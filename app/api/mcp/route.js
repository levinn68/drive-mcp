import { createClient } from "@supabase/supabase-js";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SERVER_INFO = { name: "DRIVE MCP", version: "1.1.0" };
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
const MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";
const SKILLS_REGISTRY = "https://www.skillsdirectory.com/api/registry";
const MAX_CONNECTIONS = 20;
const MAX_TOOLS_PER_CONNECTION = 100;

function jsonRpc(id, result) { return { jsonrpc: "2.0", id, result }; }
function jsonRpcError(id, code, message) { return { jsonrpc: "2.0", id: id ?? null, error: { code, message } }; }
function response(body, status = 200, headers = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...headers }
  });
}
function textResult(value) { return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] }; }
function clampLimit(value) {
  const parsed = Number(value ?? 10);
  return Number.isInteger(parsed) ? Math.min(30, Math.max(1, parsed)) : 10;
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
  if (!token) return { anonymous: true, user: null, supabase: null };
  if (!url || !key) return { error: response({ error: "Authentication is not configured" }, 503) };
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? { error: response({ error: "Invalid or expired access token" }, 401, { "WWW-Authenticate": 'Bearer error="invalid_token"' }) } : { supabase, user };
}
async function fetchJson(url, label) {
  const upstream = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "DRIVE-MCP/1.1" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000)
  });
  if (!upstream.ok) throw new Error(`${label} returned HTTP ${upstream.status}`);
  return upstream.json();
}
async function searchMcpServers(query, limit) {
  const url = new URL(MCP_REGISTRY);
  url.searchParams.set("search", query); url.searchParams.set("limit", String(limit)); url.searchParams.set("version", "latest");
  const payload = await fetchJson(url, "Official MCP Registry");
  const servers = (payload.servers || []).slice(0, limit).map((entry) => {
    const server = entry.server || entry;
    return { name: server.name || null, title: server.title || null, description: server.description || "", version: server.version || null, repository: server.repository || null, remotes: Array.isArray(server.remotes) ? server.remotes : [], packages: Array.isArray(server.packages) ? server.packages : [] };
  });
  return { source: "Official MCP Registry", query, count: servers.length, servers };
}
async function getMcpServer(serverName) {
  const url = new URL(MCP_REGISTRY);
  url.searchParams.set("search", serverName); url.searchParams.set("limit", "100"); url.searchParams.set("version", "latest");
  const payload = await fetchJson(url, "Official MCP Registry");
  const match = (payload.servers || []).find((entry) => (entry.server || entry).name === serverName);
  if (!match) return { found: false, server_name: serverName, message: "No exact server name match was found in the official registry." };
  const server = match.server || match;
  return { found: true, server: { name: server.name || null, title: server.title || null, description: server.description || "", version: server.version || null, repository: server.repository || null, remotes: Array.isArray(server.remotes) ? server.remotes : [], packages: Array.isArray(server.packages) ? server.packages : [] } };
}
async function searchSkills(query, limit) {
  const url = new URL(SKILLS_REGISTRY);
  url.searchParams.set("limit", String(Math.min(100, limit * 3))); url.searchParams.set("offset", "0"); url.searchParams.set("sort", "stars"); url.searchParams.set("q", query);
  const payload = await fetchJson(url, "Skills Directory");
  const source = payload.skills || payload.data || [];
  const seen = new Set(); const skills = [];
  for (const item of source) {
    const repository = item.repository || ""; const slug = item.slug || ""; const id = `${repository}/${slug}`;
    if (!repository || !slug || !item.name || seen.has(id)) continue;
    seen.add(id);
    skills.push({ name: item.name, slug, category: item.category || "other", description: item.description || "", author: item.author || null, stars: Number(item.stars || 0), verified: Boolean(item.verified), tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [], source: `https://github.com/${repository}` });
    if (skills.length >= limit) break;
  }
  return { source: "Skills Directory public registry", query, count: skills.length, skills, note: "Catalog discovery only. Skills are not installed, security-approved or executed by this tool." };
}
function safeToolName(value) {
  return String(value || "tool").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}
