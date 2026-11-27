import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import {
  createSignedGoToken,
  getUserMcpToken,
  saveUserMcpToken,
} from "../../../lib/mcp-token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SERVER_INFO = { name: "DRIVE MCP", version: "2.1.0" };
const PROTOCOL_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26"];
const MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";
const SKILLS_REGISTRY = "https://www.skillsdirectory.com/api/registry";
const SKILLS_SH_SEARCH = "https://skills.sh/api/search";
const DEFAULT_APP_URL = "https://drive-mcp-five.vercel.app";
const MAX_CONNECTIONS = 30;
const MAX_TOOLS_PER_CONNECTION = 150;

const CURATED_REMOTE_MCPS = [
  {
    name: "com.notion/mcp",
    title: "Notion Official MCP",
    version: "official",
    description: "Official Notion remote MCP server to search, read, create, and update Notion pages, databases, and comments.",
    repository: { url: "https://developers.notion.com/docs/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.notion.com/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["notion", "notion mcp", "notion official"],
    auth_mode: "oauth2",
    token_portal_url: "https://www.notion.so/profile/integrations",
  },
  {
    name: "com.supabase/mcp",
    title: "Supabase Official MCP",
    version: "official",
    description: "Official Supabase remote MCP server for database queries, migrations, Edge Functions, logs, and project management.",
    repository: { url: "https://supabase.com/docs/guides/getting-started/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.supabase.com/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["supabase", "supabase mcp"],
    auth_mode: "oauth2",
    token_portal_url: "https://supabase.com/dashboard/account/tokens",
  },
  {
    name: "com.github/mcp",
    title: "GitHub Official MCP",
    version: "official",
    description: "Official GitHub remote MCP server for repositories, issues, pull requests, branches, commits, and code search.",
    repository: { url: "https://github.com/github/github-mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://api.githubcopilot.com/mcp/", authentication: { required: true, type: "bearer" } }],
    aliases: ["github", "github mcp", "git"],
    auth_mode: "pat",
    token_portal_url: "https://github.com/settings/personal-access-tokens/new",
  },
  {
    name: "com.vercel/mcp",
    title: "Vercel Official MCP",
    version: "official",
    description: "Official Vercel remote MCP server for deployments, build logs, projects, domains, and documentation.",
    repository: { url: "https://vercel.com/docs/mcp/vercel-mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.vercel.com", authentication: { required: true, type: "oauth2" } }],
    aliases: ["vercel", "vercel mcp"],
    auth_mode: "oauth2",
    token_portal_url: "https://vercel.com/account/tokens",
  },
  {
    name: "com.context7/mcp",
    title: "Context7 Docs MCP",
    version: "official",
    description: "Up-to-date, version-specific library documentation and code examples for any framework or SDK (zero auth required).",
    repository: { url: "https://github.com/upstash/context7" },
    remotes: [{ type: "streamable_http", url: "https://mcp.context7.com/mcp" }],
    aliases: ["context7", "context7 mcp", "docs"],
    auth_mode: "none",
  },
  {
    name: "com.deepwiki/mcp",
    title: "DeepWiki MCP",
    version: "official",
    description: "Ask architecture questions and read deep documentation for any public GitHub repository (zero auth required).",
    repository: { url: "https://docs.devin.ai/work-with-devin/deepwiki-mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.deepwiki.com/mcp" }],
    aliases: ["deepwiki", "deepwiki mcp"],
    auth_mode: "none",
  },
  {
    name: "com.linear/mcp",
    title: "Linear Official MCP",
    version: "official",
    description: "Official Linear remote MCP server for issues, projects, cycles, teams, and roadmap workflows.",
    repository: { url: "https://linear.app/docs/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.linear.app/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["linear", "linear mcp"],
    auth_mode: "oauth2",
    token_portal_url: "https://linear.app/settings/api",
  },
  {
    name: "com.stripe/mcp",
    title: "Stripe Official MCP",
    version: "official",
    description: "Official Stripe remote MCP server for payments, customers, invoices, subscriptions, and Stripe documentation.",
    repository: { url: "https://docs.stripe.com/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.stripe.com", authentication: { required: true, type: "oauth2" } }],
    aliases: ["stripe", "stripe mcp"],
    auth_mode: "oauth2",
    token_portal_url: "https://dashboard.stripe.com/apikeys",
  },
  {
    name: "io.sentry/mcp",
    title: "Sentry Official MCP",
    version: "official",
    description: "Official Sentry remote MCP server to inspect errors, stack traces, issues, and performance telemetry.",
    repository: { url: "https://docs.sentry.io/product/sentry-mcp/" },
    remotes: [{ type: "streamable_http", url: "https://mcp.sentry.dev/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["sentry", "sentry mcp"],
    auth_mode: "oauth2",
    token_portal_url: "https://sentry.io/settings/account/api/auth-tokens/",
  },
  {
    name: "com.cloudflare/docs-mcp",
    title: "Cloudflare Docs MCP",
    version: "official",
    description: "Official Cloudflare documentation MCP server for Workers, R2, D1, Pages, and Zero Trust (zero auth required).",
    repository: { url: "https://github.com/cloudflare/mcp-server-cloudflare" },
    remotes: [{ type: "streamable_http", url: "https://docs.mcp.cloudflare.com/mcp" }],
    aliases: ["cloudflare", "cloudflare docs", "cloudflare mcp"],
    auth_mode: "none",
  },
  {
    name: "com.figma/mcp",
    title: "Figma Official MCP",
    version: "official",
    description: "Official Figma remote MCP server to inspect design frames, tokens, components, and layouts.",
    repository: { url: "https://developers.figma.com/docs/figma-mcp-server/" },
    remotes: [{ type: "streamable_http", url: "https://mcp.figma.com/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["figma", "figma mcp"],
    auth_mode: "oauth2",
    token_portal_url: "https://www.figma.com/developers/api#access-tokens",
  },
  {
    name: "com.canva/mcp",
    title: "Canva Official MCP",
    version: "official",
    description: "Official Canva remote MCP server to create, edit, and export visual designs via OAuth.",
    repository: { url: "https://mcp.canva.com/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.canva.com/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["canva", "canva mcp"],
    auth_mode: "oauth2",
  },
  {
    name: "com.make/mcp",
    title: "Make.com Official MCP",
    version: "official",
    description: "Official Make.com remote MCP server to trigger and orchestrate automated multi-app scenarios.",
    repository: { url: "https://mcp.make.com/v2" },
    remotes: [{ type: "streamable_http", url: "https://mcp.make.com/v2", authentication: { required: true, type: "oauth2" } }],
    aliases: ["make", "make.com", "make mcp"],
    auth_mode: "oauth2",
  },
  {
    name: "dev.firecrawl/mcp",
    title: "Firecrawl MCP Server",
    version: "official",
    description: "Turn websites into clean Markdown, structured JSON, or full-site crawls for AI agents.",
    repository: { url: "https://github.com/mendableai/firecrawl-mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://mcp.firecrawl.dev/v2/mcp" }],
    aliases: ["firecrawl", "firecrawl mcp"],
    auth_mode: "none",
  },
  {
    name: "com.tavily/mcp",
    title: "Tavily Search MCP",
    version: "official",
    description: "AI-tuned real-time web search and content extraction remote MCP server.",
    repository: { url: "https://github.com/tavily-ai/tavily-mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.tavily.com/mcp/" }],
    aliases: ["tavily", "tavily mcp"],
    auth_mode: "none",
  },
  {
    name: "com.slack/mcp",
    title: "Slack Official MCP",
    version: "official",
    description: "Official Slack remote MCP server to search messages and channels, send messages, and create canvases.",
    repository: { url: "https://mcp.slack.com/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.slack.com/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["slack", "slack mcp"],
    auth_mode: "oauth2",
  },
  {
    name: "com.miro/mcp",
    title: "Miro Official MCP",
    version: "official",
    description: "Summarize Miro boards, build diagrams, and act on comments.",
    repository: { url: "https://miro.com" },
    remotes: [{ type: "streamable_http", url: "https://mcp.miro.com/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["miro", "miro mcp"],
    auth_mode: "oauth2",
  },
  {
    name: "tech.neon/mcp",
    title: "Neon Postgres MCP",
    version: "official",
    description: "Official Neon serverless Postgres remote MCP server for branching, SQL execution, and schema management.",
    repository: { url: "https://neon.tech/docs/ai/neon-mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://mcp.neon.tech/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["neon", "neon mcp", "postgres"],
    auth_mode: "oauth2",
    token_portal_url: "https://console.neon.tech/app/settings/api-keys",
  },
  {
    name: "com.atlassian/mcp",
    title: "Atlassian Jira & Confluence MCP",
    version: "official",
    description: "Official Atlassian remote MCP server for Jira tickets, sprints, and Confluence pages.",
    repository: { url: "https://support.atlassian.com/rovo/docs/setting-up-ides/" },
    remotes: [{ type: "streamable_http", url: "https://mcp.atlassian.com/v2/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["atlassian", "jira", "confluence"],
    auth_mode: "oauth2",
  },
  {
    name: "com.paypal/mcp",
    title: "PayPal Official MCP",
    version: "official",
    description: "Official PayPal remote MCP server for invoices, orders, disputes, and payment links.",
    repository: { url: "https://mcp.paypal.com" },
    remotes: [{ type: "streamable_http", url: "https://mcp.paypal.com/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["paypal", "paypal mcp"],
    auth_mode: "oauth2",
  },
  {
    name: "com.asana/mcp",
    title: "Asana Official MCP",
    version: "official",
    category: "productivity",
    description: "Official Asana remote MCP server for tasks, projects, timelines, and team collaboration.",
    repository: { url: "https://developers.asana.com/docs/mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://mcp.asana.com/v2/mcp", authentication: { required: true, type: "oauth2" } }],
    aliases: ["asana", "asana mcp"],
    auth_mode: "oauth2",
  },
  {
    name: "com.intercom/mcp",
    title: "Intercom Official MCP",
    version: "official",
    description: "Official Intercom remote MCP server for customer conversations, contacts, and help center articles.",
    repository: { url: "https://developers.intercom.com" },
    remotes: [{ type: "streamable_http", url: "https://mcp.intercom.com/sse", authentication: { required: true, type: "oauth2" } }],
    aliases: ["intercom", "intercom mcp"],
    auth_mode: "oauth2",
  },
  {
    name: "ai.exa/mcp",
    title: "Exa Web Search MCP",
    version: "official",
    description: "Real-time AI web search, code context, and company research via Exa remote MCP.",
    repository: { url: "https://github.com/exa-labs/exa-mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://mcp.exa.ai/mcp" }],
    aliases: ["exa", "exa mcp", "web search"],
    auth_mode: "none",
  },
];

function jsonRpc(id, result) {
  return { jsonrpc: "2.0", id, result };
}
function jsonRpcError(id, code, message) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}
function response(body, status = 200, headers = {}) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
}
function textResult(value) {
  return { content: [{ type: "text", text: JSON.stringify(value, null, 2) }] };
}
function clampLimit(value) {
  const parsed = Number(value ?? 10);
  return Number.isInteger(parsed) ? Math.min(30, Math.max(1, parsed)) : 10;
}
function getAppOrigin(request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {}
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
  const url = new URL("/skills", appOrigin);
  if (query) url.searchParams.set("q", query);
  return url.toString();
}
function buildOneTapAuthorizeUrl(appOrigin, { connectionId, endpointUrl, serverTitle, userToken }) {
  if (!connectionId || !endpointUrl || !userToken) return `${appOrigin}/mcp`;
  const signed = createSignedGoToken({
    connectionId,
    endpointUrl,
    serverTitle: serverTitle || "MCP Server",
    userToken,
  });
  return `${appOrigin}/api/mcp-auth/go?t=${encodeURIComponent(signed)}`;
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
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 203 && b === 0)
  );
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
    return (
      addresses.length > 0 &&
      addresses.every(({ address, family }) => (family === 4 ? !privateV4(address) : !privateV6(address)))
    );
  } catch {
    return false;
  }
}
function getAdminClient() {
  const sourceUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sourceUrl || !serviceKey) return null;
  return createClient(sourceUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
async function authenticate(request) {
  const appOrigin = getAppOrigin(request);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    const resourceMetadata = new URL("/.well-known/oauth-protected-resource/api/mcp", appOrigin).toString();
    return {
      error: response(
        { error: "Authentication required", message: "Authenticate with OAuth 2.1 to access DRIVE MCP." },
        401,
        { "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadata}"` }
      ),
    };
  }
  if (!url || !key) return { error: response({ error: "Authentication is not configured" }, 503) };
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  return error || !user
    ? {
        error: response({ error: "Invalid or expired access token" }, 401, {
          "WWW-Authenticate": 'Bearer error="invalid_token"',
        }),
      }
    : { supabase, user, token, appOrigin };
}
async function fetchJson(url, label, timeoutMs = 10000) {
  const upstream = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "DRIVE-MCP/2.1" },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!upstream.ok) throw new Error(`${label} returned HTTP ${upstream.status}`);
  return upstream.json();
}
function githubHeaders() {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "DRIVE-MCP/2.1",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}
function parseFrontmatter(markdown) {
  const match = String(markdown || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key && val && !/^[>|][-+]?$/.test(val)) meta[key] = val;
  }
  return meta;
}
async function scanSkillContent(skillMd) {
  const hash = createHash("sha256").update(skillMd).digest("hex");
  const scannerUrl = process.env.SECURITY_SCANNER_URL;
  if (scannerUrl) {
    try {
      const res = await fetch(`${scannerUrl.replace(/\/+$/, "")}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: skillMd }),
        signal: AbortSignal.timeout(7000),
      });
      if (res.ok) {
        const result = await res.json();
        const blocked = result.status === "blocked" || result.safe === false;
        return {
          status: blocked ? "blocked" : "safe",
          hash,
          report: result,
          version: result.scanner_version || "remote-scanner",
        };
      }
    } catch {}
  }

  const blockedPatterns = [
    /curl\s+[^|\n]*\|\s*(ba)?sh/i,
    /wget\s+[^|\n]*\|\s*(ba)?sh/i,
    /rm\s+-rf\s+\/(\s|$)/i,
  ];
  const flagged = blockedPatterns.some((rx) => rx.test(skillMd));
  return {
    status: flagged ? "blocked" : "safe",
    hash,
    report: { mode: "builtin-static-check", flagged },
    version: "drive-builtin-2.1",
  };
}

function normalizeCuratedServer(entry, appOrigin) {
  const remotes = Array.isArray(entry.remotes) ? entry.remotes : [];
  const remote = pickHttpRemote(remotes);
  return {
    name: entry.name,
    title: entry.title,
    description: entry.description || "",
    version: entry.version || "official",
    repository: entry.repository || null,
    remotes,
    packages: [],
    source: "drive-curated-official",
    auth_mode: entry.auth_mode || (remote?.authentication?.required ? "oauth2" : "none"),
    token_portal_url: entry.token_portal_url || null,
    remote_available: Boolean(remote?.url),
    connect_url: buildConnectUrl(appOrigin, { serverName: entry.name }),
  };
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
    connect_url: server.name
      ? buildConnectUrl(appOrigin, { serverName: server.name })
      : buildConnectUrl(appOrigin, { query: server.title || "" }),
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
    connect_url: row.server_name
      ? buildConnectUrl(appOrigin, { serverName: row.server_name })
      : buildConnectUrl(appOrigin, { query: row.title || "" }),
  };
}
function findCuratedMcp(term) {
  const needle = String(term || "").trim().toLowerCase();
  if (!needle) return null;
  return (
    CURATED_REMOTE_MCPS.find(
      (item) =>
        item.name.toLowerCase() === needle ||
        item.title.toLowerCase() === needle ||
        (item.aliases || []).some((alias) => alias.toLowerCase() === needle)
    ) ||
    CURATED_REMOTE_MCPS.find(
      (item) =>
        needle.length >= 3 &&
        (item.name.toLowerCase().includes(needle) ||
          item.title.toLowerCase().includes(needle) ||
          (item.aliases || []).some(
            (alias) => alias.toLowerCase().includes(needle) || needle.includes(alias.toLowerCase())
          ))
    ) ||
    null
  );
}
async function searchMcpServers(query, limit, appOrigin, supabase = null) {
  const merged = new Map();
  const needle = String(query || "").trim().toLowerCase();

  for (const item of CURATED_REMOTE_MCPS) {
    const hay = [item.name, item.title, item.description, ...(item.aliases || [])].join(" ").toLowerCase();
    if (!needle || hay.includes(needle)) {
      const normalized = normalizeCuratedServer(item, appOrigin);
      merged.set(normalized.name, normalized);
    }
  }

  if (supabase && merged.size < limit) {
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

  if (merged.size < limit) {
    try {
      const url = new URL(MCP_REGISTRY);
      url.searchParams.set("search", query);
      url.searchParams.set("limit", String(limit));
      url.searchParams.set("version", "latest");
      const payload = await fetchJson(url, "Official MCP Registry");
      for (const entry of payload.servers || []) {
        const item = normalizeRegistryServer(entry, appOrigin);
        if (item.name && !merged.has(item.name)) merged.set(item.name, item);
        if (merged.size >= limit) break;
      }
    } catch {}
  }

  const servers = [...merged.values()]
    .sort((a, b) => {
      const curatedA = a.source === "drive-curated-official" ? 2 : 0;
      const curatedB = b.source === "drive-curated-official" ? 2 : 0;
      return curatedB + Number(b.remote_available) - (curatedA + Number(a.remote_available));
    })
    .slice(0, limit);

  return {
    source: "DRIVE Multi-Source MCP Marketplace",
    query,
    count: servers.length,
    servers,
    note: "Call drive_connect_mcp directly to connect and enable any matching MCP server in the user's DRIVE workspace.",
  };
}
async function getMcpServer(serverName, appOrigin, supabase = null) {
  const curated = findCuratedMcp(serverName);
  if (curated) return { found: true, server: normalizeCuratedServer(curated, appOrigin) };

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
      message: "No exact server name match was found in the registry. You can still call drive_connect_mcp with an endpoint_url.",
    };
  }
  return { found: true, server: normalizeRegistryServer(match, appOrigin) };
}
async function searchSkills(query, limit, appOrigin, supabase = null) {
  const seen = new Set();
  const skills = [];

  if (supabase) {
    try {
      const safeLike = query.replace(/[%_,()]/g, " ").trim();
      if (safeLike) {
        const { data } = await supabase
          .from("skill_catalog")
          .select("id,name,slug,category,description,author,stars,verified,tags,repository,skill_path,source_url,source_id")
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
            repository: item.repository,
            skill_path: item.skill_path || null,
            category: item.category || "other",
            description: item.description || "",
            author: item.author || null,
            stars: Number(item.stars || 0),
            verified: Boolean(item.verified),
            tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
            source: item.source_url || `https://github.com/${item.repository}`,
            catalog_source: item.source_id || "drive-index",
            install_url: buildSkillUrl(appOrigin, item.slug || item.name),
          });
        }
      }
    } catch {}
  }

  if (skills.length < limit) {
    try {
      const url = new URL(SKILLS_SH_SEARCH);
      url.searchParams.set("q", query);
      url.searchParams.set("limit", String(Math.min(50, limit * 2)));
      const payload = await fetchJson(url, "skills.sh", 6500);
      const source = Array.isArray(payload.skills) ? payload.skills : Array.isArray(payload.data) ? payload.data : [];
      for (const item of source) {
        const repository = String(item.source || item.topSource || item.repository || "")
          .replace(/^https?:\/\/github\.com\//i, "")
          .replace(/\/+$/, "")
          .trim();
        const slug = String(item.skillId || item.slug || item.name || "").trim();
        const name = String(item.name || slug).trim();
        const id = `${repository}/${slug}`.toLowerCase();
        if (!repository || !slug || !name || seen.has(id)) continue;
        seen.add(id);
        skills.push({
          name,
          slug,
          repository,
          skill_path: item.path || null,
          category: item.category || "other",
          description: item.description || `Agent Skill from ${repository}`,
          author: repository.split("/")[0] || null,
          stars: Number(item.stars || item.installs || 0),
          verified: Boolean(item.verified) || Number(item.installs || 0) >= 500,
          tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
          source: `https://github.com/${repository}`,
          catalog_source: "skills.sh",
          install_url: buildSkillUrl(appOrigin, slug || name),
        });
        if (skills.length >= limit) break;
      }
    } catch {}
  }

  if (skills.length < limit) {
    try {
      const url = new URL(SKILLS_REGISTRY);
      url.searchParams.set("limit", String(Math.min(100, limit * 3)));
      url.searchParams.set("offset", "0");
      url.searchParams.set("sort", "stars");
      url.searchParams.set("q", query);
      const payload = await fetchJson(url, "Skills Directory", 7000);
      const source = payload.skills || payload.data || [];
      for (const item of source) {
        const repository = item.repository || "";
        const slug = item.slug || "";
        const id = `${repository}/${slug}`.toLowerCase();
        if (!repository || !slug || !item.name || seen.has(id)) continue;
        seen.add(id);
        skills.push({
          name: item.name,
          slug,
          repository,
          skill_path: item.path || null,
          category: item.category || "other",
          description: item.description || "",
          author: item.author || null,
          stars: Number(item.stars || 0),
          verified: Boolean(item.verified),
          tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
          source: `https://github.com/${repository}`,
          catalog_source: "skillsdirectory",
          install_url: buildSkillUrl(appOrigin, slug || item.name),
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
    note: "You can directly install and activate any of these skills in the user's DRIVE workspace by calling drive_install_skill.",
  };
}

async function resolveSkillsFromGithub(repository, slug, explicitPath, installAll = false, fallbackMeta = {}) {
  const cleanRepo = String(repository || "")
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleanRepo)) {
    throw new Error(`Invalid GitHub repository format: "${repository}".`);
  }

  let branch = "main";
  let license = null;
  let targetPaths = explicitPath ? [explicitPath] : [];

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
      headers: githubHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (repoRes.ok) {
      const repoInfo = await repoRes.json();
      branch = repoInfo.default_branch || "main";
      license = repoInfo.license?.spdx_id || null;
    }

    if (!targetPaths.length) {
      const treeRes = await fetch(
        `https://api.github.com/repos/${cleanRepo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        { headers: githubHeaders(), cache: "no-store", signal: AbortSignal.timeout(9000) }
      );
      if (treeRes.ok) {
        const tree = await treeRes.json();
        const skillFiles = (tree.tree || []).filter(
          (node) => node.type === "blob" && /(^|\/)SKILL\.md$/i.test(node.path)
        );
        if (skillFiles.length) {
          if (installAll) {
            targetPaths = skillFiles.slice(0, 10).map((f) => f.path);
          } else {
            const slugLower = String(slug || "").toLowerCase();
            const exact = skillFiles.find(
              (f) =>
                slugLower &&
                (f.path.toLowerCase().includes(`/${slugLower}/skill.md`) ||
                  f.path.toLowerCase() === `${slugLower}/skill.md`)
            );
            const partial = skillFiles.find((f) => slugLower && f.path.toLowerCase().includes(slugLower));
            targetPaths = [(exact || partial || skillFiles[0]).path];
          }
        }
      }
    }
  } catch {}

  if (!targetPaths.length) {
    const s = String(slug || "").trim();
    const candidates = [
      s ? `skills/${s}/SKILL.md` : "",
      s ? `${s}/SKILL.md` : "",
      "SKILL.md",
      "README.md",
    ].filter(Boolean);

    for (const candidatePath of candidates) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${cleanRepo}/${encodeURIComponent(branch)}/${candidatePath}`;
        const rawRes = await fetch(rawUrl, { cache: "no-store", signal: AbortSignal.timeout(6500) });
        if (rawRes.ok) {
          const text = await rawRes.text();
          if (text.trim()) {
            const fm = parseFrontmatter(text);
            return [
              {
                sourceRepo: cleanRepo,
                skillPath: candidatePath,
                skillMd: text.slice(0, 120000),
                license,
                frontmatterName: fm.name || fallbackMeta.name || s || cleanRepo.split("/")[1],
                frontmatterDescription: fm.description || fallbackMeta.description || "",
              },
            ];
          }
        }
      } catch {}
    }

    const fallbackName = fallbackMeta.name || s || cleanRepo.split("/")[1];
    const fallbackDesc = fallbackMeta.description || `Agent Skill from https://github.com/${cleanRepo}`;
    const syntheticMd = [
      "---",
      `name: ${fallbackName}`,
      `description: ${fallbackDesc}`,
      `source: https://github.com/${cleanRepo}`,
      "---",
      "",
      `# ${fallbackName}`,
      "",
      fallbackDesc,
      "",
      `Reference repository: https://github.com/${cleanRepo}`,
    ].join("\n");
    return [
      {
        sourceRepo: cleanRepo,
        skillPath: s ? `skills/${s}/SKILL.md` : "SKILL.md",
        skillMd: syntheticMd,
        license,
        frontmatterName: fallbackName,
        frontmatterDescription: fallbackDesc,
      },
    ];
  }

  const downloaded = await Promise.allSettled(
    targetPaths.map(async (targetPath) => {
      const rawUrl = `https://raw.githubusercontent.com/${cleanRepo}/${encodeURIComponent(branch)}/${targetPath}`;
      const rawRes = await fetch(rawUrl, { cache: "no-store", signal: AbortSignal.timeout(8000) });
      if (!rawRes.ok) throw new Error(`Could not download ${targetPath}`);
      const skillMd = await rawRes.text();
      if (!skillMd.trim()) throw new Error("Empty SKILL.md");
      const fm = parseFrontmatter(skillMd);
      const folderName = targetPath.split("/").slice(-2, -1)[0] || cleanRepo.split("/")[1];
      return {
        sourceRepo: cleanRepo,
        skillPath: targetPath,
        skillMd: skillMd.slice(0, 120000),
        license,
        frontmatterName: fm.name || folderName || fallbackMeta.name || null,
        frontmatterDescription: fm.description || fallbackMeta.description || null,
      };
    })
  );

  const items = downloaded.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);
  if (!items.length) {
    throw new Error(`Could not download SKILL.md files from ${cleanRepo}.`);
  }
  return items;
}

