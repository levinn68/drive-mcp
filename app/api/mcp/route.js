import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = { name: "DRIVE MCP", version: "1.0.0" };
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
const MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";
const SKILLS_REGISTRY = "https://www.skillsdirectory.com/api/registry";

const TOOLS = [
  {
    name: "drive_search_mcp_servers",
    description: "Search the public DRIVE MCP directory backed by the official Model Context Protocol Registry. Returns server names, descriptions, versions, transports and source links. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search terms, for example github, filesystem, database." },
        limit: { type: "integer", minimum: 1, maximum: 30, default: 10, description: "Maximum number of results." }
      },
      required: ["query"],
      additionalProperties: false
    }
  },
  {
    name: "drive_get_mcp_server",
    description: "Look up a public MCP server by its exact registry name. Returns the latest matching registry entry and available remote endpoints. Read-only.",
    inputSchema: {
      type: "object",
      properties: {
        server_name: { type: "string", description: "Exact registry server name, such as io.github/user/repo." }
      },
      required: ["server_name"],
      additionalProperties: false
    }
  },
  {
    name: "drive_search_skills",
    description: "Search the public DRIVE Skills catalog. Returns Skill name, slug, category, description, GitHub source and tags. This does not install, approve or execute a Skill.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search terms for an Agent Skill." },
        limit: { type: "integer", minimum: 1, maximum: 30, default: 10, description: "Maximum number of results." }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
];

function jsonRpc(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function response(body, status = 200, extraHeaders = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

function textResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}

function clampLimit(value) {
  const parsed = Number(value ?? 10);
  return Number.isInteger(parsed) ? Math.min(30, Math.max(1, parsed)) : 10;
}

async function fetchJson(url, label) {
  const upstream = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "DRIVE-MCP/1.0" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12000)
  });
  if (!upstream.ok) throw new Error(`${label} returned HTTP ${upstream.status}`);
  return upstream.json();
}

async function searchMcpServers(query, limit) {
  const url = new URL(MCP_REGISTRY);
  url.searchParams.set("search", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("version", "latest");
  const payload = await fetchJson(url, "Official MCP Registry");
  const servers = (payload.servers || []).slice(0, limit).map((entry) => {
    const server = entry.server || entry;
    return {
      name: server.name || null,
      title: server.title || null,
      description: server.description || "",
      version: server.version || null,
      repository: server.repository || null,
      remotes: Array.isArray(server.remotes) ? server.remotes : [],
      packages: Array.isArray(server.packages) ? server.packages : []
    };
  });
  return { source: "Official MCP Registry", query, count: servers.length, servers };
}

async function getMcpServer(serverName) {
  const url = new URL(MCP_REGISTRY);
  url.searchParams.set("search", serverName);
  url.searchParams.set("limit", "100");
  url.searchParams.set("version", "latest");
  const payload = await fetchJson(url, "Official MCP Registry");
  const entries = payload.servers || [];
  const match = entries.find((entry) => (entry.server || entry).name === serverName);
  if (!match) return { found: false, server_name: serverName, message: "No exact server name match was found in the official registry." };
  const server = match.server || match;
  return {
    found: true,
    server: {
      name: server.name || null,
      title: server.title || null,
      description: server.description || "",
      version: server.version || null,
      repository: server.repository || null,
      remotes: Array.isArray(server.remotes) ? server.remotes : [],
      packages: Array.isArray(server.packages) ? server.packages : []
    }
  };
}

async function searchSkills(query, limit) {
  const url = new URL(SKILLS_REGISTRY);
  url.searchParams.set("limit", String(Math.min(100, limit * 3)));
  url.searchParams.set("offset", "0");
  url.searchParams.set("sort", "stars");
  url.searchParams.set("q", query);
  const payload = await fetchJson(url, "Skills Directory");
  const source = payload.skills || payload.data || [];
  const seen = new Set();
  const skills = [];
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
      source: `https://github.com/${repository}`
    });
    if (skills.length >= limit) break;
  }
  return { source: "Skills Directory public registry", query, count: skills.length, skills, note: "Catalog discovery only. Skills are not installed, security-approved or executed by this tool." };
}

async function callTool(name, args) {
  if (!args || typeof args !== "object" || Array.isArray(args)) throw new Error("Tool arguments must be an object.");
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

async function handleMessage(message) {
  if (!message || typeof message !== "object" || Array.isArray(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return { response: jsonRpcError(message?.id, -32600, "Invalid JSON-RPC request.") };
  }
  const hasId = Object.prototype.hasOwnProperty.call(message, "id");
  const id = message.id;

  if (message.method === "initialize") {
    if (!hasId) return { response: jsonRpcError(null, -32600, "initialize must be a request with an id.") };
    const requested = message.params?.protocolVersion;
    const protocolVersion = PROTOCOL_VERSIONS.includes(requested) ? requested : "2025-03-26";
    return { response: jsonRpc(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: "DRIVE provides read-only discovery of public MCP servers and public Agent Skills. It cannot access private account connections, install Skills, approve Skills, or execute remote tools."
    }) };
  }

  if (message.method === "notifications/initialized" || message.method === "notifications/cancelled" || message.method === "notifications/progress") {
    return { notification: true };
  }

  if (!hasId) return { notification: true };

  if (message.method === "ping") return { response: jsonRpc(id, {}) };
  if (message.method === "tools/list") return { response: jsonRpc(id, { tools: TOOLS }) };

  if (message.method === "tools/call") {
    const name = message.params?.name;
    try {
      const result = await callTool(name, message.params?.arguments || {});
      return { response: jsonRpc(id, result && result.content ? result : textResult(result)) };
    } catch (error) {
      return { response: jsonRpc(id, { content: [{ type: "text", text: String(error?.message || "Tool execution failed.") }], isError: true }) };
    }
  }

  return { response: jsonRpcError(id, -32601, `Method not found: ${message.method}`) };
}

export async function POST(request) {
  const accept = request.headers.get("accept") || "";
  if (!accept.includes("application/json") && !accept.includes("text/event-stream")) {
    return response(jsonRpcError(null, -32600, "Accept must include application/json or text/event-stream."), 406);
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return response(jsonRpcError(null, -32700, "Content-Type must be application/json."), 415);
  }

  let raw;
  try {
    const body = await request.text();
    if (body.length > 65536) return response(jsonRpcError(null, -32600, "Request body exceeds 64 KB."), 413);
    raw = JSON.parse(body);
  } catch {
    return response(jsonRpcError(null, -32700, "Request body must be valid JSON."), 400);
  }

  if (Array.isArray(raw)) {
    return response(jsonRpcError(null, -32600, "JSON-RPC batch requests are not supported."), 400);
  }

  const handled = await handleMessage(raw);
  if (handled.notification) return response(null, 202);
  return response(handled.response, 200, { "MCP-Protocol-Version": PROTOCOL_VERSIONS.includes(raw?.params?.protocolVersion) ? raw.params.protocolVersion : "2025-03-26" });
}

export async function GET() {
  return response({ error: "MCP Streamable HTTP GET/SSE is not enabled. Send JSON-RPC requests with POST to this endpoint." }, 405, { Allow: "POST" });
}

export async function DELETE() {
  return response({ error: "This stateless MCP endpoint does not create sessions." }, 405, { Allow: "POST" });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: { Allow: "POST, OPTIONS", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept, MCP-Protocol-Version" } });
}
