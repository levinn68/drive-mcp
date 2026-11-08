import { createClient } from "@supabase/supabase-js";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const runtime = "nodejs";

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
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? { error: json({ error: "Invalid session" }, 401) } : { supabase, user };
}

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (typeof body.connectionId !== "string") return json({ error: "connectionId is required" }, 400);

  const { data: connection, error: connectionError } = await auth.supabase
    .from("user_mcp_connections")
    .select("id,registry_server_id,custom_server_id")
    .eq("id", body.connectionId)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (connectionError || !connection) return json({ error: "MCP connection was not found" }, 404);

  let endpoint = "";
  if (connection.custom_server_id) {
    const { data: server } = await auth.supabase.from("user_custom_mcp_servers")
      .select("endpoint_url,status,transport,auth_type")
      .eq("id", connection.custom_server_id).eq("user_id", auth.user.id).maybeSingle();
    if (!server || server.status !== "verified" || server.transport !== "streamable_http") {
      return json({ error: "Only verified Streamable HTTP custom endpoints can be inspected" }, 409);
    }
    if (server.auth_type !== "none") return json({ error: "Authenticated MCP discovery is not enabled yet. Configure a secure credential provider first." }, 409);
    endpoint = server.endpoint_url;
  } else if (connection.registry_server_id) {
    const { data: server } = await auth.supabase.from("mcp_servers").select("remotes")
      .eq("id", connection.registry_server_id).maybeSingle();
    const remotes = Array.isArray(server?.remotes) ? server.remotes : [];
    const remote = remotes.find((item) => typeof item?.url === "string" && /streamable.?http/i.test(String(item?.type || item?.transport || "streamable_http")));
    if (!remote) return json({ error: "This registry record does not contain a supported remote Streamable HTTP endpoint." }, 409);
    endpoint = remote.url;
  } else {
    return json({ error: "Connection has no supported remote endpoint" }, 409);
  }

  if (!await publicHttps(endpoint)) return json({ error: "MCP endpoint must use a public HTTPS host. Local, private, and unresolved hosts are blocked." }, 400);

  const client = new Client({ name: "drive-skill-tool-discovery", version: "0.1.0" });
  let transport;
  try {
    transport = new StreamableHTTPClientTransport(new URL(endpoint), {
      requestInit: { signal: AbortSignal.timeout(12000) },
    });
    await client.connect(transport);
    const result = await client.listTools();
    const tools = (result.tools || []).slice(0, 200).map((tool) => ({
      name: tool.name,
      description: (tool.description || "").slice(0, 1200),
      inputSchema: tool.inputSchema || { type: "object", properties: {} },
      annotations: tool.annotations || null,
    }));
    return json({
      connectionId: connection.id,
      serverInfo: client.getServerVersion?.() || null,
      protocolVersion: client.getProtocolVersion?.() || null,
      tools,
      total: result.tools?.length || 0,
      truncated: (result.tools?.length || 0) > tools.length,
      discoveredAt: new Date().toISOString(),
    });
  } catch (error) {
    return json({ error: "MCP handshake or tools/list failed", detail: String(error?.message || "Unknown MCP error").slice(0, 500) }, 502);
  } finally {
    try { await client.close(); } catch {}
    try { await transport?.close(); } catch {}
  }
}
