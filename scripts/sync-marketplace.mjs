#!/usr/bin/env node
/**
 * Multi-source marketplace indexer for DRIVE MCP.
 * Syncs MCP servers (Official MCP Registry, Glama API, GitHub MCP discovery)
 * and Agent Skills (Skills Directory, curated GitHub SKILL.md repositories)
 * into Supabase (`mcp_servers`, `skill_catalog`, `mcp_registry_sync_runs`).
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const GLAMA_API_KEY = process.env.GLAMA_API_KEY || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

const MCP_OFFICIAL_URL = "https://registry.modelcontextprotocol.io/v0.1/servers";
const GLAMA_URL = "https://glama.ai/api/mcp/v1/servers";
const SKILLS_DIR_URL = "https://www.skillsdirectory.com/api/registry";

const MCP_OFFICIAL_MAX_PAGES = Number(process.env.MCP_OFFICIAL_MAX_PAGES || 15);
const GLAMA_MAX_PAGES = Number(process.env.GLAMA_MAX_PAGES || 10);
const SKILLS_DIR_MAX_PAGES = Number(process.env.SKILLS_DIR_MAX_PAGES || 10);

const CURATED_SKILL_REPOS = [
  { repo: "google/skills", category: "cloud", verified: true },
  { repo: "agents-inc/skills", category: "engineering", verified: true },
  { repo: "VoltAgent/awesome-agent-skills", category: "community", verified: true },
];

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchJson(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "DRIVE-MCP-Indexer/1.2",
      ...headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.json();
}

function githubHeaders() {
  const headers = { accept: "application/vnd.github+json" };
  if (GITHUB_TOKEN) headers.authorization = `Bearer ${GITHUB_TOKEN}`;
  return headers;
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

async function syncOfficialMcpRegistry() {
  const rows = [];
  let cursor = "";
  let pages = 0;
  for (let page = 0; page < MCP_OFFICIAL_MAX_PAGES; page += 1) {
    const url = new URL(MCP_OFFICIAL_URL);
    url.searchParams.set("limit", "100");
    url.searchParams.set("version", "latest");
    if (cursor) url.searchParams.set("cursor", cursor);
    const payload = await fetchJson(url.toString());
    const entries = Array.isArray(payload.servers) ? payload.servers : [];
    pages += 1;
    for (const entry of entries) {
      const server = entry.server || entry;
      if (!server?.name || !server?.version) continue;
      const remotes = Array.isArray(server.remotes) ? server.remotes : [];
      const packages = Array.isArray(server.packages) ? server.packages : [];
      const officialMeta = entry._meta?.["io.modelcontextprotocol.registry/official"] || {};
      const repository = server.repository?.url || server.repository || null;
      rows.push({
        id: `${server.name}@${server.version}`,
        server_name: server.name,
        version: server.version,
        title: server.title || server.name,
        description: String(server.description || "").slice(0, 1200),
        repository_url: typeof repository === "string" ? repository : repository?.url || null,
        website_url: server.websiteUrl || null,
        transport_types: [...new Set([
          ...remotes.map((r) => r?.type || "streamable_http"),
          ...packages.map((p) => p?.transport?.type || "stdio"),
        ])],
        packages,
        remotes,
        registry_metadata: entry._meta || {},
        source_id: "official-mcp-registry",
        source_status: officialMeta.status || "active",
        trust_level: "verified",
        is_latest: officialMeta.isLatest !== false,
        published_at: server.updatedAt || server.createdAt || null,
        updated_at: new Date().toISOString(),
      });
    }
    cursor = payload.metadata?.nextCursor || "";
    if (!cursor || entries.length === 0) break;
  }
  return { sourceId: "official-mcp-registry", pages, rows };
}

async function syncGlamaDirectory() {
  if (!GLAMA_API_KEY) {
    console.log("Skipping Glama MCP Directory (GLAMA_API_KEY not set).");
    return { sourceId: "glama-mcp-directory", pages: 0, rows: [] };
  }
  const rows = [];
  let cursor = "";
  let pages = 0;
  for (let page = 0; page < GLAMA_MAX_PAGES; page += 1) {
    const url = new URL(GLAMA_URL);
    url.searchParams.set("first", "100");
    if (cursor) url.searchParams.set("after", cursor);
    const payload = await fetchJson(url.toString(), { authorization: `Bearer ${GLAMA_API_KEY}` });
    const servers = Array.isArray(payload.servers) ? payload.servers : [];
    pages += 1;
    for (const item of servers) {
      const serverName = item.slug || item.id || item.name;
      if (!serverName) continue;
      const version = "glama-latest";
      const remoteUrl = item.url || item.endpoint || null;
      const remotes = remoteUrl && String(remoteUrl).startsWith("https://")
        ? [{ type: "streamable_http", url: remoteUrl }]
        : [];
      rows.push({
        id: `glama:${serverName}@${version}`,
        server_name: `glama/${serverName}`,
        version,
        title: item.name || serverName,
        description: String(item.description || "").slice(0, 1200),
        repository_url: item.repository?.url || null,
        website_url: item.url || null,
        transport_types: remotes.length ? ["streamable_http"] : ["stdio"],
        packages: [],
        remotes,
        registry_metadata: { glama: { id: item.id, attributes: item.attributes || [] } },
        source_id: "glama-mcp-directory",
        source_status: "active",
        trust_level: "community",
        is_latest: true,
        published_at: item.updatedAt || null,
        updated_at: new Date().toISOString(),
      });
    }
    cursor = payload.pageInfo?.hasNextPage ? payload.pageInfo?.endCursor || "" : "";
    if (!cursor || servers.length === 0) break;
  }
  return { sourceId: "glama-mcp-directory", pages, rows };
}

async function syncGithubMcpDiscovery() {
  const rows = [];
  let pages = 0;
  for (let page = 1; page <= 3; page += 1) {
    const url = `https://api.github.com/search/repositories?q=topic:mcp-server+archived:false&sort=stars&order=desc&per_page=50&page=${page}`;
    try {
      const payload = await fetchJson(url, githubHeaders());
      const items = Array.isArray(payload.items) ? payload.items : [];
      pages += 1;
      for (const repo of items) {
        if (!repo?.full_name) continue;
        const version = "github-latest";
        rows.push({
          id: `github:${repo.full_name}@${version}`,
          server_name: `io.github.${repo.full_name}`,
          version,
          title: repo.name,
          description: String(repo.description || "").slice(0, 1200),
          repository_url: repo.html_url,
          website_url: repo.homepage || null,
          transport_types: ["stdio"],
          packages: [],
          remotes: [],
          registry_metadata: {
            github: {
              stars: Number(repo.stargazers_count || 0),
              topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 12) : [],
            },
          },
          source_id: "github-mcp-discovery",
          source_status: "active",
          trust_level: "community",
          is_latest: true,
          published_at: repo.pushed_at || repo.updated_at || null,
          updated_at: new Date().toISOString(),
        });
      }
      if (items.length < 50) break;
    } catch (err) {
      console.warn(`GitHub MCP discovery page ${page} skipped:`, err.message);
      break;
    }
  }
  return { sourceId: "github-mcp-discovery", pages, rows };
}

async function upsertMcpSource({ sourceId, pages, rows }) {
  if (!rows.length) return { sourceId, seen: 0, upserted: 0 };
  const deduped = new Map();
  for (const row of rows) {
    deduped.set(`${row.server_name}::${row.version}`, row);
  }
  const uniqueRows = [...deduped.values()];
  let upserted = 0;
  let lastError = null;
  for (const batch of chunk(uniqueRows, 100)) {
    const { error } = await supabase
      .from("mcp_servers")
      .upsert(batch, { onConflict: "server_name,version" });
    if (error) {
      lastError = error.message;
      console.error(`Upsert error (${sourceId}):`, error.message);
    } else {
      upserted += batch.length;
    }
  }
  await supabase.from("mcp_registry_sync_runs").insert({
    source_id: sourceId,
    status: lastError ? (upserted > 0 ? "partial" : "failed") : "success",
    pages_fetched: pages,
    records_seen: uniqueRows.length,
    records_upserted: upserted,
    error_message: lastError,
    finished_at: new Date().toISOString(),
  });
  await supabase.from("mcp_registry_sources").update({
    last_synced_at: new Date().toISOString(),
    last_sync_status: lastError ? (upserted > 0 ? "partial" : "failed") : "success",
    last_sync_error: lastError,
    updated_at: new Date().toISOString(),
  }).eq("id", sourceId);
  return { sourceId, seen: uniqueRows.length, upserted };
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

async function syncSkillsDirectory() {
  const rows = [];
  for (let page = 0; page < SKILLS_DIR_MAX_PAGES; page += 1) {
    const url = new URL(SKILLS_DIR_URL);
    url.searchParams.set("limit", "100");
    url.searchParams.set("offset", String(page * 100));
    url.searchParams.set("sort", "stars");
    try {
      const payload = await fetchJson(url.toString());
      const items = payload.skills || payload.data || [];
      if (!items.length) break;
      for (const item of items) {
        if (!item?.repository || !item?.slug || !item?.name) continue;
        rows.push({
          id: `${item.repository}/${item.slug}`,
          slug: item.slug,
          name: item.name,
          description: String(item.description || "").slice(0, 1000),
          category: item.category || "other",
          author: item.author || item.repository.split("/")[0] || null,
          repository: item.repository,
          skill_path: item.path || null,
          source_url: `https://github.com/${item.repository}`,
          source_id: "skillsdirectory",
          stars: Number(item.stars || 0),
          verified: Boolean(item.verified),
          tags: Array.isArray(item.tags) ? item.tags.slice(0, 12) : [],
          updated_at: new Date().toISOString(),
        });
      }
      if (items.length < 100) break;
    } catch (err) {
      console.warn(`Skills Directory page ${page} skipped:`, err.message);
      break;
    }
  }
  return rows;
}

async function syncCuratedGithubSkills() {
  const rows = [];
  for (const target of CURATED_SKILL_REPOS) {
    try {
      const repoInfo = await fetchJson(`https://api.github.com/repos/${target.repo}`, githubHeaders());
      const branch = repoInfo.default_branch || "main";
      const tree = await fetchJson(
        `https://api.github.com/repos/${target.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
        githubHeaders()
      );
      const skillFiles = (tree.tree || [])
        .filter((node) => node.type === "blob" && /(^|\/)SKILL\.md$/i.test(node.path))
        .slice(0, 80);

      for (const file of skillFiles) {
        const parts = file.path.split("/");
        const slug = parts.length >= 2 ? parts[parts.length - 2] : target.repo.split("/")[1];
        let name = slug;
        let description = `Agent Skill from ${target.repo}`;
        try {
          const rawRes = await fetch(`https://raw.githubusercontent.com/${target.repo}/${branch}/${file.path}`, {
            signal: AbortSignal.timeout(8000),
          });
          if (rawRes.ok) {
            const text = await rawRes.text();
            const fm = parseFrontmatter(text);
            if (fm.name) name = fm.name;
            if (fm.description) description = fm.description;
          }
        } catch {}
        rows.push({
          id: `${target.repo}/${slug}`,
          slug,
          name: String(name).slice(0, 140),
          description: String(description).slice(0, 1000),
          category: target.category,
          author: target.repo.split("/")[0],
          repository: target.repo,
          skill_path: file.path,
          source_url: `https://github.com/${target.repo}/blob/${branch}/${file.path}`,
          source_id: "github-curated",
          stars: Number(repoInfo.stargazers_count || 0),
          verified: target.verified,
          tags: [target.category, "skill-md"],
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn(`Curated skill repo ${target.repo} skipped:`, err.message);
    }
  }
  return rows;
}

async function upsertSkills(rows) {
  if (!rows.length) return { seen: 0, upserted: 0 };
  const deduped = new Map();
  for (const row of rows) deduped.set(row.id, row);
  const uniqueRows = [...deduped.values()];
  let upserted = 0;
  for (const batch of chunk(uniqueRows, 100)) {
    const { error } = await supabase
      .from("skill_catalog")
      .upsert(batch, { onConflict: "id" });
    if (error) console.error("Skill catalog upsert error:", error.message);
    else upserted += batch.length;
  }
  return { seen: uniqueRows.length, upserted };
}

async function main() {
  const [official, glama, ghMcp, skillsDir, curatedSkills] = await Promise.all([
    syncOfficialMcpRegistry(),
    syncGlamaDirectory(),
    syncGithubMcpDiscovery(),
    syncSkillsDirectory(),
    syncCuratedGithubSkills(),
  ]);

  const mcpSummary = [];
  for (const source of [official, glama, ghMcp]) {
    mcpSummary.push(await upsertMcpSource(source));
  }
  const skillSummary = await upsertSkills([...skillsDir, ...curatedSkills]);

  console.log(JSON.stringify({
    synced_at: new Date().toISOString(),
    mcp: mcpSummary,
    skills: skillSummary,
  }, null, 2));
}

main().catch((err) => {
  console.error("Marketplace sync failed:", err);
  process.exit(1);
});
