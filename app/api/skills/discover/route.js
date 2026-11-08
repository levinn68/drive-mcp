import { NextResponse } from "next/server";

export const runtime = "nodejs";

const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "DRIVE-Manual-Skill-Discovery",
  "x-github-api-version": "2022-11-28",
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();
  if (query.length < 2 || query.length > 120) {
    return NextResponse.json({ error: "Search query must be between 2 and 120 characters" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query + " in:name,description,readme")}&sort=stars&order=desc&per_page=12`,
      { headers, cache: "no-store", signal: AbortSignal.timeout(10000) }
    );
    if (!response.ok) {
      return NextResponse.json({ error: response.status === 403 ? "GitHub search rate limit reached. Try again later." : "GitHub repository search failed." }, { status: response.status === 403 ? 429 : 502 });
    }
    const data = await response.json();
    return NextResponse.json({
      total_count: data.total_count || 0,
      items: (data.items || []).map((repo) => ({
        full_name: repo.full_name,
        description: repo.description || "",
        html_url: repo.html_url,
        default_branch: repo.default_branch,
        stars: repo.stargazers_count,
        updated_at: repo.updated_at,
        license: repo.license?.spdx_id || null,
        language: repo.language || null,
      })),
    });
  } catch {
    return NextResponse.json({ error: "Could not reach GitHub. Try again later." }, { status: 502 });
  }
}
