import CustomMcpForm from "../components/custom-mcp-form";
import MyMcpPanel, { AddMcpButton } from "../components/my-mcps";
import CopyButton from "../components/copy-button";
import WorkspaceTabs from "../components/workspace-tabs";
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

async function getServers(query, cursor) {
  const glamaKey = process.env.GLAMA_API_KEY;
  if (glamaKey) {
    try {
      const gp = new URLSearchParams({
        first: "100",
        sort: query ? "search-relevance:desc" : "added-at:desc",
      });
      if (query.trim()) gp.set("query", query.trim());
      if (cursor) gp.set("after", cursor);
      const gr = await fetch("https://glama.ai/api/mcp/v1/servers?" + gp.toString(), {
        headers: { accept: "application/json", authorization: "Bearer " + glamaKey },
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(10000),
      });
      if (!gr.ok) throw new Error("Glama HTTP " + gr.status);
      const gd = await gr.json();
      return {
        servers: (gd.servers || []).map((x) => ({
          server: {
            name: x.namespace + "/" + x.slug,
            title: x.name || x.slug,
            description: x.description || "",
            version: "Directory listing",
            repository: x.repository || {},
            remotes: [],
            packages: [],
          },
          _driveSource: "Glama",
          _driveSourceUrl: x.url,
          _driveNamespace: x.namespace,
          _driveTools: (x.tools || []).length,
          _driveBoosted: x.isBoosted,
        })),
        metadata: {},
        nextCursor: gd.pageInfo && gd.pageInfo.hasNextPage ? gd.pageInfo.endCursor : null,
        source: "Glama",
        unavailable: false,
      };
    } catch (error) {
      console.error("Glama catalog error", error);
      return { servers: [], metadata: {}, nextCursor: null, source: "Glama", unavailable: true };
    }
  }
  const params = new URLSearchParams({ limit: "100", version: "latest" });
  if (query && query.trim().length >= 3) params.set("search", query.trim());
  if (cursor) params.set("cursor", cursor);
  try {
    const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error("Registry unavailable");
    const payload = await response.json();
    return { ...payload, nextCursor: payload.metadata?.nextCursor || null };
  } catch {
    return { servers: [], metadata: {}, unavailable: true };
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

function ServerCard({ entry }) {
  const item = details(entry);
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
      </div>

      <h3>{item.name}</h3>
      <p>{item.description}</p>

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
          {item.sourceUrl && (
            <a
              className="source-credit-link"
              href={item.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span>Glama</span>
              <ExternalLink size={11} />
            </a>
          )}
        </div>
        <AddMcpButton
          serverName={item.id}
          version={item.version}
          remoteAvailable={isRemote}
        />
      </div>
    </article>
  );
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q : "";
  const cursor = typeof params?.cursor === "string" ? params.cursor : "";
  const data = await getServers(query, cursor);
  const servers = Array.isArray(data.servers) ? data.servers : [];
  const initialTab = query || cursor ? "discover" : "connections";

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
            placeholder="Search servers, publishers, capabilities…"
            aria-label="Search MCP servers"
          />
          <button type="submit">Search</button>
        </form>
      </div>

      <div className="catalog-source-line">
        <span className="source-indicator" />
        {data.source === "Glama" ? (
          <>
            Directory data powered by{" "}
            <a href="https://glama.ai" target="_blank" rel="noreferrer">
              Glama
            </a>
          </>
        ) : (
          <>
            Official MCP Registry{" "}
            <span className="setup-needed">Optional: set GLAMA_API_KEY for expanded index</span>
          </>
        )}
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
          <span>{query ? `matching results for "${query}"` : "servers on this page"}</span>
          <span className="registry-live">
            <i /> {data.source === "Glama" ? "Glama Index" : "Official MCP Registry"}
          </span>
        </div>
        {query && (
          <a className="clear-search-pill" href="/#directory">
            <span>Clear search</span>
            <span aria-hidden="true">×</span>
          </a>
        )}
      </div>

      {data.unavailable ? (
        <div className="empty-state">
          <div className="empty-orb">
            <Globe2 size={24} />
          </div>
          <h3>Registry is taking a moment</h3>
          <p>We couldn&apos;t reach the upstream MCP directory right now. Check connectivity or retry shortly.</p>
          <a className="glass-link is-primary" href="/#directory">
            <span>Retry connection</span>
            <ArrowUpRight size={13} />
          </a>
        </div>
      ) : servers.length ? (
        <div className="integration-grid">
          {servers.map((entry, index) => (
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
            <a className="glass-link" href="/#directory">
              Reset search
            </a>
          )}
        </div>
      )}

      {data.nextCursor && (
        <div className="load-more-row">
          <a
            className="load-more-button"
            href={`/?${new URLSearchParams({
              ...(query ? { q: query } : {}),
              cursor: data.nextCursor,
            }).toString()}#directory`}
          >
            <span>Load next page</span>
            <ArrowUpRight size={14} />
          </a>
          <span>Continue browsing the MCP catalog</span>
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
      initialTab={initialTab}
      serverCount={servers.length}
      query={query}
    />
  );
}
