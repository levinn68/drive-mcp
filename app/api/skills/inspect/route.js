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

function inspectContent(markdown) {
  const checks = [
    {
      id: "shell-execution",
      label: "Shell or script execution",
      severity: "high",
      pattern: /\b(?:bash|sh|zsh|powershell|cmd\.exe|python\s+-c|node\s+-e|npm\s+(?:install|run)|npx)\b|(?:^|\n)\s*\$\s*(?:curl|wget|chmod|sudo)\b/i,
    },
    {
      id: "remote-download",
      label: "Remote downloads or piped commands",
      severity: "high",
      pattern: /\b(?:curl|wget)\b.{0,180}(?:https?:\/\/|\|)|https?:\/\/[^\s]+\s*\|\s*(?:bash|sh)/i,
    },
    {
      id: "secret-access",
      label: "Secret or credential access",
      severity: "high",
      pattern: /\b(?:API[_ -]?KEY|ACCESS[_ -]?TOKEN|SECRET|CREDENTIALS?|\.env|id_rsa|private key)\b/i,
    },
    {
      id: "privilege-escalation",
      label: "Elevated privileges or permission changes",
      severity: "high",
      pattern: /\b(?:sudo|administrator privileges|run as root|chmod\s+777|chown\s+-R)\b/i,
    },
    {
      id: "prompt-override",
      label: "Attempts to override agent instructions",
      severity: "high",
      pattern: /\b(?:ignore|disregard|override)\b.{0,100}\b(?:previous|system|developer|safety|policy)\b|\breveal\b.{0,80}\b(?:system prompt|hidden instructions|secrets)\b/i,
    },
    {
      id: "data-exfiltration",
      label: "Potential data transmission",
      severity: "medium",
      pattern: /\b(?:upload|send|POST|exfiltrat|webhook|pastebin)\b.{0,140}\b(?:file|data|token|secret|environment|credential)\b/i,
    },
    {
      id: "destructive-operations",
      label: "Destructive file or database operations",
      severity: "high",
      pattern: /\b(?:rm\s+-rf|drop\s+database|truncate\s+table|delete\s+all|format\s+[a-z]:)\b/i,
    },
  ];
  const findings = checks.filter((check) => check.pattern.test(markdown)).map(({ id, label, severity }) => ({ id, label, severity }));
  const urls = [...markdown.matchAll(/https?:\/\/[^\s)\]}>"']+/g)].map((match) => match[0].replace(/[.,;]+$/, ""));
  const uniqueHosts = [...new Set(urls.map((value) => {
    try { return new URL(value).hostname; } catch { return "invalid-url"; }
  }))];
  return {
    findings,
    risk_level: findings.some((item) => item.severity === "high") ? "high" : findings.length ? "review" : "no_obvious_findings",
    external_urls: urls.length,
    external_hosts: uniqueHosts,
    scripts_detected: findings.some((item) => ["shell-execution", "remote-download"].includes(item.id)),
  };
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
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return NextResponse.json({ error: response.status === 404 ? "SKILL.md was not found at that path" : "GitHub could not provide this file" }, { status: response.status === 404 ? 404 : 502 });
    const markdown = await response.text();
    if (!markdown.trim() || new TextEncoder().encode(markdown).length > 250000) return NextResponse.json({ error: "Skill file is empty or exceeds the 250 KB inspection limit" }, { status: 413 });
    const metadata = parseFrontmatter(markdown);
    if (!metadata?.name || !metadata?.description) return NextResponse.json({ error: "Invalid Agent Skill: YAML frontmatter must include name and description" }, { status: 422 });
    if (metadata.name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(metadata.name)) {
      return NextResponse.json({ error: "Skill name must be lowercase kebab-case and no longer than 64 characters" }, { status: 422 });
    }
    if (metadata.description.length > 1024) return NextResponse.json({ error: "Skill description exceeds 1024 characters" }, { status: 422 });
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 4) return NextResponse.json({ error: "Invalid GitHub raw file path" }, { status: 400 });
    const sourceRepo = `https://github.com/${parts[0]}/${parts[1]}`;
    const contentChecks = inspectContent(markdown);
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
        ...contentChecks,
      },
      disclaimer: "Static pattern checks only. A clean result is not a guarantee that this Skill is safe.",
    });
  } catch {
    return NextResponse.json({ error: "Could not inspect the GitHub file. Try again later." }, { status: 502 });
  }
}