async function installOneSkillItem(supabase, userId, item, appOrigin) {
  let repository = typeof item.repository === "string" ? item.repository.trim() : "";
  let slug = typeof item.slug === "string" ? item.slug.trim() : "";
  let name = typeof item.name === "string" ? item.name.trim() : "";
  let description = typeof item.description === "string" ? item.description.trim() : "";
  let skillPath = typeof item.skill_path === "string" ? item.skill_path.trim() : "";
  const query = typeof item.query === "string" ? item.query.trim() : "";
  const installAll = Boolean(item.install_all);

  if (!repository) {
    const searchTerm = query || name || slug;
    if (!searchTerm) {
      return { ok: false, query: null, error: "Provide repository or query/name for the Skill to install." };
    }
    const found = await searchSkills(searchTerm, 5, appOrigin, supabase);
    const needle = searchTerm.toLowerCase();
    const match =
      found.skills.find((s) => s.slug?.toLowerCase() === needle || s.name?.toLowerCase() === needle) ||
      found.skills[0] ||
      null;
    if (!match || !match.repository) {
      return { ok: false, query: searchTerm, error: `No Skill matching "${searchTerm}" was found in the catalog.` };
    }
    repository = match.repository;
    slug = slug || match.slug || "";
    name = name || match.name || "";
    description = description || match.description || "";
    skillPath = skillPath || match.skill_path || "";
  }

  let resolvedList;
  try {
    resolvedList = await resolveSkillsFromGithub(repository, slug, skillPath, installAll, { name, description });
  } catch (err) {
    return { ok: false, query: query || name || repository, error: err?.message || "Failed to fetch SKILL.md." };
  }

  const saved = [];
  let blockedCount = 0;
  const now = new Date().toISOString();

  for (const resolved of resolvedList) {
    const scan = await scanSkillContent(resolved.skillMd);
    if (scan.status === "blocked") {
      blockedCount += 1;
      continue;
    }

    const finalName = String(
      resolvedList.length === 1 && name ? name : resolved.frontmatterName || slug || resolved.sourceRepo.split("/")[1]
    ).slice(0, 140);
    const finalDescription = String(
      resolved.frontmatterDescription || (resolvedList.length === 1 ? description : "") || ""
    ).slice(0, 1000);

    const { data: existing } = await supabase
      .from("user_skills")
      .select("id")
      .eq("user_id", userId)
      .eq("source_repo", resolved.sourceRepo)
      .eq("skill_path", resolved.skillPath)
      .maybeSingle();

    const row = {
      user_id: userId,
      name: finalName,
      description: finalDescription,
      source_repo: resolved.sourceRepo,
      skill_path: resolved.skillPath,
      skill_md: resolved.skillMd,
      version: "latest",
      license: resolved.license,
      status: "enabled",
      reviewed_at: now,
      security_scan: scan.report,
      security_scan_hash: scan.hash,
      security_scan_status: "safe",
      security_scanned_at: now,
      security_scanner_version: scan.version,
      security_bundle_hash: scan.hash,
      updated_at: now,
    };

    if (existing?.id) {
      const { data, error } = await supabase
        .from("user_skills")
        .update(row)
        .eq("id", existing.id)
        .eq("user_id", userId)
        .select("id,name,description,source_repo,skill_path,status,security_scan_status")
        .single();
      if (!error && data) saved.push({ ...data, updated: true });
    } else {
      const { data, error } = await supabase
        .from("user_skills")
        .insert(row)
        .select("id,name,description,source_repo,skill_path,status,security_scan_status")
        .single();
      if (!error && data) saved.push({ ...data, updated: false });
    }
  }

  if (!saved.length) {
    return {
      ok: false,
      query: query || name || repository,
      error:
        blockedCount > 0
          ? "Skill blocked by security scan due to unsafe command patterns."
          : "Could not save Skill to user workspace.",
    };
  }

  return { ok: true, skills: saved, blocked_count: blockedCount };
}

