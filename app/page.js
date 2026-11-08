import CustomMcpForm from "../components/custom-mcp-form";
import MyMcpPanel, { AddMcpButton } from "../components/my-mcps";
import CopyButton from "../components/copy-button";
import WorkspaceTabs from "../components/workspace-tabs";
import { ArrowUpRight, Blocks, Search, ShieldCheck, Sparkles, Globe2, Package, Server, ExternalLink } from "lucide-react";

const REGISTRY = "https://registry.modelcontextprotocol.io";

async function getServers(query) {
  const params = new URLSearchParams({ limit: "24", version: "latest" });
  if (query && query.trim().length >= 3) params.set("search", query.trim());
  try {
    const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, { headers: { accept: "application/json" }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) });
    if (!response.ok) throw new Error("Registry unavailable");
    return await response.json();
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
    transport: remotes.length ? "Remote MCP" : packages.length ? "Package / STDIO" : "Registry entry",
    repository: typeof repository === "string" ? repository : repository?.url || "",
    remotes,
  };
}
function ServerCard({ entry }) {
  const item = details(entry);
  return <article className="integration-card server-card">
    <div className="card-top"><div className="integration-icon"><Server size={19}/></div><span className="status">Listed</span></div>
    <div className="server-meta"><span>{item.transport}</span><span>v{item.version}</span></div>
    <h3>{item.name}</h3><p>{item.description}</p>
    <div className="server-id"><code>{item.id}</code><CopyButton value={item.id} label="Copy ID"/></div>
    <div className="card-bottom">{item.repository ? <div className="server-actions"><a href={item.repository} target="_blank" rel="noreferrer">Source <ExternalLink size={12}/></a><CopyButton value={item.repository} label="Copy URL"/></div> : <span>Publisher metadata</span>}
      <AddMcpButton serverId={item.id + "@" + item.version} remoteAvailable={item.remotes.length>0}/>
    </div>
  </article>;
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q : "";
  const data = await getServers(query);
  const servers = Array.isArray(data.servers) ? data.servers : [];
  const connections = <MyMcpPanel/>;
  const discover = <section className="catalog-section" id="directory">
    <div className="section-head"><div><div className="eyebrow">PUBLIC REGISTRY</div><h1>Discover MCPs</h1><p>Browse public servers. Add only the ones you need.</p></div>
      <form className="catalog-search" action="/" method="get"><Search size={15}/><input name="q" defaultValue={query} placeholder="Search servers…" aria-label="Search MCP servers"/><button type="submit">Search</button></form>
    </div>
    <div className="directory-stats"><span><strong>{servers.length}</strong> results</span><span>Official MCP Registry</span>{query && <a href="/">Clear</a>}</div>
    {data.unavailable ? <div className="empty-state"><Globe2 size={23}/><h3>Registry unavailable</h3><p>Try again shortly.</p></div> : servers.length ? <div className="integration-grid">{servers.map((entry,index)=><ServerCard key={entry?.server?.name+":"+entry?.server?.version||index} entry={entry}/>)}</div> : <div className="empty-state"><Search size={23}/><h3>No servers found</h3><p>Try another search.</p></div>}
    <div className="catalog-note"><Sparkles size={15}/><span>A registry listing is not a security certification or proof of remote compatibility.</span></div>
  </section>;
  const add = <section className="platform-section" id="custom">
    <div className="eyebrow">CUSTOM SERVER</div><h1>Add an MCP</h1><p className="section-intro">Register a remote Streamable HTTP endpoint. Local STDIO packages need a hosted runtime.</p>
    <CustomMcpForm/>
  </section>;
  const security = <section className="security-section" id="security"><div className="security-icon"><ShieldCheck size={23}/></div><div><div className="eyebrow">CONNECTION POLICY</div><h1>Security</h1><p>Registry entries start unverified. Verify endpoints and review permissions before enabling a connection. OFF must be enforced by the gateway, not only displayed in this interface.</p></div></section>;
  return <WorkspaceTabs connections={connections} discover={discover} add={add} security={security}/>;
}
