import Link from "next/link";
import CustomMcpForm from "../components/custom-mcp-form";
import MyMcpPanel, { AddMcpButton } from "../components/my-mcps";
import CopyButton from "../components/copy-button";
import WorkspaceTabs from "../components/workspace-tabs";
import SkillLibrary from "../components/skill-library";
import {
  ArrowUpRight,
  Blocks,
  Compass,
  ExternalLink,
  Globe2,
  Info,
  Layers3,
  LockKeyhole,
  Package,
  Plus,
  Radio,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

const REGISTRY = "https://registry.modelcontextprotocol.io";

// Popularity order seeded from public monthly package-download leaderboards.
// These are matched against official registry names/titles/repository metadata;
// entries without comparable public download data remain after the ranked set.
const USAGE_RANK_TERMS = [
  "playwright-mcp", "firebase-mcp", "storybook", "browser-use", "chrome-devtools-mcp",
  "color-space", "context7", "snyk", "e2ee", "telnyx", "agent-device", "seleniumbase",
  "ecs-mcp", "desktop-commander", "scrapling", "edgartools", "gitlab-mcp", "sentry-mcp",
  "rea", "firecrawl-mcp-server", "hostinger-api-mcp", "supabase", "azure-mcp", "mongodb-mcp-server",
  "argent", "next-devtools-mcp", "repomix", "ui5", "fiori-mcp-server", "llm-sandbox",
  "figma-context-mcp", "workspace-mcp", "cap-js", "xcodebuildmcp", "ms-365-mcp-server",
  "mcp-clickhouse", "ha-mcp", "nx-console", "kordoc", "svelte-mcp", "mobile-mcp",
  "mcp-graphql-enhanced", "cloudbase-mcp", "metabase-mcp", "sling-cli", "dbhub", "serena",
  "brave-search-mcp-server", "excel-mcp-server", "appwrite"
];

function usageRank(entry) {
  const server = entry?.server || entry || {};
  const haystack = [server.name, server.title, server.repository?.url || server.repository,
    ...(server.packages || []).map((pkg) => pkg.identifier || pkg.name || "")].join(" ").toLowerCase();
  const index = USAGE_RANK_TERMS.findIndex((term) => haystack.includes(term));
  return index < 0 ? Number.MAX_SAFE_INTEGER : index + 1;
}

async function getServers(query) {
  const all = [];
  const seen = new Set();
  let cursor = "";
  try {
    for (let page = 0; page < 10 && all.length < 1000; page++) {
      const params = new URLSearchParams({ limit: "100", version: "latest" });
      if (query && query.trim().length >= 3) params.set("search", query.trim());
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, {
        headers: { accept: "application/json" },
        next: { revalidate: query ? 900 : 3600 },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error("Registry unavailable");
      const payload = await response.json();
      for (const entry of payload.servers || []) {
        const server = entry?.server || entry;
        const key = `${server?.name || ""}@${server?.version || ""}`;
        if (server?.name && !seen.has(key)) { seen.add(key); all.push(entry); }
        if (all.length >= 1000) break;
      }
      cursor = payload.metadata?.nextCursor || "";
      if (!cursor) break;
    }
    return { servers: all.slice(0, 1000), nextCursor: cursor || null, unavailable: false };
  } catch {
    return { servers: all.slice(0, 1000), nextCursor: cursor || null, unavailable: all.length === 0 };
  }
}

function details(entry) {
  const server = entry?.server ?? entry;
  const remotes = server?.remotes ?? [];
  const packages = server?.packages ?? [];
  const repository = server?.repository?.url || server?.repository || "";
  return {
    name: server?.title || server?.name || "Unnamed MCP server",
    id: server?.name || "",
    description: server?.description || "No description supplied by publisher.",
    version: server?.version || "Latest",
    transport: remotes.length
      ? "Remote HTTP"
      : packages.length
      ? "Package / STDIO"
      : "Registry entry",
    repository: typeof repository === "string" ? repository : repository?.url || "",
    remotes,
    packageCount: packages.length,
    source: entry?._driveSource || "Official Registry",
    sourceUrl: entry?._driveSourceUrl || "",
    namespace: entry?._driveNamespace || "",
    toolCount: entry?._driveTools || 0,
    boosted: entry?._driveBoosted || false,
  };
}

async function ServerCard({ entry }) {
  const item = details(entry);
  let stars = null;
  try {
    const match = item.repository.match(/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (match) {
      const response = await fetch(`https://api.github.com/repos/${match[1]}/${match[2].replace(/\.git$/, "")}`, {
        headers: { accept: "application/vnd.github+json" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000),
      });
      if (response.ok) {
        const repository = await response.json();
        stars = Number(repository.stargazers_count || 0);
      }
    }
  } catch {}
  const isRemote = item.remotes.length > 0;
  return (
    <article className="integration-card server-card">
      <div className="card-top">
        <div className={`integration-icon ${isRemote ? "is-remote" : ""}`}>
          <Server size={18} />
        </div>
        <div className="card-badges">
          <span className={`status ${isRemote ? "is-remote" : ""}`}>
            {isRemote ? "Remote Ready" : item.source}
          </span>
          {item.boosted && (
            <span className="status is-promoted">
              <Sparkles size={10} /> Featured
            </span>
          )}
        </div>
      </div>

      <div className="server-meta">
        <span className="transport-pill">{item.transport}</span>
        <span className="version-pill">v{item.version}</span>
        {usageRank(entry) <= 50 && <span className="version-pill" title="Ranked by public monthly package downloads">↗ Usage #{usageRank(entry)}</span>}
        {stars !== null && <span className="version-pill" title="GitHub stars">★ {stars.toLocaleString()}</span>}
      </div>

      <h3>{item.name}</h3>
      <p>{item.description.length > 145 ? `${item.description.slice(0, 142).trimEnd()}…` : item.description}</p>

      <div className="server-tags">
        <span>
          <Radio size={11} />
          {isRemote ? "Streamable HTTP" : "STDIO Package"}
        </span>
        <span>
          <Package size={11} />
          {item.toolCount ? `${item.toolCount} tools` : `${item.packageCount} pkg`}
        </span>
        {item.namespace && <span>@{item.namespace}</span>}
      </div>

      <div className="server-id">
        <code>{item.id}</code>
        <CopyButton value={item.id} label="ID" />
      </div>

      <div className="card-bottom">
        <div className="server-actions">
          {item.repository ? (
            <>
              <a
                className="repo-link"
                href={item.repository}
                target="_blank"
                rel="noreferrer"
              >
                <span>Source</span>
                <ExternalLink size={12} />
              </a>
              <CopyButton value={item.repository} label="URL" />
            </>
          ) : (
            <span className="availability-note">Registry metadata</span>
          )}
        </div>
        <AddMcpButton
          serverName={item.id}
          version={item.version}
          registryEntry={entry}
          remoteAvailable={isRemote}
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
  if (!query) servers.sort((a, b) => usageRank(a) - usageRank(b));
  const visibleServers = servers.slice(page * pageSize, (page + 1) * pageSize);
  const initialTab = "mcp";

  const connections = (
    <div className="workspace-stack">
      <div className="panel-welcome glass-surface">
        <div className="welcome-copy">
          <div className="eyebrow">
            <span className="pulse" /> YOUR LIQUID MCP CONTROL CENTER
          </div>
          <h1>
            Everything connected.
            <br />
            <span>Nothing out of control.</span>
          </h1>
          <p>
            One tactile Cupertino Liquid Glass workspace to discover MCP servers, register Streamable HTTP endpoints, and govern every tool connection.
          </p>
          <div className="welcome-cta-row">
            <a href="#directory" className="glass-cta-primary">
              <Compass size={15} />
              <span>Explore Directory</span>
              <ArrowUpRight size={14} />
            </a>
            <a href="#custom" className="glass-cta-secondary">
              <Plus size={15} />
              <span>Add Custom Server</span>
            </a>
          </div>
        </div>
        <div className="welcome-orbit" aria-hidden="true">
          <div className="orbit-ring orbit-one" />
          <div className="orbit-ring orbit-two" />
          <div className="orbit-core">
            <Blocks size={28} />
          </div>
          <span className="orbit-node node-a" />
          <span className="orbit-node node-b" />
          <span className="orbit-node node-c" />
        </div>
      </div>

      <div className="quick-stats">
        <a href="#my-mcps" className="quick-stat-card">
          <span className="quick-stat-icon">
            <Server size={18} />
          </span>
          <div>
            <strong>Personal Hub</strong>
            <small>Scoped connection workspace</small>
          </div>
        </a>
        <a href="#directory" className="quick-stat-card">
          <span className="quick-stat-icon">
            <Globe2 size={18} />
          </span>
          <div>
            <strong>{servers.length || "Official"} Catalog</strong>
            <small>Live MCP registry index</small>
          </div>
        </a>
        <a href="#security" className="quick-stat-card">
          <span className="quick-stat-icon">
            <LockKeyhole size={18} />
          </span>
          <div>
            <strong>Account Scoped</strong>
            <small>Protected by Supabase RLS</small>
          </div>
        </a>
      </div>

      <MyMcpPanel />

      <a href="#directory" className="next-step-strip">
        <div className="next-step-icon">
          <Compass size={18} />
        </div>
        <div>
          <strong>Need another MCP capability?</strong>
          <span>Browse the public registry and connect remote-compatible servers in one tap.</span>
        </div>
        <span className="next-step-link">
          <span>Discover</span>
          <ArrowUpRight size={14} />
        </span>
      </a>
    </div>
  );

  const discover = (
    <section className="catalog-section glass-surface" id="directory">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            <span className="pulse" /> THE MCP DIRECTORY
          </div>
          <h1>Find your next tool.</h1>
          <p>
            Search and evaluate official Model Context Protocol servers, publishers, and remote-capable endpoints.
          </p>
        </div>
        <form className="catalog-search" action="/#directory" method="get">
          <Search size={16} />
          <input
            name="q"
            defaultValue={query}
            placeholder="Smart search: describe a task, tool, provider, or capability…"
            aria-label="Search MCP servers"
          />
          <button type="submit">Search</button>
        </form>
      </div>

      <div className="mcp-category-filter" role="group" aria-label="Browse MCP by category">
        {[
          ["All MCPs", ""],
          ["AI & Agents", "ai agent"],
          ["Development", "developer code"],
          ["Databases", "database"],
          ["Search & Knowledge", "search"],
          ["Productivity", "productivity"],
          ["Automation", "automation"],
          ["Cloud & Infrastructure", "cloud"],
          ["Communication", "communication"],
          ["Security", "security"],
        ].map(([label, term]) => (
          <Link key={label} className={(!term && !query) || (term && query === term) ? "category-chip is-active" : "category-chip"} href={term ? `/?q=${encodeURIComponent(term)}#directory` : "/#directory"}>{label}</Link>
        ))}
      </div>

      <div className="catalog-source-line">
        <span className="source-indicator" />
        Official MCP Registry · Popular servers ranked by public monthly package downloads, followed by the full directory
      </div>

      <div className="discover-highlights">
        <div>
          <span className="highlight-icon">
            <Globe2 size={16} />
          </span>
          <span>
            <strong>Official Source</strong>
            <small>Live registry metadata</small>
          </span>
        </div>
        <div>
          <span className="highlight-icon">
            <Layers3 size={16} />
          </span>
          <span>
            <strong>Latest Releases</strong>
            <small>Version-tracked entries</small>
          </span>
        </div>
        <div>
          <span className="highlight-icon">
            <ShieldCheck size={16} />
          </span>
          <span>
            <strong>Review Before Trust</strong>
            <small>Audit scopes & source</small>
          </span>
        </div>
      </div>

      <div className="directory-toolbar">
        <div className="directory-stats">
          <strong>{servers.length}</strong>{" "}
          <span>{query ? `matching results for "${query}"` : "MCP servers indexed"}</span>
          <span className="registry-live">
            <i /> Official MCP Registry
          </span>
        </div>
        {query && (
          <Link className="clear-search-pill" href="/#directory">
            <span>Clear search</span>
            <span aria-hidden="true">×</span>
          </Link>
        )}
      </div>

      {data.unavailable ? (
        <div className="empty-state">
          <div className="empty-orb">
            <Globe2 size={24} />
          </div>
          <h3>Registry is taking a moment</h3>
          <p>We couldn&apos;t reach the upstream MCP directory right now. Check connectivity or retry shortly.</p>
          <Link className="glass-link is-primary" href="/#directory">
            <span>Retry connection</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      ) : servers.length ? (
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
          <div className="empty-orb">
            <Search size={24} />
          </div>
          <h3>{query ? "No matching MCP servers" : "No servers returned"}</h3>
          <p>
            {query
              ? "Try a broader keyword (minimum 3 characters for registry search) or clear your filter."
              : "The registry returned an empty page. Try refreshing shortly."}
          </p>
          {query && (
            <Link className="glass-link" href="/#directory">
              Reset search
            </Link>
          )}
        </div>
      )}

      {servers.length > pageSize && (
        <div className="load-more-row">
          {page > 0 && <a className="load-more-button" href={`/?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page - 1) }).toString()}#mcp`}>Previous</a>}
          <span>Page {page + 1} of {Math.ceil(servers.length / pageSize)} · {servers.length.toLocaleString()} MCP servers loaded</span>
          {(page + 1) * pageSize < servers.length && <a className="load-more-button" href={`/?${new URLSearchParams({ ...(query ? { q: query } : {}), page: String(page + 1) }).toString()}#mcp`}>Next <ArrowUpRight size={14}/></a>}
        </div>
      )}

      <div className="catalog-note">
        <Info size={16} />
        <span>
          Directory listings provide discovery metadata, not an automated security audit or SLA guarantee. Always inspect publisher identity, repository commits, and requested permissions before enabling an endpoint.
        </span>
      </div>
    </section>
  );

  const add = (
    <section className="platform-section glass-surface" id="custom">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            <span className="pulse" /> BRING YOUR OWN SERVER
          </div>
          <h1>Add a connection.</h1>
          <p className="section-intro">
            Connect a hosted Streamable HTTP MCP endpoint to your personal workspace. Local STDIO packages require an isolated local or container runtime.
          </p>
        </div>
      </div>

      <div className="add-benefits">
        <div>
          <span className="benefit-icon">
            <LockKeyhole size={17} />
          </span>
          <strong>Private to your account</strong>
          <span>Saved under your authenticated Google profile with strict row-level security.</span>
        </div>
        <div>
          <span className="benefit-icon">
            <ShieldCheck size={17} />
          </span>
          <strong>Verification gated</strong>
          <span>New custom endpoints start disabled until transport verification completes.</span>
        </div>
        <div>
          <span className="benefit-icon">
            <Zap size={17} />
          </span>
          <strong>Streamable HTTP ready</strong>
          <span>Built for modern remote HTTPS MCP servers with DNS-level SSRF checks.</span>
        </div>
      </div>

      <CustomMcpForm />
    </section>
  );

  const skills = <SkillLibrary />;

  const security = (
    <section className="security-section security-page glass-surface" id="security">
      <div className="security-heading">
        <div className="security-icon">
          <ShieldCheck size={26} />
        </div>
        <div>
          <div className="eyebrow">
            <span className="pulse" /> TRUST & PERMISSIONS
          </div>
          <h1>Security, made visible.</h1>
          <p>
            DRIVE separates public discovery from execution trust. Appearing in an open registry is a starting point for review—never automatic permission to run code or access private data.
          </p>
        </div>
      </div>

      <div className="security-grid">
        <article>
          <span className="security-card-icon">
            <ShieldCheck size={18} />
          </span>
          <small>01 / BEFORE CONNECTING</small>
          <h3>Verify the publisher</h3>
          <p>
            Inspect the source repository, maintainer identity, release history, and open issues before registering or enabling any MCP server.
          </p>
        </article>
        <article>
          <span className="security-card-icon">
            <LockKeyhole size={18} />
          </span>
          <small>02 / BEFORE AUTHORIZING</small>
          <h3>Review access scopes</h3>
          <p>
            Evaluate what files, credentials, or external APIs a tool can read or mutate. Apply least-privilege access by default.
          </p>
        </article>
        <article>
          <span className="security-card-icon">
            <Zap size={18} />
          </span>
          <small>03 / WHILE USING</small>
          <h3>Enforce runtime control</h3>
          <p>
            Use the workspace switch to govern your saved connection state and pair DRIVE with an enforcing MCP gateway at runtime.
          </p>
        </article>
      </div>

      <div className="security-callout">
        <Info size={18} />
        <div>
          <strong>Important runtime boundary</strong>
          <p>
            The ON/OFF switch in DRIVE records your account preference in Supabase. Your executing MCP client or gateway must read this state to enforce network and tool execution boundaries.
          </p>
        </div>
      </div>
    </section>
  );

  return (
    <WorkspaceTabs
      connections={connections}
      discover={discover}
      add={add}
      security={security}
      skills={skills}
      initialTab={initialTab}
      serverCount={servers.length}
      query={query}
    />
  );
}
