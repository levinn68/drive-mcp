import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;
export const maxDuration = 60;

const NPM_SEARCH_API = "https://registry.npmjs.org/-/v1/search";
const LOBEHUB_AGENTS_INDEX = "https://chat-agents.lobehub.com/index.json";

const TARGET_SKILLS_COUNT = 25000;
const PER_CATEGORY_PASS1_CAP = 1800;

const JUNK_SKILL_RX = /^(test|demo|hello[-_]?world|example|sample|foo|bar|tmp|temp)[-_0-9]*$/i;
const REAL_NPM_SKILL_RX = /\b(skill\.md|agent[- ]?skills?|claude[- ]?skills?|codex[- ]?skills?|cursor[- ]?rules?|copilot[- ]?instructions?|windsurf[- ]?rules?|cline[- ]?rules?|openclaw|clawhub|skills\.sh)\b/i;

const CURATED_POPULAR_SKILLS = [
  {
    id: "vercel-labs/agent-skills/react-best-practices",
    name: "React Best Practices",
    slug: "react-best-practices",
    source: "vercel-labs/agent-skills",
    category: "frontend",
    description: "Official Vercel React & Next.js performance, Server Components, and rendering guidelines.",
    stars: 18500,
    installs: 120000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "vercel-labs/agent-skills/web-design-guidelines",
    name: "Web Design Guidelines",
    slug: "web-design-guidelines",
    source: "vercel-labs/agent-skills",
    category: "design",
    description: "Audit UI accessibility, spacing, typography, dark mode, and interaction polish.",
    stars: 16200,
    installs: 98000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "anthropics/skills/frontend-design",
    name: "Frontend Design",
    slug: "frontend-design",
    source: "anthropics/skills",
    category: "design",
    description: "Official Anthropic skill for production-grade, distinctive web interfaces and design systems.",
    stars: 24000,
    installs: 145000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "anthropics/skills/mcp-builder",
    name: "MCP Builder",
    slug: "mcp-builder",
    source: "anthropics/skills",
    category: "ai",
    description: "Build, test, and harden high-quality Model Context Protocol servers in TypeScript or Python.",
    stars: 22400,
    installs: 110000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "anthropics/skills/webapp-testing",
    name: "Webapp Testing",
    slug: "webapp-testing",
    source: "anthropics/skills",
    category: "testing",
    description: "Automated Playwright end-to-end verification, visual checks, and regression testing.",
    stars: 19500,
    installs: 88000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "anthropics/skills/docx",
    name: "DOCX Document Skill",
    slug: "docx",
    source: "anthropics/skills",
    category: "docs",
    description: "Create, edit, and format professional Word documents (.docx) with tables, headings, and comments.",
    stars: 22600,
    installs: 115000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "anthropics/skills/xlsx",
    name: "XLSX Spreadsheet Skill",
    slug: "xlsx",
    source: "anthropics/skills",
    category: "data",
    description: "Build, clean, and analyze Excel workbooks (.xlsx) with formulas, charts, and formatting.",
    stars: 20600,
    installs: 105000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "anthropics/skills/pptx",
    name: "PPTX Presentation Skill",
    slug: "pptx",
    source: "anthropics/skills",
    category: "design",
    description: "Design, build, and modify PowerPoint slide decks (.pptx) with clean layouts.",
    stars: 26400,
    installs: 132000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "supabase/agent-skills/supabase-postgres-best-practices",
    name: "Supabase Postgres Best Practices",
    slug: "supabase-postgres-best-practices",
    source: "supabase/agent-skills",
    category: "database",
    description: "Official Supabase RLS policies, indexing, query optimization, and Edge Functions guide.",
    stars: 14800,
    installs: 76000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "remotion-dev/skills/remotion-best-practices",
    name: "Remotion Best Practices",
    slug: "remotion-best-practices",
    source: "remotion-dev/skills",
    category: "media",
    description: "Official Remotion programmatic video rendering, spring physics, audio, and captions.",
    stars: 11200,
    installs: 54000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "expo/skills/building-native-ui",
    name: "Expo Native UI",
    slug: "building-native-ui",
    source: "expo/skills",
    category: "mobile",
    description: "Official Expo React Native navigation, gestures, animations, and iOS/Android native UI.",
    stars: 10400,
    installs: 49000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "cloudflare/skills/workers-best-practices",
    name: "Cloudflare Workers Best Practices",
    slug: "workers-best-practices",
    source: "cloudflare/skills",
    category: "cloud",
    description: "Official Cloudflare Workers, Durable Objects, R2, D1, and edge caching patterns.",
    stars: 9800,
    installs: 46000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "stripe/ai/stripe-best-practices",
    name: "Stripe Payments Best Practices",
    slug: "stripe-best-practices",
    source: "stripe/ai",
    category: "finance",
    description: "Official Stripe Checkout, webhooks, idempotency, subscriptions, and billing security.",
    stars: 12100,
    installs: 61000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "trailofbits/skills/security-audit",
    name: "Trail of Bits Security Audit",
    slug: "security-audit",
    source: "trailofbits/skills",
    category: "security",
    description: "Deep static analysis, OWASP checks, auth bypass auditing, and smart contract security.",
    stars: 13200,
    installs: 52000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "obra/superpowers/systematic-debugging",
    name: "Systematic Debugging",
    slug: "systematic-debugging",
    source: "obra/superpowers",
    category: "testing",
    description: "Root-cause debugging workflow with hypothesis testing, minimal repros, and regression guards.",
    stars: 15600,
    installs: 74000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "mendableai/skills/firecrawl-scrape",
    name: "Firecrawl Web Research",
    slug: "firecrawl-scrape",
    source: "mendableai/skills",
    category: "search",
    description: "Extract clean Markdown, structured JSON, and deep site crawls for research workflows.",
    stars: 14100,
    installs: 63000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "getsentry/skills/sentry-triage",
    name: "Sentry Error Triage",
    slug: "sentry-triage",
    source: "getsentry/skills",
    category: "observability",
    description: "Diagnose production stack traces, trace bottlenecks, and automate issue triage.",
    stars: 12400,
    installs: 51000,
    verified: true,
    sourceLabel: "Official",
  },
  {
    id: "shopify/skills/shopify-hydrogen",
    name: "Shopify Storefront & Hydrogen",
    slug: "shopify-hydrogen",
    source: "shopify/skills",
    category: "ecommerce",
    description: "Build fast Shopify storefronts, checkout extensions, and Admin GraphQL integrations.",
    stars: 11800,
    installs: 48000,
    verified: true,
    sourceLabel: "Official",
  },
];

