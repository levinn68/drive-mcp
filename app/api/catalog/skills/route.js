import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100);
  try {
    const headers = { accept: "application/json" };
    if (process.env.VERCEL_OIDC_TOKEN) headers.authorization = `Bearer ${process.env.VERCEL_OIDC_TOKEN}`;
    let rows = [];
    let source = "skills.sh";
    if (q) {
      const url = new URL("https://skills.sh/api/v1/skills/search");
      url.searchParams.set("q", q);
      url.searchParams.set("limit", "200");
      const response = await fetch(url, { headers, next: { revalidate: 900 }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error(`skills.sh search returned ${response.status}`);
      const payload = await response.json();
      rows = payload.data || [];
    } else {
      const pages = await Promise.all([0, 1].map(async (page) => {
        const url = new URL("https://skills.sh/api/v1/skills");
        url.searchParams.set("view", "all-time");
        url.searchParams.set("page", String(page));
        url.searchParams.set("per_page", "500");
        const response = await fetch(url, { headers, next: { revalidate: 3600 }, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new Error(`skills.sh catalog returned ${response.status}`);
        return response.json();
      }));
      rows = pages.flatMap((page) => page.data || []);
    }
    const unique = new Map();
    for (const item of rows) {
      if (!item?.id || !item?.name || !item?.source) continue;
      if (!unique.has(item.id)) unique.set(item.id, {
        id: item.id, name: item.name, slug: item.slug, source: item.source,
        installs: Number(item.installs || 0), sourceType: item.sourceType || "github",
        installUrl: item.installUrl || null, url: item.url || null,
        duplicate: Boolean(item.isDuplicate),
      });
    }
    const items = [...unique.values()].slice(0, 1000);
    return NextResponse.json({ items, count: items.length, target: 1000, source, query: q || null, truncated: items.length >= 1000 }, { headers: { "Cache-Control": q ? "public, s-maxage=900, stale-while-revalidate=3600" : "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    return NextResponse.json({ error: "Could not load the Skills catalog", detail: String(error?.message || "").slice(0, 240) }, { status: 502 });
  }
}
