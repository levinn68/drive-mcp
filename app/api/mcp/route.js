import { createClient } from "@supabase/supabase-js";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SERVER_INFO = { name: "DRIVE MCP", version: "1.3.0" };
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
const MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";
const SKILLS_REGISTRY = "https://www.skillsdirectory.com/api/registry";
const DEFAULT_APP_URL = "https://drive-mcp-five.vercel.app";
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
function getAppOrigin(request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try { return new URL(configured).origin; } catch {}
  }
  try {
    const reqOrigin = new URL(request.url).origin;
    if (reqOrigin && reqOrigin !== "null") return reqOrigin;
  } catch {}
  return DEFAULT_APP_URL;
}
function buildConnectUrl(appOrigin, { serverName, query, endpointUrl } = {}) {
  const url = new URL("/connect", appOrigin);
  if (serverName) url.searchParams.set("server", serverName);
  else if (query) url.searchParams.set("query", query);
  if (endpointUrl) url.searchParams.set("endpoint", endpointUrl);
  return url.toString();
}
function buildSkillUrl(appOrigin, query) {
  const url = new URL("/", appOrigin);
  url.searchParams.set("tab", "skills");
  if (query) url.searchParams.set("q", query);
  url.hash = "skills";
  return url.toString();
}
function pickHttpRemote(remotes) {
  if (!Array.isArray(remotes)) return null;
  const preferred = remotes.find((item) => {
    if (typeof item?.url !== "string" || !item.url.startsWith("https://")) return false;
    const kind = String(item?.type || item?.transport || "streamable_http").trim();
    return /^(streamable.?http|http)$/i.test(kind);
  });
  return preferred || remotes.find((item) => typeof item?.url === "string" && item.url.startsWith("https://")) || null;
}
function privateV4(value) {
  const p = value.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b < 127) || (a === 169 && b === 254) ||
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
    return addresses.length > 0 && addresses.every(({ address, family }) => family === 4 ? !privateV4(address) : !privateV6(address));
  } catch { return false; }
}
async function authenticate(request) {
  const appOrigin = getAppOrigin(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    const resourceMetadata = new URL("/.well-known/oauth-protected-resource/api/mcp", appOrigin).toString();
    return {
      error: response({ error: "Authentication required", message: "Authenticate with OAuth 2.1 to access DRIVE MCP." }, 401, {
        "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadata}"`
      })
    };
  }
  if (!url || !key) return { error: response({ error: "Authentication is not configured" }, 503) };
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user
    ? { error: response({ error: "Invalid or expired access token" }, 401, { "WWW-Authenticate": 'Bearer error="invalid_token"' }) }
    : { supabase, user, appOrigin };
}
async function fetchJson(url, label) {
  const upstream = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "DRIVE-MCP/1.3" },
    cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000)
  });
  if (!upstream.ok) throw new Error(`${label} returned HTTP ${upstream.status}`);
  return upstream.json();
}
function normalizeRegistryServer(entry, appOrigin) {
  const server = entry?.server || entry || {};
  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const packages = Array.isArray(server.packages) ? server.packages : [];
  const remote = pickHttpRemote(remotes);
  return {
    name: server.name || null,
    title: server.title || server.name || null,
    description: server.description || "",
    version: server.version || null,
    repository: server.repository || null,
    remotes,
    packages,
    source: entry.source_id || "official-mcp-registry",
    remote_available: Boolean(remote?.url),
    connect_url: server.name ? buildConnectUrl(appOrigin, { serverName: server.name }) : buildConnectUrl(appOrigin, { query: server.title || "" })
  };
}
function normalizeDbServer(row, appOrigin) {
  const remotes = Array.isArray(row.remotes) ? row.remotes : [];
  const packages = Array.isArray(row.packages) ? row.packages : [];
  const remote = pickHttpRemote(remotes);
  return {
    name: row.server_name || null,
    title: row.title || row.server_name || null,
    description: row.description || "",
    version: row.version || null,
    repository: row.repository_url ? { url: row.repository_url } : null,
    remotes,
    packages,
    source: row.source_id || "drive-index",
    remote_available: Boolean(remote?.url),
    connect_url: row.server_name ? buildConnectUrl(appOrigin, { serverName: row.server_name }) : buildConnectUrl(appOrigin, { query: row.title || "" })
  };
}
async function searchMcpServers(query, limit, appOrigin, supabase = null) {
  const merged = new Map();

  // 1. Fast multi-source lookup from Supabase indexed catalog (Official + Glama + GitHub + Community)
  if (supabase) {
    try {
      const safeLike = query.replace(/[%_,()]/g, " ").trim();
      if (safeLike) {
        const { data } = await supabase
          .from("mcp_servers")
          .select("server_name,title,description,version,repository_url,remotes,packages,source_id,is_latest")
          .or(`server_name.ilike.%${safeLike}%,title.ilike.%${safeLike}%,description.ilike.%${safeLike}%`)
          .order("is_latest", { ascending: false })
          .order("updated_at", { ascending: false })
          .limit(limit);
        for (const row of data || []) {
          const item = normalizeDbServer(row, appOrigin);
          if (item.name && !merged.has(item.name)) merged.set(item.name, item);
        }
      }
    } catch {}
  }

  // 2. Live Official MCP Registry merge/fallback so freshly published servers are always found
  if (merged.size < limit) {
    try {
      const url = new URL(MCP_REGISTRY);
      url.searchParams.set("search", query);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("version", "latest");
      const payload = await fetchJson(url, "Official MCP Registry");
      for (const entry of (payload.servers || [])) {
        const item = normalizeRegistryServer(entry, appOrigin);
        if (item.name && !merged.has(item.name)) merged.set(item.name, item);
        if (merged.size >= limit) break;
      }
    } catch {}
  }

  // Prioritize remote-ready servers first
  const servers = [...merged.values()]
    .sort((a, b) => Number(b.remote_available) - Number(a.remote_available))
    .slice(0, limit);

  return {
    source: "DRIVE Multi-Source MCP Marketplace",
    query,
    count: servers.length,
    servers,
    connect_fallback_url: buildConnectUrl(appOrigin, { query })
  };
}
async function getMcpServer(serverName, appOrigin, supabase = null) {
  if (supabase) {
    try {
      const { data } = await supabase
        .from("mcp_servers")
        .select("server_name,title,description,version,repository_url,remotes,packages,source_id")
        .eq("server_name", serverName)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) return { found: true, server: normalizeDbServer(data, appOrigin) };
    } catch {}
  }
  const url = new URL(MCP_REGISTRY);
  url.searchParams.set("search", serverName);
  url.searchParams.set("limit", "100");
  url.searchParams.set("version", "latest");
  const payload = await fetchJson(url, "Official MCP Registry");
  const match = (payload.servers || []).find((entry) => (entry.server || entry).name === serverName);
  if (!match) {
    return {
      found: false,
      server_name: serverName,
      connect_url: buildConnectUrl(appOrigin, { query: serverName }),
      message: "No exact server name match was found in the registry. Open connect_url in DRIVE to search or add a custom remote MCP endpoint."
    };
  }
  return { found: true, server: normalizeRegistryServer(match, appOrigin) };
}
async function searchSkills(query, limit, appOrigin, supabase = null) {
  const seen = new Set();
  const skills = [];

  // 1. Fast multi-source lookup from Supabase skill_catalog
  if (supabase) {
    try {
      const safeLike = query.replace(/[%_,()]/g, " ").trim();
      if (safeLike) {
        const { data } = await supabase
          .from("skill_catalog")
          .select("id,name,slug,category,description,author,stars,verified,tags,repository,source_url,source_id")
          .or(`name.ilike.%${safeLike}%,slug.ilike.%${safeLike}%,description.ilike.%${safeLike}%,category.ilike.%${safeLike}%`)
          .order("verified", { ascending: false })
          .order("stars", { ascending: false })
          .limit(limit);
        for (const item of data || []) {
          if (!item?.id || seen.has(item.id)) continue;
          seen.add(item.id);
          skills.push({
            name: item.name,
            slug: item.slug,
            category: item.category || "other",
            description: item.description || "",
            author: item.author || null,
            stars: Number(item.stars || 0),
            verified: Boolean(item.verified),
            tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
            source: item.source_url || `https://github.com/${item.repository}`,
            catalog_source: item.source_id || "drive-index",
            install_url: buildSkillUrl(appOrigin, item.slug || item.name)
          });
        }
      }
    } catch {}
  }

  // 2. Live Skills Directory merge/fallback
  if (skills.length < limit) {
    try {
      const url = new URL(SKILLS_REGISTRY);
      url.searchParams.set("limit", String(Math.min(100, limit * 3)));
      url.searchParams.set("offset", "0");
      url.searchParams.set("sort", "stars");
      url.searchParams.set("q", query);
      const payload = await fetchJson(url, "Skills Directory");
      const source = payload.skills || payload.data || [];
      for (const item of source) {
        const repository = item.repository || "";
        const slug = item.slug || "";
        const id = `${repository}/${slug}`;
        if (!repository || !slug || !item.name || seen.has(id)) continue;
        seen.add(id);
        skills.push({
          name: item.name,
          slug,
          category: item.category || "other",
          description: item.description || "",
          author: item.author || null,
          stars: Number(item.stars || 0),
          verified: Boolean(item.verified),
          tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
          source: `https://github.com/${repository}`,
          catalog_source: "skillsdirectory",
          install_url: buildSkillUrl(appOrigin, slug || item.name)
        });
        if (skills.length >= limit) break;
      }
    } catch {}
  }

  return {
    source: "DRIVE Multi-Source Skills Marketplace",
    query,
    count: skills.length,
    skills,
    marketplace_url: buildSkillUrl(appOrigin, query),
    note: "Send install_url to the user so they can review, scan, and enable the Skill in their DRIVE workspace."
  };
}
function safeToolName(value) {
  return String(value || "tool").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
}
function connectionToolName(connectionId, toolName) {
  return `mcp_${connectionId.replace(/-/g, "").slice(0, 12)}__${safeToolName(toolName)}`;
}
async function getUserConnections(supabase, userId, { enabledOnly = false, appOrigin = DEFAULT_APP_URL } = {}) {
  let query = supabase.from("user_mcp_connections")
    .select("id,registry_server_id,custom_server_id,enabled,updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_CONNECTIONS);
  if (enabledOnly) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error) throw new Error("Could not load MCP connections.");
  const connections = data || [];
  const registryIds = connections.map((row) => row.registry_server_id).filter(Boolean);
  const customIds = connections.map((row) => row.custom_server_id).filter(Boolean);
  const [registry, custom] = await Promise.all([
    registryIds.length ? supabase.from("mcp_servers").select("id,server_name,title,description,version,remotes").in("id", registryIds) : Promise.resolve({ data: [] }),
    customIds.length ? supabase.from("user_custom_mcp_servers").select("id,display_name,endpoint_url,status,auth_type").in("id", customIds).eq("user_id", userId) : Promise.resolve({ data: [] })
  ]);
  const rmap = new Map((registry.data || []).map((x) => [x.id, x]));
  const cmap = new Map((custom.data || []).map((x) => [x.id, x]));
  return connections.map((row) => {
    const server = row.registry_server_id ? rmap.get(row.registry_server_id) : cmap.get(row.custom_server_id);
    if (!server) return null;
    let endpoint = "";
    let authType = "none";
    let status = "active";
    if (row.registry_server_id) {
      const remote = pickHttpRemote(server.remotes || []);
      endpoint = remote?.url || "";
      authType = remote?.authentication?.required ? "oauth2" : "none";
      status = endpoint ? "ready" : "no_remote_endpoint";
    } else {
      endpoint = server.endpoint_url || "";
      authType = server.auth_type || "none";
      status = server.status || "pending";
      if (server.status !== "verified") endpoint = "";
    }
    const name = server.server_name || server.display_name || "MCP server";
    return {
      id: row.id,
      kind: row.registry_server_id ? "registry" : "custom",
      name,
      title: server.title || server.display_name || name,
      version: server.version || null,
      enabled: Boolean(row.enabled),
      endpoint,
      authType,
      status,
      active_in_gateway: Boolean(row.enabled && endpoint && authType === "none"),
      manage_url: row.registry_server_id
        ? buildConnectUrl(appOrigin, { serverName: server.server_name })
        : `${appOrigin}/#mcp`
    };
  }).filter(Boolean);
}
async function getConnectUrl(supabase, userId, args, appOrigin) {
  const serverName = typeof args.server_name === "string" ? args.server_name.trim().slice(0, 200) : "";
  const query = typeof args.query === "string" ? args.query.trim().slice(0, 120) : "";
  const endpointUrl = typeof args.endpoint_url === "string" ? args.endpoint_url.trim().slice(0, 500) : "";
  const lookupTerm = serverName || query;
  if (!lookupTerm && !endpointUrl) throw new Error("Provide server_name, query, or endpoint_url.");

  const connections = await getUserConnections(supabase, userId, { enabledOnly: false, appOrigin });
  const needle = lookupTerm.toLowerCase();
  const existing = connections.find((c) =>
    c.name.toLowerCase() === needle ||
    c.title.toLowerCase() === needle ||
    (needle.length >= 3 && (c.name.toLowerCase().includes(needle) || c.title.toLowerCase().includes(needle)))
  ) || null;

  let matchedServer = null;
  let candidates = [];
  if (lookupTerm) {
    try {
      const search = await searchMcpServers(lookupTerm, 5, appOrigin, supabase);
      candidates = search.servers;
      matchedServer = candidates.find((s) => s.name?.toLowerCase() === needle) || candidates[0] || null;
    } catch {
      candidates = [];
    }
  }

  const connectUrl = matchedServer?.name
    ? buildConnectUrl(appOrigin, { serverName: matchedServer.name, endpointUrl })
    : buildConnectUrl(appOrigin, { query: lookupTerm, endpointUrl });

  return {
    query: lookupTerm || null,
    connect_url: connectUrl,
    already_connected: Boolean(existing),
    connection_enabled: Boolean(existing?.enabled),
    existing_connection: existing,
    matched_server: matchedServer,
    candidates: candidates.slice(0, 5).map(({ name, title, description, version, remote_available, connect_url }) => ({
      name, title, description, version, remote_available, connect_url
    })),
    user_action: existing?.enabled
      ? `This MCP (${existing.title}) is already connected and enabled in DRIVE. Share ${connectUrl} if the user wants to manage or reconfigure it.`
      : `Send this clickable DRIVE MCP Gateway link directly to the user so they can connect and enable it in one click: ${connectUrl}`
  };
}
async function discoverConnectionTools(connection) {
  if (!connection.endpoint || connection.authType !== "none" || !await publicHttps(connection.endpoint)) return [];
  const client = new Client({ name: "drive-mcp-gateway", version: "1.3.0" });
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
async function buildTools(supabase, userId, appOrigin) {
  const connections = await getUserConnections(supabase, userId, { enabledOnly: true, appOrigin });
  const discovered = await Promise.all(connections.map(discoverConnectionTools));
  const gatewayTools = [
    {
      name: "drive_list_connected_mcps",
      description: "List all MCP servers connected in this user's DRIVE workspace (enabled and disabled), including their gateway status, auth requirements, and direct management URLs.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }
    },
    {
      name: "drive_get_connect_url",
      description: "Generate a direct clickable DRIVE MCP Gateway URL to connect a requested MCP server (for example 'figcraft', 'github', 'supabase') or custom remote MCP endpoint. Always call this when the user asks to connect or add an MCP, then send the returned connect_url to the user.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "MCP name or search keyword requested by the user, e.g. figcraft." },
          server_name: { type: "string", description: "Exact official registry server name if already known." },
          endpoint_url: { type: "string", description: "Optional HTTPS remote MCP endpoint URL for custom servers." }
        },
        additionalProperties: false
      }
    },
    {
      name: "drive_list_active_skills",
      description: "List the Agent Skills enabled in this DRIVE account. Call this to see all active Skills installed by the user.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }
    },
    {
      name: "drive_get_active_skill",
      description: "Read the complete instructions of one enabled and security-scanned Agent Skill. Use this when a Skill is relevant to the user's task.",
      inputSchema: { type: "object", properties: { skill_id: { type: "string", description: "Skill ID returned by drive_list_active_skills." } }, required: ["skill_id"], additionalProperties: false }
    },
    {
      name: "drive_search_mcp_servers",
      description: "Search the multi-source DRIVE MCP marketplace (Official Registry, Glama, GitHub, and community index). Each result includes a direct connect_url to connect it in DRIVE.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } }, required: ["query"], additionalProperties: false }
    },
    {
      name: "drive_get_mcp_server",
      description: "Look up an MCP server by exact registry name and get its direct DRIVE connect_url.",
      inputSchema: { type: "object", properties: { server_name: { type: "string" } }, required: ["server_name"], additionalProperties: false }
    },
    {
      name: "drive_search_skills",
      description: "Search the multi-source DRIVE Skills marketplace (Skills Directory + curated GitHub SKILL.md index). Returns matching Skills with direct install_url links to open in DRIVE.",
      inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } }, required: ["query"], additionalProperties: false }
    }
  ];
  return { tools: [...gatewayTools, ...discovered.flat()], connections };
}
async function callUpstreamTool(supabase, userId, encodedName, args, appOrigin) {
  const connections = await getUserConnections(supabase, userId, { enabledOnly: true, appOrigin });
  const match = encodedName.match(/^mcp_([a-f0-9]{12})__(.+)$/);
  if (!match) throw new Error("Unknown tool.");
  const connection = connections.find((item) => item.id.replace(/-/g, "").slice(0, 12) === match[1]);
  if (!connection || !connection.endpoint || connection.authType !== "none" || !await publicHttps(connection.endpoint)) {
    throw new Error("MCP connection is inactive or requires authentication that has not been configured.");
  }
  const client = new Client({ name: "drive-mcp-gateway", version: "1.3.0" });
  let transport;
  try {
    transport = new StreamableHTTPClientTransport(new URL(connection.endpoint), { requestInit: { signal: AbortSignal.timeout(20000) } });
    await client.connect(transport);
    const listed = await client.listTools();
    const original = listed.tools?.find((tool) => safeToolName(tool.name) === match[2]);
    if (!original) throw new Error("The original MCP tool is no longer available.");
    return await client.callTool({ name: original.name, arguments: args || {} });
  } finally { try { await client.close(); } catch {} try { await transport?.close(); } catch {} }
}
async function callTool(name, args, context) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Tool arguments must be an object.");
  if (name.startsWith("mcp_")) return callUpstreamTool(context.supabase, context.user.id, name, args, context.appOrigin);
  if (name === "drive_list_connected_mcps") {
    const connections = await getUserConnections(context.supabase, context.user.id, { enabledOnly: false, appOrigin: context.appOrigin });
    return {
      count: connections.length,
      enabled_count: connections.filter((c) => c.enabled).length,
      workspace_url: `${context.appOrigin}/#mcp`,
      connections
    };
  }
  if (name === "drive_get_connect_url") {
    return getConnectUrl(context.supabase, context.user.id, args, context.appOrigin);
  }
  if (name === "drive_list_active_skills") {
    const skills = await getActiveSkills(context.supabase, context.user.id);
    return {
      count: skills.length,
      marketplace_url: `${context.appOrigin}/?tab=skills#skills`,
      skills: skills.map(({ id, name: skillName, description, version }) => ({ id, name: skillName, description, version }))
    };
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
    return searchMcpServers(query, clampLimit(args.limit), context.appOrigin, context.supabase);
  }
  if (name === "drive_get_mcp_server") {
    const serverName = typeof args.server_name === "string" ? args.server_name.trim().slice(0, 200) : "";
    if (!serverName) throw new Error("server_name is required.");
    return getMcpServer(serverName, context.appOrigin, context.supabase);
  }
  if (name === "drive_search_skills") {
    const query = typeof args.query === "string" ? args.query.trim().slice(0, 100) : "";
    if (!query) throw new Error("query is required.");
    return searchSkills(query, clampLimit(args.limit), context.appOrigin, context.supabase);
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
    return {
      response: jsonRpc(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: true } },
        serverInfo: SERVER_INFO,
        instructions: [
          "DRIVE MCP is this user's personal MCP Gateway, Multi-Source MCP Marketplace, and Skills Hub.",
          "1. Always check drive_list_connected_mcps and drive_list_active_skills to inspect the user's installed MCPs and enabled Skills.",
          "2. When a Skill matches the user's request, call drive_get_active_skill to load its full instructions.",
          "3. When the user needs a new MCP or asks to connect one (for example: 'hubungkan mcp dengan figcraft'), call drive_get_connect_url (or drive_search_mcp_servers) and ALWAYS send the returned clickable DRIVE connect_url directly to the user so clicking it opens the DRIVE gateway to connect that MCP.",
          "4. When the user wants a new Skill, call drive_search_skills and share the returned install_url.",
          "5. Active remote MCP tools are exposed directly with the mcp_<id>__<tool> prefix."
        ].join(" ")
      })
    };
  }
  if (["notifications/initialized", "notifications/cancelled", "notifications/progress"].includes(message.method)) return { notification: true };
  if (!hasId) return { notification: true };
  if (message.method === "ping") return { response: jsonRpc(id, {}) };
  if (message.method === "tools/list") {
    try {
      const catalog = await buildTools(context.supabase, context.user.id, context.appOrigin);
      const tools = catalog.tools.map(({ _drive, ...tool }) => tool);
      return { response: jsonRpc(id, { tools }) };
    } catch (error) { return { response: jsonRpcError(id, -32603, error.message || "Could not build user tool catalog.") }; }
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    try {
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
  if (!accept.includes("application/json") && !accept.includes("text/event-stream")) {
    return response(jsonRpcError(null, -32600, "Accept must include application/json or text/event-stream."), 406);
  }
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) {
    return response(jsonRpcError(null, -32700, "Content-Type must be application/json."), 415);
  }
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
