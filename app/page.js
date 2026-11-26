import CustomMcpForm from "../components/custom-mcp-form";
import McpDirectoryGrid from "../components/mcp-directory-grid";
import MyMcpPanel from "../components/my-mcps";
import WorkspaceTabs from "../components/workspace-tabs";
import SkillLibrary from "../components/skill-library";

const REGISTRY = "https://registry.modelcontextprotocol.io";
const GLAMA_API = "https://glama.ai/api/mcp/v1/servers";

// Curated, widely-used official Remote Streamable HTTP MCP servers
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
  {
    verifiedPopular: true,
    category: "cloud",
    server: {
      name: "com.cloudflare/docs-mcp",
      title: "Cloudflare Docs MCP",
      version: "free",
      description: "Official zero-auth Cloudflare Workers, R2, D1, Pages, and Zero Trust docs search.",
      repository: { url: "https://github.com/cloudflare/mcp-server-cloudflare" },
      remotes: [{ type: "streamable-http", url: "https://docs.mcp.cloudflare.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "cloud",
    server: {
      name: "com.cloudflare/workers-bindings-mcp",
      title: "Cloudflare Workers MCP",
      version: "official",
      description: "Manage Cloudflare Workers, KV namespaces, R2 buckets, and D1 databases via OAuth.",
      repository: { url: "https://github.com/cloudflare/mcp-server-cloudflare" },
      remotes: [{ type: "streamable-http", url: "https://bindings.mcp.cloudflare.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "data",
    server: {
      name: "com.posthog/posthog-mcp",
      title: "PostHog Analytics MCP",
      version: "official",
      description: "Official PostHog MCP — product analytics, feature flags, funnels, and session insights.",
      repository: { url: "https://posthog.com/docs/model-context-protocol" },
      remotes: [{ type: "streamable-http", url: "https://mcp.posthog.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "browser",
    server: {
      name: "dev.firecrawl/firecrawl-mcp",
      title: "Firecrawl Web Scraper MCP",
      version: "official",
      description: "Turn any website into clean Markdown, structured JSON, or crawled knowledge for AI.",
      repository: { url: "https://github.com/mendableai/firecrawl-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.firecrawl.dev/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "search",
    server: {
      name: "com.tavily/tavily-mcp",
      title: "Tavily AI Search MCP",
      version: "official",
      description: "Real-time web search and content extraction optimized for LLM research agents.",
      repository: { url: "https://github.com/tavily-ai/tavily-mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.tavily.com/mcp/" }],
    },
  },
  {
    verifiedPopular: true,
    category: "browser",
    server: {
      name: "com.apify/apify-mcp",
      title: "Apify Actors & Scraping MCP",
      version: "official",
      description: "Run 4,000+ Apify web scraping and browser automation Actors directly from AI.",
      repository: { url: "https://github.com/apify/actors-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.apify.com" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    server: {
      name: "com.asana/asana-mcp",
      title: "Asana Tasks MCP",
      version: "official",
      description: "Official Asana remote MCP — manage tasks, projects, timelines, and team updates.",
      repository: { url: "https://developers.asana.com/docs/using-asanas-model-context-protocol-mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.asana.com/sse" }],
    },
  },
  {
    verifiedPopular: true,
    category: "messaging",
    server: {
      name: "com.intercom/intercom-mcp",
      title: "Intercom Support MCP",
      version: "official",
      description: "Official Intercom MCP — search customer conversations, tickets, and help articles.",
      repository: { url: "https://developers.intercom.com/docs/guides/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.intercom.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "finance",
    server: {
      name: "com.squareup/square-mcp",
      title: "Square Commerce MCP",
      version: "official",
      description: "Official Square MCP — catalog items, orders, payments, inventory, and customers.",
      repository: { url: "https://developer.squareup.com/docs/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.squareup.com/sse" }],
    },
  },
  {
    verifiedPopular: true,
    category: "design",
    server: {
      name: "com.webflow/webflow-mcp",
      title: "Webflow Sites & CMS MCP",
      version: "official",
      description: "Official Webflow remote MCP — manage CMS collections, pages, and site publishing.",
      repository: { url: "https://developers.webflow.com/data/docs/ai-tools" },
      remotes: [{ type: "streamable-http", url: "https://mcp.webflow.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "coding",
    server: {
      name: "com.prisma/prisma-mcp",
      title: "Prisma Postgres MCP",
      version: "official",
      description: "Official Prisma MCP — inspect schemas, run migrations, and manage Prisma Postgres.",
      repository: { url: "https://www.prisma.io/docs/orm/more/ai-tools/mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.prisma.io/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "productivity",
    server: {
      name: "com.hubspot/hubspot-mcp",
      title: "HubSpot CRM MCP",
      version: "official",
      description: "Official HubSpot MCP — contacts, deals, companies, and CRM pipeline automation.",
      repository: { url: "https://developers.hubspot.com/mcp" },
      remotes: [{ type: "streamable-http", url: "https://mcp.hubspot.com/" }],
    },
  },
  {
    verifiedPopular: true,
    category: "cloud",
    server: {
      name: "com.netlify/netlify-mcp",
      title: "Netlify Deploy MCP",
      version: "official",
      description: "Official Netlify remote MCP — sites, deployments, forms, and serverless functions.",
      repository: { url: "https://docs.netlify.com/welcome/build-with-ai/netlify-mcp-server/" },
      remotes: [{ type: "streamable-http", url: "https://netlify-mcp.netlify.app/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "messaging",
    server: {
      name: "com.slack/slack-mcp",
      title: "Slack Workspace MCP",
      version: "official",
      description: "Connect Slack channels, search threads, post updates, and summarize team activity.",
      repository: { url: "https://docs.slack.dev/ai/mcp-server" },
      remotes: [{ type: "streamable-http", url: "https://mcp.slack.com/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "security",
    server: {
      name: "io.snyk/snyk-mcp",
      title: "Snyk Security MCP",
      version: "official",
      description: "Scan dependencies, containers, and code for CVEs and security vulnerabilities.",
      repository: { url: "https://docs.snyk.io/integrations/developer-guardrails-for-agentic-workflows" },
      remotes: [{ type: "streamable-http", url: "https://mcp.snyk.io/mcp" }],
    },
  },
  {
    verifiedPopular: true,
    category: "data",
    server: {
      name: "com.datadog/datadog-mcp",
      title: "Datadog Observability MCP",
      version: "official",
      description: "Query Datadog logs, APM traces, metrics, dashboards, and incident alerts.",
      repository: { url: "https://docs.datadoghq.com/bits_ai/mcp_server/" },
      remotes: [{ type: "streamable-http", url: "https://mcp.datadoghq.com/api/unstable/mcp-server/mcp" }],
    },
  },
];

const USAGE_RANK_TERMS = [
  "playwright-mcp", "firebase-mcp", "storybook", "browser-use", "chrome-devtools-mcp",
  "context7", "snyk", "github-mcp", "gitlab-mcp", "sentry-mcp", "firecrawl",
  "supabase", "azure-mcp", "mongodb-mcp-server", "next-devtools-mcp", "repomix",
  "figma-context-mcp", "workspace-mcp", "ms-365-mcp-server", "mcp-clickhouse",
  "brave-search-mcp-server", "appwrite", "cloudflare", "notion", "linear", "stripe",
  "postgres", "redis", "docker", "kubernetes", "slack", "discord", "jira", "vercel",
];

const MCP_CATEGORY_RULES = [
  { id: "github", rx: /\b(github|gitlab|bitbucket|git\b|pull request|commit|repo|codebase)\b/i },
  { id: "database", rx: /\b(sql|postgres|postgresql|mysql|sqlite|supabase|neon|mongo|mongodb|redis|clickhouse|prisma|drizzle|planetscale|turso|database|dbhub|bigquery|snowflake)\b/i },
  { id: "cloud", rx: /\b(vercel|cloudflare|aws|azure|gcp|google cloud|netlify|railway|render|docker|kubernetes|k8s|terraform|sentry|devops|deploy|infra|hosting)\b/i },
  { id: "ai", rx: /\b(ai\b|llm|agent|hugging ?face|openai|anthropic|claude|gemini|ollama|langchain|vector|embedding|rag|model|prompt|memory|knowledge graph)\b/i },
  { id: "browser", rx: /\b(playwright|puppeteer|selenium|browser|chrome|crawl|firecrawl|apify|scrape|scraping|web ?fetch|headless)\b/i },
  { id: "search", rx: /\b(search|docs|documentation|wiki|deepwiki|context7|exa|tavily|brave|perplexity|arxiv|wikipedia|pubmed|knowledge)\b/i },
  { id: "design", rx: /\b(figma|design|webflow|canva|storybook|ui|ux|css|tailwind|blender|3d|image|video|svg|font|color)\b/i },
  { id: "finance", rx: /\b(stripe|paypal|square|plaid|finance|payment|invoice|billing|crypto|stock|trading|market|sec\b|edgar|bank|accounting|shopify)\b/i },
  { id: "messaging", rx: /\b(slack|discord|telegram|whatsapp|email|gmail|outlook|resend|twilio|intercom|zendesk|chat|sms|social|twitter|x\.com|linkedin)\b/i },
  { id: "security", rx: /\b(security|snyk|auth|oauth|clerk|vault|secret|vuln|cve|pentest|scan|audit|firewall|compliance|encrypt)\b/i },
  { id: "data", rx: /\b(analytics|posthog|datadog|grafana|prometheus|metabase|tableau|mixpanel|amplitude|chart|excel|sheets|csv|metrics|observability|telemetry)\b/i },
  { id: "productivity", rx: /\b(notion|linear|jira|confluence|atlassian|asana|trello|monday|clickup|todo|calendar|drive|hubspot|salesforce|crm|airtable|obsidian|zapier|n8n)\b/i },
  { id: "coding", rx: /\b(code|dev|devtools|ide|vscode|xcode|android|ios|npm|python|typescript|react|next\.js|svelte|rust|go|shell|terminal|sandbox|filesystem|lint|test)\b/i },
];

function classifyMcpCategory(explicitCategory, text) {
  if (explicitCategory) return explicitCategory;
  for (const rule of MCP_CATEGORY_RULES) {
    if (rule.rx.test(text)) return rule.id;
  }
  return "coding";
}

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
  if (entry?._stars > 500) return isRemote ? 200 : 800;
  return isRemote ? 500 : 2000;
}

async function fetchOfficialRegistry(apiSearch, maxPages = 24) {
  const results = [];
  let cursor = "";
  const deadline = Date.now() + 8500;
  for (let i = 0; i < maxPages && Date.now() < deadline; i += 1) {
    const params = new URLSearchParams({ limit: "100", version: "latest" });
    if (apiSearch.length >= 2) params.set("search", apiSearch);
    if (cursor) params.set("cursor", cursor);

    try {
      const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, {
        headers: { accept: "application/json" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(4500),
      });
      if (!response.ok) break;
      const payload = await response.json();
      const batch = Array.isArray(payload?.servers) ? payload.servers : [];
      results.push(...batch);
      cursor = payload?.metadata?.nextCursor || "";
      if (!cursor || results.length >= 2400) break;
    } catch {
      break;
    }
  }
  return results;
}

async function fetchGlamaDirectory(apiSearch, maxPages = 16) {
  const results = [];
  let cursor = "";
  const deadline = Date.now() + 8500;
  for (let i = 0; i < maxPages && Date.now() < deadline; i += 1) {
    const params = new URLSearchParams({ first: "100" });
    if (apiSearch.length >= 2) params.set("query", apiSearch);
    if (cursor) params.set("after", cursor);

    try {
      const response = await fetch(`${GLAMA_API}?${params}`, {
        headers: { accept: "application/json", "user-agent": "DRIVE-MCP/2.4" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(4500),
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
            remotes:
              item.url && /^https?:\/\//i.test(item.url) && item.url.includes("mcp")
                ? [{ type: "streamable-http", url: item.url }]
                : [],
            packages: [],
          },
        });
      }
      cursor = payload?.pageInfo?.hasNextPage ? payload?.pageInfo?.endCursor || "" : "";
      if (!cursor || results.length >= 1600) break;
    } catch {
      break;
    }
  }
  return results;
}

async function fetchGithubPopularMcps(apiSearch) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "DRIVE-MCP/2.4",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const qBase = apiSearch
    ? `${apiSearch} topic:mcp-server stars:>5`
    : "topic:mcp-server stars:>15";
  const pages = apiSearch ? [1, 2] : [1, 2, 3, 4, 5, 6];
  const settled = await Promise.allSettled(
    pages.map(async (page) => {
      const url = new URL("https://api.github.com/search/repositories");
      url.searchParams.set("q", qBase);
      url.searchParams.set("sort", "stars");
      url.searchParams.set("order", "desc");
      url.searchParams.set("per_page", "100");
      url.searchParams.set("page", String(page));
      const res = await fetch(url, {
        headers,
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload.items) ? payload.items : [];
    })
  );

  const items = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const repo of r.value) {
      if (!repo?.full_name || repo.archived) continue;
      items.push({
        _stars: Number(repo.stargazers_count || 0),
        server: {
          name: `github/${repo.full_name}`,
          title: repo.name
            .replace(/[-_]+/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase()),
          version: `${Number(repo.stargazers_count || 0).toLocaleString()}★`,
          description:
            repo.description ||
            `Popular open-source MCP server (${Number(repo.stargazers_count || 0).toLocaleString()} GitHub stars).`,
          repository: { url: repo.html_url },
          remotes:
            repo.homepage && /^https:\/\/.*mcp/i.test(repo.homepage)
              ? [{ type: "streamable-http", url: repo.homepage }]
              : [],
          packages: [{ identifier: repo.full_name }],
        },
      });
    }
  }
  return items;
}

function serializeServer(entry) {
  const server = entry?.server ?? entry ?? {};
  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const packages = Array.isArray(server.packages) ? server.packages : [];
  const repo = server.repository?.url || server.repository || "";
  const name = server.title || server.name || "Unnamed MCP";
  const id = server.name || "";
  const description = server.description || "MCP server indexed in DRIVE Directory.";
  const category = classifyMcpCategory(
    entry?.category,
    `${name} ${id} ${description} ${typeof repo === "string" ? repo : repo?.url || ""}`
  );
  return {
    name,
    id,
    description,
    version: server.version || "latest",
    transport: remotes.length ? "Remote HTTP" : packages.length ? "STDIO" : "Registry",
    repository: typeof repo === "string" ? repo : repo?.url || "",
    isRemote: remotes.length > 0,
    verifiedPopular: Boolean(entry?.verifiedPopular),
    category,
    rawEntry: {
      server: {
        name: id,
        title: name,
        version: server.version || "latest",
        description,
        repository: typeof repo === "string" ? { url: repo } : repo || undefined,
        remotes: remotes.slice(0, 2),
      },
    },
  };
}

async function getServers(query) {
  const all = [];
  const seen = new Set();
  const trimmed = (query || "").trim();
  const lower = trimmed.toLowerCase();
  const apiSearch = lower && lower !== "remote" ? trimmed : "";

  for (const item of VERIFIED_POPULAR_MCPS) {
    seen.add(item.server.name.toLowerCase());
    all.push(item);
  }

  const [officialRes, glamaRes, githubRes] = await Promise.allSettled([
    fetchOfficialRegistry(apiSearch, apiSearch ? 6 : 24),
    fetchGlamaDirectory(apiSearch, apiSearch ? 4 : 16),
    fetchGithubPopularMcps(apiSearch),
  ]);

  const combined = [
    ...(officialRes.status === "fulfilled" ? officialRes.value : []),
    ...(glamaRes.status === "fulfilled" ? glamaRes.value : []),
    ...(githubRes.status === "fulfilled" ? githubRes.value : []),
  ];

  for (const entry of combined) {
    const key = String(entry?.server?.name || entry?.name || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    all.push(entry);
    if (all.length >= 3500) break;
  }

  all.sort((a, b) => usageRank(a) - usageRank(b));
  return {
    servers: all.map(serializeServer),
    unavailable: all.length === 0,
  };
}

export default async function Home({ searchParams }) {
  const params = await searchParams;
  const query = typeof params?.q === "string" ? params.q : "";

  const data = await getServers(query);
  const servers = data.servers;

  const connections = <MyMcpPanel />;

  const discover = (
    <McpDirectoryGrid
      initialServers={servers}
      initialQuery={query}
      unavailable={data.unavailable}
    />
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
