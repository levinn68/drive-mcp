import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (item) fields[item[1]] = item[2].replace(/^["']|["']$/g, "").trim();
  }
  return fields;
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const rawUrl = typeof body.url === "string" ? body.url.trim() : "";
  let url;
  try { url = new URL(rawUrl); } catch { return NextResponse.json({ error: "Enter a valid raw GitHub SKILL.md URL" }, { status: 400 }); }
  if (url.protocol !== "https:" || url.hostname !== "raw.githubusercontent.com" || url.username || url.password || url.port || !url.pathname.toLowerCase().endsWith("/skill.md")) {
    return NextResponse.json({ error: "Only https://raw.githubusercontent.com/.../SKILL.md sources are supported" }, { status: 400 });
  }
  try {
    const response = await fetch(url.toString(), {
      headers: { accept: "text/plain", "user-agent": "DRIVE-Skill-Inspector" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? "SKILL.md was not found at that path" : "GitHub could not provide this file" }, { status: response.status === 404 ? 404 : 502 });
    const markdown = await response.text();
    if (!markdown.trim() || markdown.length > 250000) return NextResponse.json({ error: "Skill file is empty or exceeds the 250 KB inspection limit" }, { status: 413 });
    const metadata = parseFrontmatter(markdown);
    if (!metadata?.name || !metadata?.description) return NextResponse.json({ error: "Invalid Agent Skill: YAML frontmatter must include name and description" }, { status: 422 });
    const parts = url.pathname.split("/").filter(Boolean);
    const sourceRepo = parts.length >= 4 ? `https://github.com/${parts[0]}/${parts[1]}` : "https://github.com";
    return NextResponse.json({
      name: metadata.name,
      description: metadata.description,
      version: metadata.version || null,
      license: metadata.license || null,
      source_repo: sourceRepo,
      skill_path: parts.slice(3).join("/"),
      skill_md: markdown,
      checks: {
        frontmatter: true,
        size_bytes: new TextEncoder().encode(markdown).length,
        scripts_detected: /(^|\n)\s*(run|execute|install|npm|npx|curl|wget|bash|python)\b/i.test(markdown),
        external_urls: (markdown.match(/https?:\/\//g) || []).length,
      },
    });
  } catch {
    return NextResponse.json({ error: "Could not inspect the GitHub file. Try again later." }, { status: 502 });
  }
}
