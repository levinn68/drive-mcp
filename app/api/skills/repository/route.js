import { NextResponse } from "next/server";

export const runtime = "nodejs";

const headers = {
  accept: "application/vnd.github+json",
  "user-agent": "DRIVE-Skill-Catalog",
  "x-github-api-version": "2022-11-28",
};

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readSkillName(markdown) {
  const frontmatter = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!frontmatter) return "";
  const field = frontmatter[1].match(/^name:\s*(.*?)\s*$/im);
  return field ? field[1].replace(/^[\"']|[\"']$/g, "").trim() : "";
}

async function fetchSkillMetadata(file, signal) {
  const response = await fetch(file.raw_url, {
    headers: { accept: "text/plain", "user-agent": "DRIVE-Skill-Catalog" },
    cache: "no-store",
    redirect: "error",
    signal,
  });
  if (!response.ok) return { ...file, metadataError: true };
  const markdown = await response.text();
  return { ...file, frontmatterName: readSkillName(markdown) };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const owner = (searchParams.get("owner") || "").trim();
  const repo = (searchParams.get("repo") || "").trim();
  const branch = (searchParams.get("branch") || "").trim();
  const skill = (searchParams.get("skill") || "").trim();
  const skillName = (searchParams.get("skillName") || "").trim();
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
    if (tree.truncated) {
      return NextResponse.json({ error: "GitHub returned a truncated repository tree. Refusing to select a Skill from incomplete results." }, { status: 409 });
    }

    let skillFiles = (tree.tree || [])
      .filter((entry) => entry.type === "blob" && /(^|\/)SKILL\.md$/i.test(entry.path))
      .slice(0, 200)
      .map((entry) => ({
        path: entry.path,
        raw_url: `https://raw.githubusercontent.com/${owner}/${repo}/${selectedBranch}/${entry.path.split("/").map(encodeURIComponent).join("/")}`,
        size: entry.size || 0,
      }));

    if (skill || skillName) {
      const wanted = [...new Set([normalize(skill), normalize(skillName)].filter(Boolean))];
      const candidates = await Promise.all(skillFiles.map((file) =>
        fetchSkillMetadata(file, AbortSignal.timeout(10000)).catch(() => ({ ...file, metadataError: true }))
      ));
      const matches = candidates.filter((file) => {
        const folder = normalize(file.path.split("/").at(-2) || "");
        const metadataName = normalize(file.frontmatterName);
        const pathSegments = file.path.split("/").slice(0, -1).map(normalize);
        return wanted.some((candidate) =>
          candidate === metadataName ||
          candidate === folder ||
          pathSegments.includes(candidate)
        );
      });

      if (!matches.length && candidates.length === 1 && !candidates[0].metadataError) {
        skillFiles = candidates;
      } else if (!matches.length) {
        // Catalog slugs do not always equal repository folder names. Return the
        // actual SKILL.md files so the user can select the correct bundle.
        skillFiles = candidates.map(({ path, frontmatterName, metadataError, raw_url, size }) => ({
          path, raw_url, size, frontmatterName: frontmatterName || null,
          metadataError: Boolean(metadataError),
        }));
      } else if (matches.length > 1) {
        return NextResponse.json({
          error: "The catalog entry matches more than one SKILL.md file. Select the exact Skill folder.",
          matches: matches.map(({ path, frontmatterName }) => ({ path, name: frontmatterName || null })),
        }, { status: 409 });
      } else {
        skillFiles = matches;
      }
    }

    return NextResponse.json({
      repository: meta.full_name,
      html_url: meta.html_url,
      description: meta.description || "",
      branch: selectedBranch,
      license: meta.license?.spdx_id || null,
      stars: meta.stargazers_count,
      truncated: false,
      skills: skillFiles,
    });
  } catch {
    return NextResponse.json({ error: "Could not inspect this repository right now." }, { status: 502 });
  }
}