function connectionToolName(connectionId, toolName) {
  return `mcp_${connectionId.replace(/-/g, "").slice(0, 12)}__${safeToolName(toolName)}`;
}
async function getActiveConnections(supabase, userId) {
  const { data, error } = await supabase.from("user_mcp_connections")
    .select("id,registry_server_id,custom_server_id,enabled")
    .eq("user_id", userId).eq("enabled", true).limit(MAX_CONNECTIONS);
  if (error) throw new Error("Could not load active MCP connections.");
  const connections = data || [];
  const registryIds = connections.map((row) => row.registry_server_id).filter(Boolean);
  const customIds = connections.map((row) => row.custom_server_id).filter(Boolean);
  const [registry, custom] = await Promise.all([
    registryIds.length ? supabase.from("mcp_servers").select("id,server_name,title,description,remotes").in("id", registryIds) : Promise.resolve({ data: [] }),
    customIds.length ? supabase.from("user_custom_mcp_servers").select("id,display_name,endpoint_url,status,auth_type").in("id", customIds).eq("user_id", userId) : Promise.resolve({ data: [] })
  ]);
  const rmap = new Map((registry.data || []).map((x) => [x.id, x]));
  const cmap = new Map((custom.data || []).map((x) => [x.id, x]));
  return connections.map((row) => {
    const server = row.registry_server_id ? rmap.get(row.registry_server_id) : cmap.get(row.custom_server_id);
    if (!server) return null;
    let endpoint = "";
    let authType = "none";
    if (row.registry_server_id) {
      const remote = (server.remotes || []).find((item) => typeof item?.url === "string" && /streamable.?http/i.test(String(item?.type || item?.transport || "streamable_http")));
      endpoint = remote?.url || "";
      authType = remote?.authentication?.required ? "oauth2" : "none";
    } else {
      endpoint = server.endpoint_url || "";
      authType = server.auth_type || "none";
      if (server.status !== "verified") endpoint = "";
    }
    return { id: row.id, name: server.server_name || server.display_name || "MCP server", endpoint, authType };
  }).filter(Boolean);
}
async function discoverConnectionTools(connection) {
  if (!connection.endpoint || connection.authType !== "none" || !await publicHttps(connection.endpoint)) return [];
  const client = new Client({ name: "drive-mcp-gateway", version: "1.1.0" });
  let transport;
  try {
    transport = new StreamableHTTPClientTransport(new URL(connection.endpoint), { requestInit: { signal: AbortSignal.timeout(10000) } });
    await client.connect(transport);
    const result = await client.listTools();
    return (result.tools || []).slice(0, MAX_TOOLS_PER_CONNECTION).map((tool) => ({
      name: connectionToolName(connection.id, tool.name),
      description: `[${connection.name}] ${String(tool.description || tool.name).slice(0, 1000)}`,
      inputSchema: tool.inputSchema || { type: "object", properties: {} },
      _drive: { connectionId: connection.id, originalToolName: tool.name }
    }));
  } catch { return []; }
  finally { try { await client.close(); } catch {} try { await transport?.close(); } catch {} }
}
async function getActiveSkills(supabase, userId) {
  const { data, error } = await supabase.from("user_skills")
    .select("id,name,description,skill_md,version,security_scan_status,status")
    .eq("user_id", userId).eq("status", "enabled").eq("security_scan_status", "safe").limit(100);
  if (error) throw new Error("Could not load active Skills.");
  return data || [];
}
async function buildTools(supabase, userId) {
  const connections = await getActiveConnections(supabase, userId);
  const discovered = await Promise.all(connections.map(discoverConnectionTools));
  const skills = await getActiveSkills(supabase, userId);
  const skillTools = [
    { name: "drive_list_active_skills", description: "List the Agent Skills enabled in this DRIVE account. Call this to discover the user's active Skills.", inputSchema: { type: "object", properties: {}, additionalProperties: false } },
    { name: "drive_get_active_skill", description: "Read the complete instructions of one enabled and security-scanned Agent Skill. Use this when a Skill is relevant to the user's task.", inputSchema: { type: "object", properties: { skill_id: { type: "string", description: "Skill ID returned by drive_list_active_skills." } }, required: ["skill_id"], additionalProperties: false } }
  ];
  const publicTools = [
    { name: "drive_search_mcp_servers", description: "Search the public DRIVE MCP directory.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } }, required: ["query"], additionalProperties: false } },
    { name: "drive_get_mcp_server", description: "Look up a public MCP server by exact registry name.", inputSchema: { type: "object", properties: { server_name: { type: "string" } }, required: ["server_name"], additionalProperties: false } },
    { name: "drive_search_skills", description: "Search the public DRIVE Skills catalog. Does not install or execute Skills.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } }, required: ["query"], additionalProperties: false } }
  ];
  return { tools: [...publicTools, ...skillTools, ...discovered.flat()], connections, skills };
}
async function callUpstreamTool(supabase, userId, encodedName, args) {
  const connections = await getActiveConnections(supabase, userId);
  const skills = await getActiveSkills(supabase, userId);
  const match = encodedName.match(/^mcp_([a-f0-9]{12})__(.+)$/);
  if (!match) throw new Error("Unknown tool.");
  const connection = connections.find((item) => item.id.replace(/-/g, "").slice(0, 12) === match[1]);
  if (!connection || !connection.endpoint || connection.authType !== "none" || !await publicHttps(connection.endpoint)) throw new Error("MCP connection is inactive or requires authentication that has not been configured.");
  const client = new Client({ name: "drive-mcp-gateway", version: "1.1.0" });
  let transport;
  try {
    transport = new StreamableHTTPClientTransport(new URL(connection.endpoint), { requestInit: { signal: AbortSignal.timeout(20000) } });
    await client.connect(transport);
    const listed = await client.listTools();
    const original = listed.tools?.find((tool) => safeToolName(tool.name) === match[2]);
    if (!original) throw new Error("The original MCP tool is no longer available.");
    const result = await client.callTool({ name: original.name, arguments: args || {} });
    return result;
  } finally { try { await client.close(); } catch {} try { await transport?.close(); } catch {} }
}
async function callTool(name, args, context) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Tool arguments must be an object.");
  if (name.startsWith("mcp_")) return callUpstreamTool(context.supabase, context.user.id, name, args);
  if (name === "drive_list_active_skills") {
    const skills = await getActiveSkills(context.supabase, context.user.id);
    return { count: skills.length, skills: skills.map(({id,name,description,version}) => ({id,name,description,version})) };
  }
  if (name === "drive_get_active_skill") {
    const id = typeof args.skill_id === "string" ? args.skill_id : "";
    const skills = await getActiveSkills(context.supabase, context.user.id);
    const skill = skills.find((item) => item.id === id);
    if (!skill) throw new Error("Skill not found, disabled, or not security-approved.");
    return { id: skill.id, name: skill.name, description: skill.description, version: skill.version, instructions: skill.skill_md };
  }
  if (name === "drive_search_mcp_servers") {
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 100) : "";
    if (!query) throw new Error("query is required.");
    return searchMcpServers(query, clampLimit(args.limit));
  }
  if (name === "drive_get_mcp_server") {
    const serverName = typeof args.server_name === "string" ? args.server_name.trim().slice(0, 200) : "";
    if (!serverName) throw new Error("server_name is required.");
    return getMcpServer(serverName);
  }
  if (name === "drive_search_skills") {
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 100) : "";
    if (!query) throw new Error("query is required.");
    return searchSkills(query, clampLimit(args.limit));
  }
  throw new Error(`Unknown tool: ${name}`);
}
async function handleMessage(message, context) {
  if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return { response: jsonRpcError(message?.id, -32600, "Invalid JSON-RPC request.") };
  }
  const hasId = Object.prototype.hasOwnProperty.call(message, "id");
  const id = message.id;
  if (message.method === "initialize") {
    if (!hasId) return { response: jsonRpcError(null, -32600, "initialize must be a request with an id.") };
    const requested = message.params?.protocolVersion;
    const protocolVersion = PROTOCOL_VERSIONS.includes(requested) ? requested : "2025-03-26";
    return { response: jsonRpc(id, { protocolVersion, capabilities: { tools: { listChanged: true } }, serverInfo: SERVER_INFO, instructions: "DRIVE exposes the active MCP connections and enabled, security-approved Agent Skills belonging to the authenticated DRIVE user. Call drive_list_active_skills and drive_get_active_skill to load relevant Skill instructions. MCP tools are proxied to their original servers without rewriting their schemas or permission model. Servers requiring upstream credentials are not exposed until the user configures their credentials in DRIVE." }) };
  }
  if (["notifications/initialized","notifications/cancelled","notifications/progress"].includes(message.method)) return { notification: true };
  if (!hasId) return { notification: true };
  if (message.method === "ping") return { response: jsonRpc(id, {}) };
  if (message.method === "tools/list") {
    if (context.anonymous) {
      return { response: jsonRpc(id, { tools: [
        { name: "drive_search_mcp_servers", description: "Search the public MCP server directory. This tool only reads public registry data.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } }, required: ["query"], additionalProperties: false } },
        { name: "drive_get_mcp_server", description: "Look up a public MCP server by exact registry name. This tool only reads public registry data.", inputSchema: { type: "object", properties: { server_name: { type: "string" } }, required: ["server_name"], additionalProperties: false } },
        { name: "drive_search_skills", description: "Search the public Agent Skills catalog. This tool does not install or execute Skills.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } }, required: ["query"], additionalProperties: false } }
      ] }) };
    }
    try {
      const catalog = await buildTools(context.supabase, context.user.id);
      const tools = catalog.tools.map(({_drive,...tool}) => tool);
      return { response: jsonRpc(id, { tools }) };
    } catch (error) { return { response: jsonRpcError(id, -32603, error.message || "Could not build user tool catalog.") }; }
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    try {
      const publicToolNames = ["drive_search_mcp_servers", "drive_get_mcp_server", "drive_search_skills"];
      if (context.anonymous && !publicToolNames.includes(name)) {
        throw new Error("This tool requires a signed-in DRIVE account. Connect with OAuth to access personal MCP connections and Skills.");
      }
      const result = await callTool(name, message.params?.arguments || {}, context);
      return { response: jsonRpc(id, result && result.content ? result : textResult(result)) };
    } catch (error) {
      return { response: jsonRpc(id, { content: [{ type: "text", text: String(error?.message || "Tool execution failed.").slice(0, 1000) }], isError: true }) };
    }
  }
  return { response: jsonRpcError(id, -32601, `Method not found: ${message.method}`) };
}
export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  const accept = request.headers.get("accept") || "";
  if (!accept.includes("application/json") && !accept.includes("text/event-stream")) return response(jsonRpcError(null, -32600, "Accept must include application/json or text/event-stream."), 406);
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return response(jsonRpcError(null, -32700, "Content-Type must be application/json."), 415);
  let raw;
  try {
    const body = await request.text();
    if (body.length > 65536) return response(jsonRpcError(null, -32600, "Request body exceeds 64 KB."), 413);
    raw = JSON.parse(body);
  } catch { return response(jsonRpcError(null, -32700, "Request body must be valid JSON."), 400); }
  if (Array.isArray(raw)) return response(jsonRpcError(null, -32600, "JSON-RPC batch requests are not supported."), 400);
  const handled = await handleMessage(raw, auth);
  if (handled.notification) return response(null, 202);
  const version = PROTOCOL_VERSIONS.includes(raw?.params?.protocolVersion) ? raw.params.protocolVersion : "2025-03-26";
  return response(handled.response, 200, { "MCP-Protocol-Version": version });
}
export async function GET() {
  return response({ error: "MCP Streamable HTTP GET/SSE is not enabled. Send JSON-RPC requests with POST." }, 405, { Allow: "POST" });
}
export async function DELETE() {
  return response({ error: "This stateless MCP endpoint does not create sessions." }, 405, { Allow: "POST" });
}
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version" } });
}
