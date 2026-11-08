import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const runtime = "nodejs";
export const maxDuration = 30;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function privateV4(value) {
  const p = value.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a,b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) || (a === 203 && b === 0);
}
function privateV6(value) {
  const v = value.toLowerCase().split("%")[0];
  if (v === "::" || v === "::1" || /^(fc|fd|fe[89ab]|ff)/.test(v) || v.startsWith("2001:db8:")) return true;
  const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? privateV4(mapped[1]) : false;
}
async function publicHttps(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    const version = isIP(host);
    if (version === 4) return !privateV4(host);
    if (version === 6) return !privateV6(host);
    const addresses = await lookup(host, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({address,family}) => family === 4 ? !privateV4(address) : !privateV6(address));
  } catch { return false; }
}

async function authenticate(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return { error: json({ error: "Authentication is not configured" }, 503) };
  if (!token) return { error: json({ error: "Sign in is required" }, 401) };
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? { error: json({ error: "Invalid session" }, 401) } : { supabase, user };
}

async function audit(supabase, userId, entry) {
  const { error } = await supabase.from("skill_tool_audit_logs").insert({
    user_id: userId,
    binding_id: entry.binding_id || null,
    approval_id: entry.approval_id || null,
    tool_name: entry.tool_name,
    action: entry.action,
    outcome: entry.outcome,
    details: entry.details || {},
  });
  return error;
}