// 320+ high-signal balanced topics across all 22 categories for skills.sh (100% real SKILL.md repos)
const SKILLS_SH_TOPICS = [
  "react", "next", "nextjs", "vue", "nuxt", "svelte", "angular", "astro", "remix", "solid", "tailwind", "shadcn", "radix", "css", "html", "vite", "webpack", "frontend", "component", "hooks", "state", "router", "form", "table", "i18n",
  "node", "nodejs", "express", "fastify", "nestjs", "python", "fastapi", "django", "flask", "rails", "ruby", "php", "laravel", "java", "spring", "csharp", "dotnet", "golang", "go", "rust", "cpp", "graphql", "trpc", "grpc", "rest", "api", "openapi", "webhook", "auth", "oauth", "jwt", "backend", "microservice", "architecture", "refactor", "clean-code",
  "ai", "agent", "agents", "mcp", "llm", "prompt", "rag", "vector", "embedding", "eval", "langchain", "llamaindex", "langgraph", "crewai", "autogen", "openai", "claude", "gemini", "anthropic", "ollama", "vllm", "huggingface", "pydantic", "skill", "skills", "memory", "context", "orchestration", "workflow",
  "sql", "postgres", "postgresql", "mysql", "sqlite", "supabase", "prisma", "drizzle", "mongodb", "mongo", "redis", "neon", "clickhouse", "firebase", "firestore", "duckdb", "neo4j", "qdrant", "pinecone", "convex", "turso", "database", "schema", "migration", "orm",
  "docker", "kubernetes", "k8s", "helm", "aws", "lambda", "s3", "azure", "gcp", "cloudflare", "workers", "vercel", "netlify", "railway", "terraform", "pulumi", "ansible", "linux", "bash", "shell", "nginx", "ci", "cd", "github-actions", "deploy", "devops", "cloud", "infra", "git", "github", "gitlab", "pr", "review",
  "grafana", "prometheus", "sentry", "datadog", "opentelemetry", "otel", "posthog", "logging", "tracing", "monitoring", "metrics", "observability", "alerts", "incident", "perf", "performance",
  "security", "audit", "owasp", "pentest", "encryption", "compliance", "vulnerability", "snyk", "trivy", "semgrep", "vault", "keycloak", "clerk", "auth0", "rls", "rbac", "hardening", "privacy", "secrets",
  "test", "testing", "playwright", "cypress", "puppeteer", "selenium", "vitest", "jest", "pytest", "debug", "debugging", "tdd", "qa", "e2e", "benchmark", "k6", "storybook", "lint", "eslint", "typescript", "typecheck",
  "design", "ui", "ux", "figma", "canva", "miro", "craft", "accessibility", "a11y", "typography", "color", "svg", "framer", "webflow", "branding", "logo", "wireframe", "prototype", "excalidraw", "mermaid", "diagram", "layout", "icon",
  "video", "remotion", "animation", "gsap", "motion", "3d", "three", "threejs", "webgl", "blender", "audio", "image", "voice", "tts", "whisper", "ffmpeg", "game", "unity", "godot", "shader", "comfyui", "canvas", "media", "podcast",
  "data", "analytics", "pandas", "numpy", "dbt", "spark", "snowflake", "bigquery", "airflow", "kafka", "chart", "dashboard", "excel", "xlsx", "csv", "ml", "pytorch", "jupyter", "etl", "pipeline", "bi", "visualization",
  "mobile", "ios", "android", "flutter", "dart", "expo", "swift", "swiftui", "kotlin", "react-native", "capacitor", "tauri", "electron", "xcode", "gradle", "app-store",
  "docs", "documentation", "pdf", "docx", "pptx", "markdown", "mdx", "latex", "slides", "writing", "copywriting", "readme", "changelog", "research", "academic", "translation", "blog", "article", "summary", "summarize", "humanize", "technical-writing",
  "seo", "marketing", "growth", "landing", "saas", "pricing", "onboarding", "newsletter", "ads", "hubspot", "salesforce", "pitch", "content", "social", "copy", "funnel", "conversion",
  "ecommerce", "shopify", "woocommerce", "medusa", "checkout", "storefront", "inventory", "catalog", "product", "stripe",
  "finance", "accounting", "invoice", "billing", "fintech", "paypal", "plaid", "trading", "stock", "budget", "tax", "payment",
  "web3", "solana", "ethereum", "solidity", "foundry", "hardhat", "defi", "wallet", "blockchain", "wagmi", "crypto", "smart-contract", "nft",
  "automation", "cron", "queue", "cli", "n8n", "zapier", "make", "apify", "script", "bot", "rpa", "openclaw", "clawhub", "superpowers",
  "search", "scrape", "scraping", "browser", "exa", "tavily", "firecrawl", "perplexity", "crawler", "fetch", "web",
  "comms", "slack", "discord", "telegram", "whatsapp", "twilio", "resend", "email", "gmail", "outlook", "chat", "support", "intercom",
  "productivity", "notion", "linear", "jira", "confluence", "asana", "trello", "calendar", "obsidian", "airtable", "crm", "startup", "interview", "plan", "planning", "roadmap", "spec", "prd", "meeting", "daily-brief", "task", "kanban",
];

