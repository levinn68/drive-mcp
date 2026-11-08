import { ArrowUpRight, Blocks, Command, Github, Figma, Cloud, Database, MessageSquare, Search, ShieldCheck, Sparkles, Workflow, Zap } from "lucide-react";

const integrations = [
  { name: "GitHub", category: "Developer tools", description: "Repositories, issues, pull requests and code workflows.", status: "Catalog", icon: Github },
  { name: "Figma", category: "Design", description: "Design files, components, comments and team assets.", status: "Catalog", icon: Figma },
  { name: "Supabase", category: "Database", description: "Projects, SQL, authentication and storage operations.", status: "Catalog", icon: Database },
  { name: "Cloudflare", category: "Infrastructure", description: "Workers, DNS, security and edge infrastructure.", status: "Catalog", icon: Cloud },
  { name: "Notion", category: "Knowledge", description: "Pages, databases and team knowledge spaces.", status: "Planned", icon: Blocks },
  { name: "Slack", category: "Communication", description: "Messages, channels and team workflows.", status: "Planned", icon: MessageSquare },
];

const principles = [
  ["One catalog", "Discover integrations from one curated directory."],
  ["Secure by default", "Per-user access, scoped permissions and audit trails."],
  ["MCP-native", "A unified gateway built around remote MCP transport."],
];

export default function Home() {
  return (
    <main className="shell">
      <nav className="nav">
        <a className="brand" href="#"><span className="brand-mark"><Command size={19}/></span><span>NEXORA</span></a>
        <div className="nav-links"><a href="#catalog">Integrations</a><a href="#security">Security</a><a href="#architecture">Platform</a></div>
        <a className="nav-cta" href="#catalog">Explore catalog <ArrowUpRight size={15}/></a>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span className="pulse"/> THE MCP CONNECTION HUB</div>
        <h1>One hub.<br/><span>Every connection.</span></h1>
        <p className="hero-copy">Connect the tools you use to the AI systems you trust. Discover integrations, manage access, and bring your workflows together through one secure MCP gateway.</p>
        <div className="hero-actions"><a className="primary-btn" href="#catalog">Explore integrations <ArrowUpRight size={17}/></a><a className="secondary-btn" href="#architecture">How it works</a></div>
        <div className="hero-foot"><span><ShieldCheck size={15}/> User-scoped access</span><span><Zap size={15}/> MCP-ready architecture</span><span><Workflow size={15}/> One unified gateway</span></div>
        <div className="orb orb-one"/><div className="orb orb-two"/>
      </section>

      <section className="catalog-section" id="catalog">
        <div className="section-head"><div><div className="eyebrow">INTEGRATION DIRECTORY</div><h2>Your stack, connected.</h2><p>Start with a curated catalog. More providers will be added as their adapters are verified.</p></div><div className="catalog-search"><Search size={16}/><span>Search integrations</span><kbd>⌘ K</kbd></div></div>
        <div className="integration-grid">
          {integrations.map((item) => { const Icon = item.icon; return <article className="integration-card" key={item.name}><div className="card-top"><div className="integration-icon"><Icon size={21}/></div><span className={item.status === "Catalog" ? "status" : "status planned"}>{item.status}</span></div><div className="category">{item.category}</div><h3>{item.name}</h3><p>{item.description}</p><div className="card-bottom"><span>Provider details</span><ArrowUpRight size={16}/></div></article>; })}
        </div>
        <div className="catalog-note"><Sparkles size={17}/><span>Catalog entries are discovery metadata. A provider becomes connectable only after its authentication flow and MCP adapter are implemented and verified.</span></div>
      </section>

      <section className="platform-section" id="architecture">
        <div className="eyebrow">BUILT FOR COMPOSABILITY</div><h2>Less setup. More flow.</h2>
        <div className="principle-grid">{principles.map(([title, body], i) => <article className="principle" key={title}><div className="principle-number">0{i+1}</div><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="security-section" id="security"><div className="security-icon"><ShieldCheck size={25}/></div><div><div className="eyebrow">SECURITY IS THE FOUNDATION</div><h2>Your connections stay yours.</h2><p>Credentials must remain isolated per user, encrypted at rest, and limited to explicitly approved scopes. Sensitive tools require policy checks and auditable approvals.</p></div></section>

      <footer><a className="brand" href="#"><span className="brand-mark"><Command size={17}/></span><span>NEXORA</span></a><span>One Hub. Every Connection.</span><span>© 2026 NEXORA</span></footer>
    </main>
  );
}