async function installSkillsDirectly(supabase, userId, args, appOrigin) {
  const batch = Array.isArray(args.skills) && args.skills.length > 0 ? args.skills.slice(0, 12) : [args];
  const installed = [];
  const failed = [];

  for (const item of batch) {
    const res = await installOneSkillItem(supabase, userId, item || {}, appOrigin);
    if (res.ok) {
      installed.push(...res.skills);
    } else {
      failed.push({ query: res.query, error: res.error });
    }
  }

  return {
    installed: installed.length > 0,
    installed_count: installed.length,
    failed_count: failed.length,
    skills: installed,
    failed,
    workspace_url: `${appOrigin}/skills`,
    message:
      installed.length > 0
        ? `Successfully installed and immediately enabled ${installed.length} Skill(s) in the user's DRIVE workspace.`
        : `Could not install the requested Skill(s): ${failed.map((f) => f.error).join("; ")}`,
  };
}

async function manageSkillDirectly(supabase, userId, args, appOrigin) {
  const action = String(args.action || "").trim().toLowerCase();
  const skillId = typeof args.skill_id === "string" ? args.skill_id.trim() : "";
  const skillName = typeof args.name === "string" ? args.name.trim().toLowerCase() : "";

  if (!["enable", "disable", "remove"].includes(action)) {
    throw new Error('action must be one of "enable", "disable", or "remove".');
  }

  let targetId = skillId;
  let targetName = args.name || "";

  if (!targetId) {
    if (!skillName) throw new Error("Provide skill_id or name.");
    const { data: userSkills } = await supabase
      .from("user_skills")
      .select("id,name,status")
      .eq("user_id", userId)
      .limit(100);
    const match =
      (userSkills || []).find((s) => s.name?.toLowerCase() === skillName) ||
      (userSkills || []).find((s) => s.name?.toLowerCase().includes(skillName));
    if (!match) throw new Error(`Installed Skill "${args.name}" was not found in your workspace.`);
    targetId = match.id;
    targetName = match.name;
  }

  if (action === "remove") {
    const { error } = await supabase.from("user_skills").delete().eq("id", targetId).eq("user_id", userId);
    if (error) throw new Error(`Could not remove Skill: ${error.message}`);
    return { ok: true, action: "removed", skill_id: targetId, name: targetName, workspace_url: `${appOrigin}/skills` };
  }

  const nextStatus = action === "enable" ? "enabled" : "saved";
  const { data, error } = await supabase
    .from("user_skills")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", targetId)
    .eq("user_id", userId)
    .select("id,name,status")
    .single();
  if (error) throw new Error(`Could not update Skill status: ${error.message}`);

  return {
    ok: true,
    action: action === "enable" ? "enabled" : "disabled",
    skill: data,
    workspace_url: `${appOrigin}/skills`,
  };
}

