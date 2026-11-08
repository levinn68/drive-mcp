import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100).toLowerCase();
  try {
    const pages = await Promise.all(Array.from({ length: 10 }, async (_, page) => {
      const url = new URL("https://www.skillsdirectory.com/api/registry");
      url.searchParams.set("limit", "100");
      url.searchParams.set("offset", String(page * 100));
      url.searchParams.set("sort", "stars");
      if (q) url.searchParams.set("q", q);
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-Skills-Catalog/1.0" },
        next: { revalidate: q ? 900 : 3600 },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`Skills Directory returned ${response.status}`);
      return response.json();
    }));
    const unique = new Map();
    for (const payload of pages) {
      for (const item of payload.skills || payload.data || []) {
        const repository = item.repository || "";
        const slug = item.slug || "";
        const id = `${repository}/${slug}`;
        if (!repository || !slug || !item.name || unique.has(id)) continue;
        unique.set(id, {
          id, name: item.name, slug, source: repository,
          description: item.description || "", category: item.category || "other",
          author: item.author || null, stars: Number(item.stars || 0),
          verified: Boolean(item.verified), tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
          installUrl: `https://github.com/${repository}`,
          url: `https://github.com/${repository}`,
          sourceType: "github",
        });
      }
    }
    const items = [...unique.values()].slice(0, 1000);
    return NextResponse.json({
      items, count: items.length, target: 1000,
      source: "Skills Directory public registry",
      query: q || null,
      categories: [...new Set(items.map((item) => item.category))].sort(),
      truncated: items.length >= 1000,
    }, { headers: { "Cache-Control": q ? "public, s-maxage=900, stale-while-revalidate=3600" : "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    return NextResponse.json({ error: "Could not load the Skills catalog", detail: String(error?.message || "").slice(0, 240) }, { status: 502 });
  }
}
