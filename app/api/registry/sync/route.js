import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const REGISTRY_URL = "https://registry.modelcontextprotocol.io/v0.1/servers";
const SOURCE_ID = "official-mcp-registry";
const PAGE_SIZE = 100;
const MAX_PAGES_PER_RUN = 5;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function normalizeRecord(entry) {
  const server = entry?.server ?? entry;
  const officialMeta = entry?._meta?.["io.modelcontextprotocol.registry/official"] ?? {};
  const name = server?.name;
  const version = server?.version;
  if (!name || !version) return null;

  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const packages = Array.isArray(server.packages) ? server.packages : [];
  const transports = [
    ...remotes.map((remote) => remote?.type || "streamable_http"),
    ...packages.map((pkg) => pkg?.transport?.type || "stdio"),
  ];

  return {
    id: `${name}@${version}`,
    server_name: name,
    version,
    title: server.title || name,
    description: server.description || "",
    repository_url: server.repository?.url || null,
    website_url: server.websiteUrl || null,
    transport_types: [...new Set(transports)],
    packages,
    remotes,
    registry_metadata: entry?._meta || {},
    source_id: SOURCE_ID,
    source_status: officialMeta.status || "active",
    trust_level: "unverified",
    is_latest: officialMeta.isLatest === true,
    published_at: server.updatedAt || server.createdAt || null,
    updated_at: new Date().toISOString(),
  };
}

export async function POST(request) {
  const expected = process.env.REGISTRY_SYNC_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !supplied || supplied.length !== expected.length) {
    return json({ error: "Unauthorized" }, 401);
  }
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  if (mismatch !== 0) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return json({ error: "Server database credentials are not configured" }, 503);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: run, error: runError } = await supabase
    .from("mcp_registry_sync_runs")
    .insert({ source_id: SOURCE_ID, status: "running" })
    .select("id")
    .single();
  if (runError) return json({ error: "Could not start sync run", detail: runError.message }, 500);

  let cursor = null;
  let pagesFetched = 0;
  let recordsSeen = 0;
  let recordsUpserted = 0;
  let nextCursor = null;

  try {
    while (pagesFetched < MAX_PAGES_PER_RUN) {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), version: "latest" });
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`${REGISTRY_URL}?${params}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(12000),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`Official registry returned HTTP ${response.status}`);
      const payload = await response.json();
      const entries = Array.isArray(payload.servers) ? payload.servers : [];
      pagesFetched += 1;
      recordsSeen += entries.length;

      const rows = entries.map(normalizeRecord).filter(Boolean);
      if (rows.length) {
        const { error } = await supabase.from("mcp_servers").upsert(rows, { onConflict: "server_name,version" });
        if (error) throw new Error(`Database upsert failed: ${error.message}`);
        recordsUpserted += rows.length;
      }

      nextCursor = payload.metadata?.nextCursor || null;
      if (!nextCursor) break;
      cursor = nextCursor;
    }

    const status = nextCursor ? "partial" : "success";
    await supabase.from("mcp_registry_sources").update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_error: null,
      updated_at: new Date().toISOString(),
    }).eq("id", SOURCE_ID);

    await supabase.from("mcp_registry_sync_runs").update({
      status, pages_fetched: pagesFetched, records_seen: recordsSeen,
      records_upserted: recordsUpserted, finished_at: new Date().toISOString(),
    }).eq("id", run.id);

    return json({ status, pagesFetched, recordsSeen, recordsUpserted, hasMore: Boolean(nextCursor), nextCursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sync error";
    await supabase.from("mcp_registry_sources").update({
      last_sync_status: "failed", last_sync_error: message, updated_at: new Date().toISOString(),
    }).eq("id", SOURCE_ID);
    await supabase.from("mcp_registry_sync_runs").update({
      status: "failed", pages_fetched: pagesFetched, records_seen: recordsSeen,
      records_upserted: recordsUpserted, error_message: message, finished_at: new Date().toISOString(),
    }).eq("id", run.id);
    return json({ error: message, pagesFetched, recordsSeen, recordsUpserted }, 502);
  }
}
