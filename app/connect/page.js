import { createClient } from "@supabase/supabase-js";
import ConnectGateway from "../../components/connect-gateway";
import "./connect.css";

export const dynamic = "force-dynamic";

const MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";

async function lookupSupabase(term, exactName) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !term) return [];
  try {
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const safeLike = term.replace(/[%_,()]/g, " ").trim();
    const query = exactName
      ? supabase
          .from("mcp_servers")
          .select("server_name,title,description,version,repository_url,remotes,packages,source_id")
          .eq("server_name", exactName)
          .limit(5)
      : supabase
          .from("mcp_servers")
          .select("server_name,title,description,version,repository_url,remotes,packages,source_id")
          .or(`server_name.ilike.%${safeLike}%,title.ilike.%${safeLike}%,description.ilike.%${safeLike}%`)
          .order("is_latest", { ascending: false })
          .limit(8);
    const { data } = await query;
    return (data || []).map((row) => ({
      server: {
        name: row.server_name,
        title: row.title || row.server_name,
        description: row.description || "",
        version: row.version || "latest",
        repository: row.repository_url ? { url: row.repository_url } : null,
        remotes: Array.isArray(row.remotes) ? row.remotes : [],
        packages: Array.isArray(row.packages) ? row.packages : [],
      },
      source_id: row.source_id || "drive-index",
    }));
  } catch {
    return [];
  }
}

async function lookupRegistry(term, exactName) {
  if (!term) return { exact: null, candidates: [], error: null };
  const merged = new Map();
  let errorMsg = null;

  const dbEntries = await lookupSupabase(term, exactName);
  for (const entry of dbEntries) {
    if (entry.server?.name) merged.set(entry.server.name, entry);
  }

  try {
    const url = new URL(MCP_REGISTRY);
    url.searchParams.set("search", term);
    url.searchParams.set("limit", "20");
    url.searchParams.set("version", "latest");
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "DRIVE-MCP/1.3" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (response.ok) {
      const payload = await response.json();
      for (const entry of Array.isArray(payload.servers) ? payload.servers : []) {
        const name = (entry.server || entry)?.name;
        if (name && !merged.has(name)) merged.set(name, entry);
      }
    } else if (!merged.size) {
      errorMsg = `Official MCP Registry returned HTTP ${response.status}`;
    }
  } catch (error) {
    if (!merged.size) errorMsg = error?.message || "Could not reach Official MCP Registry";
  }

  const candidates = [...merged.values()].slice(0, 8);
  const exact = exactName
    ? candidates.find((entry) => (entry.server || entry)?.name === exactName) || null
    : candidates.find((entry) => (entry.server || entry)?.name?.toLowerCase() === term.toLowerCase()) || null;
  return { exact, candidates, error: errorMsg };
}

export default async function ConnectPage({ searchParams }) {
  const params = await searchParams;
  const serverParam = typeof params?.server === "string" ? params.server.trim() : "";
  const queryParam = typeof params?.query === "string" ? params.query.trim() : "";
  const endpointParam = typeof params?.endpoint === "string" ? params.endpoint.trim() : "";
  const term = serverParam || queryParam;

  const { exact, candidates, error } = await lookupRegistry(term, serverParam || null);

  return (
    <ConnectGateway
      key={`${serverParam}|${queryParam}|${endpointParam}`}
      serverParam={serverParam}
      queryParam={queryParam}
      endpointParam={endpointParam}
      initialEntry={exact || (candidates.length === 1 ? candidates[0] : null)}
      candidates={candidates}
      lookupError={error}
    />
  );
}
