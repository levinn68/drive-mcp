import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;
export const maxDuration = 60;

const NPM_SEARCH_API = "https://registry.npmjs.org/-/v1/search";
const LOBEHUB_AGENTS_INDEX = "https://chat-agents.lobehub.com/index.json";
const HUGGINGFACE_SPACES_API = "https://huggingface.co/api/spaces";
const HUGGINGFACE_DATASETS_API = "https://huggingface.co/api/datasets";
const CRATES_IO_API = "https://crates.io/api/v1/crates";
const DOCKER_HUB_API = "https://hub.docker.com/v2/search/repositories/";

const TARGET_SKILLS_COUNT = 22500;
const PER_CATEGORY_PASS1_CAP = 2500;

const JUNK_SKILL_RX = /^(test|demo|hello[-_]?world|example|sample|foo|bar|tmp|temp)[-_0-9]*$/i;

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
    category: "devops",
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
    category: "backend",
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
];

const SKILLS_SH_TOPICS = [
  "react", "next", "vue", "nuxt", "svelte", "angular", "astro", "remix", "solid", "tailwind", "shadcn", "radix", "css", "vite", "webpack",
  "node", "express", "fastify", "nestjs", "fastapi", "django", "flask", "rails", "laravel", "spring", "golang", "rust", "graphql", "trpc", "grpc", "openapi", "stripe", "webhook", "auth", "oauth",
  "ai", "agent", "mcp", "llm", "prompt", "rag", "vector", "embedding", "eval", "langchain", "llamaindex", "crewai", "autogen", "openai", "claude", "gemini", "ollama", "vllm", "huggingface", "pydantic",
  "sql", "postgres", "mysql", "sqlite", "supabase", "prisma", "drizzle", "mongodb", "redis", "neon", "clickhouse", "firebase", "duckdb", "neo4j", "qdrant", "pinecone", "convex", "turso",
  "docker", "kubernetes", "helm", "aws", "lambda", "azure", "gcp", "cloudflare", "vercel", "netlify", "terraform", "pulumi", "ansible", "linux", "nginx", "ci", "deploy", "grafana", "prometheus", "sentry", "datadog",
  "security", "audit", "owasp", "pentest", "encryption", "compliance", "vulnerability", "snyk", "trivy", "semgrep", "vault", "keycloak", "clerk", "auth0",
  "test", "playwright", "cypress", "puppeteer", "selenium", "vitest", "jest", "pytest", "debug", "tdd", "qa", "benchmark", "k6", "storybook",
  "design", "ui", "ux", "figma", "accessibility", "typography", "svg", "framer", "webflow", "branding", "wireframe", "excalidraw", "mermaid", "diagram",
  "video", "remotion", "animation", "3d", "three", "webgl", "blender", "audio", "image", "voice", "whisper", "ffmpeg", "game", "unity", "godot", "shader", "comfyui",
  "data", "analytics", "pandas", "dbt", "snowflake", "bigquery", "airflow", "kafka", "chart", "dashboard", "excel", "csv", "posthog", "ml", "pytorch", "jupyter",
  "mobile", "ios", "android", "flutter", "expo", "swift", "swiftui", "kotlin", "react-native", "capacitor", "tauri", "electron",
  "docs", "pdf", "docx", "pptx", "markdown", "mdx", "latex", "slides", "writing", "copywriting", "readme", "changelog", "research", "academic", "translation", "blog",
  "seo", "marketing", "growth", "landing", "saas", "pricing", "onboarding", "newsletter", "ads", "hubspot", "salesforce", "ecommerce", "shopify", "pitch",
  "web3", "solana", "ethereum", "solidity", "foundry", "hardhat", "defi", "wallet", "blockchain", "wagmi",
  "workflow", "automation", "scrape", "browser", "cron", "queue", "cli", "n8n", "zapier", "telegram", "whatsapp", "twilio", "resend", "apify", "firecrawl",
  "productivity", "notion", "linear", "jira", "confluence", "asana", "trello", "slack", "discord", "email", "gmail", "calendar", "obsidian", "airtable", "crm", "startup", "finance", "accounting", "interview",
];