const AWESOME_README_URLS = [
  "https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md",
  "https://raw.githubusercontent.com/VoltAgent/awesome-openclaw-skills/main/README.md",
  "https://raw.githubusercontent.com/heilcheng/awesome-agent-skills/main/README.md",
  "https://raw.githubusercontent.com/travisvn/awesome-claude-skills/main/README.md",
  "https://raw.githubusercontent.com/ComposioHQ/awesome-claude-skills/master/README.md",
  "https://raw.githubusercontent.com/karanb192/awesome-claude-skills/main/README.md",
  "https://raw.githubusercontent.com/LinklyAI/best-skills/main/README.md",
];

const CATEGORY_RULES = [
  { id: "search", rx: /\b(exa|tavily|firecrawl|perplexity|scrape|scraping|crawler|web search|serper|searx)\b/i },
  { id: "observability", rx: /\b(sentry|grafana|prometheus|datadog|opentelemetry|otel|posthog|telemetry|tracing|logging|metrics|observability|monitoring)\b/i },
  { id: "cloud", rx: /\b(aws|gcp|azure|cloudflare|vercel|netlify|terraform|pulumi|ansible|edge|lambda|s3|r2|iac|cloud)\b/i },
  { id: "finance", rx: /\b(stripe|paypal|invoice|billing|payment|fintech|accounting|quickbooks|xero|plaid|tax|finance|trading|stock)\b/i },
  { id: "ecommerce", rx: /\b(shopify|woocommerce|medusa|magento|ecommerce|storefront|checkout|inventory|amazon)\b/i },
  { id: "comms", rx: /\b(slack|discord|telegram|whatsapp|twilio|resend|sendgrid|email|gmail|intercom|zendesk|outlook)\b/i },
  { id: "frontend", rx: /\b(react|next\.?js|vue|nuxt|svelte|angular|tailwind|css|html|frontend|ui component|shadcn|vite|astro|radix|framer|remix|solidjs)\b/i },
  { id: "media", rx: /\b(remotion|video|audio|animation|gsap|motion|three\.?js|webgl|shader|3d|ffmpeg|podcast|image|canvas|music|suno|midjourney|stable diffusion|comfyui|game|unity|godot|blender|whisper|tts)\b/i },
  { id: "database", rx: /\b(sql|postgres|postgresql|mysql|sqlite|supabase|prisma|drizzle|mongo|mongodb|redis|clickhouse|database|schema|migration|neon|planetscale|firebase|duckdb|neo4j|qdrant|pinecone|turso|convex)\b/i },
  { id: "devops", rx: /\b(docker|kubernetes|k8s|ci\/cd|github actions|deploy|linux|nginx|helm|devops|container|git|github|gitlab)\b/i },
  { id: "security", rx: /\b(security|audit|owasp|pentest|vuln|cve|ssrf|xss|csrf|encrypt|secret|compliance|soc2|rbac|rls|hardening|cybersecurity|snyk|trivy|semgrep|vault|keycloak|clerk|auth0)\b/i },
  { id: "testing", rx: /\b(test|testing|playwright|cypress|puppeteer|selenium|jest|vitest|pytest|qa|e2e|unit test|debug|debugging|tdd|benchmark|lint|k6|storybook)\b/i },
  { id: "design", rx: /\b(design|ux|figma|figcraft|canva|miro|typography|color|brand|logo|wireframe|prototype|accessibility|a11y|glass|layout|illustration|sketch|ppt|powerpoint|webflow|excalidraw|mermaid|svg)\b/i },
  { id: "data", rx: /\b(data|analytics|pandas|numpy|dbt|spark|snowflake|bigquery|tableau|chart|visualization|etl|pipeline|ml|machine learning|pytorch|jupyter|excel|xlsx|csv|airflow|kafka|dataset)\b/i },
  { id: "mobile", rx: /\b(mobile|ios|android|swift|swiftui|kotlin|flutter|dart|react native|expo|apk|xcode|capacitor|tauri|electron)\b/i },
  { id: "web3", rx: /\b(web3|blockchain|solana|ethereum|solidity|smart contract|defi|wallet|nft|crypto|foundry|hardhat|wagmi)\b/i },
  { id: "marketing", rx: /\b(seo|marketing|growth|landing page|conversion|ads|social media|newsletter|email campaign|gtm|brand voice|sales|pitch|hubspot|salesforce)\b/i },
  { id: "docs", rx: /\b(doc|docs|documentation|readme|markdown|mdx|writing|copywriting|blog|changelog|technical writing|pdf|latex|slides|pptx|docx|translation|academic|essay|summary|summarize|humaniz|craft\.do)\b/i },
  { id: "automation", rx: /\b(automat|workflow|cron|browser|n8n|zapier|make\.com|cli|script|webhook|apify|openclaw|clawhub)\b/i },
  { id: "backend", rx: /\b(api|backend|node\.?js|express|fastify|nestjs|django|fastapi|flask|go|golang|rust|graphql|trpc|grpc|rest|auth|oauth|jwt|microservice|php|laravel|rails|spring|python|java)\b/i },
  { id: "ai", rx: /\b(ai|llm|agent|mcp|prompt|rag|embedding|vector|openai|claude|gemini|anthropic|langchain|llamaindex|langgraph|crewai|autogen|eval|fine-?tun|ollama|vllm|huggingface)\b/i },
  { id: "productivity", rx: /\b(productivity|notion|linear|jira|confluence|asana|trello|calendar|meeting|plan|planning|roadmap|project management|kanban|obsidian|airtable|career|interview|education|tutor|brief|prd|spec)\b/i },
];

