import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function githubHeaders() {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "DRIVE-MCP/2.6",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

function parseFrontmatter(markdown) {
  const match = String(markdown || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const meta = {};
  let currentKey = "";
  let multiline = [];

  const flush = () => {
    if (currentKey && multiline.length) {
      meta[currentKey] = multiline.join(" ").replace(/\s+/g, " ").trim();
    }
    currentKey = "";
    multiline = [];
  };

  for (const line of lines) {
    if (currentKey && (/^\s+/.test(line) || line.trim() === "")) {
      if (line.trim()) multiline.push(line.trim());
      continue;
    }
    flush();
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const rawVal = line.slice(idx + 1).trim();
    if (/^[>|][-+]?$/.test(rawVal)) {
      currentKey = key;
      multiline = [];
    } else if (key && rawVal) {
      meta[key] = rawVal.replace(/^['"]|['"]$/g, "");
    }
  }
  flush();
  return meta;
}

function extractHeadingsAndSummary(markdown) {
  const withoutFm = String(markdown || "").replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
  const headings = [];
  for (const line of withoutFm.split(/\r?\n/)) {
    const m = line.match(/^#{1,3}\s+(.+)/);
    if (m && headings.length < 10) {
      headings.push(m[1].replace(/[*`#]/g, "").trim());
    }
  }
  const paragraphs = withoutFm
    .split(/\r?\n\r?\n/)
    .map((p) => p.replace(/^#+\s.*$/gm, "").replace(/```[\s\S]*?```/g, "").replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 25);
  return {
    headings,
    firstParagraph: (paragraphs[0] || "").slice(0, 320),
  };
}

function buildIndonesianExplanation({ name, description, category, headings, fileStats }) {
  const cleanDesc = String(description || "").replace(/^[>|][-+]?\s*/, "").trim();
  const parts = [];

  const catLabelsId = {
    frontend: "pengembangan Frontend & UI",
    backend: "pengembangan Backend & API",
    ai: "workflow AI & Agent",
    devops: "DevOps, Cloud & Deployment",
    database: "Database & SQL",
    security: "Keamanan & Audit Kode",
    testing: "Testing, QA & Debugging",
    design: "Desain UI/UX & Aksesibilitas",
    data: "Analisis Data & Visualisasi",
    mobile: "Aplikasi Mobile (iOS/Android)",
    docs: "Dokumentasi & Penulisan Teknis",
    productivity: "Produktivitas & Otomatisasi Kerja",
    marketing: "Marketing & SEO",
    automation: "Otomatisasi & Scripting",
  };
  const domainId = catLabelsId[String(category || "").toLowerCase()] || "workflow AI agent";

  parts.push(
    `Skill "${name}" berfungsi sebagai panduan khusus untuk AI di bidang ${domainId}.`
  );

  if (cleanDesc) {
    parts.push(`Ringkasan fungsi: ${cleanDesc}`);
  }

  if (headings.length > 0) {
    parts.push(`Topik & aturan utama di dalamnya mencakup: ${headings.slice(0, 5).join(", ")}.`);
  }

  const structNotes = [];
  if (fileStats.skillMdCount > 0) structNotes.push(`${fileStats.skillMdCount} file instruksi SKILL.md`);
  if (fileStats.scriptCount > 0) structNotes.push(`${fileStats.scriptCount} skrip helper`);
  if (fileStats.refCount > 0) structNotes.push(`${fileStats.refCount} dokumen referensi`);
  if (fileStats.folderCount > 0) structNotes.push(`${fileStats.folderCount} folder terstruktur`);

  if (structNotes.length > 0) {
    parts.push(`Paket ini berisi ${structNotes.join(", ")} yang otomatis dibaca AI saat skill diaktifkan.`);
  }

  return parts.join(" ");
}

function buildEnglishExplanation({ name, description, category, headings, fileStats }) {
  const cleanDesc = String(description || "").replace(/^[>|][-+]?\s*/, "").trim();
  const parts = [];
  parts.push(
    `"${name}" is a specialized Agent Skill for ${category || "AI agent"} workflows.`
  );
  if (cleanDesc) {
    parts.push(cleanDesc);
  }
  if (headings.length > 0) {
    parts.push(`Core sections covered: ${headings.slice(0, 5).join(", ")}.`);
  }
  const structNotes = [];
  if (fileStats.skillMdCount > 0) structNotes.push(`${fileStats.skillMdCount} SKILL.md instruction file(s)`);
  if (fileStats.scriptCount > 0) structNotes.push(`${fileStats.scriptCount} helper script(s)`);
  if (fileStats.refCount > 0) structNotes.push(`${fileStats.refCount} reference doc(s)`);
  if (structNotes.length > 0) {
    parts.push(`Bundle includes ${structNotes.join(", ")} loaded when the skill is enabled.`);
  }
  return parts.join(" ");
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawRepo = String(body.repository || body.source || "").trim();
  const cleanRepo = rawRepo
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
  const slug = String(body.slug || "").trim().toLowerCase();
  const skillPath = String(body.skillPath || "").trim();
  const fallbackName = String(body.name || cleanRepo || "Agent Skill").trim();
  const fallbackDesc = String(body.description || "").replace(/^[>|][-+]?\s*/, "").trim();
  const category = String(body.category || "").trim();
  let skillMd = String(body.skillMd || "").trim();

  let branch = "main";
  let entries = [];
  let repoUrl = cleanRepo.includes("/") ? `https://github.com/${cleanRepo}` : "";

  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleanRepo)) {
    try {
      const repoRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
        headers: githubHeaders(),
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(7000),
      });
      if (repoRes.ok) {
        const repoInfo = await repoRes.json();
        branch = repoInfo.default_branch || "main";
        const treeRes = await fetch(
          `https://api.github.com/repos/${cleanRepo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
          {
            headers: githubHeaders(),
            next: { revalidate: 1800 },
            signal: AbortSignal.timeout(8000),
          }
        );
        if (treeRes.ok) {
          const treeJson = await treeRes.json();
          const allNodes = Array.isArray(treeJson.tree) ? treeJson.tree : [];

          // Find target skill subfolder if applicable
          let prefix = "";
          if (skillPath && skillPath.includes("/")) {
            prefix = skillPath.slice(0, skillPath.lastIndexOf("/") + 1);
          } else if (slug) {
            const matchSkill = allNodes.find(
              (n) =>
                n.type === "blob" &&
                /(^|\/)SKILL\.md$/i.test(n.path) &&
                n.path.toLowerCase().includes(slug)
            );
            if (matchSkill && matchSkill.path.includes("/")) {
              prefix = matchSkill.path.slice(0, matchSkill.path.lastIndexOf("/") + 1);
            }
          }

          const scopedNodes = prefix
            ? allNodes.filter((n) => n.path.startsWith(prefix))
            : allNodes;
          const displayNodes = scopedNodes.length > 0 ? scopedNodes : allNodes;

          entries = displayNodes.slice(0, 80).map((n) => ({
            path: prefix && n.path.startsWith(prefix) ? n.path.slice(prefix.length) || n.path : n.path,
            fullPath: n.path,
            type: n.type === "tree" ? "folder" : "file",
            size: Number(n.size || 0),
          }));

          // Fetch SKILL.md if not provided
          if (!skillMd) {
            const targetMd =
              displayNodes.find((n) => n.type === "blob" && /(^|\/)SKILL\.md$/i.test(n.path)) ||
              allNodes.find((n) => n.type === "blob" && /(^|\/)SKILL\.md$/i.test(n.path)) ||
              allNodes.find((n) => n.type === "blob" && /^README\.md$/i.test(n.path));
            if (targetMd) {
              const rawRes = await fetch(
                `https://raw.githubusercontent.com/${cleanRepo}/${encodeURIComponent(branch)}/${targetMd.path}`,
                { next: { revalidate: 1800 }, signal: AbortSignal.timeout(6000) }
              );
              if (rawRes.ok) {
                skillMd = (await rawRes.text()).slice(0, 12000);
              }
            }
          }
        }
      }
    } catch {}
  } else if (skillPath) {
    // Custom uploaded skill
    entries = [{ path: skillPath, fullPath: skillPath, type: "file", size: skillMd.length }];
  }

  const fm = parseFrontmatter(skillMd);
  const { headings, firstParagraph } = extractHeadingsAndSummary(skillMd);
  const resolvedName = fm.name || fallbackName;
  const resolvedDesc = fm.description || fallbackDesc || firstParagraph;

  const fileStats = {
    totalFiles: entries.filter((e) => e.type === "file").length,
    folderCount: entries.filter((e) => e.type === "folder").length,
    skillMdCount: entries.filter((e) => /(^|\/)SKILL\.md$/i.test(e.path)).length,
    scriptCount: entries.filter((e) => /\.(py|js|mjs|ts|sh)$/i.test(e.path)).length,
    refCount: entries.filter((e) => /\.(md|txt|json)$/i.test(e.path) && !/SKILL\.md$/i.test(e.path)).length,
  };

  return NextResponse.json({
    name: resolvedName,
    repository: cleanRepo,
    branch,
    repoUrl,
    entries,
    fileStats,
    headings,
    summary: {
      id: buildIndonesianExplanation({
        name: resolvedName,
        description: resolvedDesc,
        category,
        headings,
        fileStats,
      }),
      en: buildEnglishExplanation({
        name: resolvedName,
        description: resolvedDesc,
        category,
        headings,
        fileStats,
      }),
    },
    preview: skillMd.slice(0, 4000),
  });
}