function safeToolName(value) {
  return String(value || "tool")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);
}
function connectionToolName(connectionId, toolName) {
  return `mcp_${connectionId.replace(/-/g, "").slice(0, 12)}__${safeToolName(toolName)}`;
}

async function getUserConnections(supabase, user, { enabledOnly = false, appOrigin = DEFAULT_APP_URL } = {}) {
  const userId = user.id;
  let query = supabase
    .from("user_mcp_connections")
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
    registryIds.length
      ? supabase.from("mcp_servers").select("id,server_name,title,description,version,remotes").in("id", registryIds)
      : Promise.resolve({ data: [] }),
    customIds.length
      ? supabase
          .from("user_custom_mcp_servers")
          .select("id,display_name,endpoint_url,status,auth_type")
          .in("id", customIds)
          .eq("user_id", userId)
      : Promise.resolve({ data: [] }),
  ]);
  const rmap = new Map((registry.data || []).map((x) => [x.id, x]));
  const cmap = new Map((custom.data || []).map((x) => [x.id, x]));
  return connections
    .map((row) => {
      const server = row.registry_server_id ? rmap.get(row.registry_server_id) : cmap.get(row.custom_server_id);
      if (!server) return null;
      const hasSavedToken = Boolean(getUserMcpToken(user, row.id));
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
        authType = server.auth_type || (hasSavedToken ? "bearer" : "none");
        status = hasSavedToken && (server.status === "pending" || !server.status) ? "verified" : server.status || "pending";
        if (!["verified", "ready", "active"].includes(status) && !hasSavedToken) endpoint = "";
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
        authorized: authType === "none" || hasSavedToken,
        status,
        active_in_gateway: Boolean(row.enabled && endpoint && (authType === "none" || hasSavedToken)),
        manage_url: `${appOrigin}/mcp`,
      };
    })
    .filter(Boolean);
}