const AWESOME_README_URLS = [
  "https://raw.githubusercontent.com/VoltAgent/awesome-agent-skills/main/README.md",
  "https://raw.githubusercontent.com/heilcheng/awesome-agent-skills/main/README.md",
  "https://raw.githubusercontent.com/travisvn/awesome-claude-skills/main/README.md",
];

const CATEGORY_RULES = [
  { id: "frontend", rx: /\b(react|next\.?js|vue|nuxt|svelte|angular|tailwind|css|html|frontend|ui component|shadcn|vite|astro|radix|framer|remix|solidjs)\b/i },
  { id: "media", rx: /\b(remotion|video|audio|animation|motion|three\.?js|webgl|shader|3d|ffmpeg|podcast|image|canvas|music|suno|midjourney|stable diffusion|comfyui|game|unity|godot|blender|whisper|tts)\b/i },
  { id: "database", rx: /\b(sql|postgres|postgresql|mysql|sqlite|supabase|prisma|drizzle|mongo|mongodb|redis|clickhouse|database|schema|migration|neon|planetscale|firebase|duckdb|neo4j|qdrant|pinecone|turso|convex)\b/i },
  { id: "devops", rx: /\b(docker|kubernetes|k8s|terraform|pulumi|aws|gcp|azure|vercel|cloudflare|ci\/cd|github actions|deploy|linux|nginx|helm|ansible|devops|infra|cloud|sentry|grafana|prometheus|datadog)\b/i },
  { id: "security", rx: /\b(security|audit|owasp|pentest|vuln|cve|ssrf|xss|csrf|encrypt|secret|compliance|soc2|rbac|rls|hardening|cybersecurity|snyk|trivy|semgrep|vault|keycloak|clerk|auth0)\b/i },
  { id: "testing", rx: /\b(test|testing|playwright|cypress|puppeteer|selenium|jest|vitest|pytest|qa|e2e|unit test|debug|debugging|tdd|benchmark|lint|k6|storybook)\b/i },
  { id: "design", rx: /\b(design|ux|figma|typography|color|brand|logo|wireframe|prototype|accessibility|a11y|glass|layout|illustration|sketch|ppt|powerpoint|webflow|excalidraw|mermaid|svg)\b/i },
  { id: "data", rx: /\b(data|analytics|pandas|numpy|dbt|spark|snowflake|bigquery|tableau|chart|visualization|etl|pipeline|ml|machine learning|pytorch|jupyter|excel|csv|posthog|airflow|kafka|dataset)\b/i },
  { id: "mobile", rx: /\b(mobile|ios|android|swift|swiftui|kotlin|flutter|react native|expo|apk|xcode|capacitor|tauri|electron)\b/i },
  { id: "web3", rx: /\b(web3|blockchain|solana|ethereum|solidity|smart contract|defi|wallet|nft|crypto|foundry|hardhat|wagmi)\b/i },
  { id: "marketing", rx: /\b(seo|marketing|growth|landing page|conversion|ads|social media|newsletter|email campaign|gtm|brand voice|sales|ecommerce|amazon|shopify|pitch|hubspot|salesforce)\b/i },
  { id: "docs", rx: /\b(doc|docs|documentation|readme|markdown|mdx|writing|copywriting|blog|changelog|technical writing|pdf|latex|slides|pptx|docx|translation|academic|essay|summary)\b/i },
  { id: "automation", rx: /\b(automat|workflow|cron|scrape|scraping|crawler|browser|n8n|zapier|make\.com|slack bot|telegram|discord bot|cli|script|webhook|apify|firecrawl|twilio|resend)\b/i },
  { id: "backend", rx: /\b(api|backend|node\.?js|express|fastify|nestjs|django|fastapi|flask|go|golang|rust|graphql|trpc|grpc|rest|stripe|payment|auth|oauth|jwt|microservice|php|laravel|rails|spring)\b/i },
  { id: "ai", rx: /\b(ai|llm|agent|mcp|prompt|rag|embedding|vector|openai|claude|gemini|anthropic|langchain|llamaindex|langgraph|crewai|autogen|eval|fine-?tun|ollama|vllm|huggingface)\b/i },
  { id: "productivity", rx: /\b(productivity|notion|linear|jira|confluence|asana|trello|calendar|email|gmail|meeting|plan|planning|roadmap|project management|kanban|obsidian|airtable|career|interview|finance|accounting|education|tutor)\b/i },
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

// Non-GitHub Source 1: skills.sh search across 220+ balanced topics
async function fetchSkillsShSearch(q) {
  const headers = { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/4.2" };
  const queries = q ? [q] : SKILLS_SH_TOPICS;
  const rows = [];
  const deadline = Date.now() + 18000;

  for (let start = 0; start < queries.length && Date.now() < deadline; start += 40) {
    const batch = queries.slice(start, start + 40);
    const settled = await Promise.allSettled(
      batch.map(async (term) => {
        const url = new URL("https://skills.sh/api/search");
        url.searchParams.set("q", term);
        url.searchParams.set("limit", "250");
        const res = await fetch(url, {
          headers,
          next: { revalidate: q ? 900 : 3600 },
          signal: AbortSignal.timeout(4800),
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
    if (rows.length >= 45000) break;
  }
  return rows;
}

// Non-GitHub Source 2: skillsdirectory.com public registry
async function fetchSkillsDirectory(q) {
  const totalPages = q ? 12 : 95;
  const allRows = [];
  const deadline = Date.now() + 16500;
  for (let start = 0; start < totalPages && Date.now() < deadline; start += 24) {
    const batch = Array.from({ length: Math.min(24, totalPages - start) }, (_, i) => start + i);
    const settled = await Promise.allSettled(
      batch.map(async (page) => {
        const url = new URL("https://www.skillsdirectory.com/api/registry");
        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", "100");
        url.searchParams.set("sort", "stars");
        if (q) url.searchParams.set("q", q);
        const res = await fetch(url, {
          headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/4.2" },
          next: { revalidate: q ? 900 : 3600 },
          signal: AbortSignal.timeout(5000),
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

// Non-GitHub Source 3: LobeHub Public Agent Skills Index
async function fetchLobeHubSkills(q) {
  try {
    const res = await fetch(LOBEHUB_AGENTS_INDEX, {
      headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/4.2" },
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

// Non-GitHub Source 4: Hugging Face Top AI Spaces & Workflow Skills
const HF_SPACE_TOPICS = [
  "agent", "rag", "coding", "image", "video", "audio", "tts", "ocr",
  "pdf", "sql", "design", "translation", "security", "search", "chat", "finance",
  "3d", "music", "vision", "markdown", "analytics", "resume", "marketing", "medical",
];

async function fetchHuggingFaceSkills(q) {
  const queries = q ? [q] : HF_SPACE_TOPICS;
  const settled = await Promise.allSettled(
    queries.map(async (term) => {
      const url = new URL(HUGGINGFACE_SPACES_API);
      url.searchParams.set("search", term);
      url.searchParams.set("sort", "likes");
      url.searchParams.set("direction", "-1");
      url.searchParams.set("limit", "100");
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/4.2" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5500),
      });
      if (!res.ok) return [];
      const arr = await res.json();
      return Array.isArray(arr) ? arr : [];
    })
  );

  const out = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const sp of r.value) {
      const id = String(sp?.id || "").trim();
      if (!id || !id.includes("/")) continue;
      const likes = Number(sp.likes || 0);
      if (likes < 3) continue;
      const rawName = id.split("/")[1] || id;
      const tags = Array.isArray(sp.tags) ? sp.tags.slice(0, 6).join(", ") : "";
      out.push({
        repository: `huggingface/${id}`,
        name: rawName,
        slug: rawName.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        description:
          sp.cardData?.short_description ||
          `Popular Hugging Face AI Space & workflow (${likes.toLocaleString()} likes${tags ? ` · ${tags}` : ""}).`,
        author: id.split("/")[0],
        stars: likes,
        installs: likes,
        verified: likes >= 100,
        sourceLabel: "HuggingFace",
        installUrl: `https://huggingface.co/spaces/${id}`,
      });
    }
  }
  return out;
}

// Non-GitHub Source 5: Hugging Face Top Prompt, Eval & Instruction Datasets
const HF_DATASET_TOPICS = [
  "prompt", "instruction", "agent", "code", "sql", "math", "reasoning", "eval",
  "finance", "security", "medical", "legal", "translation", "vision", "audio", "rag",
  "function-calling", "benchmark",
];

async function fetchHuggingFaceDatasets(q) {
  const queries = q ? [q] : HF_DATASET_TOPICS;
  const settled = await Promise.allSettled(
    queries.map(async (term) => {
      const url = new URL(HUGGINGFACE_DATASETS_API);
      url.searchParams.set("search", term);
      url.searchParams.set("sort", "likes");
      url.searchParams.set("direction", "-1");
      url.searchParams.set("limit", "100");
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/4.2" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5500),
      });
      if (!res.ok) return [];
      const arr = await res.json();
      return Array.isArray(arr) ? arr : [];
    })
  );

  const out = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const ds of r.value) {
      const id = String(ds?.id || "").trim();
      if (!id) continue;
      const likes = Number(ds.likes || 0);
      if (likes < 5) continue;
      const rawName = id.includes("/") ? id.split("/")[1] : id;
      const downloads = Number(ds.downloads || 0);
      out.push({
        repository: `hf-dataset/${id}`,
        name: rawName,
        slug: rawName.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        description:
          ds.description?.slice(0, 180) ||
          `Hugging Face AI benchmark & knowledge dataset (${likes.toLocaleString()} likes · ${downloads.toLocaleString()} downloads).`,
        author: id.includes("/") ? id.split("/")[0] : "huggingface",
        stars: likes,
        installs: Math.min(5000, Math.round(Math.sqrt(downloads) * 2) + likes),
        verified: likes >= 80,
        sourceLabel: "HF Datasets",
        installUrl: `https://huggingface.co/datasets/${id}`,
      });
    }
  }
  return out;
}

// Non-GitHub Source 6: Crates.io Rust AI, CLI, Security & Automation Workflow Tools
const CRATES_SKILL_TOPICS = [
  "ai-agent", "llm", "prompt", "cli-tool", "security-audit", "sql-migrate",
  "web-scraper", "markdown", "pdf", "docker", "kubernetes", "benchmark",
  "formatter", "linter",
];

async function fetchCratesIoSkills(q) {
  const queries = q ? [q] : CRATES_SKILL_TOPICS;
  const settled = await Promise.allSettled(
    queries.map(async (term) => {
      const url = new URL(CRATES_IO_API);
      url.searchParams.set("q", term);
      url.searchParams.set("per_page", "100");
      url.searchParams.set("sort", "downloads");
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/4.2 (https://drive-mcp-five.vercel.app)" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5500),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload?.crates) ? payload.crates : [];
    })
  );

  const out = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const c of r.value) {
      const name = String(c?.name || "").trim();
      if (!name || JUNK_SKILL_RX.test(name)) continue;
      const downloads = Number(c.downloads || 0);
      if (downloads < 500) continue;
      const score = Math.min(4000, Math.round(Math.sqrt(downloads) * 2));
      out.push({
        repository: `crates/${name}`,
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        description: c.description || `Rust developer workflow & CLI tool (${downloads.toLocaleString()} downloads).`,
        author: "crates.io",
        stars: score,
        installs: score,
        verified: downloads >= 50000,
        sourceLabel: "Crates.io",
        installUrl: c.homepage || c.repository || `https://crates.io/crates/${name}`,
      });
    }
  }
  return out;
}

// Non-GitHub Source 7: Docker Hub AI, DevOps & Automation Workflow Images
const DOCKER_SKILL_TOPICS = [
  "ai-agent", "llm", "ollama", "n8n", "playwright", "security-scanner",
  "postgres", "grafana", "prometheus", "terraform", "ffmpeg", "pdf",
  "airflow", "jupyter",
];

async function fetchDockerHubSkills(q) {
  const queries = q ? [q] : DOCKER_SKILL_TOPICS;
  const settled = await Promise.allSettled(
    queries.map(async (term) => {
      const url = new URL(DOCKER_HUB_API);
      url.searchParams.set("query", term);
      url.searchParams.set("page_size", "100");
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/4.2" },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(5500),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload?.results) ? payload.results : [];
    })
  );

  const out = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const repo of r.value) {
      const name = String(repo?.repo_name || "").trim();
      if (!name) continue;
      const shortName = name.split("/")[1] || name;
      if (JUNK_SKILL_RX.test(shortName)) continue;
      const pulls = Number(repo.pull_count || 0);
      if (pulls < 500) continue;
      const score = Math.min(3500, Math.max(Number(repo.star_count || 0) * 5, Math.round(Math.sqrt(pulls))));
      out.push({
        repository: `docker/${name}`,
        name: shortName,
        slug: name.toLowerCase().replace(/[^a-z0-9-]+/g, "-"),
        description:
          repo.short_description ||
          `Containerized AI/DevOps workflow image on Docker Hub (${pulls.toLocaleString()} pulls).`,
        author: name.includes("/") ? name.split("/")[0] : "docker",
        stars: score,
        installs: score,
        verified: Boolean(repo.is_official) || pulls >= 100000,
        sourceLabel: "Docker Hub",
        installUrl: `https://hub.docker.com/r/${name}`,
      });
    }
  }
  return out;
}

// Non-GitHub Source 8: npm Public Registry — 96 high-signal useful AI/Agent/Skill/Workflow queries
const NPM_BALANCED_SKILL_QUERIES = [
  "agent-skill", "claude-skill", "codex-skill", "cursor-rules",
  "ai-agent-skills", "skill-md", "copilot-instructions", "windsurf-rules",
  "cline-rules", "mcp-skill", "prompt-template", "ai-prompt",
  "agent-workflow", "langchain", "llamaindex", "crewai",
  "mastra", "vercel-ai", "ai-assistant", "openai-agent",
  "claude-code", "anthropic-sdk", "gemini-ai", "rag-pipeline",
  "vector-search", "embeddings-ai", "code-review-ai", "refactor-cli",
  "eslint-config", "prettier-config", "typescript-template", "nextjs-template",
  "react-components", "tailwind-plugin", "shadcn-ui", "design-tokens",
  "figma-plugin", "accessibility-audit", "playwright-test", "vitest-plugin",
  "cypress-plugin", "security-audit", "owasp-scanner", "vulnerability-scan",
  "postgres-migration", "supabase-cli", "prisma-generator", "drizzle-kit",
  "docker-compose", "kubernetes-cli", "terraform-module", "cloudflare-worker",
  "seo-optimizer", "sitemap-generator", "markdown-parser", "pdf-generator",
  "docx-generator", "excel-parser", "web-scraper", "crawler-agent",
  "slack-bot", "discord-bot", "telegram-bot", "stripe-webhook",
  "remotion-video", "threejs-component", "ffmpeg-wrapper", "audio-transcribe",
  "react-native-ui", "expo-plugin", "flutter-cli", "capacitor-plugin",
  "solidity-audit", "solana-sdk", "wagmi-plugin", "viem-utils",
  "graphql-codegen", "openapi-generator", "trpc-router", "zod-schema",
  "analytics-sdk", "posthog-plugin", "opentelemetry-sdk", "sentry-plugin",
  "notion-sdk", "linear-sdk", "jira-client", "obsidian-plugin",
  "shopify-app", "hubspot-client", "resend-email", "twilio-sdk",
  "n8n-nodes", "cron-scheduler", "bullmq-worker", "i18n-translator",
];

async function fetchNpmSkillPackages(q) {
  const queries = q ? [`${q} agent skill`, `${q} ai`] : NPM_BALANCED_SKILL_QUERIES;
  const requests = [];
  for (let idx = 0; idx < queries.length; idx += 1) {
    const text = queries[idx];
    const offsets = q ? [0, 250] : idx < 24 ? [0, 250, 500] : [0, 250];
    for (const from of offsets) requests.push({ text, from });
  }

  const parsed = [];
  const deadline = Date.now() + 18500;
  for (let start = 0; start < requests.length && Date.now() < deadline; start += 36) {
    const batch = requests.slice(start, start + 36);
    const settled = await Promise.allSettled(
      batch.map(async ({ text, from }) => {
        const url = new URL(NPM_SEARCH_API);
        url.searchParams.set("text", text);
        url.searchParams.set("size", "250");
        url.searchParams.set("from", String(from));
        const res = await fetch(url, {
          headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/4.2" },
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
        if (!pkg?.name || JUNK_SKILL_RX.test(pkg.name)) continue;
        const popScore = Math.round(Number(obj?.score?.detail?.popularity || 0) * 1400);
        const repoUrl = pkg.links?.repository || "";
        const ghMatch = repoUrl.match(/github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/i);
        const cleanSource = ghMatch ? ghMatch[1].replace(/\.git$/i, "") : `npm/${pkg.name}`;
        parsed.push({
          repository: cleanSource,
          name: pkg.name.replace(/^@[^/]+\//, ""),
          slug: pkg.name.replace(/^@/, "").replace(/[^a-z0-9-]+/gi, "-").toLowerCase(),
          description: pkg.description || `Published npm Agent Skill & workflow package (${pkg.name}).`,
          author: pkg.publisher?.username || "npm",
          stars: popScore,
          installs: popScore,
          verified: popScore >= 300,
          sourceLabel: "npm",
          installUrl: pkg.links?.homepage || pkg.links?.npm || `https://www.npmjs.com/package/${pkg.name}`,
        });
      }
    }
  }
  return parsed;
}

// Source 9: Curated Awesome Agent Skills Lists
async function fetchAwesomeReadmes(q) {
  const settled = await Promise.allSettled(
    AWESOME_README_URLS.map(async (readmeUrl) => {
      const res = await fetch(readmeUrl, {
        headers: { "user-agent": "DRIVE-Skills-Catalog/4.2" },
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
          stars: 250,
          installs: 150,
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
  if (sortedItems.length <= targetCount) return sortedItems;
  const picked = [];
  const overflow = [];
  const catCounts = new Map();

  for (const item of sortedItems) {
    if (item.sourceLabel === "Official") {
      picked.push(item);
      catCounts.set(item.category, (catCounts.get(item.category) || 0) + 1);
      continue;
    }
    const c = catCounts.get(item.category) || 0;
    if (c < perCategoryCap) {
      picked.push(item);
      catCounts.set(item.category, c + 1);
    } else {
      overflow.push(item);
    }
    if (picked.length >= targetCount) break;
  }

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
    const [shRes, dirRes, lobeRes, hfRes, hfDsRes, cratesRes, dockerRes, npmRes, awesomeRes] =
      await Promise.allSettled([
        fetchSkillsShSearch(q),
        fetchSkillsDirectory(q),
        fetchLobeHubSkills(q),
        fetchHuggingFaceSkills(q),
        fetchHuggingFaceDatasets(q),
        fetchCratesIoSkills(q),
        fetchDockerHubSkills(q),
        fetchNpmSkillPackages(q),
        fetchAwesomeReadmes(q),
      ]);

    const shRows = shRes.status === "fulfilled" ? shRes.value : [];
    const dirRows = dirRes.status === "fulfilled" ? dirRes.value : [];
    const lobeRows = lobeRes.status === "fulfilled" ? lobeRes.value : [];
    const hfRows = hfRes.status === "fulfilled" ? hfRes.value : [];
    const hfDsRows = hfDsRes.status === "fulfilled" ? hfDsRes.value : [];
    const cratesRows = cratesRes.status === "fulfilled" ? cratesRes.value : [];
    const dockerRows = dockerRes.status === "fulfilled" ? dockerRes.value : [];
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
      if (!bypassRepoCap && repoCount >= 55) return;
      perRepoCount.set(repoKey, repoCount + 1);

      const displayName = formatTitle(rawName, cleanRepo.split("/")[1]);
      const installs = Number(item.installs || 0);
      const stars = Number(item.stars || installs || 0);
      const desc = cleanDescription(
        item.description,
        `Popular Agent Skill from ${cleanRepo}${installs ? ` · ${installs.toLocaleString()} installs` : ""}.`
      );
      const category = classifySkillCategory(item.category, `${displayName} ${slug} ${desc}`);
      const defaultUrl = cleanRepo.startsWith("npm/")
        ? `https://www.npmjs.com/package/${cleanRepo.slice(4)}`
        : cleanRepo.startsWith("lobehub/")
        ? `https://lobehub.com/discover/assistant/${cleanRepo.slice(8)}`
        : cleanRepo.startsWith("huggingface/")
        ? `https://huggingface.co/spaces/${cleanRepo.slice(12)}`
        : cleanRepo.startsWith("hf-dataset/")
        ? `https://huggingface.co/datasets/${cleanRepo.slice(11)}`
        : cleanRepo.startsWith("crates/")
        ? `https://crates.io/crates/${cleanRepo.slice(7)}`
        : cleanRepo.startsWith("docker/")
        ? `https://hub.docker.com/r/${cleanRepo.slice(7)}`
        : `https://github.com/${cleanRepo}`;
      const targetUrl = item.installUrl || defaultUrl;

      uniqueSkills.set(skillKey, {
        id: skillKey,
        name: displayName,
        slug: slug || cleanRepo.split("/")[1] || rawName,
        source: cleanRepo,
        sourceLabel:
          item.sourceLabel ||
          (cleanRepo.startsWith("npm/")
            ? "npm"
            : cleanRepo.startsWith("lobehub/")
            ? "LobeHub"
            : cleanRepo.startsWith("huggingface/")
            ? "HuggingFace"
            : cleanRepo.startsWith("hf-dataset/")
            ? "HF Datasets"
            : cleanRepo.startsWith("crates/")
            ? "Crates.io"
            : cleanRepo.startsWith("docker/")
            ? "Docker Hub"
            : "skills.sh"),
        description: desc,
        category,
        author: item.author || cleanRepo.split("/")[0] || null,
        stars,
        installs,
        verified: Boolean(item.verified) || installs >= 1000 || stars >= 500,
        installUrl: targetUrl,
        url: targetUrl,
        sourceType: cleanRepo.startsWith("npm/")
          ? "npm"
          : cleanRepo.startsWith("lobehub/")
          ? "lobehub"
          : cleanRepo.startsWith("huggingface/") || cleanRepo.startsWith("hf-dataset/")
          ? "huggingface"
          : cleanRepo.startsWith("crates/")
          ? "crates"
          : cleanRepo.startsWith("docker/")
          ? "docker"
          : "registry",
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
        verified: Boolean(item.verified) || Number(item.installs || 0) >= 500,
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
        verified: Boolean(item.verified) || Number(item.stars || 0) >= 300,
        sourceLabel: "SkillsDirectory",
        installUrl: item.url || undefined,
      });
    }

    for (const item of lobeRows) upsert(item.repository, item, true);
    for (const item of hfRows) upsert(item.repository, item, true);
    for (const item of hfDsRows) upsert(item.repository, item, true);
    for (const item of cratesRows) upsert(item.repository, item, true);
    for (const item of dockerRows) upsert(item.repository, item, true);
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
        target: 20000,
        categories: categoryCounts,
        source: "skills.sh + SkillsDirectory + LobeHub + HuggingFace + HF Datasets + Crates.io + Docker Hub + npm + Curated",
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
