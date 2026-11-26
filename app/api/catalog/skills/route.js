import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

function formatRepoTitle(repo) {
  const name = String(repo || "").split("/")[1] || repo || "Agent Skill";
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100).toLowerCase();

  try {
    // Fetch up to 3,000 raw skills in 3 parallel batches of 10 pages (100 per page)
    const totalPages = q ? 10 : 30;
    const payloads = [];

    for (let start = 0; start < totalPages; start += 10) {
      const batchIndices = Array.from(
        { length: Math.min(10, totalPages - start) },
        (_, idx) => start + idx
      );
      const settled = await Promise.allSettled(
        batchIndices.map(async (page) => {
          const url = new URL("https://www.skillsdirectory.com/api/registry");
          url.searchParams.set("limit", "100");
          url.searchParams.set("offset", String(page * 100));
          url.searchParams.set("sort", "stars");
          if (q) url.searchParams.set("q", q);
          const response = await fetch(url, {
            headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/2.0" },
            next: { revalidate: q ? 900 : 3600 },
            signal: AbortSignal.timeout(9000),
          });
          if (!response.ok) throw new Error(`Skills Directory returned ${response.status}`);
          return response.json();
        })
      );

      let batchHadRows = false;
      for (const res of settled) {
        if (res.status === "fulfilled" && res.value) {
          const rows = res.value.skills || res.value.data || [];
          if (rows.length > 0) batchHadRows = true;
          payloads.push(rows);
        }
      }
      if (!batchHadRows) break;
    }

    // Group by repository so 1 repo = 1 clean Skill/Pack card (no duplicate spam in list)
    const groupedByRepo = new Map();
    let totalRawSkills = 0;

    for (const rows of payloads) {
      for (const item of rows) {
        const repository = String(item?.repository || "").trim();
        const slug = String(item?.slug || "").trim();
        if (!repository || !item?.name) continue;
        totalRawSkills += 1;

        const repoKey = repository.toLowerCase();
        const existing = groupedByRepo.get(repoKey);
        if (!existing) {
          groupedByRepo.set(repoKey, {
            id: repository,
            name: item.name,
            repoTitle: formatRepoTitle(repository),
            slug: slug || repository.split("/")[1] || item.name,
            source: repository,
            description: item.description || "",
            category: item.category || "other",
            author: item.author || repository.split("/")[0] || null,
            stars: Number(item.stars || 0),
            verified: Boolean(item.verified),
            tags: Array.isArray(item.tags) ? item.tags.slice(0, 8) : [],
            installUrl: `https://github.com/${repository}`,
            url: `https://github.com/${repository}`,
            sourceType: "github",
            skillCount: 1,
            includedSkills: [item.name],
          });
        } else {
          existing.skillCount += 1;
          if (existing.includedSkills.length < 12 && !existing.includedSkills.includes(item.name)) {
            existing.includedSkills.push(item.name);
          }
          if (Number(item.stars || 0) > existing.stars) {
            existing.stars = Number(item.stars || 0);
          }
          if (item.verified) existing.verified = true;
        }
      }
    }

    // For multi-skill repos, use clean repo title so the pack represents all bundled skills
    const items = [...groupedByRepo.values()]
      .map((pack) => ({
        ...pack,
        name: pack.skillCount > 1 ? pack.repoTitle : pack.name,
      }))
      .sort((a, b) => b.stars - a.stars);

    return NextResponse.json(
      {
        items,
        count: items.length,
        totalRawSkills,
        target: 3000,
        source: "Skills Directory public registry (grouped 1 repo = 1 skill pack)",
        query: q || null,
        categories: [...new Set(items.map((item) => item.category))].sort(),
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
      { error: "Could not load the Skills catalog", detail: String(error?.message || "").slice(0, 240) },
      { status: 502 }
    );
  }
}
