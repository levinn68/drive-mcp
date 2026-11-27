import CustomMcpForm from "../components/custom-mcp-form";
import McpDirectoryGrid from "../components/mcp-directory-grid";
import MyMcpPanel from "../components/my-mcps";
import WorkspaceTabs from "../components/workspace-tabs";
import SkillLibrary from "../components/skill-library";

export const revalidate = 3600;
export const maxDuration = 60;

const REGISTRY = "https://registry.modelcontextprotocol.io";
const GLAMA_API = "https://glama.ai/api/mcp/v1/servers";
const NPM_SEARCH_API = "https://registry.npmjs.org/-/v1/search";
const PULSEMCP_API = "https://api.pulsemcp.com/v0beta/servers";
const DOCKER_HUB_API = "https://hub.docker.com/v2/search/repositories/";
const CRATES_IO_API = "https://crates.io/api/v1/crates";

const TARGET_MCP_COUNT = 25000;
const PER_CATEGORY_PASS1_CAP = 1800;

const JUNK_NAME_RX = /^(test|demo|hello[-_]?world|example|sample|my[-_]?first|foo|bar|tmp|temp)[-_0-9]*$/i;

const VERIFIED_POPULAR_MCPS = [
  {
    verifiedPopular: true,
    category: "search",
    authType: "none",
    stars: 38500,
    sourceLabel: "Official",
    server: {
      name: "com.upstash/context7-mcp",
      title: "Context7 Docs MCP",
      version: "official",
      description: "Live, version-specific documentation & code examples for any library or framework.",
      repository: { url: "https://context7.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.context7.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "github",
    authType: "pat",
    stars: 24800,
    sourceLabel: "Official",
    server: {
      name: "com.github/github-mcp-server",
      title: "GitHub MCP",
      version: "official",
      description: "Official GitHub remote MCP server for repositories, issues, PRs, code search, and Actions.",
      repository: { url: "https://github.com/github/github-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://api.githubcopilot.com/mcp/" }],
    },
  },
  {
    verifiedPopular: true,
    category: "github",
    authType: "pat",
    stars: 24500,
    sourceLabel: "Official",
    server: {
      name: "com.github/github-mcp-all",
      title: "GitHub MCP (All 19 Toolsets)",
      version: "official",
      description: "Full GitHub remote MCP with all 116+ tools across Actions, Code Security, Projects, Gists, and Orgs.",
      repository: { url: "https://github.com/github/github-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://api.githubcopilot.com/mcp/x/all" }],
    },
  },
  {
    verifiedPopular: true,
    category: "search",
    authType: "none",
    stars: 18200,
    sourceLabel: "Official",
    server: {
      name: "com.openai/docs-mcp",
      title: "OpenAI Docs MCP",
      version: "free",
      description: "Official OpenAI developer documentation search & API reference MCP (zero auth).",
      repository: { url: "https://developers.openai.com" },
      remotes: [{ type: "streamable-http", url: "https://developers.openai.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "database",
    authType: "oauth",
    stars: 16900,
    sourceLabel: "Official",
    server: {
      name: "com.supabase/supabase-mcp",
      title: "Supabase MCP",
      version: "official",
      description: "Official Supabase remote MCP — Postgres SQL, schema migrations, Edge Functions, and logs.",
      repository: { url: "https://supabase.com/docs/guides/getting-started/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.supabase.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "search",
    authType: "none",
    stars: 15400,
    sourceLabel: "Official",
    server: {
      name: "com.deepwiki/deepwiki-mcp",
      title: "DeepWiki MCP",
      version: "free",
      description: "Zero-auth codebase wiki & architecture Q&A powered by Cognition DeepWiki.",
      repository: { url: "https://deepwiki.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.deepwiki.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "browser",
    authType: "pat",
    stars: 14600,
    sourceLabel: "Official",
    server: {
      name: "dev.firecrawl/firecrawl-mcp",
      title: "Firecrawl Web Scraper MCP",
      version: "official",
      description: "Turn any website into clean Markdown, structured JSON, or crawled knowledge for AI.",
      repository: { url: "https://www.firecrawl.dev/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.firecrawl.dev/v2/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "cloud",
    authType: "oauth",
    stars: 14200,
    sourceLabel: "Official",
    server: {
      name: "com.vercel/vercel-mcp",
      title: "Vercel MCP",
      version: "official",
      description: "Official Vercel MCP — deployments, projects, domains, build logs, and env management.",
      repository: { url: "https://vercel.com/docs/mcp/vercel-mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.vercel.com" }],
    },
  },
  {
    verifiedPopular: true,
    category: "finance",
    authType: "oauth",
    stars: 13500,
    sourceLabel: "Official",
    server: {
      name: "com.stripe/stripe-mcp",
      title: "Stripe MCP",
      version: "official",
      description: "Official Stripe MCP — payments, customers, invoices, subscriptions, and docs.",
      repository: { url: "https://docs.stripe.com/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.stripe.com" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "oauth_catalog",
    stars: 12800,
    sourceLabel: "Official",
    server: {
      name: "com.figma/figma-mcp",
      title: "Figma Dev Mode MCP",
      version: "official",
      description: "Official Figma remote MCP — inspect design frames, components, tokens, and code.",
      repository: { url: "https://developers.figma.com/docs/figma-mcp-server/" },
      remotes: [{ type: "streamable-http", url: "https://mcp.figma.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "oauth",
    stars: 12400,
    sourceLabel: "Official",
    server: {
      name: "com.canva/canva-mcp",
      title: "Canva Official MCP",
      version: "official",
      description: "Official Canva AI Connector — generate, edit, and export Canva designs & decks.",
      repository: { url: "https://www.canva.dev/docs/apps/mcp/" },
      remotes: [{ type: "streamable-http", url: "https://mcp.canva.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "oauth",
    stars: 12100,
    sourceLabel: "Official",
    server: {
      name: "com.miro/miro-mcp",
      title: "Miro Official MCP",
      version: "official",
      description: "Summarize Miro boards, create architecture diagrams, and act on board comments.",
      repository: { url: "https://miro.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.miro.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "pat",
    stars: 12000,
    sourceLabel: "Official",
    server: {
      name: "com.forgegui/forgegui-mcp",
      title: "ForgeGUI MCP",
      version: "official",
      description: "AI game GUI, 3D model, icon, and thumbnail generator MCP for Roblox, Unity, and Unreal.",
      repository: { url: "https://forgegui.com/" },
      remotes: [],
      packages: [{ registryType: "github", identifier: "elwinhe/forgegui-plugins" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "none",
    stars: 11200,
    sourceLabel: "Official",
    server: {
      name: "com.tylertech/forge-mcp",
      title: "Tyler Forge UI MCP",
      version: "official",
      description: "Official Tyler Forge web components & design system MCP server with /forge-design skill.",
      repository: { url: "https://github.com/tyler-technologies-oss/forge-mcp" },
      remotes: [],
      packages: [{ registryType: "npm", identifier: "@tylertech/forge-mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "none",
    stars: 10600,
    sourceLabel: "Official",
    server: {
      name: "com.forgespace/ui-mcp",
      title: "Forge Space UI MCP",
      version: "official",
      description: "Forge Space UI generation & context MCP server for structured frontend component workflows.",
      repository: { url: "https://github.com/Forge-Space/core" },
      remotes: [],
      packages: [{ registryType: "github", identifier: "Forge-Space/core" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    authType: "oauth",
    stars: 11800,
    sourceLabel: "Official",
    server: {
      name: "do.craft/craft-mcp",
      title: "Craft.do Official MCP",
      version: "official",
      description: "Official Craft.do remote MCP — read, search, and edit Craft documents and knowledge spaces.",
      repository: { url: "https://www.craft.do/imagine/guide/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.craft.do/my/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "none",
    stars: 11700,
    sourceLabel: "ArtCraft",
    server: {
      name: "com.getartcraft/figcraft",
      title: "FigCraft MCP (ArtCraft)",
      version: "official",
      description: "Open-source Rust Figma alternative with 400+ UI design & prototyping commands via figcraft-cli mcp.",
      repository: { url: "https://github.com/storytold/figcraft" },
      remotes: [],
      packages: [{ registryType: "cargo", identifier: "figcraft-cli" }],
    },
  },
  {
    verifiedPopular: true,
    category: "media",
    authType: "none",
    stars: 10900,
    sourceLabel: "ArtCraft",
    server: {
      name: "com.getartcraft/effectcraft",
      title: "EffectCraft MCP (ArtCraft)",
      version: "official",
      description: "Open-source Rust motion graphics and compositing app controlled via effectcraft-cli mcp.",
      repository: { url: "https://github.com/storytold/effectcraft" },
      remotes: [],
      packages: [{ registryType: "cargo", identifier: "effectcraft-cli" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "none",
    stars: 10400,
    sourceLabel: "ArtCraft",
    server: {
      name: "com.getartcraft/vectorcraft",
      title: "VectorCraft MCP (ArtCraft)",
      version: "official",
      description: "Open-source ArtCraft vector illustration app controllable via CLI and MCP server.",
      repository: { url: "https://getartcraft.com/apps" },
      remotes: [],
      packages: [{ registryType: "cargo", identifier: "vectorcraft-cli" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "none",
    stars: 10100,
    sourceLabel: "ArtCraft",
    server: {
      name: "com.getartcraft/photocraft",
      title: "PhotoCraft MCP (ArtCraft)",
      version: "official",
      description: "Open-source ArtCraft raster and photo editing app driven via CLI and MCP server.",
      repository: { url: "https://getartcraft.com/apps" },
      remotes: [],
      packages: [{ registryType: "cargo", identifier: "photocraft-cli" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "none",
    stars: 9900,
    sourceLabel: "ArtCraft",
    server: {
      name: "com.getartcraft/texturecraft",
      title: "TextureCraft MCP (ArtCraft)",
      version: "official",
      description: "Open-source ArtCraft procedural texture synthesis app with native MCP command interface.",
      repository: { url: "https://getartcraft.com/apps" },
      remotes: [],
      packages: [{ registryType: "cargo", identifier: "texturecraft-cli" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "none",
    stars: 9700,
    sourceLabel: "ArtCraft",
    server: {
      name: "com.getartcraft/materialcraft",
      title: "MaterialCraft MCP (ArtCraft)",
      version: "official",
      description: "Open-source ArtCraft PBR material authoring tool with native CLI and MCP server.",
      repository: { url: "https://getartcraft.com/apps" },
      remotes: [],
      packages: [{ registryType: "cargo", identifier: "materialcraft-cli" }],
    },
  },
  {
    verifiedPopular: true,
    category: "media",
    authType: "none",
    stars: 9500,
    sourceLabel: "ArtCraft",
    server: {
      name: "com.getartcraft/soundcraft",
      title: "SoundCraft MCP (ArtCraft)",
      version: "official",
      description: "Open-source ArtCraft audio design and synthesis tool driven via CLI and MCP server.",
      repository: { url: "https://getartcraft.com/apps" },
      remotes: [],
      packages: [{ registryType: "cargo", identifier: "soundcraft-cli" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    authType: "none",
    stars: 9400,
    sourceLabel: "ArtCraft",
    server: {
      name: "com.getartcraft/wordcraft",
      title: "WordCraft MCP (ArtCraft)",
      version: "official",
      description: "Open-source ArtCraft publishing and document layout tool controllable via MCP server.",
      repository: { url: "https://getartcraft.com/apps" },
      remotes: [],
      packages: [{ registryType: "cargo", identifier: "wordcraft-cli" }],
    },
  },
  {
    verifiedPopular: true,
    category: "ai",
    authType: "oauth",
    stars: 11900,
    sourceLabel: "Official",
    server: {
      name: "co.hf/huggingface-mcp",
      title: "Hugging Face MCP",
      version: "official",
      description: "Search models, datasets, Spaces, and run Hugging Face inference directly via MCP.",
      repository: { url: "https://huggingface.co/mcp" },
      remotes: [{ type: "streamable-http", url: "https://huggingface.co/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    authType: "oauth",
    stars: 11400,
    sourceLabel: "Official",
    server: {
      name: "com.notion/notion-mcp",
      title: "Notion MCP",
      version: "official",
      description: "Official Notion remote MCP — search pages, edit docs, query databases, and comments.",
      repository: { url: "https://developers.notion.com/docs/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.notion.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "automation",
    authType: "oauth",
    stars: 10800,
    sourceLabel: "Official",
    server: {
      name: "com.make/make-mcp",
      title: "Make.com Official MCP",
      version: "official",
      description: "Official Make.com remote MCP — run automated scenarios and cross-app workflows via OAuth.",
      repository: { url: "https://developers.make.com/mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.make.com/v2" }],
    },
  },
  {
    verifiedPopular: true,
    category: "cloud",
    authType: "none",
    stars: 10500,
    sourceLabel: "Official",
    server: {
      name: "com.cloudflare/docs-mcp",
      title: "Cloudflare Docs MCP",
      version: "free",
      description: "Official zero-auth Cloudflare Workers, R2, D1, Pages, and Zero Trust docs search.",
      repository: { url: "https://developers.cloudflare.com/agents/model-context-protocol/" },
      remotes: [{ type: "streamable-http", url: "https://docs.mcp.cloudflare.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "cloud",
    authType: "oauth",
    stars: 10200,
    sourceLabel: "Official",
    server: {
      name: "com.cloudflare/workers-bindings-mcp",
      title: "Cloudflare Workers MCP",
      version: "official",
      description: "Manage Cloudflare Workers, KV namespaces, R2 buckets, and D1 databases via OAuth.",
      repository: { url: "https://developers.cloudflare.com/agents/model-context-protocol/" },
      remotes: [{ type: "streamable-http", url: "https://bindings.mcp.cloudflare.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "messaging",
    authType: "oauth",
    stars: 9800,
    sourceLabel: "Official",
    server: {
      name: "com.slack/slack-mcp",
      title: "Slack Workspace MCP",
      version: "official",
      description: "Read channels, search messages, and send updates across Slack workspaces.",
      repository: { url: "https://api.slack.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.slack.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    authType: "oauth",
    stars: 9600,
    sourceLabel: "Official",
    server: {
      name: "app.linear/linear-mcp",
      title: "Linear MCP",
      version: "official",
      description: "Official Linear MCP — issues, projects, cycles, teams, and sprint workflows.",
      repository: { url: "https://linear.app/docs/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.linear.app/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    authType: "oauth",
    stars: 9200,
    sourceLabel: "Official",
    server: {
      name: "com.atlassian/rovo-mcp",
      title: "Atlassian Jira & Confluence",
      version: "official",
      description: "Official Atlassian MCP — search Jira issues, Confluence spaces, and sprint boards.",
      repository: { url: "https://www.atlassian.com/platform/remote-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.atlassian.com/v2/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "cloud",
    authType: "oauth",
    stars: 8900,
    sourceLabel: "Official",
    server: {
      name: "dev.sentry/sentry-mcp",
      title: "Sentry MCP",
      version: "official",
      description: "Official Sentry MCP — inspect stack traces, error groups, and release health.",
      repository: { url: "https://docs.sentry.io/product/sentry-mcp/" },
      remotes: [{ type: "streamable-http", url: "https://mcp.sentry.dev/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "coding",
    authType: "oauth",
    stars: 8700,
    sourceLabel: "Official",
    server: {
      name: "com.prisma/prisma-mcp",
      title: "Prisma Postgres MCP",
      version: "official",
      description: "Official Prisma MCP — manage Prisma Postgres databases, backups, and schemas.",
      repository: { url: "https://www.prisma.io/docs/orm/more/ai-tools/mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.prisma.io/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "database",
    authType: "oauth",
    stars: 8200,
    sourceLabel: "Official",
    server: {
      name: "tech.neon/neon-mcp",
      title: "Neon Postgres MCP",
      version: "official",
      description: "Official Neon serverless Postgres MCP — branching, SQL queries, and migrations.",
      repository: { url: "https://neon.tech/docs/ai/neon-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.neon.tech/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "search",
    authType: "pat",
    stars: 7800,
    sourceLabel: "Official",
    server: {
      name: "ai.exa/exa-mcp",
      title: "Exa AI Search MCP",
      version: "official",
      description: "Real-time neural web search, company research, and live code context for AI.",
      repository: { url: "https://exa.ai" },
      remotes: [{ type: "streamable-http", url: "https://mcp.exa.ai/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "search",
    authType: "pat",
    stars: 7200,
    sourceLabel: "Official",
    server: {
      name: "com.tavily/tavily-mcp",
      title: "Tavily AI Search MCP",
      version: "official",
      description: "Real-time web search and content extraction optimized for LLM research agents.",
      repository: { url: "https://tavily.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.tavily.com/mcp/" }],
    },
  },
  {
    verifiedPopular: true,
    category: "data",
    authType: "oauth",
    stars: 6800,
    sourceLabel: "Official",
    server: {
      name: "com.posthog/posthog-mcp",
      title: "PostHog Analytics MCP",
      version: "official",
      description: "Query product analytics, funnels, feature flags, and session insights via MCP.",
      repository: { url: "https://posthog.com/docs/model-context-protocol" },
      remotes: [{ type: "streamable-http", url: "https://mcp.posthog.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "finance",
    authType: "oauth",
    stars: 6400,
    sourceLabel: "Official",
    server: {
      name: "com.paypal/paypal-mcp",
      title: "PayPal MCP",
      version: "official",
      description: "Official PayPal MCP — invoices, orders, disputes, and payment links.",
      repository: { url: "https://mcp.paypal.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.paypal.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "data",
    authType: "pat",
    stars: 6300,
    sourceLabel: "Official",
    server: {
      name: "com.datadog/datadog-mcp",
      title: "Datadog Observability MCP",
      version: "official",
      description: "Inspect monitors, logs, APM traces, and production metrics directly from AI.",
      repository: { url: "https://docs.datadoghq.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.datadoghq.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "cloud",
    authType: "oauth",
    stars: 6200,
    sourceLabel: "Official",
    server: {
      name: "com.netlify/netlify-mcp",
      title: "Netlify Deploy MCP",
      version: "official",
      description: "Create sites, manage deploys, env vars, and serverless functions on Netlify.",
      repository: { url: "https://docs.netlify.com" },
      remotes: [{ type: "streamable-http", url: "https://netlify-mcp.netlify.app/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "browser",
    authType: "pat",
    stars: 6100,
    sourceLabel: "Official",
    server: {
      name: "com.apify/apify-mcp",
      title: "Apify Actors & Scraping MCP",
      version: "official",
      description: "Run 4,000+ Apify web scraping and browser automation Actors directly from AI.",
      repository: { url: "https://apify.com/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.apify.com" }],
    },
  },
  {
    verifiedPopular: true,
    category: "crm",
    authType: "oauth",
    stars: 5900,
    sourceLabel: "Official",
    server: {
      name: "com.hubspot/hubspot-mcp",
      title: "HubSpot CRM MCP",
      version: "official",
      description: "Search CRM contacts, deals, companies, and engagement notes in HubSpot.",
      repository: { url: "https://developers.hubspot.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.hubspot.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "security",
    authType: "pat",
    stars: 5600,
    sourceLabel: "Official",
    server: {
      name: "io.snyk/snyk-mcp",
      title: "Snyk Security MCP",
      version: "official",
      description: "Scan dependencies, containers, and IaC code for CVEs and security vulnerabilities.",
      repository: { url: "https://docs.snyk.io" },
      remotes: [{ type: "streamable-http", url: "https://mcp.snyk.io/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    authType: "oauth",
    stars: 5300,
    sourceLabel: "Official",
    server: {
      name: "com.asana/asana-mcp",
      title: "Asana Tasks MCP",
      version: "official",
      description: "Official Asana MCP — tasks, projects, timelines, and team collaboration.",
      repository: { url: "https://developers.asana.com/docs/mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.asana.com/v2/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    authType: "oauth",
    stars: 5100,
    sourceLabel: "Official",
    server: {
      name: "com.webflow/webflow-mcp",
      title: "Webflow Sites & CMS MCP",
      version: "official",
      description: "Manage Webflow CMS collections, pages, and site publishing via MCP.",
      repository: { url: "https://developers.webflow.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.webflow.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "messaging",
    authType: "oauth",
    stars: 4900,
    sourceLabel: "Official",
    server: {
      name: "com.intercom/intercom-mcp",
      title: "Intercom Support MCP",
      version: "official",
      description: "Official Intercom MCP — customer conversations, contacts, and help center docs.",
      repository: { url: "https://developers.intercom.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.intercom.com/sse" }],
    },
  },
  {
    verifiedPopular: true,
    category: "ecommerce",
    authType: "oauth",
    stars: 4500,
    sourceLabel: "Official",
    server: {
      name: "com.squareup/square-mcp",
      title: "Square Commerce MCP",
      version: "official",
      description: "Official Square MCP — POS catalog, orders, payments, and inventory management.",
      repository: { url: "https://developer.squareup.com" },
      remotes: [{ type: "streamable-http", url: "https://mcp.squareup.com/sse" }],
    },
  },
];

const MCP_CATEGORY_RULES = [
  { id: "database", rx: /\b(sql|postgres|postgresql|mysql|sqlite|supabase|neon|mongo|mongodb|redis|clickhouse|prisma|drizzle|planetscale|turso|database|dbhub|bigquery|snowflake|duckdb|cassandra|dynamodb|neo4j|qdrant|pinecone|milvus)\b/i },
  { id: "cloud", rx: /\b(vercel|cloudflare|aws|azure|gcp|google cloud|netlify|railway|render|docker|kubernetes|k8s|terraform|sentry|devops|deploy|infra|hosting|heroku|fly\.io|digitalocean|helm|ansible)\b/i },
  { id: "browser", rx: /\b(playwright|puppeteer|selenium|browser|chrome|crawl|firecrawl|apify|scrape|scraping|web ?fetch|headless|browserbase|stagehand)\b/i },
  { id: "finance", rx: /\b(stripe|paypal|plaid|finance|payment|invoice|billing|stock|trading|market|sec\b|edgar|bank|accounting|yahoo finance|alphavantage|quickbooks|xero|forex|portfolio)\b/i },
  { id: "web3", rx: /\b(crypto|blockchain|ethereum|solana|web3|wallet|defi|nft|token|onchain|evm|bitcoin|binance|coinbase|uniswap|polygon|arbitrum|sui|aptos)\b/i },
  { id: "design", rx: /\b(figma|figcraft|forgegui|forge-mcp|vectorcraft|photocraft|texturecraft|materialcraft|canva|miro|design|webflow|storybook|ui|ux|css|tailwind|blender|3d|svg|font|color|sketch|framer|penpot|excalidraw|mermaid)\b/i },
  { id: "media", rx: /\b(video|audio|music|effectcraft|soundcraft|youtube|spotify|ffmpeg|image|photo|podcast|remotion|elevenlabs|tts|speech|whisper|midjourney|flux|comfyui|stable diffusion|plex|vimeo)\b/i },
  { id: "ecommerce", rx: /\b(shopify|square|woocommerce|ecommerce|e-commerce|store|cart|product catalog|inventory|order|amazon|ebay|etsy|magento|bigcommerce)\b/i },
  { id: "crm", rx: /\b(hubspot|salesforce|crm|pipedrive|zoho|lead|sales|marketing|mailchimp|klaviyo|apollo|attio|zendesk|freshdesk|ads|seo|semrush|ahrefs)\b/i },
  { id: "maps", rx: /\b(maps|geo|location|weather|flight|travel|hotel|route|gps|places|openstreetmap|mapbox|airbnb|uber|transit|gis|geospatial)\b/i },
  { id: "security", rx: /\b(security|snyk|auth|oauth|clerk|vault|secret|vuln|cve|pentest|scan|audit|firewall|compliance|encrypt|owasp|semgrep|trivy|sonarqube|burp|shodan)\b/i },
  { id: "data", rx: /\b(analytics|posthog|datadog|grafana|prometheus|metabase|tableau|mixpanel|amplitude|chart|excel|sheets|csv|metrics|observability|telemetry|jupyter|pandas|dbt|airflow|kafka)\b/i },
  { id: "messaging", rx: /\b(slack|discord|telegram|whatsapp|email|gmail|outlook|resend|twilio|intercom|chat|sms|social|twitter|x\.com|linkedin|bluesky|mastodon|reddit|teams|zoom)\b/i },
  { id: "automation", rx: /\b(zapier|n8n|make\.com|workflow|automat|cron|webhook|trigger|pipeline|rpa|home assistant|iot|smart home|mqtt|ifttt|temporal)\b/i },
  { id: "productivity", rx: /\b(notion|craft\.do|wordcraft|linear|jira|confluence|atlassian|asana|trello|monday|clickup|todo|calendar|google drive|airtable|obsidian|evernote|todoist|notes|docs|pdf|docx|pptx)\b/i },
  { id: "search", rx: /\b(search|documentation|wiki|deepwiki|context7|exa|tavily|brave|perplexity|arxiv|wikipedia|pubmed|knowledge|news|rss|weather|scholar|semantic scholar)\b/i },
  { id: "ai", rx: /\b(ai\b|llm|agent|hugging ?face|openai|anthropic|claude|gemini|ollama|langchain|vector|embedding|rag|model|prompt|memory|knowledge graph|mcp-proxy|gateway|reasoning)\b/i },
  { id: "github", rx: /\b(github|gitlab|bitbucket|git\b|pull request|commit|code review|ci\/cd|actions)\b/i },
  { id: "coding", rx: /\b(code|dev|devtools|ide|vscode|xcode|android|ios|npm|python|typescript|react|next\.js|svelte|rust|go|shell|terminal|sandbox|filesystem|lint|test|debugger|lsp)\b/i },
];

function classifyMcpCategory(explicitCategory, text) {
  if (explicitCategory) return explicitCategory;
  const hay = String(text || "");
  for (const rule of MCP_CATEGORY_RULES) {
    if (rule.rx.test(hay)) return rule.id;
  }
  return "coding";
}

function inferAuthType(explicitAuthType, isRemote, text) {
  if (explicitAuthType) return explicitAuthType;
  const lower = String(text || "").toLowerCase();
  if (!isRemote) return "none";
  if (/\b(zero[- ]auth|no[- ]auth|public|docs)\b/.test(lower)) return "none";
  if (/\b(api key|pat|token|bearer)\b/.test(lower)) return "pat";
  return "oauth";
}

async function fetchOfficialRegistry(apiSearch, maxPages = 85) {
  const results = [];
  let cursor = "";
  const deadline = Date.now() + 17000;
  for (let i = 0; i < maxPages && Date.now() < deadline; i += 1) {
    const params = new URLSearchParams({ limit: "100", version: "latest" });
    if (apiSearch.length >= 2) params.set("search", apiSearch);
    if (cursor) params.set("cursor", cursor);

    try {
      const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, {
        headers: { accept: "application/json", "user-agent": "DRIVE-MCP/5.1" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(4500),
      });
      if (!response.ok) break;
      const payload = await response.json();
      const batch = Array.isArray(payload?.servers) ? payload.servers : [];
      for (const item of batch) {
        results.push({ ...item, sourceLabel: "Official Registry" });
      }
      cursor = payload?.metadata?.nextCursor || "";
      if (!cursor || results.length >= 8500) break;
    } catch {
      break;
    }
  }
  return results;
}

const GLAMA_HIGH_SIGNAL_QUERIES = [
  "postgres", "mysql", "sqlite", "mongodb", "redis", "supabase", "firebase", "snowflake", "bigquery", "duckdb", "neo4j", "qdrant",
  "aws", "azure", "gcp", "kubernetes", "docker", "terraform", "cloudflare", "vercel", "netlify", "railway", "linux", "ssh",
  "playwright", "puppeteer", "browser", "scraper", "firecrawl", "selenium", "crawl", "chrome", "fetch", "http",
  "stripe", "paypal", "finance", "stock", "trading", "accounting", "invoice", "bank", "plaid", "quickbooks", "forex",
  "crypto", "ethereum", "solana", "binance", "blockchain", "defi", "wallet", "bitcoin", "polygon", "web3",
  "figma", "blender", "unity", "design", "svg", "3d", "canva", "miro", "craft", "forge", "webflow", "mermaid", "excalidraw", "diagram",
  "youtube", "spotify", "video", "audio", "ffmpeg", "image", "whisper", "tts", "music", "podcast", "ocr",
  "shopify", "woocommerce", "amazon", "ecommerce", "inventory", "square",
  "hubspot", "salesforce", "zendesk", "crm", "seo", "marketing", "ads", "analytics", "mailchimp",
  "maps", "weather", "flight", "travel", "geo", "hotel", "calendar", "time",
  "security", "snyk", "pentest", "owasp", "vault", "auth", "clerk", "semgrep", "audit",
  "datadog", "grafana", "prometheus", "posthog", "excel", "sheets", "csv", "pandas", "jupyter",
  "slack", "discord", "telegram", "whatsapp", "gmail", "outlook", "email", "twitter", "reddit", "linkedin", "teams",
  "n8n", "zapier", "workflow", "homeassistant", "iot", "cron", "webhook", "queue",
  "notion", "linear", "jira", "confluence", "obsidian", "pdf", "drive", "airtable", "trello", "asana", "clickup",
  "search", "arxiv", "wikipedia", "docs", "memory", "rag", "vector", "ollama", "huggingface", "github", "gitlab", "git",
];

async function fetchGlamaDirectory(apiSearch) {
  const results = [];
  const deadline = Date.now() + 18500;

  const generalTask = (async () => {
    const out = [];
    let cursor = "";
    const maxPages = apiSearch ? 8 : 34;
    for (let i = 0; i < maxPages && Date.now() < deadline; i += 1) {
      const params = new URLSearchParams({ first: "100" });
      if (apiSearch.length >= 2) params.set("query", apiSearch);
      if (cursor) params.set("after", cursor);
      try {
        const res = await fetch(`${GLAMA_API}?${params}`, {
          headers: { accept: "application/json", "user-agent": "DRIVE-MCP/5.1" },
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(4500),
        });
        if (!res.ok) break;
        const payload = await res.json();
        const batch = Array.isArray(payload?.servers) ? payload.servers : [];
        out.push(...batch);
        cursor = payload?.pageInfo?.hasNextPage ? payload?.pageInfo?.endCursor || "" : "";
        if (!cursor || out.length >= 3400) break;
      } catch {
        break;
      }
    }
    return out;
  })();

  const categoryTask = apiSearch
    ? Promise.resolve([])
    : (async () => {
        const out = [];
        for (let i = 0; i < GLAMA_HIGH_SIGNAL_QUERIES.length && Date.now() < deadline; i += 24) {
          const batchTerms = GLAMA_HIGH_SIGNAL_QUERIES.slice(i, i + 24);
          const settled = await Promise.allSettled(
            batchTerms.map(async (term) => {
              const params = new URLSearchParams({ first: "100", query: term });
              const res = await fetch(`${GLAMA_API}?${params}`, {
                headers: { accept: "application/json", "user-agent": "DRIVE-MCP/5.1" },
                next: { revalidate: 3600 },
                signal: AbortSignal.timeout(4500),
              });
              if (!res.ok) return [];
              const payload = await res.json();
              return Array.isArray(payload?.servers) ? payload.servers : [];
            })
          );
          for (const r of settled) {
            if (r.status === "fulfilled" && r.value.length) out.push(...r.value);
          }
        }
        return out;
      })();

  const [genRows, catRows] = await Promise.all([generalTask, categoryTask]);
  for (const item of [...genRows, ...catRows]) {
    if (!item?.name || JUNK_NAME_RX.test(item.name)) continue;
    const slug = item.slug || item.id || item.name;
    const repoUrl = item.url || item.repository?.url || `https://glama.ai/mcp/servers/${slug}`;
    const stars = Number(item.repository?.stargazersCount || item.stars || 0);
    results.push({
      _stars: stars,
      sourceLabel: "Glama",
      server: {
        name: `${item.namespace || "glama"}/${slug}`,
        title: item.name,
        version: "glama",
        description: item.description || "Indexed from Glama MCP Directory.",
        repository: { url: repoUrl },
        remotes:
          item.url && /^https?:\/\//i.test(item.url) && item.url.includes("mcp")
            ? [{ type: "streamable-http", url: item.url }]
            : [],
        packages: [],
      },
    });
  }
  return results;
}

const NPM_BALANCED_MCP_QUERIES = [
  "mcp-server", "modelcontextprotocol", "@modelcontextprotocol", "fastmcp",
  "mcp-client", "mcp-proxy", "mcp-bridge", "mcp-tool",
  "mcp postgres", "mcp mysql", "mcp sqlite", "mcp mongodb", "mcp redis", "mcp supabase", "mcp firebase", "mcp prisma",
  "mcp aws", "mcp azure", "mcp gcp", "mcp docker", "mcp kubernetes", "mcp cloudflare", "mcp vercel", "mcp terraform",
  "mcp playwright", "mcp puppeteer", "mcp browser", "mcp firecrawl", "mcp scraper", "mcp fetch",
  "mcp stripe", "mcp paypal", "mcp finance", "mcp stock", "mcp crypto", "mcp solana", "mcp ethereum", "mcp web3",
  "mcp figma", "mcp design", "mcp craft", "mcp forge", "mcp video", "mcp youtube", "mcp image", "mcp audio", "mcp ffmpeg",
  "mcp shopify", "mcp hubspot", "mcp salesforce", "mcp crm", "mcp maps", "mcp weather", "mcp travel",
  "mcp security", "mcp auth", "mcp analytics", "mcp datadog", "mcp grafana", "mcp sentry",
  "mcp slack", "mcp discord", "mcp telegram", "mcp whatsapp", "mcp gmail", "mcp email", "mcp twitter",
  "mcp notion", "mcp linear", "mcp jira", "mcp obsidian", "mcp pdf", "mcp excel", "mcp calendar",
  "mcp search", "mcp memory", "mcp rag", "mcp github", "mcp gitlab", "mcp n8n", "mcp filesystem", "mcp terminal",
];

async function fetchNpmMcpServers(apiSearch) {
  const queries = apiSearch ? [`${apiSearch} mcp`] : NPM_BALANCED_MCP_QUERIES;
  const requests = [];
  for (let idx = 0; idx < queries.length; idx += 1) {
    const text = queries[idx];
    const offsets = apiSearch ? [0, 250] : idx < 12 ? [0, 250, 500] : [0, 250];
    for (const from of offsets) requests.push({ text, from });
  }

  const items = [];
  const deadline = Date.now() + 18000;
  for (let start = 0; start < requests.length && Date.now() < deadline; start += 36) {
    const batch = requests.slice(start, start + 36);
    const settled = await Promise.allSettled(
      batch.map(async ({ text, from }) => {
        const url = new URL(NPM_SEARCH_API);
        url.searchParams.set("text", text);
        url.searchParams.set("size", "250");
        url.searchParams.set("from", String(from));
        const res = await fetch(url, {
          headers: { accept: "application/json", "user-agent": "DRIVE-MCP/5.1" },
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        const payload = await res.json();
        return Array.isArray(payload?.objects) ? payload.objects : [];
      })
    );

    for (const r of settled) {
      if (r.status !== "fulfilled") continue;
      for (const obj of r.value) {
        const pkg = obj?.package;
        if (!pkg?.name || JUNK_NAME_RX.test(pkg.name)) continue;
        const popScore = Math.round(Number(obj?.score?.detail?.popularity || 0) * 1800);
        const npmLink = pkg.links?.homepage || pkg.links?.npm || `https://www.npmjs.com/package/${pkg.name}`;
        const cleanTitle = pkg.name
          .replace(/^@[^/]+\//, "")
          .replace(/[-_]+/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        items.push({
          _stars: popScore,
          sourceLabel: "npm",
          server: {
            name: `npm/${pkg.name}`,
            title: cleanTitle,
            version: pkg.version || "npm",
            description: pkg.description || `Published npm MCP server package (${pkg.name}).`,
            repository: { url: npmLink },
            remotes: [],
            packages: [{ registryType: "npm", identifier: pkg.name }],
          },
        });
      }
    }
  }
  return items;
}

async function fetchPulseMcpServers(apiSearch) {
  const pages = apiSearch ? [0, 1] : Array.from({ length: 24 }, (_, i) => i);
  const settled = await Promise.allSettled(
    pages.map(async (page) => {
      const url = new URL(PULSEMCP_API);
      url.searchParams.set("count_per_page", "100");
      url.searchParams.set("offset", String(page * 100));
      if (apiSearch) url.searchParams.set("query", apiSearch);
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-MCP/5.1" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5500),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload?.servers) ? payload.servers : [];
    })
  );

  const items = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const s of r.value) {
      if (!s?.name || JUNK_NAME_RX.test(s.name)) continue;
      const stars = Number(s.github_stars || s.estimated_downloads || 0);
      const targetUrl = s.url || s.source_code_url || "";
      items.push({
        _stars: stars,
        sourceLabel: "PulseMCP",
        server: {
          name: `pulsemcp/${s.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}`,
          title: s.name,
          version: "pulsemcp",
          description: s.short_description || s.description || "Indexed from PulseMCP Directory.",
          repository: targetUrl ? { url: targetUrl } : undefined,
          remotes: Array.isArray(s.remotes) ? s.remotes : [],
          packages: [],
        },
      });
    }
  }
  return items;
}

async function fetchDockerHubMcps(apiSearch) {
  const queries = apiSearch
    ? [`${apiSearch} mcp`]
    : [
        "mcp-server", "modelcontextprotocol", "mcp-proxy", "mcp-gateway",
        "mcp postgres", "mcp github", "mcp browser", "mcp playwright",
        "mcp cloud", "mcp docker", "mcp slack", "mcp notion",
        "mcp redis", "mcp aws", "mcp kubernetes", "mcp database",
        "mcp search", "mcp python",
      ];
  const requests = [];
  for (const q of queries) {
    const pages = apiSearch ? [1] : [1, 2, 3];
    for (const page of pages) requests.push({ q, page });
  }

  const settled = await Promise.allSettled(
    requests.map(async ({ q, page }) => {
      const url = new URL(DOCKER_HUB_API);
      url.searchParams.set("query", q);
      url.searchParams.set("page_size", "100");
      url.searchParams.set("page", String(page));
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-MCP/5.1" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5500),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload?.results) ? payload.results : [];
    })
  );

  const items = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const repo of r.value) {
      const name = String(repo?.repo_name || "").trim();
      const desc = String(repo?.short_description || "").trim();
      if (!name || JUNK_NAME_RX.test(name.split("/")[1] || name)) continue;
      if (!/\bmcp\b|model[- ]?context[- ]?protocol/i.test(`${name} ${desc}`)) continue;
      const pulls = Number(repo.pull_count || 0);
      const stars = Math.max(Number(repo.star_count || 0) * 10, Math.round(Math.sqrt(pulls) * 4));
      const cleanTitle = (name.split("/")[1] || name)
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
      items.push({
        _stars: stars,
        sourceLabel: "Docker Hub",
        server: {
          name: `docker/${name}`,
          title: cleanTitle,
          version: "docker",
          description: desc || `Containerized MCP server on Docker Hub (${pulls.toLocaleString()} pulls).`,
          repository: { url: `https://hub.docker.com/r/${name}` },
          remotes: [],
          packages: [{ registryType: "docker", identifier: name }],
        },
      });
    }
  }
  return items;
}

async function fetchCratesIoMcps(apiSearch) {
  const queries = apiSearch
    ? [`${apiSearch} mcp`]
    : ["mcp-server", "model-context-protocol", "rmcp", "mcp", "mcp-client", "mcp-sdk", "mcp-core", "mcp-tools"];
  const requests = [];
  for (const q of queries) {
    const pages = apiSearch ? [1] : [1, 2, 3];
    for (const page of pages) requests.push({ q, page });
  }

  const settled = await Promise.allSettled(
    requests.map(async ({ q, page }) => {
      const url = new URL(CRATES_IO_API);
      url.searchParams.set("q", q);
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      url.searchParams.set("sort", "downloads");
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-MCP/5.1 (https://drive-mcp-five.vercel.app)" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5500),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload?.crates) ? payload.crates : [];
    })
  );

  const items = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const c of r.value) {
      const name = String(c?.name || "").trim();
      const desc = String(c?.description || "").trim();
      if (!name || JUNK_NAME_RX.test(name)) continue;
      if (!/\bmcp\b|model[- ]?context[- ]?protocol/i.test(`${name} ${desc}`)) continue;
      const downloads = Number(c.downloads || 0);
      const stars = Math.round(Math.sqrt(downloads) * 3);
      const cleanTitle = name.replace(/[-_]+/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase());
      items.push({
        _stars: stars,
        sourceLabel: "Crates.io",
        server: {
          name: `crates/${name}`,
          title: cleanTitle,
          version: c.max_version || "rust",
          description: desc || `Rust MCP server crate on Crates.io (${downloads.toLocaleString()} downloads).`,
          repository: { url: c.homepage || c.repository || `https://crates.io/crates/${name}` },
          remotes: [],
          packages: [{ registryType: "cargo", identifier: name }],
        },
      });
    }
  }
  return items;
}

async function fetchGithubPopularMcps(apiSearch) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "DRIVE-MCP/5.1",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const queryList = apiSearch
    ? [`${apiSearch} topic:mcp-server stars:>5`]
    : [
        "topic:mcp-server stars:>120",
        "topic:mcp-server stars:30..120",
        "topic:model-context-protocol stars:>25",
      ];

  const requests = [];
  for (const qStr of queryList) {
    const pages = apiSearch ? [1, 2] : [1, 2, 3];
    for (const page of pages) requests.push({ qStr, page });
  }

  const settled = await Promise.allSettled(
    requests.map(async ({ qStr, page }) => {
      const url = new URL("https://api.github.com/search/repositories");
      url.searchParams.set("q", qStr);
      url.searchParams.set("sort", "stars");
      url.searchParams.set("order", "desc");
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      const res = await fetch(url, {
        headers,
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5500),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload?.items) ? payload.items : [];
    })
  );

  const items = [];
  for (const res of settled) {
    if (res.status !== "fulfilled") continue;
    for (const repo of res.value) {
      if (!repo?.full_name || repo.archived) continue;
      items.push({
        _stars: Number(repo.stargazers_count || 0),
        sourceLabel: "GitHub",
        server: {
          name: `github/${repo.full_name}`,
          title: repo.name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          version: "github",
          description:
            repo.description ||
            `Open-source MCP server (${Number(repo.stargazers_count || 0).toLocaleString()} stars).`,
          repository: { url: repo.homepage || repo.html_url },
          remotes:
            repo.homepage && /^https:\/\/.*mcp/i.test(repo.homepage)
              ? [{ type: "streamable-http", url: repo.homepage }]
              : [],
          packages: [],
        },
      });
    }
  }
  return items;
}

function serializeServer(entry) {
  const server = entry?.server || entry || {};
  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const packages = Array.isArray(server.packages) ? server.packages : [];
  const repo = server.repository;
  const name = server.title || server.name || "Unnamed MCP";
  const id = server.name || "";
  const description = server.description || "MCP server indexed in DRIVE Directory.";
  const isRemote = remotes.length > 0;
  const repoStr = typeof repo === "string" ? repo : repo?.url || "";
  const cleanIdForCat = id.replace(/^(github|glama|npm|pulsemcp|docker|crates)\//i, "");
  const category = classifyMcpCategory(entry?.category, `${name} ${cleanIdForCat} ${description}`);
  const authType = inferAuthType(entry?.authType, isRemote, `${name} ${description}`);
  const stars = Number(entry?.stars || entry?._stars || 0);

  return {
    name,
    id,
    description,
    version: server.version || "latest",
    transport: isRemote ? "Remote HTTP" : packages.length ? "STDIO" : "Registry",
    repository: repoStr,
    sourceLabel: entry?.sourceLabel || "Registry",
    isRemote,
    verifiedPopular: Boolean(entry?.verifiedPopular),
    category,
    authType,
    stars,
    rawEntry: {
      server: {
        name: id,
        title: name,
        version: server.version || "latest",
        description,
        repository: repoStr ? { url: repoStr } : undefined,
        remotes: remotes.slice(0, 2),
      },
    },
  };
}

function balanceByCategory(sortedItems, targetCount, perCategoryCap) {
  const curated = [];
  const byCategory = new Map();

  for (const item of sortedItems) {
    if (item.verifiedPopular) {
      curated.push(item);
      continue;
    }
    const cat = item.category || "coding";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(item);
  }

  const picked = [...curated];
  const overflow = [];
  const categories = [...byCategory.keys()];
  const indices = new Map(categories.map((c) => [c, 0]));

  let added = true;
  while (picked.length < targetCount && added) {
    added = false;
    for (const cat of categories) {
      const list = byCategory.get(cat);
      const idx = indices.get(cat);
      if (idx < list.length && idx < perCategoryCap) {
        picked.push(list[idx]);
        indices.set(cat, idx + 1);
        added = true;
        if (picked.length >= targetCount) break;
      }
    }
  }

  for (const cat of categories) {
    const list = byCategory.get(cat);
    const idx = indices.get(cat);
    if (idx < list.length) overflow.push(...list.slice(idx));
  }

  overflow.sort((a, b) => (b.stars || 0) - (a.stars || 0));
  for (const item of overflow) {
    if (picked.length >= targetCount) break;
    picked.push(item);
  }
  return picked;
}

async function getServers(query) {
  const trimmed = (query || "").trim().slice(0, 120);
  const lower = trimmed.toLowerCase();
  const seen = new Set();
  const all = [];
  const apiSearch = lower && lower !== "remote" ? trimmed : "";

  for (const item of VERIFIED_POPULAR_MCPS) {
    seen.add(item.server.name.toLowerCase());
    all.push(item);
  }

  const [officialRes, glamaRes, npmRes, pulseRes, dockerRes, cratesRes, githubRes] =
    await Promise.allSettled([
      fetchOfficialRegistry(apiSearch, apiSearch ? 10 : 85),
      fetchGlamaDirectory(apiSearch),
      fetchNpmMcpServers(apiSearch),
      fetchPulseMcpServers(apiSearch),
      fetchDockerHubMcps(apiSearch),
      fetchCratesIoMcps(apiSearch),
      fetchGithubPopularMcps(apiSearch),
    ]);

  const combined = [
    ...(officialRes.status === "fulfilled" ? officialRes.value : []),
    ...(glamaRes.status === "fulfilled" ? glamaRes.value : []),
    ...(npmRes.status === "fulfilled" ? npmRes.value : []),
    ...(pulseRes.status === "fulfilled" ? pulseRes.value : []),
    ...(dockerRes.status === "fulfilled" ? dockerRes.value : []),
    ...(cratesRes.status === "fulfilled" ? cratesRes.value : []),
    ...(githubRes.status === "fulfilled" ? githubRes.value : []),
  ];

  for (const entry of combined) {
    const server = entry?.server || entry;
    const key = String(server?.name || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    all.push(entry);
    if (all.length >= 42000) break;
  }

  const serialized = all.map(serializeServer);
  serialized.sort((a, b) => {
    if (b.verifiedPopular !== a.verifiedPopular) return Number(b.verifiedPopular) - Number(a.verifiedPopular);
    if (b.stars !== a.stars) return b.stars - a.stars;
    if (b.isRemote !== a.isRemote) return Number(b.isRemote) - Number(a.isRemote);
    return a.name.localeCompare(b.name);
  });

  const balanced = balanceByCategory(serialized, TARGET_MCP_COUNT, PER_CATEGORY_PASS1_CAP);

  return {
    servers: balanced,
    unavailable: balanced.length === 0,
  };
}

export async function renderWorkspaceHome(searchParams, forcedTab = "mcp") {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q : "";

  const { servers, unavailable } = await getServers(query);

  const discover = (
    <McpDirectoryGrid
      initialServers={servers}
      initialQuery={query}
      unavailable={unavailable}
    />
  );

  const add = (
    <section className="platform-section" id="custom">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            <span className="pulse" /> CUSTOM ENDPOINT
          </div>
          <h1>Add Custom MCP</h1>
        </div>
      </div>
      <CustomMcpForm />
    </section>
  );

  const connections = <MyMcpPanel />;
  const skills = <SkillLibrary />;

  return (
    <WorkspaceTabs
      connections={connections}
      discover={discover}
      add={add}
      skills={skills}
      initialTab={forcedTab}
      serverCount={servers.length}
      query={query}
    />
  );
}

export default async function Home({ searchParams }) {
  return renderWorkspaceHome(searchParams, "mcp");
}