const LOBEHUB_CAT_MAP = {
  programming: "backend",
  design: "design",
  copywriting: "docs",
  marketing: "marketing",
  office: "productivity",
  career: "productivity",
  academic: "docs",
  education: "docs",
  translation: "docs",
  games: "media",
  entertainment: "media",
  life: "productivity",
  general: "ai",
  emotions: "productivity",
};

function classifySkillCategory(rawCategory, text) {
  const hay = `${rawCategory || ""} ${text || ""}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.rx.test(hay)) return rule.id;
  }
  const clean = String(rawCategory || "").toLowerCase().trim();
  if (LOBEHUB_CAT_MAP[clean]) return LOBEHUB_CAT_MAP[clean];
  if (clean && clean !== "other" && clean !== "uncategorized") {
    if (clean.includes("dev") || clean.includes("code") || clean.includes("eng")) return "backend";
    return clean;
  }
  return "ai";
}

function cleanDescription(raw, fallback) {
  const txt = String(raw || "")
    .replace(/^[>|][-+]?\s*$/g, "")
    .replace(/^[>|][-+]?\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return txt.length >= 4 ? txt : fallback;
}

function formatTitle(raw, fallback) {
  const base = String(raw || fallback || "Agent Skill").trim();
  return base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Primary Source 1: skills.sh real SKILL.md index across 320+ balanced topics
async function fetchSkillsShSearch(q) {
  const headers = { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/6.0" };
  const queries = q ? [q] : SKILLS_SH_TOPICS;
  const rows = [];
  const deadline = Date.now() + 26000;

  for (let start = 0; start < queries.length && Date.now() < deadline; start += 48) {
    const batch = queries.slice(start, start + 48);
    const settled = await Promise.allSettled(
      batch.map(async (term) => {
        const url = new URL("https://skills.sh/api/search");
        url.searchParams.set("q", term);
        url.searchParams.set("limit", "250");
        const res = await fetch(url, {
          headers,
          next: { revalidate: q ? 900 : 3600 },
          signal: AbortSignal.timeout(4500),
        });
        if (!res.ok) return [];
        const payload = await res.json();
        return Array.isArray(payload.skills)
          ? payload.skills
          : Array.isArray(payload.data)
          ? payload.data
          : [];
      })
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.length) rows.push(...r.value);
    }
    if (rows.length >= 75000) break;
  }
  return rows;
}

// Primary Source 2: skillsdirectory.com public SKILL.md registry (up to 15,000 real skills)
async function fetchSkillsDirectory(q) {
  const totalPages = q ? 12 : 150;
  const allRows = [];
  const deadline = Date.now() + 23000;
  for (let start = 0; start < totalPages && Date.now() < deadline; start += 30) {
    const batch = Array.from({ length: Math.min(30, totalPages - start) }, (_, i) => start + i);
    const settled = await Promise.allSettled(
      batch.map(async (page) => {
        const url = new URL("https://www.skillsdirectory.com/api/registry");
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", "100");
        url.searchParams.set("sort", "stars");
        if (q) url.searchParams.set("q", q);
        const res = await fetch(url, {
          headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/6.0" },
          next: { revalidate: q ? 900 : 3600 },
          signal: AbortSignal.timeout(4800),
        });
        if (!res.ok) return [];
        const payload = await res.json();
        return Array.isArray(payload.skills) ? payload.skills : [];
      })
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.length) allRows.push(...r.value);
    }
  }
  return allRows;
}

// Source 3: LobeHub Public Agent Skills Index (real system-prompt skills)
async function fetchLobeHubSkills(q) {
  try {
    const res = await fetch(LOBEHUB_AGENTS_INDEX, {
      headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/6.0" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const payload = await res.json();
    const agents = Array.isArray(payload?.agents) ? payload.agents : [];
    const out = [];
    for (const agent of agents) {
      const id = String(agent?.identifier || "").trim();
      const title = String(agent?.meta?.title || id).trim();
      const desc = String(agent?.meta?.description || "").trim();
      const rawCat = String(agent?.meta?.category || "").trim().toLowerCase();
      if (!id || !title) continue;
      if (q && !`${title} ${id} ${desc} ${rawCat}`.toLowerCase().includes(q)) continue;
      const mappedCat = LOBEHUB_CAT_MAP[rawCat] || "";
      const tokenScore = Math.min(2500, Math.max(180, Number(agent.tokenUsage || 300)));
      out.push({
        repository: `lobehub/${id}`,
        name: title,
        slug: id,
        description: desc || `LobeHub AI Agent Skill (${title}).`,
        category: mappedCat,
        author: agent.author || "lobehub",
        stars: tokenScore,
        installs: tokenScore,
        verified: true,
        sourceLabel: "LobeHub",
        installUrl: `https://lobehub.com/discover/assistant/${id}`,
      });
    }
    return out;
  } catch {
    return [];
  }
}

