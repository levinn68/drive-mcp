import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;
export const maxDuration = 60;

const REGISTRY = "https://registry.modelcontextprotocol.io";
const NPM_SEARCH_API = "https://registry.npmjs.org/-/v1/search";
const DOCKER_HUB_API = "https://hub.docker.com/v2/search/repositories/";
const CRATES_IO_API = "https://crates.io/api/v1/crates";

const TARGET_MCP_COUNT = 25000;
const PER_CATEGORY_PASS1_CAP = 1600;
const JUNK_MCP_RX = /^(test|demo|hello[-_]?world|example|sample|foo|bar|tmp|temp)[-_0-9]*$/i;

const CURATED_POPULAR_MCPS = [
  {
    name: "com.github/mcp",
    title: "GitHub Official MCP",
    version: "official",
    category: "backend",
    description: "Official GitHub remote MCP server for repositories, issues, pull requests, branches, commits, and code search.",
    repository: { url: "https://github.com/github/github-mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://api.githubcopilot.com/mcp/", authentication: { required: true, type: "bearer" } }],
    stars: 28000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.github/mcp-all",
    title: "GitHub Official MCP (All Toolsets)",
    version: "official",
    category: "backend",
    description: "Full GitHub remote MCP with all 19 toolsets including Actions, Code Security, Projects, Gists, and Orgs.",
    repository: { url: "https://github.com/github/github-mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://api.githubcopilot.com/mcp/x/all", authentication: { required: true, type: "bearer" } }],
    stars: 27500,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.supabase/mcp",
    title: "Supabase Official MCP",
    version: "official",
    category: "database",
    description: "Official Supabase remote MCP server for Postgres queries, migrations, Edge Functions, logs, and project management.",
    repository: { url: "https://supabase.com/docs/guides/getting-started/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.supabase.com/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 24000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.vercel/mcp",
    title: "Vercel Official MCP",
    version: "official",
    category: "cloud",
    description: "Official Vercel remote MCP server for deployments, build logs, projects, domains, and documentation.",
    repository: { url: "https://vercel.com/docs/mcp/vercel-mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.vercel.com", authentication: { required: true, type: "oauth2" } }],
    stars: 22000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.cloudflare/mcp",
    title: "Cloudflare Official MCP",
    version: "official",
    category: "cloud",
    description: "Official Cloudflare MCP server for Workers, Pages, R2, D1 SQL, DNS, and Zero Trust documentation.",
    repository: { url: "https://github.com/cloudflare/mcp-server-cloudflare" },
    remotes: [{ type: "streamable_http", url: "https://docs.mcp.cloudflare.com/mcp" }],
    stars: 21000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.notion/mcp",
    title: "Notion Official MCP",
    version: "official",
    category: "productivity",
    description: "Official Notion remote MCP server to search, read, create, and update Notion pages, databases, and comments.",
    repository: { url: "https://developers.notion.com/docs/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.notion.com/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 23000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.linear/mcp",
    title: "Linear Official MCP",
    version: "official",
    category: "productivity",
    description: "Official Linear remote MCP server for issues, projects, cycles, teams, and roadmap workflows.",
    repository: { url: "https://linear.app/docs/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.linear.app/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 19500,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.atlassian/mcp",
    title: "Atlassian Rovo MCP (Jira & Confluence)",
    version: "official",
    category: "productivity",
    description: "Official Atlassian remote MCP server for Jira tickets, sprints, Bitbucket, and Confluence pages.",
    repository: { url: "https://support.atlassian.com/rovo/docs/setting-up-ides/" },
    remotes: [{ type: "streamable_http", url: "https://mcp.atlassian.com/v2/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 19000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.slack/mcp",
    title: "Slack Official MCP",
    version: "official",
    category: "comms",
    description: "Official Slack remote MCP server to search messages and channels, send messages, and create canvases.",
    repository: { url: "https://mcp.slack.com/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.slack.com/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 20500,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "dev.firecrawl/mcp",
    title: "Firecrawl MCP Server",
    version: "official",
    category: "search",
    description: "Turn any website into clean Markdown, structured JSON, or full-site crawls for AI agents.",
    repository: { url: "https://github.com/mendableai/firecrawl-mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://mcp.firecrawl.dev/v2/mcp" }],
    stars: 21500,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "ai.exa/mcp",
    title: "Exa Web Search MCP",
    version: "official",
    category: "search",
    description: "Real-time AI web search, code context, and company research via Exa remote MCP.",
    repository: { url: "https://github.com/exa-labs/exa-mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://mcp.exa.ai/mcp" }],
    stars: 18200,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.tavily/mcp",
    title: "Tavily Search MCP",
    version: "official",
    category: "search",
    description: "AI-tuned real-time web search and content extraction remote MCP server.",
    repository: { url: "https://github.com/tavily-ai/tavily-mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.tavily.com/mcp/" }],
    stars: 17400,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.apify/mcp",
    title: "Apify Actors MCP",
    version: "official",
    category: "automation",
    description: "Run ready-made Apify web scrapers and automation Actors directly from AI agents.",
    repository: { url: "https://mcp.apify.com" },
    remotes: [{ type: "streamable_http", url: "https://mcp.apify.com", authentication: { required: true, type: "oauth2" } }],
    stars: 15800,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.make/mcp",
    title: "Make.com Official MCP",
    version: "official",
    category: "automation",
    description: "Official Make.com remote MCP server to trigger and orchestrate automated multi-app scenarios.",
    repository: { url: "https://mcp.make.com/v2" },
    remotes: [{ type: "streamable_http", url: "https://mcp.make.com/v2", authentication: { required: true, type: "oauth2" } }],
    stars: 16500,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.zapier/mcp",
    title: "Zapier Official MCP",
    version: "official",
    category: "automation",
    description: "Connect AI agents to 8,000+ apps and automated workflows through Zapier MCP.",
    repository: { url: "https://mcp.zapier.com" },
    remotes: [{ type: "streamable_http", url: "https://mcp.zapier.com/api/v1/connect" }],
    stars: 19200,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.context7/mcp",
    title: "Context7 Docs MCP",
    version: "official",
    category: "docs",
    description: "Up-to-date, version-specific library documentation and code examples for any framework or SDK.",
    repository: { url: "https://github.com/upstash/context7" },
    remotes: [{ type: "streamable_http", url: "https://mcp.context7.com/mcp" }],
    stars: 25400,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.deepwiki/deepwiki-mcp",
    title: "DeepWiki MCP",
    version: "official",
    category: "docs",
    description: "Ask architecture questions and read deep documentation for any public GitHub repository.",
    repository: { url: "https://docs.devin.ai/work-with-devin/deepwiki-mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.deepwiki.com/mcp" }],
    stars: 17800,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "io.sentry/mcp",
    title: "Sentry Official MCP",
    version: "official",
    category: "observability",
    description: "Official Sentry remote MCP server to inspect errors, stack traces, issues, and performance telemetry.",
    repository: { url: "https://docs.sentry.io/product/sentry-mcp/" },
    remotes: [{ type: "streamable_http", url: "https://mcp.sentry.dev/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 18600,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.grafana/mcp",
    title: "Grafana Official MCP",
    version: "official",
    category: "observability",
    description: "Search Grafana dashboards, query Prometheus and Loki, and inspect alerts and incidents.",
    repository: { url: "https://github.com/grafana/mcp-grafana" },
    remotes: [],
    stars: 15600,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.figma/mcp",
    title: "Figma Official MCP",
    version: "official",
    category: "design",
    description: "Official Figma remote MCP server to inspect design frames, tokens, components, and layouts.",
    repository: { url: "https://developers.figma.com/docs/figma-mcp-server/" },
    remotes: [{ type: "streamable_http", url: "https://mcp.figma.com/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 22400,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.canva/mcp",
    title: "Canva Official MCP",
    version: "official",
    category: "design",
    description: "Official Canva remote MCP server to create, edit, and export visual designs via OAuth.",
    repository: { url: "https://mcp.canva.com/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.canva.com/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 18900,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.miro/mcp",
    title: "Miro Official MCP",
    version: "official",
    category: "design",
    description: "Summarize Miro boards, build architecture diagrams, and act on board comments.",
    repository: { url: "https://miro.com" },
    remotes: [{ type: "streamable_http", url: "https://mcp.miro.com/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 14900,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "do.craft/mcp",
    title: "Craft.do Official MCP",
    version: "official",
    category: "docs",
    description: "Official Craft.do remote MCP server to read, search, and edit Craft documents and knowledge spaces.",
    repository: { url: "https://www.craft.do/imagine/guide/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.craft.do/my/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 16800,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.getartcraft/figcraft",
    title: "FigCraft MCP (ArtCraft)",
    version: "official",
    category: "design",
    description: "Open-source Rust Figma alternative with 400+ UI design, auto-layout, and prototyping commands via figcraft-cli mcp.",
    repository: { url: "https://github.com/storytold/figcraft" },
    packages: [{ registryType: "cargo", identifier: "figcraft-cli", transport: { type: "stdio" } }],
    remotes: [],
    stars: 17200,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.getartcraft/effectcraft",
    title: "EffectCraft MCP (ArtCraft)",
    version: "official",
    category: "media",
    description: "Open-source Rust motion graphics and compositing app driven by AI agents via effectcraft-cli mcp.",
    repository: { url: "https://github.com/storytold/effectcraft" },
    packages: [{ registryType: "cargo", identifier: "effectcraft-cli", transport: { type: "stdio" } }],
    remotes: [],
    stars: 14100,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.getartcraft/vectorcraft",
    title: "VectorCraft MCP (ArtCraft)",
    version: "official",
    category: "design",
    description: "Open-source ArtCraft vector illustration suite controllable via CLI and MCP server.",
    repository: { url: "https://getartcraft.com/apps" },
    packages: [{ registryType: "cargo", identifier: "vectorcraft-cli", transport: { type: "stdio" } }],
    remotes: [],
    stars: 13200,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.getartcraft/photocraft",
    title: "PhotoCraft MCP (ArtCraft)",
    version: "official",
    category: "design",
    description: "Open-source ArtCraft raster and photo editing app controllable via CLI and MCP server.",
    repository: { url: "https://getartcraft.com/apps" },
    packages: [{ registryType: "cargo", identifier: "photocraft-cli", transport: { type: "stdio" } }],
    remotes: [],
    stars: 12900,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.getartcraft/texturecraft",
    title: "TextureCraft MCP (ArtCraft)",
    version: "official",
    category: "design",
    description: "Open-source ArtCraft procedural texture synthesis app with native MCP command interface.",
    repository: { url: "https://getartcraft.com/apps" },
    packages: [{ registryType: "cargo", identifier: "texturecraft-cli", transport: { type: "stdio" } }],
    remotes: [],
    stars: 12100,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.getartcraft/materialcraft",
    title: "MaterialCraft MCP (ArtCraft)",
    version: "official",
    category: "design",
    description: "Open-source ArtCraft PBR material authoring tool with native CLI and MCP server.",
    repository: { url: "https://getartcraft.com/apps" },
    packages: [{ registryType: "cargo", identifier: "materialcraft-cli", transport: { type: "stdio" } }],
    remotes: [],
    stars: 11800,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.getartcraft/soundcraft",
    title: "SoundCraft MCP (ArtCraft)",
    version: "official",
    category: "media",
    description: "Open-source ArtCraft audio design and synthesis tool driven via CLI and MCP server.",
    repository: { url: "https://getartcraft.com/apps" },
    packages: [{ registryType: "cargo", identifier: "soundcraft-cli", transport: { type: "stdio" } }],
    remotes: [],
    stars: 11600,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.getartcraft/wordcraft",
    title: "WordCraft MCP (ArtCraft)",
    version: "official",
    category: "docs",
    description: "Open-source ArtCraft publishing and document layout tool controllable via MCP server.",
    repository: { url: "https://getartcraft.com/apps" },
    packages: [{ registryType: "cargo", identifier: "wordcraft-cli", transport: { type: "stdio" } }],
    remotes: [],
    stars: 11500,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.craftcms/mcp",
    title: "Craft CMS Official MCP",
    version: "official",
    category: "backend",
    description: "Official Craft CMS 5.x MCP integration built on mcp/sdk for entries, sections, and content management.",
    repository: { url: "https://craftcms.com/docs/5.x/extend/mcp.html" },
    remotes: [],
    stars: 12400,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "io.craft/mcp",
    title: "Craft.io Official MCP",
    version: "official",
    category: "productivity",
    description: "Official Craft.io product management connector for roadmaps, specs, and feedback.",
    repository: { url: "https://help.craft.io/en/articles/16952279-connect-craft-io-to-claude-with-the-official-connector" },
    remotes: [],
    stars: 11900,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.stripe/mcp",
    title: "Stripe Official MCP",
    version: "official",
    category: "finance",
    description: "Official Stripe remote MCP server for payments, customers, invoices, subscriptions, and billing.",
    repository: { url: "https://docs.stripe.com/mcp" },
    remotes: [{ type: "streamable_http", url: "https://mcp.stripe.com", authentication: { required: true, type: "oauth2" } }],
    stars: 20100,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.paypal/mcp",
    title: "PayPal Official MCP",
    version: "official",
    category: "finance",
    description: "Official PayPal remote MCP server for invoices, orders, disputes, and payment links.",
    repository: { url: "https://mcp.paypal.com" },
    remotes: [{ type: "streamable_http", url: "https://mcp.paypal.com/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 14200,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "tech.neon/mcp",
    title: "Neon Postgres MCP",
    version: "official",
    category: "database",
    description: "Official Neon serverless Postgres remote MCP server for branching, SQL execution, and schema management.",
    repository: { url: "https://neon.tech/docs/ai/neon-mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://mcp.neon.tech/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 16300,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.hashicorp/terraform-mcp",
    title: "HashiCorp Terraform MCP",
    version: "official",
    category: "cloud",
    description: "Official Terraform MCP server for provider docs, modules, workspaces, and IaC state workflows.",
    repository: { url: "https://github.com/hashicorp/terraform-mcp-server" },
    remotes: [],
    stars: 15100,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.asana/mcp",
    title: "Asana Official MCP",
    version: "official",
    category: "productivity",
    description: "Official Asana remote MCP server for tasks, projects, timelines, and team collaboration.",
    repository: { url: "https://developers.asana.com/docs/mcp-server" },
    remotes: [{ type: "streamable_http", url: "https://mcp.asana.com/v2/mcp", authentication: { required: true, type: "oauth2" } }],
    stars: 13800,
    verified: true,
    sourceLabel: "Official",
  },
  {
    name: "com.shopify/mcp",
    title: "Shopify Dev MCP",
    version: "official",
    category: "ecommerce",
    description: "Official Shopify MCP server for Storefront/Admin GraphQL APIs, Polaris, and Hydrogen docs.",
    repository: { url: "https://github.com/Shopify/dev-mcp" },
    remotes: [],
    stars: 14700,
    verified: true,
    sourceLabel: "Official",
  },
];

const MCP_CATEGORY_RULES = [
  { id: "search", rx: /\b(exa|tavily|firecrawl|perplexity|brave|serper|searx|search|scrape|scraping|crawl|fetch)\b/i },
  { id: "observability", rx: /\b(sentry|grafana|prometheus|datadog|opentelemetry|otel|posthog|telemetry|logging|metrics|tracing|incident)\b/i },
  { id: "cloud", rx: /\b(cloudflare|aws|gcp|azure|vercel|netlify|terraform|pulumi|kubernetes|k8s|helm|docker|ansible|infra|edge|lambda|s3|r2)\b/i },
  { id: "database", rx: /\b(supabase|postgres|postgresql|mysql|sqlite|neon|prisma|drizzle|mongo|mongodb|redis|clickhouse|duckdb|neo4j|qdrant|pinecone|turso|convex|sql|database)\b/i },
  { id: "finance", rx: /\b(stripe|paypal|invoice|billing|payment|fintech|accounting|quickbooks|xero|plaid|tax|crypto|defi|solana|ethereum|wallet)\b/i },
  { id: "ecommerce", rx: /\b(shopify|woocommerce|magento|ecommerce|storefront|checkout|catalog|inventory|order)\b/i },
  { id: "comms", rx: /\b(slack|discord|telegram|whatsapp|email|gmail|outlook|resend|twilio|sendgrid|intercom|zendesk|notification|chat)\b/i },
  { id: "design", rx: /\b(figma|figcraft|vectorcraft|photocraft|texturecraft|materialcraft|canva|miro|excalidraw|mermaid|diagram|design|ui|ux|sketch|blender|3d|svg|canvas)\b/i },
  { id: "media", rx: /\b(remotion|effectcraft|soundcraft|video|audio|youtube|spotify|ffmpeg|whisper|tts|voice|image|midjourney|comfyui|music)\b/i },
  { id: "security", rx: /\b(security|audit|owasp|pentest|vuln|cve|snyk|trivy|semgrep|vault|keycloak|clerk|auth0|oauth|secret)\b/i },
  { id: "testing", rx: /\b(playwright|puppeteer|cypress|selenium|browser|test|testing|qa|vitest|jest|pytest|debug)\b/i },
  { id: "productivity", rx: /\b(notion|linear|jira|confluence|atlassian|asana|trello|calendar|obsidian|airtable|todoist|clickup|hubspot|salesforce|crm|craft\.io)\b/i },
  { id: "docs", rx: /\b(context7|deepwiki|craft\.do|wordcraft|docs|documentation|wiki|markdown|pdf|docx|pptx|xlsx|excel|slides|knowledge|rag)\b/i },
  { id: "automation", rx: /\b(n8n|zapier|make\.com|apify|workflow|automation|cron|webhook|scheduler|bot|cli|desktop-commander)\b/i },
  { id: "data", rx: /\b(analytics|bigquery|snowflake|dbt|pandas|jupyter|airflow|kafka|tableau|chart|bi|ml|huggingface|dataset)\b/i },
  { id: "mobile", rx: /\b(ios|android|xcode|flutter|expo|react-native|swift|kotlin|mobile)\b/i },
  { id: "frontend", rx: /\b(react|next\.?js|vue|nuxt|svelte|angular|tailwind|shadcn|vite|frontend)\b/i },
  { id: "backend", rx: /\b(github|gitlab|bitbucket|git|craftcms|api|node|python|rust|golang|java|graphql|trpc|grpc|server)\b/i },
  { id: "ai", rx: /\b(ai|llm|agent|mcp|modelcontextprotocol|openai|anthropic|claude|gemini|langchain|llamaindex|ollama|vllm|memory|prompt)\b/i },
];

function classifyMcpCategory(text) {
  const hay = String(text || "");
  for (const rule of MCP_CATEGORY_RULES) {
    if (rule.rx.test(hay)) return rule.id;
  }
  return "ai";
}

const NPM_MCP_QUERIES = [
  "mcp-server", "@modelcontextprotocol", "model-context-protocol", "mcp",
  "mcp github", "mcp gitlab", "mcp postgres", "mcp supabase", "mcp mysql", "mcp sqlite",
  "mcp redis", "mcp mongodb", "mcp neon", "mcp qdrant", "mcp pinecone",
  "mcp aws", "mcp cloudflare", "mcp kubernetes", "mcp docker", "mcp terraform", "mcp vercel",
  "mcp notion", "mcp linear", "mcp jira", "mcp atlassian", "mcp asana", "mcp obsidian", "mcp airtable",
  "mcp slack", "mcp discord", "mcp telegram", "mcp gmail", "mcp email", "mcp twilio",
  "mcp figma", "mcp canva", "mcp miro", "mcp excalidraw", "mcp mermaid", "mcp craft", "figcraft",
  "mcp playwright", "mcp puppeteer", "mcp browser", "mcp selenium", "mcp cypress",
  "mcp firecrawl", "mcp exa", "mcp tavily", "mcp brave", "mcp search", "mcp fetch", "mcp scraper",
  "mcp stripe", "mcp paypal", "mcp shopify", "mcp hubspot", "mcp salesforce",
  "mcp sentry", "mcp grafana", "mcp prometheus", "mcp datadog", "mcp posthog",
  "mcp context7", "mcp rag", "mcp memory", "mcp knowledge", "mcp pdf", "mcp excel",
  "mcp n8n", "mcp zapier", "mcp workflow", "mcp automation", "mcp cli",
  "mcp security", "mcp auth", "mcp vault", "mcp solana", "mcp ethereum",
  "mcp youtube", "mcp spotify", "mcp ffmpeg", "mcp image", "mcp audio",
  "mcp android", "mcp ios", "mcp flutter", "mcp react", "mcp nextjs",
];

const DOCKER_MCP_TOPICS = [
  "mcp-server", "modelcontextprotocol", "mcp-postgres", "mcp-github",
  "mcp-playwright", "mcp-grafana", "mcp-kubernetes", "mcp-docker",
  "mcp-redis", "mcp-slack", "mcp-notion", "mcp-fetch",
];

const CRATES_MCP_TOPICS = [
  "mcp", "model-context-protocol", "mcp-server", "rmcp", "figcraft", "craft",
];

async function fetchOfficialRegistry(q) {
  const all = [];
  const deadline = Date.now() + 9000;
  let cursor = "";
  for (let page = 0; page < 18 && Date.now() < deadline && all.length < 2500; page++) {
    const params = new URLSearchParams({ limit: "100", version: "latest" });
    if (q) params.set("search", q);
    if (cursor) params.set("cursor", cursor);
    try {
      const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, {
        headers: { accept: "application/json" },
        next: { revalidate: q ? 900 : 3600 },
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) break;
      const payload = await response.json();
      const servers = Array.isArray(payload.servers) ? payload.servers : [];
      if (!servers.length) break;
      all.push(...servers);
      cursor = payload.metadata?.nextCursor || "";
      if (!cursor) break;
    } catch {
      break;
    }
  }
  return all;
}

async function fetchNpmMcps(q) {
  const queries = q ? [`${q} mcp`, `mcp-server ${q}`, q] : NPM_MCP_QUERIES;
  const requests = [];
  for (let idx = 0; idx < queries.length; idx += 1) {
    const text = queries[idx];
    const offsets = q ? [0, 250] : idx < 12 ? [0, 250, 500, 750] : [0, 250];
    for (const from of offsets) requests.push({ text, from });
  }

  const parsed = [];
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
          headers: { accept: "application/json", "user-agent": "DRIVE-MCP-Catalog/5.0" },
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(4800),
        });
        if (!res.ok) return [];
        const payload = await res.json();
        return Array.isArray(payload?.objects) ? payload.objects : [];
      })
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.length) parsed.push(...r.value);
    }
    if (parsed.length >= 35000) break;
  }
  return parsed;
}

async function fetchDockerMcps(q) {
  const queries = q ? [`mcp ${q}`, q] : DOCKER_MCP_TOPICS;
  const settled = await Promise.allSettled(
    queries.map(async (term) => {
      const url = new URL(DOCKER_HUB_API);
      url.searchParams.set("query", term);
      url.searchParams.set("page_size", "100");
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-MCP-Catalog/5.0" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload?.results) ? payload.results : [];
    })
  );
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function fetchCratesMcps(q) {
  const queries = q ? [`mcp ${q}`] : CRATES_MCP_TOPICS;
  const settled = await Promise.allSettled(
    queries.map(async (term) => {
      const url = new URL(CRATES_IO_API);
      url.searchParams.set("q", term);
      url.searchParams.set("per_page", "100");
      url.searchParams.set("sort", "downloads");
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-MCP-Catalog/5.0 (https://drive-mcp-five.vercel.app)" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload?.crates) ? payload.crates : [];
    })
  );
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

function balanceAndInterleave(sortedItems, targetCount, perCategoryCap) {
  const byCategory = new Map();
  const curated = [];

  for (const item of sortedItems) {
    if (item.sourceLabel === "Official") {
      curated.push(item);
      continue;
    }
    const cat = item.category || "ai";
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100).toLowerCase();

  try {
    const [regRes, npmRes, dockerRes, cratesRes] = await Promise.allSettled([
      fetchOfficialRegistry(q),
      fetchNpmMcps(q),
      fetchDockerMcps(q),
      fetchCratesMcps(q),
    ]);

    const regRows = regRes.status === "fulfilled" ? regRes.value : [];
    const npmRows = npmRes.status === "fulfilled" ? npmRes.value : [];
    const dockerRows = dockerRes.status === "fulfilled" ? dockerRes.value : [];
    const cratesRows = cratesRes.status === "fulfilled" ? cratesRes.value : [];

    const unique = new Map();

    function upsert(entry) {
      const server = entry.server || entry;
      const name = String(server.name || "").trim();
      if (!name || JUNK_MCP_RX.test(name)) return;
      const key = name.toLowerCase();
      if (unique.has(key)) {
        const existing = unique.get(key);
        if ((entry.stars || 0) > (existing.stars || 0)) existing.stars = entry.stars;
        if (entry.verified) existing.verified = true;
        return;
      }
      const title = String(server.title || name).trim();
      const desc = String(server.description || "").trim();
      const category = entry.category || classifyMcpCategory(`${name} ${title} ${desc}`);
      const normalized = {
        ...entry,
        server: {
          ...server,
          name,
          title,
          description: desc,
          category,
        },
        name,
        title,
        description: desc,
        category,
        stars: Number(entry.stars || 0),
        verified: Boolean(entry.verified),
        sourceLabel: entry.sourceLabel || "Registry",
      };
      unique.set(key, normalized);
    }

    for (const curated of CURATED_POPULAR_MCPS) {
      const hay = `${curated.name} ${curated.title} ${curated.description} ${curated.category}`.toLowerCase();
      if (!q || hay.includes(q)) {
        upsert({ server: curated, ...curated });
      }
    }

    for (const entry of regRows) {
      const s = entry.server || entry;
      if (!s?.name) continue;
      upsert({
        server: s,
        stars: 1200,
        verified: true,
        sourceLabel: "MCP Registry",
      });
    }

    for (const obj of npmRows) {
      const pkg = obj?.package;
      if (!pkg?.name || JUNK_MCP_RX.test(pkg.name)) continue;
      const popScore = Math.round(Number(obj?.score?.detail?.popularity || 0) * 2000);
      const repoUrl = pkg.links?.repository || pkg.links?.homepage || pkg.links?.npm || "";
      upsert({
        server: {
          name: pkg.name,
          title: pkg.name.replace(/^@[^/]+\//, "").replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          version: pkg.version || "latest",
          description: pkg.description || `Published npm MCP Server package (${pkg.name}).`,
          repository: repoUrl ? { url: repoUrl } : undefined,
          packages: [{ registryType: "npm", identifier: pkg.name, transport: { type: "stdio" } }],
          remotes: [],
        },
        stars: popScore,
        verified: popScore >= 350,
        sourceLabel: "npm",
      });
    }

    for (const repo of dockerRows) {
      const name = String(repo?.repo_name || "").trim();
      if (!name) continue;
      const pulls = Number(repo.pull_count || 0);
      if (pulls < 100) continue;
      const score = Math.min(4000, Math.max(Number(repo.star_count || 0) * 5, Math.round(Math.sqrt(pulls))));
      upsert({
        server: {
          name: `docker/${name}`,
          title: (name.split("/")[1] || name).replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          version: "latest",
          description: repo.short_description || `Containerized MCP Server on Docker Hub (${pulls.toLocaleString()} pulls).`,
          repository: { url: `https://hub.docker.com/r/${name}` },
          packages: [{ registryType: "oci", identifier: name, transport: { type: "stdio" } }],
          remotes: [],
        },
        stars: score,
        verified: Boolean(repo.is_official) || pulls >= 50000,
        sourceLabel: "Docker Hub",
      });
    }

    for (const c of cratesRows) {
      const name = String(c?.name || "").trim();
      if (!name || JUNK_MCP_RX.test(name)) continue;
      const downloads = Number(c.downloads || 0);
      const score = Math.min(3500, Math.round(Math.sqrt(downloads) * 2));
      upsert({
        server: {
          name: `crates/${name}`,
          title: name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c2) => c2.toUpperCase()),
          version: c.newest_version || "latest",
          description: c.description || `Rust MCP Server crate (${downloads.toLocaleString()} downloads).`,
          repository: { url: c.repository || c.homepage || `https://crates.io/crates/${name}` },
          packages: [{ registryType: "cargo", identifier: name, transport: { type: "stdio" } }],
          remotes: [],
        },
        stars: score,
        verified: downloads >= 10000,
        sourceLabel: "Crates.io",
      });
    }

    const sorted = [...unique.values()].sort((a, b) => (b.stars || 0) - (a.stars || 0));
    const servers = balanceAndInterleave(sorted, TARGET_MCP_COUNT, PER_CATEGORY_PASS1_CAP);

    const categoryCounts = {};
    for (const item of servers) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    }

    return NextResponse.json(
      {
        servers,
        count: servers.length,
        target: TARGET_MCP_COUNT,
        categories: categoryCounts,
        source: "Official MCP Registry + npm + Docker Hub + Crates.io + Curated Official",
        query: q || null,
        hasMore: false,
      },
      {
        headers: {
          "Cache-Control": q
            ? "public, s-maxage=900, stale-while-revalidate=3600"
            : "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        servers: CURATED_POPULAR_MCPS.map((c) => ({ server: c, ...c })),
        count: CURATED_POPULAR_MCPS.length,
        error: "Could not load the full MCP catalog",
        detail: String(error?.message || "").slice(0, 240),
      },
      { status: 200 }
    );
  }
}