async function probeRemoteMcp(endpointUrl, bearerToken = "") {
  if (!endpointUrl || !(await publicHttps(endpointUrl))) {
    return { reachable: false, authRequired: false };
  }
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "User-Agent": "DRIVE-MCP-Gateway/2.1",
  };
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`;

  try {
    const res = await fetch(endpointUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "DRIVE MCP", version: "2.1.0" },
        },
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (res.status === 401 || res.status === 403) {
      return { reachable: true, authRequired: true, status: res.status };
    }
    return { reachable: true, authRequired: false, status: res.status };
  } catch {
    return { reachable: false, authRequired: false };
  }
}

async function connectMcpDirectly(context, args) {
  const { supabase, user, token: userToken, appOrigin } = context;
  const userId = user.id;

  const serverNameInput = typeof args.server_name === "string" ? args.server_name.trim().slice(0, 200) : "";
  const queryInput = typeof args.query === "string" ? args.query.trim().slice(0, 120) : "";
  const endpointInput = typeof args.endpoint_url === "string" ? args.endpoint_url.trim().slice(0, 500) : "";
  const displayNameInput = typeof args.display_name === "string" ? args.display_name.trim().slice(0, 120) : "";
  const apiKey = typeof args.api_key === "string" ? args.api_key.trim() : "";
  const desiredEnabled = typeof args.enabled === "boolean" ? args.enabled : true;

  const lookupTerm = serverNameInput || queryInput || displayNameInput;
  if (!lookupTerm && !endpointInput) {
    throw new Error("Provide query, server_name, or endpoint_url to connect an MCP server.");
  }

  const existingConnections = await getUserConnections(supabase, user, { enabledOnly: false, appOrigin });
  const needle = lookupTerm.toLowerCase();
  const existingConn = existingConnections.find((c) => {
    if (endpointInput && c.endpoint === endpointInput) return true;
    if (!needle) return false;
    return (
      c.name.toLowerCase() === needle ||
      c.title.toLowerCase() === needle ||
      (needle.length >= 3 && (c.name.toLowerCase().includes(needle) || c.title.toLowerCase().includes(needle)))
    );
  });

  if (existingConn) {
    if (existingConn.enabled !== desiredEnabled) {
      await supabase
        .from("user_mcp_connections")
        .update({ enabled: desiredEnabled, updated_at: new Date().toISOString() })
        .eq("id", existingConn.id)
        .eq("user_id", userId);
    }

    let activeToken = apiKey || getUserMcpToken(user, existingConn.id);
    if (apiKey) {
      await saveUserMcpToken(supabase, user, existingConn.id, apiKey);
    }

    const probe = existingConn.endpoint
      ? await probeRemoteMcp(existingConn.endpoint, activeToken)
      : { authRequired: existingConn.authType !== "none" && !activeToken };
    const needsAuth = probe.authRequired || (existingConn.authType !== "none" && !activeToken);
    const directAuthorizeUrl = needsAuth
      ? buildOneTapAuthorizeUrl(appOrigin, {
          connectionId: existingConn.id,
          endpointUrl: existingConn.endpoint,
          serverTitle: existingConn.title,
          userToken,
        })
      : null;

    return {
      connected: true,
      already_existed: true,
      enabled: desiredEnabled,
      connection: { ...existingConn, enabled: desiredEnabled, authorized: !needsAuth },
      auth_required: needsAuth,
      ready: desiredEnabled && !needsAuth,
      authorize_url: directAuthorizeUrl,
      workspace_url: `${appOrigin}/mcp`,
      message: needsAuth
        ? `${existingConn.title} is connected and enabled in your DRIVE workspace. Tap this 1-click authorize link to open ${existingConn.title}'s official Allow screen directly: ${directAuthorizeUrl}`
        : `${existingConn.title} is connected, authorized, and ready to use directly in your AI chat!`,
    };
  }

  let resolvedServer = null;
  let curatedHint = null;

  if (!endpointInput && lookupTerm) {
    curatedHint = findCuratedMcp(lookupTerm);
    if (curatedHint) {
      resolvedServer = normalizeCuratedServer(curatedHint, appOrigin);
    } else {
      const search = await searchMcpServers(lookupTerm, 6, appOrigin, supabase);
      resolvedServer =
        search.servers.find((s) => s.name?.toLowerCase() === needle && s.remote_available) ||
        search.servers.find((s) => s.remote_available) ||
        search.servers[0] ||
        null;
    }
  }

  const remote = resolvedServer ? pickHttpRemote(resolvedServer.remotes) : null;
  const endpointUrl = endpointInput || remote?.url || "";
  const title = displayNameInput || resolvedServer?.title || resolvedServer?.name || lookupTerm || "Custom MCP";
  const serverKeyName = resolvedServer?.name || "";
  const version = resolvedServer?.version || "official";

  if (!endpointUrl) {
    return {
      connected: false,
      enabled: false,
      query: lookupTerm,
      matched_server: resolvedServer,
      workspace_url: `${appOrigin}/mcp`,
      connect_url: buildConnectUrl(appOrigin, { serverName: serverKeyName || undefined, query: lookupTerm }),
      message: resolvedServer
        ? `${title} was found in the catalog, but it is a local STDIO-only server with no hosted HTTPS remote endpoint. Provide a hosted HTTPS endpoint_url if you have one.`
        : `No hosted remote MCP server matching "${lookupTerm}" was found. Provide its HTTPS endpoint_url to connect it directly.`,
    };
  }

  if (!(await publicHttps(endpointUrl))) {
    throw new Error("Remote MCP endpoint must be a valid public HTTPS URL.");
  }

  const probe = await probeRemoteMcp(endpointUrl, apiKey);
  const authType = probe.authRequired
    ? curatedHint?.auth_mode || "oauth2"
    : !apiKey && remote?.authentication?.required
    ? curatedHint?.auth_mode || "oauth2"
    : "none";

  let registryServerId = null;
  let customServerId = null;

  if (!endpointInput && serverKeyName) {
    const { data: existingReg } = await supabase
      .from("mcp_servers")
      .select("id")
      .eq("server_name", serverKeyName)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingReg?.id) {
      registryServerId = existingReg.id;
    } else {
      const admin = getAdminClient();
      if (admin) {
        const remotesPayload = resolvedServer?.remotes?.length
          ? resolvedServer.remotes
          : [
              {
                type: "streamable_http",
                url: endpointUrl,
                authentication: authType !== "none" ? { required: true, type: authType } : undefined,
              },
            ];
        const { data: imported } = await admin
          .from("mcp_servers")
          .upsert(
            {
              id: `${serverKeyName}@${version}`,
              server_name: serverKeyName,
              version,
              title,
              description: resolvedServer?.description || `${title} remote MCP server`,
              repository_url: resolvedServer?.repository?.url || null,
              transport_types: ["streamable_http"],
              packages: resolvedServer?.packages || [],
              remotes: remotesPayload,
              registry_metadata: {},
              source_id: "official-mcp-registry",
              source_status: "active",
              trust_level: curatedHint ? "verified" : "community",
              is_latest: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "server_name,version" }
          )
          .select("id")
          .single();
        if (imported?.id) registryServerId = imported.id;
      }
    }
  }

  if (!registryServerId) {
    const { data: existingCustom } = await supabase
      .from("user_custom_mcp_servers")
      .select("id")
      .eq("user_id", userId)
      .eq("endpoint_url", endpointUrl)
      .maybeSingle();

    if (existingCustom?.id) {
      customServerId = existingCustom.id;
    } else {
      const { data: createdCustom, error: customErr } = await supabase
        .from("user_custom_mcp_servers")
        .insert({
          user_id: userId,
          display_name: title,
          endpoint_url: endpointUrl,
          transport: "streamable_http",
          auth_type: authType === "none" ? "none" : "oauth2",
          status: "verified",
          updated_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (customErr || !createdCustom?.id) {
        throw new Error(`Could not register MCP server "${title}": ${customErr?.message || "Database error"}`);
      }
      customServerId = createdCustom.id;
    }
  }

  let existingRowQuery = supabase
    .from("user_mcp_connections")
    .select("id,enabled")
    .eq("user_id", userId);
  existingRowQuery = registryServerId
    ? existingRowQuery.eq("registry_server_id", registryServerId)
    : existingRowQuery.eq("custom_server_id", customServerId);
  const { data: existingRow } = await existingRowQuery.maybeSingle();

  let connectionRow = null;
  if (existingRow?.id) {
    const { data, error } = await supabase
      .from("user_mcp_connections")
      .update({ enabled: desiredEnabled, updated_at: new Date().toISOString() })
      .eq("id", existingRow.id)
      .eq("user_id", userId)
      .select("id,registry_server_id,custom_server_id,enabled")
      .single();
    if (error) throw new Error(`Could not enable MCP connection: ${error.message}`);
    connectionRow = data;
  } else {
    const { data, error } = await supabase
      .from("user_mcp_connections")
      .insert({
        user_id: userId,
        registry_server_id: registryServerId,
        custom_server_id: customServerId,
        enabled: desiredEnabled,
      })
      .select("id,registry_server_id,custom_server_id,enabled")
      .single();
    if (error) throw new Error(`Could not save MCP connection: ${error.message}`);
    connectionRow = data;
  }

  if (apiKey) {
    await saveUserMcpToken(supabase, user, connectionRow.id, apiKey);
  }

  const savedToken = apiKey || getUserMcpToken(user, connectionRow.id);
  const needsAuth = authType !== "none" && (!savedToken || probe.authRequired);
  const directAuthorizeUrl = needsAuth
    ? buildOneTapAuthorizeUrl(appOrigin, {
        connectionId: connectionRow.id,
        endpointUrl,
        serverTitle: title,
        userToken,
      })
    : null;

  return {
    connected: true,
    enabled: Boolean(connectionRow.enabled),
    connection_id: connectionRow.id,
    title,
    server_name: serverKeyName || title,
    endpoint_url: endpointUrl,
    auth_required: needsAuth,
    auth_mode: authType,
    ready: Boolean(connectionRow.enabled && !needsAuth),
    workspace_url: `${appOrigin}/mcp`,
    authorize_url: directAuthorizeUrl,
    provider_token_url: needsAuth ? curatedHint?.token_portal_url || null : null,
    message: needsAuth
      ? `${title} has been directly connected and enabled in your DRIVE workspace! Because ${title} requires your personal ${authType.toUpperCase()} permission, tap this 1-click link to jump straight to ${title}'s Allow screen (valid 10 min): ${directAuthorizeUrl}. Once approved, all ${title} tools will work automatically here.`
      : `${title} has been directly connected, enabled, and is immediately active in your DRIVE MCP gateway!`,
  };
}

async function manageMcpDirectly(supabase, user, args, appOrigin) {
  const action = String(args.action || "").trim().toLowerCase();
  const connectionId = typeof args.connection_id === "string" ? args.connection_id.trim() : "";
  const nameInput = typeof args.name === "string" ? args.name.trim().toLowerCase() : "";

  if (!["enable", "disable", "remove"].includes(action)) {
    throw new Error('action must be one of "enable", "disable", or "remove".');
  }

  const connections = await getUserConnections(supabase, user, { enabledOnly: false, appOrigin });
  const target = connectionId
    ? connections.find((c) => c.id === connectionId)
    : connections.find(
        (c) =>
          c.name.toLowerCase() === nameInput ||
          c.title.toLowerCase() === nameInput ||
          (nameInput.length >= 2 &&
            (c.name.toLowerCase().includes(nameInput) || c.title.toLowerCase().includes(nameInput)))
      );

  if (!target) {
    throw new Error(`Connected MCP "${args.name || connectionId}" was not found in your DRIVE workspace.`);
  }

  if (action === "remove") {
    const { error } = await supabase
      .from("user_mcp_connections")
      .delete()
      .eq("id", target.id)
      .eq("user_id", user.id);
    if (error) throw new Error(`Could not remove MCP connection: ${error.message}`);
    return { ok: true, action: "removed", connection_id: target.id, title: target.title, workspace_url: `${appOrigin}/mcp` };
  }

  const nextEnabled = action === "enable";
  const { error } = await supabase
    .from("user_mcp_connections")
    .update({ enabled: nextEnabled, updated_at: new Date().toISOString() })
    .eq("id", target.id)
    .eq("user_id", user.id);
  if (error) throw new Error(`Could not update MCP connection: ${error.message}`);

  return {
    ok: true,
    action: nextEnabled ? "enabled" : "disabled",
    connection: { ...target, enabled: nextEnabled },
    workspace_url: `${appOrigin}/mcp`,
  };
}

async function getConnectUrl(supabase, user, args, appOrigin) {
  const serverName = typeof args.server_name === "string" ? args.server_name.trim().slice(0, 200) : "";
  const query = typeof args.query === "string" ? args.query.trim().slice(0, 120) : "";
  const endpointUrl = typeof args.endpoint_url === "string" ? args.endpoint_url.trim().slice(0, 500) : "";
  const lookupTerm = serverName || query;
  if (!lookupTerm && !endpointUrl) throw new Error("Provide server_name, query, or endpoint_url.");

  const connections = await getUserConnections(supabase, user, { enabledOnly: false, appOrigin });
  const needle = lookupTerm.toLowerCase();
  const existing =
    connections.find(
      (c) =>
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
      name,
      title,
      description,
      version,
      remote_available,
      connect_url,
    })),
    note: "Tip: Use drive_connect_mcp instead to directly connect and enable this MCP server in the user's DRIVE workspace automatically.",
  };
}

