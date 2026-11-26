import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function getUserClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return { error: json({ error: "Authentication is not configured" }, 503) };
  if (!token) return { error: json({ error: "Sign in is required to install Skills" }, 401) };
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return { error: json({ error: "Invalid or expired session" }, 401) };
  return { supabase, user };
}

function githubHeaders() {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "DRIVE-MCP/4.0",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return headers;
}

function parseFrontmatter(markdown) {
  const match = String(markdown || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line
      .slice(idx + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (key && val && !/^[>|][-+]?$/.test(val)) meta[key] = val;
  }
  return meta;
}

async function resolveLobeHubSkill(identifier, fallbackName, fallbackDesc) {
  const cleanId = String(identifier || "").replace(/^lobehub\//i, "").trim();
  if (!cleanId) throw new Error("Invalid LobeHub skill identifier.");
  let title = fallbackName || cleanId;
  let description = fallbackDesc || "";
  let systemRole = "";

  try {
    const res = await fetch(`https://chat-agents.lobehub.com/${encodeURIComponent(cleanId)}.json`, {
      headers: { accept: "application/json", "user-agent": "DRIVE-MCP/4.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      title = data?.meta?.title || title;
      description = data?.meta?.description || description;
      systemRole = data?.config?.systemRole || "";
    }
  } catch {}

  const skillMd = [
    "---",
    `name: ${title}`,
    `description: ${description || `LobeHub AI Agent Skill (${title})`}`,
    `source: https://lobehub.com/discover/assistant/${cleanId}`,
    "---",
    "",
    `# ${title}`,
    "",
    systemRole || description || `Act as ${title}.`,
  ].join("\n");

  return [
    {
      sourceRepo: `lobehub/${cleanId}`,
      skillPath: "SKILL.md",
      skillMd: skillMd.slice(0, 120000),
      license: "MIT",
      frontmatterName: title,
      frontmatterDescription: description || null,
    },
  ];
}

async function resolveNpmSkill(pkgPath, fallbackName, fallbackDesc) {
  const pkgName = String(pkgPath || "").replace(/^npm\//i, "").trim();
  if (!pkgName) throw new Error("Invalid npm package name.");
  let title = fallbackName || pkgName;
  let description = fallbackDesc || "";
  let readme = "";
  let license = null;

  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}`, {
      headers: { accept: "application/json", "user-agent": "DRIVE-MCP/4.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const data = await res.json();
      description = data.description || description;
      readme = typeof data.readme === "string" ? data.readme : "";
      license = typeof data.license === "string" ? data.license : null;
    }
  } catch {}

  const skillMd = [
    "---",
    `name: ${title}`,
    `description: ${description || `npm Agent Skill package (${pkgName})`}`,
    `source: https://www.npmjs.com/package/${pkgName}`,
    "---",
    "",
    readme || `# ${title}\n\n${description || `Agent Skill package ${pkgName} from npm.`}`,
  ].join("\n");

  return [
    {
      sourceRepo: `npm/${pkgName}`,
      skillPath: "SKILL.md",
      skillMd: skillMd.slice(0, 120000),
      license,
      frontmatterName: title,
      frontmatterDescription: description || null,
    },
  ];
}

async function resolveSkillsFromGithub(repository, slug, explicitPath, installAll) {
  const cleanRepo = String(repository || "")
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleanRepo)) {
    throw new Error("Invalid GitHub repository format.");
  }

  const repoRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
    headers: githubHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!repoRes.ok) {
    throw new Error(`Could not access GitHub repository ${cleanRepo} (HTTP ${repoRes.status}).`);
  }
  const repoInfo = await repoRes.json();
  const branch = repoInfo.default_branch || "main";
  const license = repoInfo.license?.spdx_id || null;

  let targetPaths = [];
  if (explicitPath) {
    targetPaths = [explicitPath];
  } else {
    const treeRes = await fetch(
      `https://api.github.com/repos/${cleanRepo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { headers: githubHeaders(), cache: "no-store", signal: AbortSignal.timeout(12000) }
    );
    if (!treeRes.ok) throw new Error("Could not inspect repository files for SKILL.md.");
    const tree = await treeRes.json();
    const skillFiles = (tree.tree || []).filter(
      (node) => node.type === "blob" && /(^|\/)SKILL\.md$/i.test(node.path)
    );
    if (!skillFiles.length) throw new Error(`No SKILL.md found in ${cleanRepo}.`);

    if (installAll) {
      targetPaths = skillFiles.slice(0, 15).map((f) => f.path);
    } else {
      const slugLower = String(slug || "").toLowerCase();
      const exact = skillFiles.find(
        (f) =>
          f.path.toLowerCase().includes(`/${slugLower}/skill.md`) ||
          f.path.toLowerCase() === `${slugLower}/skill.md`
      );
      const partial = skillFiles.find((f) => slugLower && f.path.toLowerCase().includes(slugLower));
      targetPaths = [(exact || partial || skillFiles[0]).path];
    }
  }

  const downloaded = await Promise.allSettled(
    targetPaths.map(async (targetPath) => {
      const rawUrl = `https://raw.githubusercontent.com/${cleanRepo}/${encodeURIComponent(branch)}/${targetPath}`;
      const rawRes = await fetch(rawUrl, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!rawRes.ok) throw new Error(`Could not download ${targetPath}`);
      const skillMd = await rawRes.text();
      if (!skillMd.trim()) throw new Error("Empty SKILL.md");
      const fm = parseFrontmatter(skillMd);
      const folderName = targetPath.split("/").slice(-2, -1)[0] || cleanRepo.split("/")[1];
      return {
        sourceRepo: cleanRepo,
        skillPath: targetPath,
        skillMd: skillMd.slice(0, 120000),
        license,
        frontmatterName: fm.name || folderName || null,
        frontmatterDescription: fm.description || null,
      };
    })
  );

  const items = downloaded.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);
  if (!items.length) {
    throw new Error(`Could not download SKILL.md files from ${cleanRepo}.`);
  }
  return items;
}

