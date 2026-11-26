import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

function formatRepoTitle(repo) {
  const name = String(repo || "").split("/")[1] || repo || "Agent Skill";
  return name.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchSkillsSh(q) {
  const headers = { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/2.2" };
  if (process.env.VERCEL_OIDC_TOKEN) {
    headers.authorization = `Bearer ${process.env.VERCEL_OIDC_TOKEN}`;
  }

  if (q) {
    try {
      const url = new URL("https://skills.sh/api/v1/skills/search");
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "200");
      const res = await fetch(url, {
        headers,
        next: { revalidate: 900 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload.data) ? payload.data : [];
    } catch {
      return [];
    }
  }

  const settled = await Promise.allSettled(
    [0, 1, 2, 3, 4, 5].map(async (page) => {
      const url = new URL("https://skills.sh/api/v1/skills");
      url.searchParams.set("view", "all-time");
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", "500");
      const res = await fetch(url, {
        headers,
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) return [];
      const payload = await res.json();
      return Array.isArray(payload.data) ? payload.data : [];
    })
  );
  return settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function fetchSkillsDirectory(q) {
  const totalPages = q ? 8 : 30;
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
          headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/2.2" },
          next: { revalidate: q ? 900 : 3600 },
          signal: AbortSignal.timeout(8000),
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

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100).toLowerCase();

  try {
    const [shRes, dirRes] = await Promise.allSettled([
      fetchSkillsSh(q),
      fetchSkillsDirectory(q),
    ]);

    const shRows = shRes.status === "fulfilled" ? shRes.value : [];
    const dirRows = dirRes.status === "fulfilled" ? dirRes.value : [];

    // Group by repository so 1 repo = 1 clean Skill/Pack card (no duplicate spam like 10x "Rea ...")
    const groupedByRepo = new Map();
    let totalRawSkills = 0;

    function upsert(repo, item) {
      const cleanRepo = String(repo || "")
        .replace(/^https?:\/\/github\.com\//i, "")
        .replace(/\/+$/, "")
        .trim();
      if (!cleanRepo || !item.name) return;
      totalRawSkills += 1;

      const repoKey = cleanRepo.toLowerCase();
      const existing = groupedByRepo.get(repoKey);
      if (!existing) {
        groupedByRepo.set(repoKey, {
          id: cleanRepo,
          name: item.name,
          repoTitle: formatRepoTitle(cleanRepo),
          slug: item.slug || cleanRepo.split("/")[1] || item.name,
          source: cleanRepo,
          description: item.description || "",
          category: item.category || "development",
          author: item.author || cleanRepo.split("/")[0] || null,
          stars: Number(item.stars || 0),
          installs: Number(item.installs || 0),
          verified: Boolean(item.verified),
          installUrl: `https://github.com/${cleanRepo}`,
          url: `https://github.com/${cleanRepo}`,
          sourceType: "github",
          skillCount: 1,
          includedSkills: [item.name],
        });
      } else {
        existing.skillCount += 1;
        if (existing.includedSkills.length < 15 && !existing.includedSkills.includes(item.name)) {
          existing.includedSkills.push(item.name);
        }
        if (Number(item.stars || 0) > existing.stars) existing.stars = Number(item.stars || 0);
        if (Number(item.installs || 0) > existing.installs) {
          existing.installs = Number(item.installs || 0);
        }
        if (item.verified) existing.verified = true;
        if (!existing.description && item.description) existing.description = item.description;
      }
    }

    for (const item of shRows) {
      upsert(item.source, {
        name: item.name,
        slug: item.slug,
        description: item.description || `Popular Agent Skill (${Number(item.installs || 0).toLocaleString()} installs)`,
        category: item.category || "development",
        installs: item.installs || 0,
        stars: item.stars || item.installs || 0,
        verified: Boolean(item.verified),
      });
    }

    for (const item of dirRows) {
      upsert(item.repository, {
        name: item.name,
        slug: item.slug,
        description: item.description || "",
        category: item.category || "development",
        author: item.author,
        stars: item.stars || 0,
        verified: Boolean(item.verified),
      });
    }

    const items = [...groupedByRepo.values()]
      .map((pack) => ({
        ...pack,
        name: pack.skillCount > 1 ? pack.repoTitle : pack.name,
      }))
      .sort((a, b) => b.installs + b.stars - (a.installs + a.stars))
      .slice(0, 3000);

    return NextResponse.json(
      {
        items,
        count: items.length,
        totalRawSkills,
        target: 3000,
        source: "skills.sh + Skills Directory (1 repo = 1 skill pack)",
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
