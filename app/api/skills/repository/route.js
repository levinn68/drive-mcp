import { NextResponse } from "next/server";

export const runtime = "nodejs";

const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "DRIVE-Manual-Skill-Discovery",
  "x-github-api-version": "2022-11-28",
};

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const owner = (searchParams.get("owner") || "").trim();
  const repo = (searchParams.get("repo") || "").trim();
  const branch = (searchParams.get("branch") || "").trim();
  const skill = (searchParams.get("skill") || "").trim().toLowerCase();\n  const skillName = (searchParams.get("skillName") || "").trim().toLowerCase();
  if (!/^[a-zA-Z0-9_.-]{1,100}$/.test(owner) || !/^[a-zA-Z0-9_.-]{1,100}$/.test(repo)) {
    return NextResponse.json({ error: "Invalid GitHub owner or repository" }, { status: 400 });
  }

  try {
    const metaResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!metaResponse.ok) return NextResponse.json({ error: "Could not read this public GitHub repository" }, { status: metaResponse.status === 404 ? 404 : 502 });
    const meta = await metaResponse.json();
    const selectedBranch = branch || meta.default_branch;
    const treeResponse = await fetch(`https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(selectedBranch)}?recursive=1`, {
      headers, cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    if (!treeResponse.ok) return NextResponse.json({ error: "Could not inspect repository tree. The repository may be too large or its branch unavailable." }, { status: 502 });
    const tree = await treeResponse.json();
    let skillFiles = (tree.tree || [])
      .filter((entry) => entry.type === "blob" && /(^|\/)SKILL\.md$/i.test(entry.path))
      .slice(0, 200)
      .map((entry) => ({
        path: entry.path,
        raw_url: `https://raw.githubusercontent.com/${owner}/${repo}/${selectedBranch}/${entry.path.split("/").map(encodeURIComponent).join("/")}`,
        size: entry.size || 0,
      }));
    if (skill) {
      const matches = skillFiles.filter((file) => file.path.split("/").at(-2)?.toLowerCase() === skill);
      if (!matches.length) return NextResponse.json({ error: "Could not locate this catalog Skill folder in its GitHub repository." }, { status: 404 });
      skillFiles = matches;
    }
    return NextResponse.json({
      repository: meta.full_name,
      html_url: meta.html_url,
      description: meta.description || "",
      branch: selectedBranch,
      license: meta.license?.spdx_id || null,
      stars: meta.stargazers_count,
      truncated: Boolean(tree.truncated),
      skills: skillFiles,
    });
  } catch {
    return NextResponse.json({ error: "Could not inspect this repository right now." }, { status: 502 });
  }
}
