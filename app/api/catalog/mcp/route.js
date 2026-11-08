import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 3600;

const REGISTRY = "https://registry.modelcontextprotocol.io";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().slice(0, 100);
  try {
    let cursor = "";
    const all = [];
    const seen = new Set();
    for (let page = 0; page < 10 && all.length < 1000; page++) {
      const params = new URLSearchParams({ limit: "100", version: "latest" });
      if (q) params.set("search", q);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`${REGISTRY}/v0.1/servers?${params}`, {
        headers: { accept: "application/json" },
        next: { revalidate: q ? 900 : 3600 },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error(`Official MCP Registry returned ${response.status}`);
      const payload = await response.json();
      for (const entry of payload.servers || []) {
        const server = entry.server || entry;
        const id = `${server.name || ""}@${server.version || ""}`;
        if (server.name && !seen.has(id)) { seen.add(id); all.push(entry); }
        if (all.length >= 1000) break;
      }
      cursor = payload.metadata?.nextCursor || "";
      if (!cursor) break;
    }
    return NextResponse.json({ servers: all.slice(0, 1000), count: all.length, target: 1000, source: "Official MCP Registry", query: q || null, hasMore: Boolean(cursor) }, { headers: { "Cache-Control": q ? "public, s-maxage=900, stale-while-revalidate=3600" : "public, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch (error) {
    return NextResponse.json({ error: "Could not load the MCP catalog", detail: String(error?.message || "").slice(0, 240) }, { status: 502 });
  }
}
