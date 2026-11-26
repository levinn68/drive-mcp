import Link from "next/link";
import CustomMcpForm from "../components/custom-mcp-form";
import MyMcpPanel, { AddMcpButton } from "../components/my-mcps";
import WorkspaceTabs from "../components/workspace-tabs";
import SkillLibrary from "../components/skill-library";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe2,
  Search,
  Server,
  ShieldCheck,
} from "lucide-react";

const REGISTRY = "https://registry.modelcontextprotocol.io";
const GLAMA_API = "https://glama.ai/api/mcp/v1/servers";

// Curated, widely-used official Remote Streamable HTTP MCP servers that work immediately via URL/OAuth
const VERIFIED_POPULAR_MCPS = [
  {
    verifiedPopular: true,
    category: "github",
    server: {
      name: "com.github/github-mcp-server",
      title: "GitHub MCP",
      version: "official",
      description: "Official remote GitHub MCP — repos, PRs, issues, CI checks, and code search.",
      repository: { url: "https://github.com/github/github-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://api.githubcopilot.com/mcp/" }],
    },
  },
  {
    verifiedPopular: true,
    category: "cloud",
    server: {
      name: "com.vercel/vercel-mcp",
      title: "Vercel MCP",
      version: "official",
      description: "Official Vercel MCP — deployments, build logs, projects, domains, and env vars.",
      repository: { url: "https://vercel.com/docs/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.vercel.com/" }],
    },
  },
  {
    verifiedPopular: true,
    category: "database",
    server: {
      name: "com.supabase/supabase-mcp",
      title: "Supabase MCP",
      version: "official",
      description: "Official Supabase MCP — SQL queries, migrations, Edge Functions, logs, and Auth.",
      repository: { url: "https://github.com/supabase-community/supabase-mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.supabase.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "search",
    server: {
      name: "com.upstash/context7-mcp",
      title: "Context7 Docs MCP",
      version: "official",
      description: "Live, version-specific documentation & code examples for any library or framework.",
      repository: { url: "https://github.com/upstash/context7" },
      remotes: [{ type: "streamable-http", url: "https://mcp.context7.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    server: {
      name: "com.figma/figma-mcp",
      title: "Figma Dev Mode MCP",
      version: "official",
      description: "Official Figma remote MCP — inspect frames, design tokens, and components.",
      repository: { url: "https://developers.figma.com/docs/figma-mcp-server/" },
      remotes: [{ type: "streamable-http", url: "https://mcp.figma.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    server: {
      name: "com.notion/notion-mcp",
      title: "Notion MCP",
      version: "official",
      description: "Official Notion remote MCP — search workspace, read pages, and update databases.",
      repository: { url: "https://developers.notion.com/docs/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.notion.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    server: {
      name: "app.linear/linear-mcp",
      title: "Linear MCP",
      version: "official",
      description: "Official Linear remote MCP — issues, cycles, projects, and team workflows.",
      repository: { url: "https://linear.app/docs/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.linear.app/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "cloud",
    server: {
      name: "dev.sentry/sentry-mcp",
      title: "Sentry MCP",
      version: "official",
      description: "Official Sentry remote MCP — live error tracking, stack traces, and issue triage.",
      repository: { url: "https://docs.sentry.io/product/sentry-mcp/" },
      remotes: [{ type: "streamable-http", url: "https://mcp.sentry.dev/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "search",
    server: {
      name: "com.deepwiki/deepwiki-mcp",
      title: "DeepWiki MCP",
      version: "free",
      description: "Zero-auth GitHub repo wiki & architecture Q&A powered by Cognition DeepWiki.",
      repository: { url: "https://deepwiki.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.deepwiki.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "search",
    server: {
      name: "com.openai/docs-mcp",
      title: "OpenAI Docs MCP",
      version: "free",
      description: "Zero-auth public OpenAI API, Responses, and Agents SDK documentation search.",
      repository: { url: "https://developers.openai.com/api/docs/guides/tools-connectors-mcp" },
      remotes: [{ type: "streamable-http", url: "https://developers.openai.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "finance",
    server: {
      name: "com.stripe/stripe-mcp",
      title: "Stripe MCP",
      version: "official",
      description: "Official Stripe remote MCP — payments, customers, invoices, and subscriptions.",
      repository: { url: "https://docs.stripe.com/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.stripe.com" }],
    },
  },
  {
    verifiedPopular: true,
    category: "finance",
    server: {
      name: "com.paypal/paypal-mcp",
      title: "PayPal MCP",
      version: "official",
      description: "Official PayPal remote MCP — orders, invoices, disputes, and payment links.",
      repository: { url: "https://developer.paypal.com/tools/mcp-server/" },
      remotes: [{ type: "streamable-http", url: "https://mcp.paypal.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "search",
    server: {
      name: "ai.exa/exa-mcp",
      title: "Exa AI Search MCP",
      version: "official",
      description: "Real-time neural web search, company research, and live code context for AI.",
      repository: { url: "https://github.com/exa-labs/exa-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.exa.ai/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "database",
    server: {
      name: "tech.neon/neon-mcp",
      title: "Neon Postgres MCP",
      version: "official",
      description: "Official Neon serverless Postgres MCP — branches, SQL queries, and schemas.",
      repository: { url: "https://neon.tech/docs/ai/neon-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.neon.tech/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    server: {
      name: "com.atlassian/rovo-mcp",
      title: "Atlassian Jira & Confluence",
      version: "official",
      description: "Official Atlassian Rovo remote MCP for Jira tickets and Confluence docs.",
      repository: { url: "https://www.atlassian.com/platform/remote-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.atlassian.com/v1/mcp/authv2" }],
    },
  },
  {
    verifiedPopular: true,
    category: "ai",
    server: {
      name: "co.hf/huggingface-mcp",
      title: "Hugging Face MCP",
      version: "official",
      description: "Official Hugging Face remote MCP — search models, datasets, papers, and Spaces.",
      repository: { url: "https://huggingface.co/mcp" },
      remotes: [{ type: "streamable-http", url: "https://hf.co/mcp" }],
    },
  },
];

const USAGE_RANK_TERMS = [
  "playwright-mcp", "firebase-mcp", "storybook", "browser-use", "chrome-devtools-mcp",
  "context7", "snyk", "github-mcp", "gitlab-mcp", "sentry-mcp", "firecrawl",
  "supabase", "azure-mcp", "mongodb-mcp-server", "next-devtools-mcp", "repomix",
  "figma-context-mcp", "workspace-mcp", "ms-365-mcp-server", "mcp-clickhouse",
  "brave-search-mcp-server", "appwrite", "cloudflare", "notion", "linear", "stripe",
];

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "remote", label: "Remote Ready" },
  { id: "github", label: "GitHub" },
  { id: "database", label: "Database" },
  { id: "search", label: "Search & Docs" },
  { id: "design", label: "Design" },
  { id: "cloud", label: "Cloud" },
  { id: "productivity", label: "Productivity" },
  { id: "finance", label: "Finance" },
];

function usageRank(entry) {
  if (entry?.verifiedPopular) return 0;
  const server = entry?.server || entry || {};
  const isRemote = Array.isArray(server.remotes) && server.remotes.length > 0;
  const haystack = [
    server.name,
    server.title,
    server.repository?.url || server.repository,
    ...(server.packages || []).map((pkg) => pkg.identifier || pkg.name || ""),
  ]
    .join(" ")
    .toLowerCase();
  const index = USAGE_RANK_TERMS.findIndex((term) => haystack.includes(term));
  if (index >= 0) return (isRemote ? 10 : 100) + index;
  return isRemote ? 500 : 2000;
}

async function fetchOfficialRegistry(apiSearch, maxPages = 22) {
  const results = [];
  let cursor = "";
  for (let i = 0; i < maxPages; i += 1) {
    const params = new URLSearchParams({ limit: "100", version: "latest" });
    if (apiSearch.length >= 2) params.set("search", apiSearch);
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) break;
    const payload = await response.json();
    const batch = Array.isArray(payload?.servers) ? payload.servers : [];
    results.push(...batch);
    cursor = payload?.metadata?.nextCursor || "";
    if (!cursor || results.length >= 2200) break;
  }
  return results;
}

async function fetchGlamaDirectory(apiSearch, maxPages = 10) {
  const results = [];
  let cursor = "";
  for (let i = 0; i < maxPages; i += 1) {
    const params = new URLSearchParams({ first: "100" });
    if (apiSearch.length >= 2) params.set("query", apiSearch);
    if (cursor) params.set("after", cursor);

    const response = await fetch(`${GLAMA_API}?${params}`, {
      headers: { accept: "application/json", "user-agent": "DRIVE-MCP/2.0" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) break;
    const payload = await response.json();
    const batch = Array.isArray(payload?.servers) ? payload.servers : [];
    for (const item of batch) {
      if (!item?.name) continue;
      const slug = item.slug || item.id || item.name;
      const repoUrl = item.repository?.url || "";
      results.push({
        server: {
          name: `${item.namespace || "glama"}/${slug}`,
          title: item.name,
          version: "glama",
          description: item.description || "Indexed from Glama MCP Directory.",
          repository: repoUrl ? { url: repoUrl } : undefined,
          remotes: item.url && /^https?:\/\//i.test(item.url) && item.url.includes("mcp")
            ? [{ type: "streamable-http", url: item.url }]
            : [],
          packages: [],
        },
      });
    }
    cursor = payload?.pageInfo?.hasNextPage ? payload?.pageInfo?.endCursor || "" : "";
    if (!cursor || results.length >= 1000) break;
  }
  return results;
}

async function getServers(query) {
  const all = [];
  const seen = new Set();
  const trimmed = (query || "").trim();
  const lower = trimmed.toLowerCase();
  const apiSearch = lower && lower !== "remote" ? trimmed : "";

  for (const item of VERIFIED_POPULAR_MCPS) {
    const hay = [
      item.server.title,
      item.server.name,
      item.server.description,
      item.category,
    ]
      .join(" ")
      .toLowerCase();
    if (!lower || lower === "remote" || hay.includes(lower)) {
      seen.add(item.server.name.toLowerCase());
      all.push(item);
    }
  }

  const [officialRes, glamaRes] = await Promise.allSettled([
    fetchOfficialRegistry(apiSearch, apiSearch ? 5 : 22),
    fetchGlamaDirectory(apiSearch, apiSearch ? 3 : 10),
  ]);

  const combined = [
    ...(officialRes.status === "fulfilled" ? officialRes.value : []),
    ...(glamaRes.status === "fulfilled" ? glamaRes.value : []),
  ];

  for (const entry of combined) {
    const key = String(entry?.server?.name || entry?.name || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    if (lower === "remote" && !(entry?.server?.remotes?.length > 0)) continue;
    seen.add(key);
    all.push(entry);
    if (all.length >= 3000) break;
  }

  return { servers: all, unavailable: all.length === 0 };
}

function details(entry) {
  const server = entry?.server ?? entry ?? {};
  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const packages = Array.isArray(server.packages) ? server.packages : [];
  const repo = server.repository?.url || server.repository || "";
  return {
    name: server.title || server.name || "Unnamed MCP",
    id: server.name || "",
    description: server.description || "MCP server published to the Official Registry.",
    version: server.version || "latest",
    transport: remotes.length ? "Remote HTTP" : packages.length ? "STDIO" : "Registry",
    repository: typeof repo === "string" ? repo : repo?.url || "",
    isRemote: remotes.length > 0,
    verifiedPopular: Boolean(entry?.verifiedPopular),
  };
}

function ServerCard({ entry }) {
  const item = details(entry);
  return (
    <article className="integration-card server-card">
      <div className="card-top">
        <div className="integration-icon">
          {item.verifiedPopular ? <ShieldCheck size={16} /> : <Server size={16} />}
        </div>
        <span className={`status ${item.verifiedPopular ? "is-enabled" : ""}`}>
          {item.verifiedPopular ? "Verified" : item.isRemote ? "Remote" : "STDIO"}
        </span>
      </div>

      <div className="server-meta">
        <span className="transport-pill">{item.transport}</span>
        <span className="version-pill">
          {["official", "free", "glama"].includes(item.version) ? item.version : `v${item.version}`}
        </span>
      </div>

      <h3>{item.name}</h3>
      <p>{item.description}</p>

      <div className="card-bottom">
        {item.repository ? (
          <div className="server-actions">
            <a href={item.repository} target="_blank" rel="noreferrer">
              Source <ExternalLink size={11} />
            </a>
          </div>
        ) : null}
        <AddMcpButton
          serverName={item.id}
          version={item.version}
          registryEntry={entry}
          remoteAvailable={item.isRemote}
        />
      </div>
    </article>
  );
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q : "";
  const page = Math.max(0, Math.min(130, Number.parseInt(params?.page || "0", 10) || 0));
  const pageSize = 24;

  const data = await getServers(query);
  const servers = Array.isArray(data.servers) ? [...data.servers] : [];
  servers.sort((a, b) => usageRank(a) - usageRank(b));

  const totalPages = Math.max(1, Math.ceil(servers.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visibleServers = servers.slice(safePage * pageSize, (safePage + 1) * pageSize);

  const buildPageHref = (nextPage) => {
    const p = new URLSearchParams();
    if (query) p.set("q", query);
    if (nextPage > 0) p.set("page", String(nextPage));
    const qs = p.toString();
    return qs ? `/?${qs}` : "/";
  };

  const connections = <MyMcpPanel />;

  const discover = (
    <section className="catalog-section" id="directory">
      <form className="catalog-search" action="/" method="get">
        <Search size={15} />
        <input
          name="q"
          defaultValue={query}
          placeholder="Search 3,000+ MCPs (GitHub, Supabase, Vercel...)"
          aria-label="Search MCP servers"
        />
        <button type="submit">Search</button>
      </form>

      <div className="mcp-category-filter" aria-label="Quick categories">
        {CATEGORIES.map((cat) => {
          const isActive = (query || "").toLowerCase() === cat.id;
          return (
            <Link
              key={cat.label}
              href={cat.id ? `/?q=${encodeURIComponent(cat.id)}` : "/"}
              className={`category-chip ${isActive ? "is-active" : ""}`}
            >
              {cat.label}
            </Link>
          );
        })}
      </div>

      <div className="directory-toolbar">
        <div className="directory-stats">
          <strong>{servers.length.toLocaleString()}</strong>{" "}
          {query ? `results for "${query}"` : "MCPs indexed"}
          <span className="registry-live">
            <i /> Verified Remote First
          </span>
        </div>
        {query ? (
          <Link href="/" className="glass-link">
            Clear ×
          </Link>
        ) : null}
      </div>

      {data.unavailable ? (
        <div className="empty-state">
          <Globe2 size={22} />
          <h3>Registry temporarily unavailable</h3>
          <p>Try refreshing in a moment.</p>
        </div>
      ) : visibleServers.length ? (
        <div className="integration-grid">
          {visibleServers.map((entry, index) => (
            <ServerCard
              key={`${entry?.server?.name || entry?.name || "server"}:${
                entry?.server?.version || entry?.version || index
              }`}
              entry={entry}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search size={22} />
          <h3>No matching MCPs</h3>
          <p>Try a broader keyword or clear the filter.</p>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="load-more-row">
          {safePage > 0 ? (
            <Link className="glass-chip-btn" href={buildPageHref(safePage - 1)}>
              <ArrowLeft size={13} /> Prev
            </Link>
          ) : null}
          <span>
            Page {safePage + 1} / {totalPages}
          </span>
          {safePage + 1 < totalPages ? (
            <Link className="load-more-button" href={buildPageHref(safePage + 1)}>
              Next <ArrowRight size={13} />
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );

  const add = (
    <section className="platform-section" id="custom">
      <div className="section-head">
        <div>
          <div className="eyebrow">CUSTOM ENDPOINT</div>
          <h1>Add MCP Server</h1>
          <p className="section-intro">
            Connect any remote Streamable HTTP MCP URL directly to your DRIVE account.
          </p>
        </div>
      </div>
      <CustomMcpForm />
    </section>
  );

  const skills = <SkillLibrary />;

  return (
    <WorkspaceTabs
      connections={connections}
      discover={discover}
      add={add}
      skills={skills}
      initialTab="mcp"
      serverCount={servers.length}
      query={query}
    />
  );
}
