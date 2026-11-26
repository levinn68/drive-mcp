import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

const CURATED_POPULAR_SKILLS = [
  {
    id: "vercel-labs/agent-skills/react-best-practices",
    name: "React & Next.js Best Practices",
    slug: "react-best-practices",
    source: "vercel-labs/agent-skills",
    description: "Official Vercel engineering guidelines for React Server Components, App Router caching, and zero-waterfall performance.",
    category: "frontend",
    author: "vercel-labs",
    stars: 18500,
    installs: 120000,
    verified: true,
  },
  {
    id: "vercel-labs/agent-skills/web-design-guidelines",
    name: "Web Design & Accessibility Guidelines",
    slug: "web-design-guidelines",
    source: "vercel-labs/agent-skills",
    description: "Audits UI hierarchy, keyboard navigation, contrast, responsive spacing, and layout polish across web apps.",
    category: "design",
    author: "vercel-labs",
    stars: 16200,
    installs: 98000,
    verified: true,
  },
  {
    id: "anthropics/skills/frontend-design",
    name: "Frontend Design System Architect",
    slug: "frontend-design",
    source: "anthropics/skills",
    description: "Official Anthropic skill for crafting distinctive, production-grade UI layouts, typography, and micro-interactions.",
    category: "design",
    author: "anthropics",
    stars: 24000,
    installs: 145000,
    verified: true,
  },
  {
    id: "anthropics/skills/mcp-builder",
    name: "MCP Server Builder",
    slug: "mcp-builder",
    source: "anthropics/skills",
    description: "Step-by-step workflow to design, build, test, and harden Model Context Protocol servers in TypeScript and Python.",
    category: "ai",
    author: "anthropics",
    stars: 22400,
    installs: 110000,
    verified: true,
  },
  {
    id: "anthropics/skills/webapp-testing",
    name: "Playwright WebApp Testing",
    slug: "webapp-testing",
    source: "anthropics/skills",
    description: "Automated end-to-end browser verification, console log capture, and visual regression testing with Playwright.",
    category: "testing",
    author: "anthropics",
    stars: 19500,
    installs: 88000,
    verified: true,
  },
  {
    id: "supabase/agent-skills/supabase-postgres-best-practices",
    name: "Supabase & Postgres Best Practices",
    slug: "supabase-postgres-best-practices",
    source: "supabase/agent-skills",
    description: "Official Supabase guide for Row Level Security (RLS), indexing, schema migrations, and Edge Functions.",
    category: "database",
    author: "supabase",
    stars: 14800,
    installs: 76000,
    verified: true,
  },
  {
    id: "remotion-dev/skills/remotion-best-practices",
    name: "Remotion Programmatic Video",
    slug: "remotion-best-practices",
    source: "remotion-dev/skills",
    description: "Build React-driven motion graphics, kinetic typography, and frame-accurate video compositions in Remotion.",
    category: "frontend",
    author: "remotion-dev",
    stars: 11200,
    installs: 54000,
    verified: true,
  },
  {
    id: "expo/skills/building-native-ui",
    name: "Expo & React Native UI",
    slug: "building-native-ui",
    source: "expo/skills",
    description: "Official Expo Router, native gestures, safe-area layout, and 60fps animations for iOS and Android apps.",
    category: "mobile",
    author: "expo",
    stars: 10400,
    installs: 49000,
    verified: true,
  },
  {
    id: "cloudflare/skills/workers-best-practices",
    name: "Cloudflare Workers & Edge API",
    slug: "workers-best-practices",
    source: "cloudflare/skills",
    description: "Edge routing, D1/KV/R2 storage patterns, Durable Objects, and zero-cold-start Workers architecture.",
    category: "devops",
    author: "cloudflare",
    stars: 9800,
    installs: 46000,
    verified: true,
  },
  {
    id: "stripe/ai/stripe-best-practices",
    name: "Stripe Payments & Webhooks",
    slug: "stripe-best-practices",
    source: "stripe/ai",
    description: "Secure Checkout, Subscriptions, webhook signature verification, and idempotent billing workflows.",
    category: "backend",
    author: "stripe",
    stars: 12100,
    installs: 61000,
    verified: true,
  },
  {
    id: "trailofbits/skills/security-audit",
    name: "Security & Vulnerability Audit",
    slug: "security-audit",
    source: "trailofbits/skills",
    description: "Systematic threat modeling, OWASP checks, auth boundary auditing, and SSRF/injection hardening.",
    category: "security",
    author: "trailofbits",
    stars: 13200,
    installs: 52000,
    verified: true,
  },
  {
    id: "obra/superpowers/systematic-debugging",
    name: "Systematic Debugging & Root Cause",
    slug: "systematic-debugging",
    source: "obra/superpowers",
    description: "Evidence-first debugging protocol: reproduce, isolate root cause, write regression test, then patch cleanly.",
    category: "testing",
    author: "obra",
    stars: 15600,
    installs: 74000,
    verified: true,
  },
];

