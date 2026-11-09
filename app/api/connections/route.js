import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function getUserClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return { error: json({ error: "Authentication is not configured" }, 503) };
  if (!token) return { error: json({ error: "Sign in is required" }, 401) };
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { error: json({ error: "Invalid session" }, 401) };
  return { supabase, user };
}

export async function GET(request) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;
  const { data, error } = await auth.supabase
    .from("user_mcp_connections")
    .select("id,registry_server_id,custom_server_id,enabled,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false });
  if (error) return json({ error: "Could not load MCP settings" }, 400);
  const registryIds = (data || []).map((row) => row.registry_server_id).filter(Boolean);
  const customIds = (data || []).map((row) => row.custom_server_id).filter(Boolean);
  const [registryResult, customResult] = await Promise.all([
    registryIds.length ? auth.supabase.from("mcp_servers").select("id,server_name,title,description,version,repository_url,transport_types,remotes").in("id", registryIds) : Promise.resolve({ data: [], error: null }),
    customIds.length ? auth.supabase.from("user_custom_mcp_servers").select("id,display_name,endpoint_url,status,transport").in("id", customIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (registryResult.error || customResult.error) return json({ error: "Could not load MCP details" }, 400);
  const registryById = new Map((registryResult.data || []).map((item) => [item.id, item]));
  const customById = new Map((customResult.data || []).map((item) => [item.id, item]));
  const connections = (data || []).map((row) => ({ ...row, server: row.registry_server_id ? registryById.get(row.registry_server_id) || null : customById.get(row.custom_server_id) || null, kind: row.registry_server_id ? "registry" : "custom" }));
  return json({ connections });
}

export async function POST(request) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  let registryServerId = typeof body.registryServerId === "string" ? body.registryServerId : null;
  const customServerId = typeof body.customServerId === "string" ? body.customServerId : null;

  // Discover catalog entries come directly from the public registry. Import the
  // exact selected entry on demand before creating the per-user connection.
  if (!registryServerId && body.registryEntry && typeof body.registryEntry === "object") {
    const entry = body.registryEntry;
    const server = entry.server || entry;
    const name = typeof server.name === "string" ? server.name : "";
    const version = typeof server.version === "string" ? server.version : "";
    const remotes = Array.isArray(server.remotes) ? server.remotes : [];
    const packages = Array.isArray(server.packages) ? server.packages : [];
    if (!name || !version) return json({ error: "Registry entry is missing its name or version" }, 400);
    if (!remotes.length) return json({ error: "This MCP has no supported remote endpoint. Local STDIO packages cannot be connected from the hosted workspace." }, 409);

    const sourceUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!sourceUrl || !serviceKey) return json({ error: "Registry import is not configured on the server" }, 503);
    const admin = createClient(sourceUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { error: sourceError } = await admin.from("mcp_registry_sources").upsert({
      id: "official-mcp-registry",
      name: "Official MCP Registry",
      base_url: "https://registry.modelcontextprotocol.io",
      source_type: "official_registry",
      enabled: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });
    if (sourceError) return json({ error: "Could not initialize the official MCP registry source", detail: sourceError.message }, 500);

    const officialMeta = entry._meta?.["io.modelcontextprotocol.registry/official"] || {};
    const repository = server.repository?.url || server.repository || null;
    const row = {
      id: `${name}@${version}`,
      server_name: name,
      version,
      title: server.title || name,
      description: server.description || "",
      repository_url: typeof repository === "string" ? repository : repository?.url || null,
      website_url: server.websiteUrl || null,
      transport_types: [...new Set([
        ...remotes.map((remote) => remote?.type || "streamable_http"),
        ...packages.map((pkg) => pkg?.transport?.type || "stdio"),
      ])],
      packages,
      remotes,
      registry_metadata: entry._meta || {},
      source_id: "official-mcp-registry",
      source_status: officialMeta.status || "active",
      trust_level: "unverified",
      is_latest: officialMeta.isLatest === true,
      published_at: server.updatedAt || server.createdAt || null,
      updated_at: new Date().toISOString(),
    };
    const { data: imported, error: importError } = await admin
      .from("mcp_servers")
      .upsert(row, { onConflict: "server_name,version" })
      .select("id")
      .single();
    if (importError || !imported) return json({ error: "Could not import this MCP into the DRIVE registry", detail: importError?.message }, 400);
    registryServerId = imported.id;
  }

  if (Boolean(registryServerId) === Boolean(customServerId)) {
    return json({ error: "Provide exactly one registryServerId, registryEntry, or customServerId" }, 400);
  }

  if (registryServerId) {
    const { data: server, error } = await auth.supabase
      .from("mcp_servers").select("id,remotes").eq("id", registryServerId).maybeSingle();
    if (error || !server) return json({ error: "MCP server was not found after registry import" }, 404);
    if (!Array.isArray(server.remotes) || server.remotes.length === 0) {
      return json({ error: "This registry entry has no remote endpoint and cannot be enabled as a connection" }, 409);
    }
  } else {
    const { data: server, error } = await auth.supabase
      .from("user_custom_mcp_servers").select("id,status").eq("id", customServerId).maybeSingle();
    if (error || !server) return json({ error: "Custom MCP server was not found" }, 404);
    if (server.status !== "verified") return json({ error: "Verify this custom endpoint before enabling it" }, 409);
  }

  const payload = {
    user_id: auth.user.id,
    registry_server_id: registryServerId,
    custom_server_id: customServerId,
    enabled: false,
  };
  const { data, error } = await auth.supabase
    .from("user_mcp_connections").upsert(payload, {
      onConflict: registryServerId ? "user_id,registry_server_id" : "user_id,custom_server_id",
    }).select("id,registry_server_id,custom_server_id,enabled").single();
  if (error) return json({ error: "Could not add MCP to your connections", detail: error.message }, 400);
  return json({ connection: data }, 201);
}

export async function PATCH(request) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
  if (typeof body.id !== "string" || typeof body.enabled !== "boolean") {
    return json({ error: "Provide connection id and boolean enabled value" }, 400);
  }

  const { data: current, error: lookupError } = await auth.supabase
    .from("user_mcp_connections")
    .select("id,registry_server_id,custom_server_id")
    .eq("id", body.id).eq("user_id", auth.user.id).maybeSingle();
  if (lookupError || !current) return json({ error: "Connection was not found" }, 404);

  if (body.enabled && current.registry_server_id) {
    const { data: server } = await auth.supabase
      .from("mcp_servers").select("remotes").eq("id", current.registry_server_id).maybeSingle();
    if (!Array.isArray(server?.remotes) || server.remotes.length === 0) {
      return json({ error: "This server has no supported remote endpoint" }, 409);
    }
  }
  if (body.enabled && current.custom_server_id) {
    const { data: server } = await auth.supabase
      .from("user_custom_mcp_servers").select("status").eq("id", current.custom_server_id).maybeSingle();
    if (server?.status !== "verified") return json({ error: "Verify this endpoint before enabling it" }, 409);
  }

  const { data, error } = await auth.supabase
    .from("user_mcp_connections")
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq("id", body.id).eq("user_id", auth.user.id)
    .select("id,registry_server_id,custom_server_id,enabled,updated_at").single();
  if (error) return json({ error: "Could not update MCP setting" }, 400);
  return json({ connection: data });
}
