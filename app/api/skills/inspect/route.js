import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 120;

const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function authenticate(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\\s+/i, "");
  if (!url || !key) return { error: json({ error: "Authentication is not configured" }, 503) };
  if (!token) return { error: json({ error: "Sign in is required" }, 401) };
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? { error: json({ error: "Invalid session" }, 401) } : { user };
}

function parseFrontmatter(markdown) {
  const match = markdown.match(/^---\\s*\\r?\\n([\\s\\S]*?)\\r?\\n---(?:\\r?\\n|$)/);
  if (!match) return null;
  const fields = {};
  for (const line of match[1].split(/\\r?\\n/)) {
    const item = line.match(/^([a-zA-Z0-9_-]+):\\s*(.*)$/);
    if (item) fields[item[1]] = item[2].replace(/^["']|["']$/g, "").trim();
  }
  return fields;
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
    const response = await fetch(url.toString(), { headers: { accept: "text/plain", "user-agent": "DRIVE-Skill-Inspector" }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) return json({ error: response.status === 404 ? "SKILL.md was not found" : "GitHub could not provide this file" }, response.status === 404 ? 404 : 502);
    const markdown = await response.text();
    const size = new TextEncoder().encode(markdown).length;
    if (!markdown.trim() || size > 250000) return json({ error: "Skill file is empty or exceeds the 250 KB inspection limit" }, 413);
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
        body: JSON.stringify({ content: markdown, filename: "SKILL.md" }),
        cache: "no-store",
        signal: AbortSignal.timeout(105000),
      });
    } catch {
      return json({ error: "NVIDIA SkillSpector is unavailable. Fail-closed policy blocked this Skill." }, 503);
    }
    if (!scanResponse.ok) return json({ error: "NVIDIA SkillSpector failed to complete the scan. Skill import is blocked.", scanner_status: scanResponse.status }, 502);
    const scan = await scanResponse.json();
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(markdown));
    const hash = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (scan.content_sha256 !== hash || scan.complete !== true || scan.safe_to_install !== true || String(scan.recommendation).toUpperCase() !== "SAFE") {
      return json({ error: "SkillSpector did not return a complete SAFE verdict. This Skill cannot be imported.", scan: { ...scan, raw_report: undefined } }, 422);
    }

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 4) return json({ error: "Invalid GitHub raw file path" }, 400);
    return json({
      name: metadata.name, description: metadata.description, version: metadata.version || null, license: metadata.license || null,
      source_repo: `https://github.com/${parts[0]}/${parts[1]}`, skill_path: parts.slice(3).join("/"), skill_md: markdown,
      scan: { scanner: scan.scanner, scanner_version: scan.scanner_version, content_sha256: hash, scan_mode: scan.scan_mode, risk_score: scan.risk_score, severity: scan.severity, recommendation: scan.recommendation, safe_to_install: true, complete: true, findings: scan.findings || [], scanned_at: new Date().toISOString() },
      checks: { frontmatter: true, size_bytes: size, risk_level: "safe", external_urls: [...markdown.matchAll(/https?:\\/\\/[^\\s)\\]}>"']+/g)].length, external_hosts: [], scripts_detected: false, findings: [] },
      disclaimer: "SkillSpector static analysis passed. This is defense-in-depth, not a sandbox or a guarantee of safety."
    });
  } catch {
    return json({ error: "Could not inspect the Skill. No import is allowed without a complete scanner result." }, 502);
  }
}
