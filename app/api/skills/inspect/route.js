import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const MAX_FILES = 40;
const MAX_FILE_BYTES = 250_000;
const MAX_BUNDLE_BYTES = 1_000_000;

async function authenticate(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return { error: json({ error: "Authentication is not configured" }, 503) };
  if (!token) return { error: json({ error: "Sign in is required" }, 401) };
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? { error: json({ error: "Invalid session" }, 401) } : { user };
}

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

function validRelativePath(path) {
  if (typeof path !== "string" || !path || path.length > 240 || path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  const parts = path.split("/");
  return parts.every((part) => part && part !== "." && part !== ".." && /^[A-Za-z0-9_.@+-]+$/.test(part));
}

async function readSkillBundle(rawUrl) {
  const parts = rawUrl.pathname.split("/").filter(Boolean);
  if (parts.length < 4) throw new Error("Invalid GitHub raw file path");
  const [owner, repo, ref, ...fileParts] = parts;
  if (!/^[A-Za-z0-9_.-]+$/.test(ref) || fileParts.at(-1)?.toLowerCase() !== "skill.md") {
    throw new Error("Use a raw GitHub URL with a simple branch or tag name and a SKILL.md file");
  }
  const skillDir = fileParts.slice(0, -1).join("/");
  const treeUrl = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`;
  const treeResponse = await fetch(treeUrl, { headers: { accept: "application/vnd.github+json", "user-agent": "DRIVE-Skill-Inspector" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!treeResponse.ok) throw new Error(treeResponse.status === 404 ? "GitHub repository, branch, or tree was not found" : "GitHub tree lookup failed");
  const tree = await treeResponse.json();
  if (tree.truncated || !Array.isArray(tree.tree)) throw new Error("GitHub repository tree is truncated; refusing a partial security scan");
  const prefix = skillDir ? `${skillDir}/` : "";
  const entries = tree.tree.filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix))
    .map((entry) => ({ path: entry.path.slice(prefix.length), mode: entry.mode, type: entry.type }))
    .filter((entry) => entry.path && !entry.path.includes("/../"));
  if (!entries.some((entry) => entry.path.toLowerCase() === "skill.md")) throw new Error("SKILL.md was not present in the selected Skill folder");
  if (entries.length > MAX_FILES) throw new Error(`Skill bundle exceeds the ${MAX_FILES}-file scan limit`);
  const allEntries = tree.tree.filter((entry) => entry.path.startsWith(prefix) && entry.path !== skillDir);
  if (allEntries.some((entry) => entry.type === "commit" || entry.mode === "120000")) throw new Error("Skill bundle contains a symlink or submodule; refusing to scan an incomplete bundle");
  const files = [];
  let total = 0;
  for (const entry of entries) {
    if (!validRelativePath(entry.path)) throw new Error("Skill bundle contains an unsafe file path");
    const fileUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${ref}/${[...fileParts.slice(0, -1), ...entry.path.split("/")].map(encodeURIComponent).join("/")}`;
    const response = await fetch(fileUrl, { headers: { accept: "application/octet-stream", "user-agent": "DRIVE-Skill-Inspector" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Could not retrieve bundle file: ${entry.path}`);
    const content = await response.text();
    const size = new TextEncoder().encode(content).length;
    if (size > MAX_FILE_BYTES) throw new Error(`Bundle file exceeds 250 KB: ${entry.path}`);
    total += size;
    if (total > MAX_BUNDLE_BYTES) throw new Error("Skill bundle exceeds the 1 MB total scan limit");
    files.push({ path: entry.path, content });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { owner, repo, ref, skillDir, files, totalBytes: total };
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  let url;
  try { url = new URL(typeof body.url === "string" ? body.url.trim() : ""); }
  catch { return json({ error: "Enter a valid raw GitHub SKILL.md URL" }, 400); }
  if (url.protocol !== "https:" || url.hostname !== "raw.githubusercontent.com" || url.username || url.password || url.port || !url.pathname.toLowerCase().endsWith("/skill.md")) {
    return json({ error: "Only https://raw.githubusercontent.com/.../SKILL.md sources are supported" }, 400);
  }

  try {
    const bundle = await readSkillBundle(url);
    const skillFile = bundle.files.find((file) => file.path.toLowerCase() === "skill.md");
    const markdown = skillFile.content;
    const metadata = parseFrontmatter(markdown);
    if (!metadata?.name || !metadata?.description || metadata.name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name) || metadata.description.length > 1024) {
      return json({ error: "Invalid Agent Skill metadata. Check name and description in YAML frontmatter." }, 422);
    }

    const scannerUrl = process.env.DRIVE_SKILLSPECTOR_URL;
    const scannerToken = process.env.DRIVE_SKILLSPECTOR_TOKEN;
    if (!scannerUrl || !scannerToken) return json({ error: "NVIDIA SkillSpector is not configured. Skill import is blocked until the scanner is online." }, 503);
    let scanResponse;
    try {
      scanResponse = await fetch(new URL("/scan", scannerUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${scannerToken}` },
        body: JSON.stringify({ files: bundle.files }),
        cache: "no-store",
        signal: AbortSignal.timeout(105000),
      });
    } catch {
      return json({ error: "NVIDIA SkillSpector is unavailable. Fail-closed policy blocked this Skill." }, 503);
    }
    if (!scanResponse.ok) return json({ error: "NVIDIA SkillSpector failed to complete the bundle scan. Skill import is blocked.", scanner_status: scanResponse.status }, 502);
    const scan = await scanResponse.json();
    const contentHash = await sha256(markdown);
    const bundleManifest = bundle.files.map(({ path, content }) => ({ path, sha256: null, bytes: new TextEncoder().encode(content).length }));
    for (let i = 0; i < bundle.files.length; i++) bundleManifest[i].sha256 = await sha256(bundle.files[i].content);
    const bundleHash = await sha256(bundle.files.map(({ path, content }) => `${path}\0${content}\0`).join(""));
    if (scan.content_sha256 !== bundleHash || scan.complete !== true || scan.safe_to_install !== true || String(scan.recommendation).toUpperCase() !== "SAFE") {
      return json({ error: "SkillSpector did not return a complete SAFE verdict for the entire bundle. This Skill cannot be imported.", scan: { ...scan, raw_report: undefined } }, 422);
    }

    return json({
      name: metadata.name, description: metadata.description, version: metadata.version || null, license: metadata.license || null,
      source_repo: `https://github.com/${bundle.owner}/${bundle.repo}`, skill_path: bundle.skillDir,
      skill_md: markdown,
      scan: { scanner: scan.scanner, scanner_version: scan.scanner_version, content_sha256: contentHash, bundle_sha256: bundleHash, bundle_manifest: bundleManifest, files_scanned: bundle.files.length, bytes_scanned: bundle.totalBytes, scan_mode: scan.scan_mode, risk_score: scan.risk_score, severity: scan.severity, recommendation: scan.recommendation, safe_to_install: true, complete: true, findings: scan.findings || [], scanned_at: new Date().toISOString() },
      checks: { frontmatter: true, size_bytes: new TextEncoder().encode(markdown).length, bundle_files: bundle.files.length, bundle_bytes: bundle.totalBytes, risk_level: "safe", external_urls: (markdown.split("https://").length - 1) + (markdown.split("http://").length - 1), external_hosts: [], scripts_detected: bundle.files.some((file) => /\\.(sh|bash|py|js|mjs|cjs|ts|ps1)$/i.test(file.path)), findings: [] },
      disclaimer: "SkillSpector static analysis passed for the retrieved bundle. This is defense-in-depth, not a sandbox or a guarantee of safety."
    });
  } catch (error) {
    return json({ error: String(error?.message || "Could not inspect the Skill. No import is allowed without a complete scanner result.") }, 502);
  }
}
