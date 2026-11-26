import { createClient } from "@supabase/supabase-js";
import MarketplaceExplorer from "../../components/marketplace-explorer";
import "./marketplace.css";

export const dynamic = "force-dynamic";

const MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";
const SKILLS_REGISTRY = "https://www.skillsdirectory.com/api/registry";

async function loadMcpCatalog() {
  const merged = new Map();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data } = await supabase
        .from("mcp_servers")
        .select("server_name,title,description,version,repository_url,remotes,source_id")
        .order("is_latest", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(120);
      for (const row of data || []) {
        const remotes = Array.isArray(row.remotes) ? row.remotes : [];
        const remoteReady = remotes.some((r) => typeof r?.url === "string" && r.url.startsWith("https://"));
        merged.set(row.server_name, {
          name: row.server_name,
          title: row.title || row.server_name,
          description: row.description || "",
          version: row.version || "latest",
          repositoryUrl: row.repository_url || null,
          source: row.source_id || "drive-index",
          remoteReady,
        });
      }
    } catch {}
  }

  if (merged.size < 40) {
    try {
      const res = await fetch(`${MCP_REGISTRY}?limit=60&version=latest`, {
        headers: { accept: "application/json", "user-agent": "DRIVE-MCP/1.3" },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const payload = await res.json();
        for (const entry of payload.servers || []) {
          const s = entry.server || entry;
          if (!s?.name || merged.has(s.name)) continue;
          const remotes = Array.isArray(s.remotes) ? s.remotes : [];
          const remoteReady = remotes.some((r) => typeof r?.url === "string" && r.url.startsWith("https://"));
          merged.set(s.name, {
            name: s.name,
            title: s.title || s.name,
            description: s.description || "",
            version: s.version || "latest",
            repositoryUrl: s.repository?.url || null,
            source: "official-mcp-registry",
            remoteReady,
          });
        }
      }
    } catch {}
  }

  return [...merged.values()].sort((a, b) => Number(b.remoteReady) - Number(a.remoteReady));
}

async function loadSkillsCatalog() {
  const merged = new Map();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (url && key) {
    try {
      const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
      const { data } = await supabase
        .from("skill_catalog")
        .select("id,slug,name,description,category,author,repository,source_url,source_id,stars,verified")
        .order("verified", { ascending: false })
        .order("stars", { ascending: false })
        .limit(120);
      for (const item of data || []) {
        merged.set(item.id, {
          id: item.id,
          slug: item.slug,
          name: item.name,
          description: item.description || "",
          category: item.category || "other",
          author: item.author || null,
          sourceUrl: item.source_url || `https://github.com/${item.repository}`,
          source: item.source_id || "drive-index",
          stars: Number(item.stars || 0),
          verified: Boolean(item.verified),
        });
      }
    } catch {}
  }

  if (merged.size < 40) {
    try {
      const res = await fetch(`${SKILLS_REGISTRY}?limit=60&offset=0&sort=stars`, {
        headers: { accept: "application/json", "user-agent": "DRIVE-MCP/1.3" },
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const payload = await res.json();
        for (const item of payload.skills || payload.data || []) {
          if (!item?.repository || !item?.slug || !item?.name) continue;
          const id = `${item.repository}/${item.slug}`;
          if (merged.has(id)) continue;
          merged.set(id, {
            id,
            slug: item.slug,
            name: item.name,
            description: item.description || "",
            category: item.category || "other",
            author: item.author || item.repository.split("/")[0] || null,
            sourceUrl: `https://github.com/${item.repository}`,
            source: "skillsdirectory",
            stars: Number(item.stars || 0),
            verified: Boolean(item.verified),
          });
        }
      }
    } catch {}
  }

  return [...merged.values()];
}

export default async function MarketplacePage({ searchParams }) {
  const params = await searchParams;
  const initialTab = params?.tab === "skills" ? "skills" : "mcp";
  const initialQuery = typeof params?.q === "string" ? params.q.trim() : "";

  const [mcps, skills] = await Promise.all([loadMcpCatalog(), loadSkillsCatalog()]);

  return (
    <MarketplaceExplorer
      initialTab={initialTab}
      initialQuery={initialQuery}
      mcps={mcps}
      skills={skills}
    />
  );
}