async function scanSkillContent(skillMd) {
  const hash = createHash("sha256").update(skillMd).digest("hex");
  const scannerUrl = process.env.SECURITY_SCANNER_URL;
  if (scannerUrl) {
    try {
      const res = await fetch(`${scannerUrl.replace(/\/+$/, "")}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: skillMd }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const result = await res.json();
        const blocked = result.status === "blocked" || result.safe === false;
        return {
          status: blocked ? "blocked" : "safe",
          hash,
          report: result,
          version: result.scanner_version || "remote-scanner",
        };
      }
    } catch {}
  }

  const blockedPatterns = [
    /curl\s+[^|\n]*\|\s*(ba)?sh/i,
    /wget\s+[^|\n]*\|\s*(ba)?sh/i,
    /rm\s+-rf\s+\/(\s|$)/i,
  ];
  const flagged = blockedPatterns.some((rx) => rx.test(skillMd));
  return {
    status: flagged ? "blocked" : "safe",
    hash,
    report: { mode: "builtin-static-check", flagged },
    version: "drive-builtin-1.0",
  };
}

export async function POST(request) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const repository = typeof body.repository === "string" ? body.repository.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const skillPath = typeof body.skillPath === "string" ? body.skillPath.trim() : "";
  const installAll = Boolean(body.installAll);
  if (!repository) return json({ error: "repository is required" }, 400);

  let resolvedList;
  try {
    if (/^lobehub\//i.test(repository)) {
      resolvedList = await resolveLobeHubSkill(repository, body.name, body.description);
    } else if (/^npm\//i.test(repository)) {
      resolvedList = await resolveNpmSkill(repository, body.name, body.description);
    } else {
      resolvedList = await resolveSkillsFromGithub(repository, slug, skillPath, installAll);
    }
  } catch (err) {
    return json({ error: err?.message || "Could not load Skill content" }, 400);
  }

  const saved = [];
  let blockedCount = 0;
  const now = new Date().toISOString();

  for (const resolved of resolvedList) {
    const scan = await scanSkillContent(resolved.skillMd);
    if (scan.status === "blocked") {
      blockedCount += 1;
      continue;
    }

    const fallbackName =
      resolvedList.length === 1 && body.name
        ? body.name
        : resolved.frontmatterName || slug || resolved.sourceRepo.split("/")[1];
    const finalName = String(fallbackName).slice(0, 140);
    const finalDescription = String(
      resolved.frontmatterDescription || (resolvedList.length === 1 ? body.description : "") || ""
    ).slice(0, 1000);

    const { data: existing } = await auth.supabase
      .from("user_skills")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("source_repo", resolved.sourceRepo)
      .eq("skill_path", resolved.skillPath)
      .maybeSingle();

    const row = {
      user_id: auth.user.id,
      name: finalName,
      description: finalDescription,
      source_repo: resolved.sourceRepo,
      skill_path: resolved.skillPath,
      skill_md: resolved.skillMd,
      version: "latest",
      license: resolved.license,
      status: "enabled",
      reviewed_at: now,
      security_scan: scan.report,
      security_scan_hash: scan.hash,
      security_scan_status: "safe",
      security_scanned_at: now,
      security_scanner_version: scan.version,
      security_bundle_hash: scan.hash,
      updated_at: now,
    };

    if (existing?.id) {
      const { data } = await auth.supabase
        .from("user_skills")
        .update(row)
        .eq("id", existing.id)
        .eq("user_id", auth.user.id)
        .select("id,name,status,security_scan_status")
        .single();
      if (data) saved.push(data);
    } else {
      const { data } = await auth.supabase
        .from("user_skills")
        .insert(row)
        .select("id,name,status,security_scan_status")
        .single();
      if (data) saved.push(data);
    }
  }

  if (saved.length === 0) {
    return json(
      {
        error:
          blockedCount > 0
            ? "Skill blocked by security scan due to unsafe command patterns."
            : "Could not save Skill to your workspace.",
      },
      422
    );
  }

  return json(
    {
      skill: saved[0],
      skills: saved,
      installedCount: saved.length,
      blockedCount,
    },
    201
  );
}
