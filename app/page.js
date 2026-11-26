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
} from "lucide-react";

const REGISTRY = "https://registry.modelcontextprotocol.io";

const USAGE_RANK_TERMS = [
  "playwright-mcp", "firebase-mcp", "storybook", "browser-use", "chrome-devtools-mcp",
  "color-space", "context7", "snyk", "e2ee", "telnyx", "agent-device", "seleniumbase",
  "ecs-mcp", "desktop-commander", "scrapling", "edgartools", "gitlab-mcp", "sentry-mcp",
  "react-mcp", "firecrawl-mcp-server", "hostinger-api-mcp", "supabase", "azure-mcp",
  "mongodb-mcp-server", "argent", "next-devtools-mcp", "repomix", "ui5", "fiori-mcp-server",
  "llm-sandbox", "figma-context-mcp", "workspace-mcp", "cap-js", "xcodebuildmcp",
  "ms-365-mcp-server", "mcp-clickhouse", "ha-mcp", "nx-console", "kordoc", "svelte-mcp",
  "mobile-mcp", "mcp-graphql-enhanced", "cloudbase-mcp", "metabase-mcp", "sling-cli",
  "dbhub", "serena", "brave-search-mcp-server", "excel-mcp-server", "appwrite",
];

const CATEGORIES = [
  { id: "", label: "All" },
  { id: "github", label: "GitHub" },
  { id: "database", label: "Database" },
  { id: "browser", label: "Browser" },
  { id: "search", label: "Search" },
  { id: "design", label: "Design" },
  { id: "cloud", label: "Cloud" },
  { id: "slack", label: "Messaging" },
  { id: "finance", label: "Finance" },
];

function usageRank(entry) {
  const server = entry?.server || entry || {};
  const haystack = [
    server.name,
    server.title,
    server.repository?.url || server.repository,
    ...(server.packages || []).map((pkg) => pkg.identifier || pkg.name || ""),
  ]
    .join(" ")
    .toLowerCase();
  const index = USAGE_RANK_TERMS.findIndex((term) => haystack.includes(term));
  return index < 0 ? Number.MAX_SAFE_INTEGER : index + 1;
}

async function getServers(query) {
  const all = [];
  const seen = new Set();
  let cursor = "";
  const trimmed = (query || "").trim();
  const maxPages = trimmed ? 4 : 10;

  try {
    for (let i = 0; i < maxPages; i += 1) {
      const params = new URLSearchParams({ limit: "100", version: "latest" });
      if (trimmed.length >= 2) params.set("search", trimmed);
      if (cursor) params.set("cursor", cursor);

      const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, {
        headers: { accept: "application/json" },
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) break;
      const payload = await response.json();
      const batch = Array.isArray(payload?.servers) ? payload.servers : [];
      for (const entry of batch) {
        const key = entry?.server?.name || entry?.name;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        all.push(entry);
      }
      cursor = payload?.metadata?.nextCursor || "";
      if (!cursor || all.length >= 1000) break;
    }
    return { servers: all, unavailable: false };
  } catch {
    return { servers: all, unavailable: all.length === 0 };
  }
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
    packageCount: packages.length,
  };
}

function ServerCard({ entry }) {
  const item = details(entry);
  return (
    <article className="integration-card server-card">
      <div className="card-top">
        <div className="integration-icon">
          <Server size={16} />
        </div>
        <span className="status">{item.isRemote ? "Remote" : "Registry"}</span>
      </div>

      <div className="server-meta">
        <span className="transport-pill">{item.transport}</span>
        <span className="version-pill">v{item.version}</span>
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
  const page = Math.max(0, Math.min(41, Number.parseInt(params?.page || "0", 10) || 0));
  const pageSize = 24;

  const data = await getServers(query);
  const servers = Array.isArray(data.servers) ? [...data.servers] : [];
  if (!query) {
    servers.sort((a, b) => usageRank(a) - usageRank(b));
  }

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
          placeholder="Search MCP servers (GitHub, Supabase, Figma...)"
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
          <strong>{servers.length}</strong> {query ? `results for "${query}"` : "MCPs indexed"}
          <span className="registry-live">
            <i /> Live Registry
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