async function resolveEndpoint(supabase, userId, connection) {
  if (connection.custom_server_id) {
    const { data: server, error } = await supabase.from("user_custom_mcp_servers")
      .select("endpoint_url,status,transport,auth_type")
      .eq("id", connection.custom_server_id).eq("user_id", userId).maybeSingle();
    if (error || !server || server.status !== "verified" || server.transport !== "streamable_http") {
      throw new Error("Custom MCP endpoint is not verified or unsupported");
    }
    if (server.auth_type !== "none") throw new Error("This MCP authentication type is not supported by the execution gateway yet");
    return server.endpoint_url;
  }
  if (connection.registry_server_id) {
    const { data: server, error } = await supabase.from("mcp_servers")
      .select("remotes").eq("id", connection.registry_server_id).maybeSingle();
    if (error || !server) throw new Error("MCP registry server was not found");
    const remotes = Array.isArray(server.remotes) ? server.remotes : [];
    const remote = remotes.find((item) => typeof item?.url === "string" && /streamable.?http/i.test(String(item?.type || item?.transport || "streamable_http")));
    if (!remote) throw new Error("This registry entry has no supported Streamable HTTP endpoint");
    return remote.url;
  }
  throw new Error("MCP connection has no endpoint");
}

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (typeof body.approvalId !== "string") return json({ error: "approvalId is required" }, 400);

  const { data: approval, error: approvalError } = await auth.supabase.from("skill_execution_approvals")
    .select("id,binding_id,tool_name,arguments,status,expires_at")
    .eq("id", body.approvalId).eq("user_id", auth.user.id).maybeSingle();
  if (approvalError || !approval) return json({ error: "Approval request was not found" }, 404);
  if (approval.status !== "approved") return json({ error: "Only approved requests can be executed" }, 409);
  if (new Date(approval.expires_at).getTime() <= Date.now()) {
    await auth.supabase.from("skill_execution_approvals").update({ status: "expired" })
      .eq("id", approval.id).eq("user_id", auth.user.id).eq("status", "approved");
    await audit(auth.supabase, auth.user.id, { binding_id: approval.binding_id, approval_id: approval.id, tool_name: approval.tool_name, action: "expire", outcome: "denied", details: { reason: "approval_timeout" } });
    return json({ error: "Approval has expired. Submit a new request." }, 410);
  }

  const { data: binding, error: bindingError } = await auth.supabase.from("mcp_skill_bindings")
    .select("id,skill_id,connection_id,allowed_tools,enabled")
    .eq("id", approval.binding_id).eq("user_id", auth.user.id).maybeSingle();
  if (bindingError || !binding) return json({ error: "Skill binding was not found" }, 404);
  if (!binding.enabled || !(binding.allowed_tools || []).includes(approval.tool_name)) {
    await audit(auth.supabase, auth.user.id, { binding_id: binding.id, approval_id: approval.id, tool_name: approval.tool_name, action: "blocked", outcome: "blocked", details: { reason: "binding_disabled_or_tool_not_allowlisted" } });
    return json({ error: "Skill binding is disabled or this tool is no longer allowlisted" }, 403);
  }

  const { data: skill, error: skillError } = await auth.supabase.from("user_skills")
    .select("id,status,skill_md,security_scan_status,security_scan_hash,security_bundle_hash,security_bundle_manifest").eq("id", binding.skill_id).eq("user_id", auth.user.id).maybeSingle();
  if (skillError || !skill || skill.status !== "enabled") return json({ error: "Skill is not enabled" }, 403);
  const currentHash = createHash("sha256").update(skill.skill_md || "").digest("hex");
  if (skill.security_scan_status !== "safe" || !skill.security_scan_hash || currentHash !== skill.security_scan_hash || !skill.security_bundle_hash || !Array.isArray(skill.security_bundle_manifest) || skill.security_bundle_manifest.length < 1) {
    return json({ error: "Skill security scan is missing, stale, or not SAFE. Execution blocked." }, 403);
  }

  const { data: connection, error: connectionError } = await auth.supabase.from("user_mcp_connections")
    .select("id,registry_server_id,custom_server_id,enabled")
    .eq("id", binding.connection_id).eq("user_id", auth.user.id).maybeSingle();
  if (connectionError || !connection) return json({ error: "MCP connection was not found" }, 404);
  if (!connection.enabled) return json({ error: "MCP connection is disabled" }, 403);

  let endpoint;
  try {
    endpoint = await resolveEndpoint(auth.supabase, auth.user.id, connection);
  } catch (error) {
    return json({ error: String(error?.message || "Could not resolve MCP endpoint") }, 409);
  }
  if (!await publicHttps(endpoint)) return json({ error: "MCP endpoint must use a public HTTPS host. Private and unresolved hosts are blocked." }, 400);

  // Atomically consume the approval before making a remote call. A retry cannot execute it twice.
  const { data: consumed, error: consumeError } = await auth.supabase.from("skill_execution_approvals")
    .update({ status: "consumed", executed_at: new Date().toISOString() })
    .eq("id", approval.id).eq("user_id", auth.user.id).eq("status", "approved")
    .gt("expires_at", new Date().toISOString())
    .select("id").maybeSingle();
  if (consumeError || !consumed) return json({ error: "Approval was already consumed, changed, or expired. Create a new request." }, 409);

  await audit(auth.supabase, auth.user.id, { binding_id: binding.id, approval_id: approval.id, tool_name: approval.tool_name, action: "execute", outcome: "allowed", details: { phase: "started" } });

  const client = new Client({ name: "drive-skill-execution-gateway", version: "0.1.0" });
  let transport;
  try {
    transport = new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: { signal: AbortSignal.timeout(20000) },
    });
    await client.connect(transport);
    const listed = await client.listTools();
    const tool = (listed.tools || []).find((item) => item.name === approval.tool_name);
    if (!tool) throw new Error("The approved tool is no longer exposed by this MCP server");
    const result = await client.callTool({
      name: approval.tool_name,
      arguments: approval.arguments || {},
    }, undefined, { timeout: 18000, resetTimeoutOnProgress: false });

    const summary = JSON.stringify({
      isError: Boolean(result?.isError),
      contentTypes: (result?.content || []).map((item) => item.type).slice(0, 12),
      structuredContent: result?.structuredContent ? "present" : "absent",
    }).slice(0, 1200);
    const action = result?.isError ? "failure" : "success";
    const outcome = result?.isError ? "failure" : "success";
    await auth.supabase.from("skill_execution_approvals").update({
      result_summary: summary,
    }).eq("id", approval.id).eq("user_id", auth.user.id);
    await audit(auth.supabase, auth.user.id, { binding_id: binding.id, approval_id: approval.id, tool_name: approval.tool_name, action, outcome, details: { isError: Boolean(result?.isError), summary } });
    return json({ executed: !result?.isError, approvalId: approval.id, result });
  } catch (error) {
    const message = String(error?.message || "MCP tool execution failed").slice(0, 500);
    await auth.supabase.from("skill_execution_approvals").update({ result_summary: message })
      .eq("id", approval.id).eq("user_id", auth.user.id);
    await audit(auth.supabase, auth.user.id, { binding_id: binding.id, approval_id: approval.id, tool_name: approval.tool_name, action: "failure", outcome: "failure", details: { error: message } });
    return json({ error: "MCP tool execution failed", detail: message, approvalId: approval.id }, 502);
  } finally {
    try { await client.close(); } catch {}
    try { await transport?.close(); } catch {}
  }
}
