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
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: json({ error: "Invalid or expired session" }, 401) };
  return { supabase, user };
}

function githubHeaders() {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "DRIVE-MCP/1.3",
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
    const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && val) meta[key] = val;
  }
  return meta;
}

async function resolveSkillFromGithub(repository, slug, explicitPath) {
  const cleanRepo = String(repository || "").replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/^\/+|\/+$/g, "");
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleanRepo)) {
    throw new Error("Invalid GitHub repository format.");
  }

  const repoRes = await fetch(`https://api.github.com/repos/${cleanRepo}`, {
    headers: githubHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!repoRes.ok) throw new Error(`Could not access GitHub repository ${cleanRepo} (HTTP ${repoRes.status}).`);
  const repoInfo = await repoRes.json();
  const branch = repoInfo.default_branch || "main";

  let targetPath = explicitPath || "";
  if (!targetPath) {
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
    const slugLower = String(slug || "").toLowerCase();
    const exact = skillFiles.find((f) => f.path.toLowerCase().includes(`/${slugLower}/skill.md`) || f.path.toLowerCase() === `${slugLower}/skill.md`);
    const partial = skillFiles.find((f) => slugLower && f.path.toLowerCase().includes(slugLower));
    targetPath = (exact || partial || skillFiles[0]).path;
  }

  const rawUrl = `https://raw.githubusercontent.com/${cleanRepo}/${encodeURIComponent(branch)}/${targetPath}`;
  const rawRes = await fetch(rawUrl, { cache: "no-store", signal: AbortSignal.timeout(12000) });
  if (!rawRes.ok) throw new Error(`Could not download ${targetPath} from ${cleanRepo}.`);
  const skillMd = await rawRes.text();
  if (!skillMd.trim()) throw new Error("Downloaded SKILL.md is empty.");

  const fm = parseFrontmatter(skillMd);
  return {
    sourceRepo: cleanRepo,
    skillPath: targetPath,
    skillMd: skillMd.slice(0, 120000),
    license: repoInfo.license?.spdx_id || null,
    frontmatterName: fm.name || null,
    frontmatterDescription: fm.description || null,
  };
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
        signal: AbortSignal.timeout(10000),
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

  // Built-in static check when external scanner URL is not configured
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
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  const repository = typeof body.repository === "string" ? body.repository.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const skillPath = typeof body.skillPath === "string" ? body.skillPath.trim() : "";
  if (!repository) return json({ error: "repository is required" }, 400);

  let resolved;
  try {
    resolved = await resolveSkillFromGithub(repository, slug, skillPath);
  } catch (err) {
    return json({ error: err?.message || "Could not load SKILL.md from GitHub" }, 400);
  }

  const scan = await scanSkillContent(resolved.skillMd);
  if (scan.status === "blocked") {
    return json({ error: "Skill blocked by security scan due to unsafe command patterns.", scan: scan.report }, 422);
  }

  const finalName = String(body.name || resolved.frontmatterName || slug || resolved.sourceRepo.split("/")[1]).slice(0, 140);
  const finalDescription = String(body.description || resolved.frontmatterDescription || "").slice(0, 1000);
  const now = new Date().toISOString();

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
    const { data, error } = await auth.supabase
      .from("user_skills")
      .update(row)
      .eq("id", existing.id)
      .eq("user_id", auth.user.id)
      .select("id,name,status,security_scan_status")
      .single();
    if (error) return json({ error: "Could not update installed Skill", detail: error.message }, 400);
    return json({ skill: data, updated: true }, 200);
  }

  const { data, error } = await auth.supabase
    .from("user_skills")
    .insert(row)
    .select("id,name,status,security_scan_status")
    .single();
  if (error) return json({ error: "Could not save Skill", detail: error.message }, 400);
  return json({ skill: data, updated: false }, 201);
}