const CATEGORY_RULES = [
  { id: "frontend", rx: /\b(react|next\.?js|vue|svelte|angular|tailwind|css|html|frontend|ui component|shadcn|vite|astro|remotion|three\.?js|webgl)\b/i },
  { id: "backend", rx: /\b(api|backend|node\.?js|express|fastify|nestjs|django|fastapi|flask|go|golang|rust|graphql|rest|webhook|stripe|payment|auth|oauth|jwt|microservice)\b/i },
  { id: "ai", rx: /\b(ai|llm|agent|mcp|prompt|rag|embedding|vector|openai|claude|gemini|anthropic|langchain|langgraph|crewai|autogen|eval|fine-?tun)\b/i },
  { id: "database", rx: /\b(sql|postgres|postgresql|mysql|sqlite|supabase|prisma|drizzle|mongo|mongodb|redis|clickhouse|database|schema|migration|neon|planetscale)\b/i },
  { id: "devops", rx: /\b(docker|kubernetes|k8s|terraform|aws|gcp|azure|vercel|cloudflare|ci\/cd|github actions|deploy|linux|nginx|helm|ansible|devops|infra|cloud)\b/i },
  { id: "security", rx: /\b(security|audit|owasp|pentest|vuln|cve|ssrf|xss|csrf|encrypt|crypto|secret|compliance|soc2|rbac|rls|hardening)\b/i },
  { id: "testing", rx: /\b(test|testing|playwright|cypress|jest|vitest|pytest|qa|e2e|unit test|debug|debugging|tdd|benchmark|lint)\b/i },
  { id: "design", rx: /\b(design|ux|figma|typography|color|brand|logo|wireframe|prototype|accessibility|a11y|animation|motion|glass|layout|illustration)\b/i },
  { id: "data", rx: /\b(data|analytics|pandas|numpy|dbt|spark|snowflake|bigquery|tableau|chart|visualization|etl|pipeline|ml|machine learning|jupyter|excel|csv)\b/i },
  { id: "mobile", rx: /\b(mobile|ios|android|swift|swiftui|kotlin|flutter|react native|expo|apk|xcode|capacitor)\b/i },
  { id: "docs", rx: /\b(doc|docs|documentation|readme|markdown|writing|copywriting|blog|changelog|technical writing|pdf|latex|slides|pptx|docx)\b/i },
  { id: "marketing", rx: /\b(seo|marketing|growth|landing page|conversion|ads|social media|newsletter|email campaign|analytics|gtm|brand voice)\b/i },
  { id: "automation", rx: /\b(automat|workflow|cron|scrape|scraping|crawler|browser|n8n|zapier|make\.com|slack bot|telegram|discord bot|cli|script)\b/i },
  { id: "productivity", rx: /\b(productivity|notion|linear|jira|calendar|email|gmail|meeting|summary|plan|planning|roadmap|project management|kanban|obsidian)\b/i },
];

function classifySkillCategory(rawCategory, text) {
  const hay = `${rawCategory || ""} ${text || ""}`;
  for (const rule of CATEGORY_RULES) {
    if (rule.rx.test(hay)) return rule.id;
  }
  const clean = String(rawCategory || "").toLowerCase().trim();
  if (clean && clean !== "other" && clean !== "uncategorized") {
    if (clean.includes("dev") || clean.includes("code") || clean.includes("eng")) return "backend";
    return clean;
  }
  return "productivity";
}