async function discoverConnectionTools(connection, user) {
  if (!connection.endpoint || !(await publicHttps(connection.endpoint))) return [];
  const upstreamToken = getUserMcpToken(user, connection.id);
  if (connection.authType !== "none" && !upstreamToken) return [];

  const client = new Client({ name: "drive-mcp-gateway", version: "2.1.0" });
  let transport;
  try {
    const headers = upstreamToken ? { Authorization: `Bearer ${upstreamToken}` } : undefined;
    transport = new StreamableHTTPClientTransport(new URL(connection.endpoint), {
      requestInit: { headers, signal: AbortSignal.timeout(10000) },
    });
    await client.connect(transport);
    const result = await client.listTools();
    return (result.tools || []).slice(0, MAX_TOOLS_PER_CONNECTION).map((tool) => ({
      name: connectionToolName(connection.id, tool.name),
      description: `[${connection.title || connection.name}] ${String(tool.description || tool.name).slice(0, 1000)}`,
      inputSchema: tool.inputSchema || { type: "object", properties: {} },
      _drive: { connectionId: connection.id, originalToolName: tool.name },
    }));
  } catch {
    return [];
  } finally {
    try {
      await client.close();
    } catch {}
    try {
      await transport?.close();
    } catch {}
  }
}

async function getActiveSkills(supabase, userId) {
  const { data, error } = await supabase
    .from("user_skills")
    .select("id,name,description,skill_md,version,source_repo,security_scan_status,status")
    .eq("user_id", userId)
    .eq("status", "enabled")
    .eq("security_scan_status", "safe")
    .limit(100);
  if (error) throw new Error("Could not load active Skills.");
  return data || [];
}

