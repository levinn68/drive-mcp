import { createClient } from "@supabase/supabase-js";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const runtime = "nodejs";
export const maxDuration = 30;
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

function blockedV4(ip) {
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a,b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) || (a === 198 && (b === 18 || b === 19)) || (a === 203 && b === 0);
}
function blockedV6(ip) {
  const v = ip.toLowerCase().split("%")[0];
  if (v === "::" || v === "::1" || /^(fc|fd|fe[89ab]|ff)/.test(v) || v.startsWith("2001:db8:")) return true;
  const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? blockedV4(mapped[1]) : false;
}
async function safeEndpoint(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    const family = isIP(host);
    if (family === 4) return !blockedV4(host);
    if (family === 6) return !blockedV6(host);
    const addresses = await lookup(host, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address, family: f }) => f === 4 ? !blockedV4(address) : !blockedV6(address));
  } catch { return false; }
}
async function authenticate(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return { error: json({ error: "Authentication is not configured" }, 503) };
  if (!token) return { error: json({ error: "Sign in is required" }, 401) };
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? { error: json({ error: "Invalid session" }, 401) } : { supabase, user };
}
async function endpointFor(supabase, userId, connection) {
  if (connection.custom_server_id) {
    const { data: server, error } = await supabase.from("user_custom_mcp_servers").select("endpoint_url,status,transport,auth_type")
      .eq("id", connection.custom_server_id).eq("user_id", userId).maybeSingle();
    if (error || !server || server.status !== "verified" || server.transport !== "streamable_http") throw new Error("Custom MCP endpoint is not verified or supported");
    if (server.auth_type !== "none") throw new Error("MCP authentication is not configured for this runtime");
    return server.endpoint_url;
  }
  if (connection.registry_server_id) {
    const { data: server, error } = await supabase.from("mcp_servers").select("remotes").eq("id", connection.registry_server_id).maybeSingle();
    if (error || !server) throw new Error("MCP registry record was not found");
    const remote = (Array.isArray(server.remotes) ? server.remotes : []).find((item) =>
      typeof item?.url === "string" && /streamable.?http/i.test(String(item?.type || item?.transport || "streamable_http")));
    if (!remote) throw new Error("This registry record has no Streamable HTTP endpoint");
    return remote.url;
  }
  throw new Error("MCP connection has no endpoint");
}

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (typeof body.skillId !== "string" || typeof body.task !== "string" || !body.task.trim() || body.task.length > 4000) {
    return json({ error: "Provide skillId and a task between 1 and 4000 characters" }, 400);
  }
  const { data: skill, error: skillError } = await auth.supabase.from("user_skills")
    .select("id,name,description,skill_md,status,version").eq("id", body.skillId).eq("user_id", auth.user.id).maybeSingle();
  if (skillError || !skill) return json({ error: "Skill was not found" }, 404);
  if (skill.status !== "enabled") return json({ error: "Review and approve this Skill before preparing a runtime" }, 403);
  if (!skill.skill_md || skill.skill_md.length > 30000) return json({ error: "Skill instructions are empty or exceed the 30 KB runtime limit" }, 400);

  const { data: bindings, error: bindingError } = await auth.supabase.from("mcp_skill_bindings")
    .select("id,connection_id,allowed_tools,enabled").eq("user_id", auth.user.id).eq("skill_id", skill.id).eq("enabled", true);
  if (bindingError) return json({ error: "Could not load Skill bindings" }, 400);
  if (!bindings?.length) return json({ error: "This Skill has no enabled MCP bindings" }, 409);
  const connectionIds = [...new Set(bindings.map((item) => item.connection_id))];
  const { data: connections, error: connectionError } = await auth.supabase.from("user_mcp_connections")
    .select("id,registry_server_id,custom_server_id,enabled").eq("user_id", auth.user.id).in("id", connectionIds).eq("enabled", true);
  if (connectionError) return json({ error: "Could not load active MCP connections" }, 400);
  const connectionMap = new Map((connections || []).map((item) => [item.id, item]));
  const sources = [];

  for (const binding of bindings) {
    const connection = connectionMap.get(binding.connection_id);
    if (!connection) continue;
    let endpoint;
    try { endpoint = await endpointFor(auth.supabase, auth.user.id, connection); }
    catch (error) { sources.push({ bindingId: binding.id, unavailable: String(error?.message || "Endpoint unavailable") }); continue; }
    if (!await safeEndpoint(endpoint)) { sources.push({ bindingId: binding.id, unavailable: "Endpoint blocked by HTTPS/public-host validation" }); continue; }
    const client = new Client({ name: "drive-skill-runtime-context", version: "0.1.0" });
    let transport;
    try {
      transport = new StreamableHTTPClientTransport(new URL(endpoint), { requestInit: { signal: AbortSignal.timeout(10000) } });
      await client.connect(transport);
      const result = await client.listTools();
      const available = result.tools || [];
      const allowed = new Set(binding.allowed_tools || []);
      const tools = available.filter((tool) => allowed.has(tool.name)).slice(0, 100).map((tool) => ({
        name: tool.name, description: String(tool.description || "").slice(0, 1000),
        inputSchema: tool.inputSchema || { type: "object", properties: {} },
      }));
      sources.push({
        bindingId: binding.id, connectionId: connection.id, requiresApproval: true, tools,
        totalDiscovered: available.length,
        allowedToolsUnavailable: [...allowed].filter((name) => !available.some((tool) => tool.name === name)),
      });
    } catch (error) {
      sources.push({ bindingId: binding.id, unavailable: String(error?.message || "MCP discovery failed").slice(0, 300) });
    } finally {
      try { await client.close(); } catch {}
      try { await transport?.close(); } catch {}
    }
  }
  const usableTools = sources.reduce((count, item) => count + (item.tools?.length || 0), 0);
  if (!usableTools) return json({ error: "No allowlisted tools are currently available from enabled MCP connections", sources }, 409);
  return json({
    runtime: "prepared_context_only", executable: false,
    skill: { id: skill.id, name: skill.name, description: skill.description, version: skill.version },
    task: body.task.trim(), skillInstructions: skill.skill_md,
    instructionTrust: "untrusted_user_supplied_skill_content",
    policy: { toolsLimitedToBindingAllowlists: true, approvalRequiredForEveryToolCall: true, secretsExposedToSkill: false, skillCannotOverridePlatformOrUserPolicies: true, executionAvailableInThisRequest: false },
    sources, preparedAt: new Date().toISOString(),
  });
}