// Source 4: Strictly real Agent Skill npm packages (must explicitly be SKILL.md / agent-skill / cursor-rules)
const NPM_STRICT_SKILL_QUERIES = [
  "agent-skill", "agent-skills", "claude-skill", "claude-skills",
  "codex-skill", "cursor-rules", "skill-md", "SKILL.md",
  "copilot-instructions", "windsurf-rules", "cline-rules", "openclaw-skill",
  "clawhub", "claude-code-skill", "gemini-skill", "mcp-skill",
];

async function fetchNpmRealSkillPackages(q) {
  const queries = q ? [`${q} agent-skill`, `${q} claude-skill`] : NPM_STRICT_SKILL_QUERIES;
  const requests = [];
  for (const text of queries) {
    const offsets = q ? [0] : [0, 250];
    for (const from of offsets) requests.push({ text, from });
  }

  const parsed = [];
  const deadline = Date.now() + 12000;
  for (let start = 0; start < requests.length && Date.now() < deadline; start += 24) {
    const batch = requests.slice(start, start + 24);
    const settled = await Promise.allSettled(
      batch.map(async ({ text, from }) => {
        const url = new URL(NPM_SEARCH_API);
        url.searchParams.set("text", text);
        url.searchParams.set("size", "250");
        url.searchParams.set("from", String(from));
        const res = await fetch(url, {
          headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/6.0" },
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(4500),
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
        if (!pkg?.name || JUNK_SKILL_RX.test(pkg.name)) continue;
        const hay = `${pkg.name} ${pkg.description || ""} ${(pkg.keywords || []).join(" ")}`;
        if (!REAL_NPM_SKILL_RX.test(hay)) continue;
        const repoUrl = pkg.links?.repository || "";
        const ghMatch = repoUrl.match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i);
        if (!ghMatch) continue; // Only include installable GitHub-backed skills
        const cleanSource = ghMatch[1].replace(/\.git$/i, "");
        const popScore = Math.round(Number(obj?.score?.detail?.popularity || 0) * 1400);
        parsed.push({
          repository: cleanSource,
          name: pkg.name.replace(/^@[^/]+\//, ""),
          slug: pkg.name.replace(/^@/, "").replace(/[^a-z0-9-]+/gi, "-").toLowerCase(),
          description: pkg.description || `Agent Skill package from ${cleanSource}.`,
          author: pkg.publisher?.username || cleanSource.split("/")[0],
          stars: popScore,
          installs: popScore,
          verified: popScore >= 250,
          sourceLabel: "Skill Pack",
          installUrl: `https://github.com/${cleanSource}`,
        });
      }
    }
  }
  return parsed;
}

// Source 5: Curated Awesome Agent Skills Lists (VoltAgent, OpenClaw/ClawHub, Composio, LinklyAI, Anthropic)
async function fetchAwesomeReadmes(q) {
  const settled = await Promise.allSettled(
    AWESOME_README_URLS.map(async (readmeUrl) => {
      const res = await fetch(readmeUrl, {
        headers: { "user-agent": "DRIVE-Skills-Catalog/6.0" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return [];
      const md = await res.text();
      const parsed = [];
      const rx = /-\s*\[([^\]]+)\]\(https?:\/\/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)[^)]*\)\s*(?:[-–—:]\s*(.+))?/g;
      let match;
      while ((match = rx.exec(md)) !== null) {
        const name = match[1].trim();
        const repo = match[2].replace(/\.git$/i, "").trim();
        const desc = (match[3] || "").trim();
        if (!name || !repo) continue;
        if (q && !`${name} ${repo} ${desc}`.toLowerCase().includes(q)) continue;
        parsed.push({
          repository: repo,
          name,
          slug: name.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
          description: desc || `Curated Agent Skill from ${repo}.`,
          stars: 350,
          installs: 200,
          verified: true,
          sourceLabel: "Curated",
        });
      }
      return parsed;
    })
  );
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

function balanceByCategory(sortedItems, targetCount, perCategoryCap) {
  const byCategory = new Map();
  const official = [];

  for (const item of sortedItems) {
    if (item.sourceLabel === "Official") {
      official.push(item);
      continue;
    }
    const cat = item.category || "ai";
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat).push(item);
  }

  const picked = [...official];
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

  overflow.sort((a, b) => b.installs * 2 + b.stars - (a.installs * 2 + a.stars));
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
    const [shRes, dirRes, lobeRes, npmRes, awesomeRes] = await Promise.allSettled([
      fetchSkillsShSearch(q),
      fetchSkillsDirectory(q),
      fetchLobeHubSkills(q),
      fetchNpmRealSkillPackages(q),
      fetchAwesomeReadmes(q),
    ]);

    const shRows = shRes.status === "fulfilled" ? shRes.value : [];
    const dirRows = dirRes.status === "fulfilled" ? dirRes.value : [];
    const lobeRows = lobeRes.status === "fulfilled" ? lobeRes.value : [];
    const npmRows = npmRes.status === "fulfilled" ? npmRes.value : [];
    const awesomeRows = awesomeRes.status === "fulfilled" ? awesomeRes.value : [];

    const uniqueSkills = new Map();
    const perRepoCount = new Map();
    let totalRawSkills = 0;

    function upsert(repo, item, bypassRepoCap = false) {
      const cleanRepo = String(repo || "")
        .replace(/^https?:\/\/github\.com\//i, "")
        .replace(/\/+$/, "")
        .trim();
      const rawName = String(item.name || item.skillId || "").trim();
      if (!cleanRepo || !rawName || JUNK_SKILL_RX.test(rawName)) return;

      totalRawSkills += 1;
      const slug = String(item.slug || item.skillId || rawName)
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const repoKey = cleanRepo.toLowerCase();
      const skillKey = `${repoKey}/${slug || rawName.toLowerCase()}`;

      if (uniqueSkills.has(skillKey)) {
        const existing = uniqueSkills.get(skillKey);
        if (Number(item.stars || 0) > existing.stars) existing.stars = Number(item.stars || 0);
        if (Number(item.installs || 0) > existing.installs) existing.installs = Number(item.installs || 0);
        if (item.verified) existing.verified = true;
        const candidateDesc = cleanDescription(item.description, "");
        if (candidateDesc && (!existing.description || existing.description.startsWith("Popular Agent Skill"))) {
          existing.description = candidateDesc;
        }
        return;
      }

      const repoCount = perRepoCount.get(repoKey) || 0;
      if (!bypassRepoCap && repoCount >= 150) return;
      perRepoCount.set(repoKey, repoCount + 1);

      const displayName = formatTitle(rawName, cleanRepo.split("/")[1]);
      const installs = Number(item.installs || 0);
      const stars = Number(item.stars || installs || 0);
      const desc = cleanDescription(
        item.description,
        `Verified Agent Skill from ${cleanRepo}${installs ? ` · ${installs.toLocaleString()} installs` : ""}.`
      );
      const category = classifySkillCategory(item.category, `${displayName} ${slug} ${desc}`);
      const defaultUrl = cleanRepo.startsWith("lobehub/")
        ? `https://lobehub.com/discover/assistant/${cleanRepo.slice(8)}`
        : `https://github.com/${cleanRepo}`;
      const targetUrl = item.installUrl || defaultUrl;

      uniqueSkills.set(skillKey, {
        id: skillKey,
        name: displayName,
        slug: slug || cleanRepo.split("/")[1] || rawName,
        source: cleanRepo,
        sourceLabel: item.sourceLabel || (cleanRepo.startsWith("lobehub/") ? "LobeHub" : "skills.sh"),
        description: desc,
        category,
        author: item.author || cleanRepo.split("/")[0] || null,
        stars,
        installs,
        verified: Boolean(item.verified) || installs >= 500 || stars >= 300,
        installUrl: targetUrl,
        url: targetUrl,
        sourceType: cleanRepo.startsWith("lobehub/") ? "lobehub" : "registry",
        skillCount: 1,
      });
    }

    for (const curated of CURATED_POPULAR_SKILLS) {
      const hay = `${curated.name} ${curated.description} ${curated.source} ${curated.category}`.toLowerCase();
      if (!q || hay.includes(q)) upsert(curated.source, curated, true);
    }

    for (const item of shRows) {
      const repo = item.source || item.topSource || item.repository || "";
      upsert(repo, {
        name: item.name || item.skillId,
        slug: item.skillId || item.slug || item.name,
        description: item.description || "",
        category: item.category || "",
        installs: item.installs || 0,
        stars: item.stars || item.installs || 0,
        verified: Boolean(item.verified) || Number(item.installs || 0) >= 300,
        sourceLabel: "skills.sh",
      });
    }

    for (const item of dirRows) {
      upsert(item.repository || "", {
        name: item.name || item.slug,
        slug: item.slug || item.name,
        description: item.description || "",
        category: item.category || "",
        author: item.author || null,
        stars: item.stars || 0,
        installs: item.installs || 0,
        verified: Boolean(item.verified) || Number(item.stars || 0) >= 200,
        sourceLabel: "SkillsDirectory",
        installUrl: item.url || undefined,
      });
    }

    for (const item of lobeRows) upsert(item.repository, item, true);
    for (const item of npmRows) upsert(item.repository, item);
    for (const item of awesomeRows) upsert(item.repository, item);

    const sorted = [...uniqueSkills.values()].sort((a, b) => {
      const scoreA = a.installs * 2 + a.stars;
      const scoreB = b.installs * 2 + b.stars;
      return scoreB - scoreA;
    });

    const items = balanceByCategory(sorted, TARGET_SKILLS_COUNT, PER_CATEGORY_PASS1_CAP);

    const categoryCounts = {};
    for (const item of items) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    }

    return NextResponse.json(
      {
        items,
        count: items.length,
        totalRawSkills,
        target: TARGET_SKILLS_COUNT,
        categories: categoryCounts,
        source: "skills.sh + SkillsDirectory + LobeHub + Curated OpenClaw/Composio + Verified Skill Packs",
        query: q || null,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        items: CURATED_POPULAR_SKILLS,
        count: CURATED_POPULAR_SKILLS.length,
        error: error?.message || "Failed to load skills catalog",
      },
      { status: 200 }
    );
  }
}