async function buildTools(supabase, user, appOrigin) {
  const connections = await getUserConnections(supabase, user, { enabledOnly: true, appOrigin });
  const discovered = await Promise.all(connections.map((conn) => discoverConnectionTools(conn, user)));
  const gatewayTools = [
    {
      name: "drive_install_skill",
      description:
        "DIRECTLY install, security-scan, and immediately activate (enable) one or more Agent Skills into this user's DRIVE workspace. ALWAYS call this tool when the user commands you to install/add/pasang a Skill (or multiple Skills at once via the skills array). Never tell the user to install manually.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Skill name or keyword to find and install, e.g. 'Office Productivity' or 'Daily Prep'." },
          repository: { type: "string", description: "Optional GitHub repository in owner/repo format if already known." },
          slug: { type: "string", description: "Optional skill slug if already known." },
          name: { type: "string", description: "Optional display name for the skill." },
          description: { type: "string", description: "Optional short description." },
          skill_path: { type: "string", description: "Optional explicit path to SKILL.md inside the repo." },
          install_all: { type: "boolean", description: "If true, installs all SKILL.md files in the repository pack (up to 10)." },
          skills: {
            type: "array",
            description: "Optional batch list of skills to install and enable in a single command.",
            items: {
              type: "object",
              properties: {
                query: { type: "string" },
                repository: { type: "string" },
                slug: { type: "string" },
                name: { type: "string" },
                description: { type: "string" },
                skill_path: { type: "string" },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "drive_manage_skill",
      description:
        "Directly enable, disable (pause), or remove an installed Agent Skill in this user's DRIVE workspace by skill_id or name.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["enable", "disable", "remove"], description: "Action to perform on the installed skill." },
          skill_id: { type: "string", description: "Skill ID returned by drive_list_active_skills or drive_install_skill." },
          name: { type: "string", description: "Skill name if skill_id is not provided." },
        },
        required: ["action"],
        additionalProperties: false,
      },
    },
    {
      name: "drive_connect_mcp",
      description:
        "DIRECTLY connect, register, and enable an MCP server (such as Notion, Supabase, GitHub, Vercel, Context7, Linear, Stripe, Sentry, Figma, Cloudflare, Neon, or any custom HTTPS MCP URL) into this user's DRIVE workspace. ALWAYS call this tool when the user commands you to connect/konekin/pasang an MCP server. If OAuth login is required, it returns a 1-tap authorize_url that jumps straight to the provider's Allow screen.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "MCP name or keyword requested by the user, e.g. 'notion', 'supabase', 'context7', 'vercel'." },
          server_name: { type: "string", description: "Optional exact registry server name if already known, e.g. 'com.notion/mcp'." },
          endpoint_url: { type: "string", description: "Optional custom remote HTTPS Streamable HTTP MCP endpoint URL." },
          display_name: { type: "string", description: "Optional display name for a custom endpoint." },
          api_key: { type: "string", description: "Optional API key or Personal Access Token if provided by the user." },
          enabled: { type: "boolean", description: "Whether to enable immediately (default true)." },
        },
        additionalProperties: false,
      },
    },
    {
      name: "drive_manage_mcp",
      description:
        "Directly enable, disable (pause), or disconnect (remove) an MCP server connected in this user's DRIVE workspace by connection_id or name.",
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["enable", "disable", "remove"], description: "Action to perform on the MCP connection." },
          connection_id: { type: "string", description: "Connection ID returned by drive_list_connected_mcps or drive_connect_mcp." },
          name: { type: "string", description: "MCP server name or title if connection_id is not provided." },
        },
        required: ["action"],
        additionalProperties: false,
      },
    },
    {
      name: "drive_list_connected_mcps",
      description:
        "List all MCP servers connected in this user's DRIVE workspace (enabled and disabled), including their authorization status and gateway readiness.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "drive_list_active_skills",
      description: "List all Agent Skills currently installed and enabled in this DRIVE account.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "drive_get_active_skill",
      description:
        "Read the complete SKILL.md instructions of one enabled Agent Skill. Use this when a Skill matches the user's task.",
      inputSchema: {
        type: "object",
        properties: { skill_id: { type: "string", description: "Skill ID returned by drive_list_active_skills." } },
        required: ["skill_id"],
        additionalProperties: false,
      },
    },
    {
      name: "drive_search_mcp_servers",
      description:
        "Search the multi-source DRIVE MCP marketplace (Curated Official Remote MCPs, Official Registry, Glama, GitHub, and community index). To connect any result directly, call drive_connect_mcp.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "drive_get_mcp_server",
      description: "Look up an MCP server by exact registry name or alias.",
      inputSchema: {
        type: "object",
        properties: { server_name: { type: "string" } },
        required: ["server_name"],
        additionalProperties: false,
      },
    },
    {
      name: "drive_search_skills",
      description:
        "Search the multi-source DRIVE Skills marketplace (skills.sh, Skills Directory, and curated GitHub SKILL.md index). To install and activate any result directly, call drive_install_skill.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 30 } },
        required: ["query"],
        additionalProperties: false,
      },
    },
    {
      name: "drive_get_connect_url",
      description:
        "Generate a clickable DRIVE web link for an MCP server. Prefer calling drive_connect_mcp first to directly connect and enable the MCP in the user's workspace.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "MCP name or search keyword." },
          server_name: { type: "string", description: "Exact registry server name if known." },
          endpoint_url: { type: "string", description: "Optional HTTPS remote MCP endpoint URL." },
        },
        additionalProperties: false,
      },
    },
  ];
  return { tools: [...gatewayTools, ...discovered.flat()], connections };
}

