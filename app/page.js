import CustomMcpForm from "../components/custom-mcp-form";
import MyMcpPanel, { AddMcpButton } from "../components/my-mcps";
import CopyButton from "../components/copy-button";
import { ArrowUpRight, Blocks, Command, Search, ShieldCheck, Sparkles, Zap, Globe2, Package, Server, ExternalLink } from "lucide-react";

const REGISTRY = "https://registry.modelcontextprotocol.io";

async function getServers(query, cursor) {
  const params = new URLSearchParams({ limit: "24", version: "latest" });
  if (query && query.trim().length >= 3) params.set("search", query.trim());
  if (cursor) params.set("cursor", cursor);
  try {
    const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, {
      headers: { accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(9000),
    });
    if (!response.ok) throw new Error(`Registry returned ${response.status}`);
    return await response.json();
  } catch {
    return { servers: [], metadata: {}, unavailable: true };
  }
}

function details(entry) {
  const server = entry?.server ?? entry;
  const remotes = server?.remotes ?? [];
  const packages = server?.packages ?? [];
  const transport = remotes.length ? "Remote MCP" : packages.length ? "Package / STDIO" : "Registry entry";
  const repository = server?.repository?.url || server?.repository || "";
  const website = server?.websiteUrl || server?.website_url || repository || "";
  const description = server?.description || "No description supplied by the publisher.";
  return {
    name: server?.title || server?.name || "Unnamed MCP server",
    id: server?.name || "",
    description,
    version: server?.version || "Latest",
    transport,
    repository: typeof repository === "string" ? repository : repository?.url || "",
    website: typeof website === "string" ? website : "",
    remotes,
    packages,
  };
}

function ServerCard({ entry }) {
  const item = details(entry);
  return <article className="integration-card server-card">
    <div className="card-top"><div className="integration-icon"><Server size={21}/></div><span className="status">Registry listed</span></div>
    <div className="server-meta"><span>{item.transport}</span><span>v{item.version}</span></div>
    <h3>{item.name}</h3>
    <p>{item.description}</p>
    <div className="server-id"><code>{item.id}</code><CopyButton value={item.id} label="Copy ID"/></div>
    <div className="card-bottom">
      {item.repository ? <div className="server-actions"><a href={item.repository} target="_blank" rel="noreferrer">Repository <ExternalLink size={13}/></a><CopyButton value={item.repository} label="Copy URL"/></div> : <span>Publisher metadata</span>}
      <AddMcpButton serverId={item.id + "@" + item.version} remoteAvailable={item.remotes.length > 0}/>
    </div>
  </article>;
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q : "";

  const data = await getServers(query, "");
  const servers = Array.isArray(data.servers) ? data.servers : [];


  return <main className="shell">
    <nav className="nav">
      <a className="brand" href="/"><span className="brand-mark"><Command size={19}/></span><span>DRIVE</span></a>
      <div className="nav-links"><a href="#my-mcps">Connections</a><a href="#directory">Browse</a><a href="#security">Security</a></div>
      <a className="nav-cta" href="#custom">Add MCP <ArrowUpRight size={15}/></a>
    </nav>

    <section className="hero">
      <div className="eyebrow"><span className="pulse"/> DRIVE / WORKSPACE</div>
      <h1>Connections<span>.</span></h1>
      <p className="hero-copy">Manage the MCP servers linked to your account. Enable only the connections you need.</p>
      <div className="hero-actions"><a className="primary-btn" href="#my-mcps">View connections <ArrowUpRight size={15}/></a><a className="secondary-btn" href="#directory">Browse registry</a></div>
      <div className="hero-foot"><span><ShieldCheck size={13}/> Account-scoped</span><span><Zap size={13}/> Manual enable</span></div>
      <div className="orb orb-one"/><div className="orb orb-two"/>
    </section>

    <MyMcpPanel />

    <section className="catalog-section" id="directory">
      <div className="section-head"><div><div className="eyebrow">REGISTRY</div><h2>Browse servers</h2><p>Public listings. Add a server to your workspace only when you choose it.</p></div>
      <form className="catalog-search" action="/" method="get"><Search size={16}/><input name="q" defaultValue={query} placeholder="Search MCP servers (3+ chars)" aria-label="Search MCP servers"/><button type="submit">Search</button></form></div>
      <div className="directory-stats"><span><strong>{servers.length}</strong> matching servers</span><span>Source: registry.modelcontextprotocol.io</span>{query && <a href="/">Clear search</a>}</div>
      {data.unavailable ? <div className="empty-state"><Globe2 size={24}/><h3>Registry temporarily unavailable</h3><p>DRIVE could not reach the official registry. Try again shortly.</p></div> : servers.length ? <div className="integration-grid">{servers.map((entry, index) => <ServerCard key={entry?.server?.name + ":" + entry?.server?.version || index} entry={entry}/>)}</div> : <div className="empty-state"><Search size={24}/><h3>No servers found</h3><p>Try another search term or clear the filter.</p></div>}

      <div className="catalog-note"><Sparkles size={17}/><span>Directory presence is not a safety certification or a promise that a server is remotely connectable. DRIVE displays publisher metadata and transport hints; connection support and security checks are separate steps.</span></div>
    </section>

    <section className="platform-section" id="custom">
      <div className="eyebrow">BRING YOUR OWN SERVER</div><h2>Add a server</h2>
      <p className="section-intro">Missing a server? Add a remote MCP endpoint here. Local STDIO packages need a separate hosted runtime and cannot be connected directly from a browser.</p>
      <div className="principle-grid"><article className="principle"><div className="principle-number"><Globe2 size={17}/></div><h3>Remote endpoint</h3><p>Register a Streamable HTTP MCP URL and configure its authentication method.</p></article><article className="principle"><div className="principle-number"><Package size={17}/></div><h3>Local packages</h3><p>Browse package metadata and setup instructions. Execution requires an isolated runtime.</p></article><article className="principle"><div className="principle-number"><Blocks size={17}/></div><h3>Unified directory</h3><p>Search official registry entries alongside your own private connections.</p></article></div>
      <CustomMcpForm />
    </section>

    <section className="security-section" id="security"><div className="security-icon"><ShieldCheck size={25}/></div><div><div className="eyebrow">CONNECTION POLICY</div><h2>Verify before enabling.</h2><p>A registry listing is a starting point, not a security review. DRIVE keeps unverified servers separate from connected services. Source checks, transport validation and permission controls are required before a connection can be enabled.</p></div></section>
    <footer><a className="brand" href="/"><span className="brand-mark"><Command size={17}/></span><span>DRIVE</span></a><span>One Hub. Every Connection.</span><span>© 2026 DRIVE</span></footer>
  </main>;
}