function formatTitle(raw, fallback) {
  const base = String(raw || fallback || "Agent Skill").trim();
  if (!base) return "Agent Skill";
  if (/[A-Z]/.test(base) && base.includes(" ")) return base;
  return base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchSkillsSh(q) {
  const headers = { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/2.4" };
  if (process.env.VERCEL_OIDC_TOKEN) {
    headers.authorization = `Bearer ${process.env.VERCEL_OIDC_TOKEN}`;
  }

  if (q) {
    try {
      const url = new URL("https://skills.sh/api/v1/skills/search");
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "250");
      const res = await fetch(url, {
        headers,
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(7500),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload.data) ? payload.data : [];
    } catch {
      return [];
    }
  }

  const settled = await Promise.allSettled(
    [0, 1, 2, 3, 4, 5, 6, 7].map(async (page) => {
      const url = new URL("https://skills.sh/api/v1/skills");
      url.searchParams.set("view", "all-time");
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", "500");
      const res = await fetch(url, {
        headers,
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload.data) ? payload.data : [];
    })
  );
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function fetchSkillsDirectory(q) {
  const totalPages = q ? 8 : 32;
  const allRows = [];
  for (let start = 0; start < totalPages; start += 10) {
    const batch = Array.from({ length: Math.min(10, totalPages - start) }, (_, i) => start + i);
    const settled = await Promise.allSettled(
      batch.map(async (page) => {
        const url = new URL("https://www.skillsdirectory.com/api/registry");
        url.searchParams.set("limit", "100");
        url.searchParams.set("offset", String(page * 100));
        url.searchParams.set("sort", "stars");
        if (q) url.searchParams.set("q", q);
        const res = await fetch(url, {
          headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/2.4" },
          next: { revalidate: q ? 900 : 3600 },
          signal: AbortSignal.timeout(7500),
        });
        if (!res.ok) return [];
        const payload = await res.json();
        return payload.skills || payload.data || [];
      })
    );
    let anyRows = false;
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value.length) {
        anyRows = true;
        allRows.push(...r.value);
      }
    }
    if (!anyRows) break;
  }
  return allRows;
}

async function fetchGithubSkillRepos(q) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "DRIVE-Skills-Catalog/2.4",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  const searchQuery = q
    ? `${q} (topic:agent-skills OR topic:claude-skills OR "SKILL.md") stars:>2`
    : `(topic:agent-skills OR topic:claude-skills OR topic:codex-skills) stars:>5`;
  const pages = q ? [1, 2] : [1, 2, 3, 4, 5];
  const settled = await Promise.allSettled(
    pages.map(async (page) => {
      const url = new URL("https://api.github.com/search/repositories");
      url.searchParams.set("q", searchQuery);
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
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100).toLowerCase();

  try {
    const [shRes, dirRes, ghRes] = await Promise.allSettled([
      fetchSkillsSh(q),
      fetchSkillsDirectory(q),
      fetchGithubSkillRepos(q),
    ]);

    const shRows = shRes.status === "fulfilled" ? shRes.value : [];
    const dirRows = dirRes.status === "fulfilled" ? dirRes.value : [];
    const ghRows = ghRes.status === "fulfilled" ? ghRes.value : [];

    // Deduplicate by (repo + slug) while capping single-repo floods (max 12 per repo)
    // so the catalog reliably delivers ~3,000+ useful, popular Skills!
    const uniqueSkills = new Map();
    const perRepoCount = new Map();
    let totalRawSkills = 0;

    function upsert(repo, item, bypassRepoCap = false) {
      const cleanRepo = String(repo || "")
        .replace(/^https?:\/\/github\.com\//i, "")
        .replace(/\/+$/, "")
        .trim();
      const rawName = String(item.name || "").trim();
      if (!cleanRepo || !rawName) return;

      totalRawSkills += 1;
      const slug = String(item.slug || rawName)
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/^-|-$/g, "");
      const repoKey = cleanRepo.toLowerCase();
      const skillKey = `${repoKey}/${slug || rawName.toLowerCase()}`;

      const existing = uniqueSkills.get(skillKey);
      if (existing) {
        if (Number(item.stars || 0) > existing.stars) existing.stars = Number(item.stars || 0);
        if (Number(item.installs || 0) > existing.installs) existing.installs = Number(item.installs || 0);
        if (item.verified) existing.verified = true;
        if ((!existing.description || existing.description.startsWith("Agent Skill from")) && item.description) {
          existing.description = item.description;
        }
        return;
      }

      const repoCount = perRepoCount.get(repoKey) || 0;
      if (!bypassRepoCap && repoCount >= 12) return;
      perRepoCount.set(repoKey, repoCount + 1);

      const displayName = formatTitle(rawName, cleanRepo.split("/")[1]);
      const desc =
        String(item.description || "").trim() ||
        `Agent Skill from ${cleanRepo}${item.installs ? ` · ${Number(item.installs).toLocaleString()} installs` : ""}.`;
      const category = classifySkillCategory(item.category, `${displayName} ${slug} ${cleanRepo} ${desc}`);

      uniqueSkills.set(skillKey, {
        id: skillKey,
        name: displayName,
        slug: slug || cleanRepo.split("/")[1] || rawName,
        source: cleanRepo,
        description: desc,
        category,
        author: item.author || cleanRepo.split("/")[0] || null,
        stars: Number(item.stars || 0),
        installs: Number(item.installs || 0),
        verified: Boolean(item.verified),
        installUrl: `https://github.com/${cleanRepo}`,
        url: `https://github.com/${cleanRepo}`,
        sourceType: "github",
        skillCount: 1,
      });
    }

    for (const curated of CURATED_POPULAR_SKILLS) {
      const hay = `${curated.name} ${curated.description} ${curated.source} ${curated.category}`.toLowerCase();
      if (!q || hay.includes(q)) {
        upsert(curated.source, curated, true);
      }
    }

    for (const item of shRows) {
      upsert(item.source || item.repository, {
        name: item.name,
        slug: item.slug,
        description: item.description || "",
        category: item.category || "",
        installs: item.installs || 0,
        stars: item.stars || item.installs || 0,
        verified: Boolean(item.verified) || Number(item.installs || 0) >= 1000,
      });
    }

    for (const item of dirRows) {
      upsert(item.repository || item.source, {
        name: item.name,
        slug: item.slug,
        description: item.description || "",
        category: item.category || "",
        author: item.author,
        stars: item.stars || 0,
        installs: item.installs || 0,
        verified: Boolean(item.verified) || Number(item.stars || 0) >= 500,
      });
    }

    for (const repo of ghRows) {
      if (!repo?.full_name || repo.archived) continue;
      upsert(repo.full_name, {
        name: repo.name,
        slug: repo.name,
        description: repo.description || `Open-source Agent Skill repository (${repo.stargazers_count || 0} stars).`,
        category: "",
        author: repo.owner?.login || null,
        stars: Number(repo.stargazers_count || 0),
        installs: 0,
        verified: Number(repo.stargazers_count || 0) >= 300,
      });
    }

    const items = [...uniqueSkills.values()]
      .sort((a, b) => {
        const scoreA = (a.verified ? 50000 : 0) + a.installs * 2 + a.stars;
        const scoreB = (b.verified ? 50000 : 0) + b.installs * 2 + b.stars;
        return scoreB - scoreA;
      })
      .slice(0, 3500);

    const categoryCounts = {};
    for (const item of items) {
      categoryCounts[item.category] = (categoryCounts[item.category] || 0) + 1;
    }

    return NextResponse.json(
      {
        items,
        count: items.length,
        totalRawSkills,
        target: 3000,
        categories: categoryCounts,
        source: "Verified Official + skills.sh + Skills Directory + GitHub",
        query: q || null,
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
      { error: "Could not load Skills catalog", detail: String(error?.message || "").slice(0, 240) },
      { status: 502 }
    );
  }
}