async function callUpstreamTool(supabase, user, encodedName, args, appOrigin) {
  const connections = await getUserConnections(supabase, user, { enabledOnly: true, appOrigin });
  const match = encodedName.match(/^mcp_([a-f0-9]{12})__(.+)$/);
  if (!match) throw new Error("Unknown tool.");
  const connection = connections.find((item) => item.id.replace(/-/g, "").slice(0, 12) === match[1]);
  if (!connection || !connection.endpoint || !(await publicHttps(connection.endpoint))) {
    throw new Error("MCP connection is inactive or has no valid remote endpoint.");
  }
  const upstreamToken = getUserMcpToken(user, connection.id);
  if (connection.authType !== "none" && !upstreamToken) {
    throw new Error(
      `${connection.title || connection.name} requires authorization. Call drive_connect_mcp to get a 1-tap authorize link.`
    );
  }

  const client = new Client({ name: "drive-mcp-gateway", version: "2.1.0" });
  let transport;
  try {
    const headers = upstreamToken ? { Authorization: `Bearer ${upstreamToken}` } : undefined;
    transport = new StreamableHTTPClientTransport(new URL(connection.endpoint), {
      requestInit: { headers, signal: AbortSignal.timeout(20000) },
    });
    await client.connect(transport);
    const listed = await client.listTools();
    const original = listed.tools?.find((tool) => safeToolName(tool.name) === match[2]);
    if (!original) throw new Error("The original MCP tool is no longer available.");
    return await client.callTool({ name: original.name, arguments: args || {} });
  } finally {
    try {
      await client.close();
    } catch {}
    try {
      await transport?.close();
    } catch {}
  }
}

async function callTool(name, args, context) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new Error("Tool arguments must be an object.");
  }
  if (name.startsWith("mcp_")) {
    return callUpstreamTool(context.supabase, context.user, name, args, context.appOrigin);
  }
  if (name === "drive_install_skill") {
    return installSkillsDirectly(context.supabase, context.user.id, args, context.appOrigin);
  }
  if (name === "drive_manage_skill") {
    return manageSkillDirectly(context.supabase, context.user.id, args, context.appOrigin);
  }
  if (name === "drive_connect_mcp") {
    return connectMcpDirectly(context, args);
  }
  if (name === "drive_manage_mcp") {
    return manageMcpDirectly(context.supabase, context.user, args, context.appOrigin);
  }
  if (name === "drive_list_connected_mcps") {
    const connections = await getUserConnections(context.supabase, context.user, {
      enabledOnly: false,
      appOrigin: context.appOrigin,
    });
    return {
      count: connections.length,
      enabled_count: connections.filter((c) => c.enabled).length,
      workspace_url: `${context.appOrigin}/mcp`,
      connections,
    };
  }
  if (name === "drive_get_connect_url") {
    return getConnectUrl(context.supabase, context.user, args, context.appOrigin);
  }
  if (name === "drive_list_active_skills") {
    const skills = await getActiveSkills(context.supabase, context.user.id);
    return {
      count: skills.length,
      marketplace_url: `${context.appOrigin}/skills`,
      skills: skills.map(({ id, name: skillName, description, version, source_repo }) => ({
        id,
        name: skillName,
        description,
        version,
        source_repo,
      })),
    };
  }
  if (name === "drive_get_active_skill") {
    const id = typeof args.skill_id === "string" ? args.skill_id : "";
    const skills = await getActiveSkills(context.supabase, context.user.id);
    const skill = skills.find((item) => item.id === id);
    if (!skill) throw new Error("Skill not found, disabled, or not security-approved.");
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      version: skill.version,
      instructions: skill.skill_md,
    };
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
  if (
    !message ||
    typeof message !== "object" ||
    Array.isArray(message) ||
    message.jsonrpc !== "2.0" ||
    typeof message.method !== "string"
  ) {
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
          "DRIVE MCP is this user's personal MCP Gateway, Multi-Source MCP Marketplace, and Agent Skills Hub.",
          "1. You CAN directly install and activate Skills on user command using drive_install_skill (supports single skill or batch `skills` array). NEVER tell the user that skill installation must be done manually.",
          "2. You CAN directly connect and enable MCP servers on user command using drive_connect_mcp (supports Notion, Supabase, GitHub, Vercel, Context7, Linear, Stripe, Sentry, Figma, Cloudflare, Neon, registry servers, and custom HTTPS endpoints). NEVER refuse or say you can only send links — ALWAYS call drive_connect_mcp first.",
          "3. If drive_connect_mcp returns auth_required: true with an authorize_url, confirm that the MCP is ALREADY connected and enabled in DRIVE, and share that 1-tap authorize_url which jumps straight to the provider's official OAuth Allow screen. Once the user clicks Allow, all upstream tools become immediately available through DRIVE.",
          "4. Use drive_manage_skill and drive_manage_mcp to directly enable, pause/disable, or remove Skills and MCP connections.",
          "5. Always check drive_list_connected_mcps and drive_list_active_skills to inspect active integrations, and call drive_get_active_skill when a Skill matches the user's task.",
          "6. Active remote MCP tools (both zero-auth and OAuth/PAT authorized) are exposed directly with the mcp_<id>__<tool> prefix.",
        ].join(" "),
      }),
    };
  }
  if (["notifications/initialized", "notifications/cancelled", "notifications/progress"].includes(message.method)) {
    return { notification: true };
  }
  if (!hasId) return { notification: true };
  if (message.method === "ping") return { response: jsonRpc(id, {}) };
  if (message.method === "tools/list") {
    try {
      const catalog = await buildTools(context.supabase, context.user, context.appOrigin);
      const tools = catalog.tools.map(({ _drive, ...tool }) => tool);
      return { response: jsonRpc(id, { tools }) };
    } catch (error) {
      return { response: jsonRpcError(id, -32603, error.message || "Could not build user tool catalog.") };
    }
  }
  if (message.method === "tools/call") {
    const name = message.params?.name;
    try {
      const result = await callTool(name, message.params?.arguments || {}, context);
      return { response: jsonRpc(id, result && result.content ? result : textResult(result)) };
    } catch (error) {
      return {
        response: jsonRpc(id, {
          content: [{ type: "text", text: String(error?.message || "Tool execution failed.").slice(0, 1000) }],
          isError: true,
        }),
      };
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
  } catch {
    return response(jsonRpcError(null, -32700, "Request body must be valid JSON."), 400);
  }
  if (Array.isArray(raw)) {
    return response(jsonRpcError(null, -32600, "JSON-RPC batch requests are not supported."), 400);
  }
  const handled = await handleMessage(raw, auth);
  if (handled.notification) return response(null, 202);
  const version = PROTOCOL_VERSIONS.includes(raw?.params?.protocolVersion) ? raw.params.protocolVersion : "2025-03-26";
  return response(handled.response, 200, { "MCP-Protocol-Version": version });
}

export async function GET() {
  return response(
    { error: "MCP Streamable HTTP GET/SSE is not enabled. Send JSON-RPC requests with POST." },
    405,
    { Allow: "POST" }
  );
}

export async function DELETE() {
  return response({ error: "This stateless MCP endpoint does not create sessions." }, 405, { Allow: "POST" });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "POST, OPTIONS",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version",
    },
  });
}
