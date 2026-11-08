import CustomMcpForm from "../components/custom-mcp-form";
import MyMcpPanel, { AddMcpButton } from "../components/my-mcps";
import CopyButton from "../components/copy-button";
import WorkspaceTabs from "../components/workspace-tabs";
import { ArrowUpRight, Blocks, Search, ShieldCheck, Sparkles, Globe2, Package, Server, ExternalLink, Zap, LockKeyhole, Radio, Layers3, Compass, CircleCheck, Info } from "lucide-react";

const REGISTRY = "https://registry.modelcontextprotocol.io";

async function getServers(query, cursor) {
  const glamaKey = process.env.GLAMA_API_KEY;
  if (glamaKey) {
   try {
    const gp = new URLSearchParams({ first: "100", sort: query ? "search-relevance:desc" : "added-at:desc" });
    if (query.trim()) gp.set("query", query.trim());
    if (cursor) gp.set("after", cursor);
    const gr = await fetch("https://glama.ai/api/mcp/v1/servers?" + gp.toString(), { headers: { accept: "application/json", authorization: "Bearer " + glamaKey }, next: { revalidate: 900 }, signal: AbortSignal.timeout(10000) });
    if (!gr.ok) throw new Error("Glama HTTP " + gr.status);
    const gd = await gr.json();
    return { servers: (gd.servers || []).map((x) => ({ server: { name: x.namespace + "/" + x.slug, title: x.name || x.slug, description: x.description || "", version: "Directory listing", repository: x.repository || {}, remotes: [], packages: [] }, _driveSource: "Glama", _driveSourceUrl: x.url, _driveNamespace: x.namespace, _driveTools: (x.tools || []).length, _driveBoosted: x.isBoosted })), metadata: {}, nextCursor: gd.pageInfo && gd.pageInfo.hasNextPage ? gd.pageInfo.endCursor : null, source: "Glama", unavailable: false };
   } catch (error) { console.error("Glama catalog error", error); return { servers: [], metadata: {}, nextCursor: null, source: "Glama", unavailable: true }; }
  }
  const params = new URLSearchParams({ limit: "100", version: "latest" });
  if (query && query.trim().length >= 3) params.set("search", query.trim());
  if (cursor) params.set("cursor", cursor);
  try {
    const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, { headers: { accept: "application/json" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error("Registry unavailable");
    const payload = await response.json();
    return { ...payload, nextCursor: payload.metadata?.nextCursor || null };
  } catch { return { servers: [], metadata: {}, unavailable: true }; }
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
    transport: remotes.length ? "Remote HTTP" : packages.length ? "Package / STDIO" : "Registry entry",
    repository: typeof repository === "string" ? repository : repository?.url || "",
    remotes,
    packageCount: packages.length, source: entry?._driveSource || "Official MCP Registry", sourceUrl: entry?._driveSourceUrl || "", namespace: entry?._driveNamespace || "", toolCount: entry?._driveTools || 0, boosted: entry?._driveBoosted || false,
  };
}
function ServerCard({ entry }) {
  const item = details(entry);
  return <article className="integration-card server-card">
    <div className="card-top"><div className="integration-icon"><Server size={19}/></div><span className="status">{item.source}</span></div>
    <div className="server-meta"><span>{item.transport}</span><span>v{item.version}</span></div>
    <h3>{item.name}</h3><p>{item.description}</p>
    <div className="server-tags"><span><Radio size={11}/>{item.remotes.length ? "Remote endpoint" : "Source package"}</span><span><Package size={11}/>{item.toolCount ? item.toolCount + " tools" : item.packageCount + " packages"}</span>{item.namespace && <span>{item.namespace}</span>}{item.boosted && <span>Promoted</span>}</div>
    <div className="server-id"><code>{item.id}</code><CopyButton value={item.id} label="Copy ID"/></div>
    <div className="card-bottom">{item.repository ? <div className="server-actions"><a href={item.repository} target="_blank" rel="noreferrer">Repository <ExternalLink size={12}/></a><CopyButton value={item.repository} label="Copy URL"/></div> : <span className="availability-note">Publisher metadata</span>}{item.sourceUrl && <a className="source-credit-link" href={item.sourceUrl} target="_blank" rel="noreferrer">View on Glama <ExternalLink size={11}/></a>}
      <AddMcpButton serverName={item.id} version={item.version} remoteAvailable={item.remotes.length>0}/>
    </div>
  </article>;
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q : "";
  const cursor = typeof params?.cursor === "string" ? params.cursor : "";
  const data = await getServers(query, cursor);
  const servers = Array.isArray(data.servers) ? data.servers : [];
  const connections = <><div className="panel-welcome"><div><div className="eyebrow"><span className="pulse"/> YOUR MCP CONTROL CENTER</div><h1>Everything connected.<br/><span>Nothing out of control.</span></h1><p>One workspace to discover MCP servers, manage your tools, and keep every connection visible.</p></div><div className="welcome-orbit"><div className="orbit-ring orbit-one"/><div className="orbit-ring orbit-two"/><div className="orbit-core"><Blocks size={28}/></div><span className="orbit-node node-a"/><span className="orbit-node node-b"/><span className="orbit-node node-c"/></div></div><div className="quick-stats"><div><span className="quick-stat-icon"><CableIcon/></span><strong>Personal</strong><small>connection workspace</small></div><div><span className="quick-stat-icon"><Globe2 size={17}/></span><strong>Official registry</strong><small>public MCP discovery</small></div><div><span className="quick-stat-icon"><LockKeyhole size={17}/></span><strong>Account scoped</strong><small>your connections stay yours</small></div></div><MyMcpPanel/><div className="next-step-strip"><div className="next-step-icon"><Compass size={18}/></div><div><strong>Need another tool?</strong><span>Explore the public directory and add remote-compatible MCPs.</span></div><span className="next-step-link">Discover <ArrowUpRight size={14}/></span></div></>;
  const discover = <section className="catalog-section" id="directory">
    <div className="section-head"><div><div className="eyebrow">THE MCP DIRECTORY</div><h1>Find your next tool.</h1><p>Search a wider catalog of MCP servers, publishers, and tools.</p></div>
      <form className="catalog-search" action="/" method="get"><Search size={16}/><input name="q" defaultValue={query} placeholder="Search servers, publishers, descriptions…" aria-label="Search MCP servers"/><button type="submit">Search</button></form>
    </div>
    <div className="discover-highlights"><div><Globe2 size={16}/><span><strong>Official source</strong><small>Registry data</small></span></div><div><Layers3 size={16}/><span><strong>Latest versions</strong><small>Latest release per server</small></span></div><div><ShieldCheck size={16}/><span><strong>Review first</strong><small>Listings aren't verified</small></span></div></div>
    <div className="directory-toolbar"><div className="directory-stats"><strong>{servers.length}</strong> {query ? "matching results" : "servers on this page"} <span className="registry-live"><i/> Official MCP Registry</span></div>{query && <a href="/">Clear search <span>×</span></a>}</div>
    {data.unavailable ? <div className="empty-state"><Globe2 size={23}/><h3>Registry is taking a break</h3><p>We couldn't reach the official directory. Check your connection and try again.</p><a className="glass-link" href="/">Retry <ArrowUpRight size={13}/></a></div> : servers.length ? <div className="integration-grid">{servers.map((entry,index)=><ServerCard key={`${entry?.server?.name || entry?.name || "server"}:${entry?.server?.version || entry?.version || index}`} entry={entry}/>)}</div> : <div className="empty-state"><Search size={23}/><h3>{query ? "No matching MCPs" : "No servers returned"}</h3><p>{query ? "Try a broader name or capability." : "The registry returned an empty page. Try again shortly."}</p></div>}
    {data.nextCursor && <div className="load-more-row"><a className="load-more-button" href={`/?${new URLSearchParams({ ...(query ? { q: query } : {}), cursor: data.nextCursor }).toString()}`}>Load more servers <ArrowUpRight size={14}/></a><span>Continue browsing the official registry.</span></div>}
    <div className="catalog-note"><Info size={15}/><span>Directory listings are discovery metadata, not a security audit or uptime guarantee. Review publisher identity, repository activity, permissions, and authentication before connecting.</span></div>
  </section>;
  const add = <section className="platform-section" id="custom">
    <div className="eyebrow">BRING YOUR OWN SERVER</div><h1>Add a connection.</h1><p className="section-intro">Connect a hosted Streamable HTTP MCP endpoint to your personal workspace. Local STDIO packages need a separate hosted runtime.</p>
    <div className="add-benefits"><div><LockKeyhole size={17}/><strong>Private to your account</strong><span>Saved under your signed-in profile.</span></div><div><ShieldCheck size={17}/><strong>Verification pending</strong><span>New endpoints aren't enabled automatically.</span></div><div><Zap size={17}/><strong>Remote ready</strong><span>Designed for hosted HTTP MCP servers.</span></div></div>
    <CustomMcpForm/>
  </section>;
  const security = <section className="security-section security-page"><div className="security-heading"><div className="security-icon"><ShieldCheck size={24}/></div><div><div className="eyebrow">TRUST & PERMISSIONS</div><h1>Security, made visible.</h1><p>DRIVE separates discovery from trust. A public listing is only a starting point, not permission to run code.</p></div></div><div className="security-grid"><article><span className="security-card-icon"><EyeIcon/></span><small>01 / BEFORE CONNECTING</small><h3>Verify the publisher</h3><p>Check the repository, maintainer identity, release history, and reported issues before adding a server.</p></article><article><span className="security-card-icon"><KeyRoundIcon/></span><small>02 / BEFORE AUTHORIZING</small><h3>Review access scopes</h3><p>Understand what data a tool can read, change, or send to external services. Avoid granting broad access by default.</p></article><article><span className="security-card-icon"><PowerIcon/></span><small>03 / WHILE USING</small><h3>Keep control of connections</h3><p>Use the connection switch to manage your saved state. Enforcement must happen in the runtime or gateway too.</p></article></div><div className="security-callout"><Info size={17}/><div><strong>Important limitation</strong><p>The ON/OFF switch in DRIVE records your preference. It is not, by itself, a network firewall or execution kill switch. A gateway must enforce runtime access.</p></div></div></section>;
  return <WorkspaceTabs connections={connections} discover={discover} add={add} security={security}/>;
}
function CableIcon(){return <Server size={17}/>}
function EyeIcon(){return <ShieldCheck size={17}/>}
function KeyRoundIcon(){return <LockKeyhole size={17}/>}
function PowerIcon(){return <Zap size={17}/>}
