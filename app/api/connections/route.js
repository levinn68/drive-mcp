import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";

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

async function fetchRegistryEntryByName(serverName) {
  const url = new URL(MCP_REGISTRY);
  url.searchParams.set("search", serverName);
  url.searchParams.set("limit", "100");
  url.searchParams.set("version", "latest");
  const upstream = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "DRIVE-MCP/1.2" },
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(12000),
  });
  if (!upstream.ok) return null;
  const payload = await upstream.json();
  const entries = payload.servers || [];
  return entries.find((entry) => (entry.server || entry).name === serverName) || null;
}

async function importRegistryEntry(auth, entry) {
  const server = entry.server || entry;
  const name = typeof server.name === "string" ? server.name : "";
  const version = typeof server.version === "string" ? server.version : "";
  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const packages = Array.isArray(server.packages) ? server.packages : [];
  if (!name || !version) return { error: json({ error: "Registry entry is missing its name or version" }, 400) };
  if (!remotes.length) {
    return { error: json({ error: "This MCP has no supported remote endpoint. Local STDIO packages cannot be connected from the hosted workspace." }, 409) };
  }

  // Avoid needing the server-side admin key if this exact registry version is already in mcp_servers.
  const { data: existingServer } = await auth.supabase
    .from("mcp_servers")
    .select("id,remotes")
    .eq("server_name", name)
    .eq("version", version)
    .maybeSingle();
  if (existingServer?.id) return { registryServerId: existingServer.id };

  const sourceUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sourceUrl || !serviceKey) {
    return { error: json({ error: "Registry import is not configured on the server. Set SUPABASE_SERVICE_ROLE_KEY in environment variables." }, 503) };
  }
  const admin = createClient(sourceUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
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
  if (importError || !imported) {
    const detail = importError?.message || "Unknown database error";
    if (/invalid api key|invalid jwt|jwt expired/i.test(detail)) {
      return {
        error: json({
          error: "The server-side Supabase key configured in Vercel is invalid or expired. Update SUPABASE_SERVICE_ROLE_KEY in Vercel Production Environment Variables, then redeploy.",
          code: "SUPABASE_ADMIN_KEY_INVALID",
        }, 503),
      };
    }
    return { error: json({ error: "Could not import this MCP into the DRIVE registry", detail }, 400) };
  }
  return { registryServerId: imported.id };
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
    registryIds.length
      ? auth.supabase.from("mcp_servers").select("id,server_name,title,description,version,repository_url,transport_types,remotes").in("id", registryIds)
      : Promise.resolve({ data: [], error: null }),
    customIds.length
      ? auth.supabase.from("user_custom_mcp_servers").select("id,display_name,endpoint_url,status,transport").in("id", customIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (registryResult.error || customResult.error) return json({ error: "Could not load MCP details" }, 400);
  const registryById = new Map((registryResult.data || []).map((item) => [item.id, item]));
  const customById = new Map((customResult.data || []).map((item) => [item.id, item]));
  const connections = (data || []).map((row) => ({
    ...row,
    server: row.registry_server_id ? registryById.get(row.registry_server_id) || null : customById.get(row.custom_server_id) || null,
    kind: row.registry_server_id ? "registry" : "custom",
  }));
  return json({ connections });
}

export async function POST(request) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  let registryServerId = typeof body.registryServerId === "string" ? body.registryServerId : null;
  const customServerId = typeof body.customServerId === "string" ? body.customServerId : null;
  const serverName = typeof body.serverName === "string" ? body.serverName.trim() : "";
  const version = typeof body.version === "string" ? body.version.trim() : "";
  const desiredEnabled = typeof body.enabled === "boolean" ? body.enabled : false;

  if (!registryServerId && !customServerId && body.registryEntry && typeof body.registryEntry === "object") {
    const imported = await importRegistryEntry(auth, body.registryEntry);
    if (imported.error) return imported.error;
    registryServerId = imported.registryServerId;
  } else if (!registryServerId && !customServerId && serverName) {
    let lookup = auth.supabase.from("mcp_servers").select("id").eq("server_name", serverName);
    if (version) lookup = lookup.eq("version", version);
    const { data: match } = await lookup.order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (match?.id) {
      registryServerId = match.id;
    } else {
      const liveEntry = await fetchRegistryEntryByName(serverName);
      if (!liveEntry) return json({ error: `MCP server "${serverName}" was not found in the Official MCP Registry` }, 404);
      const imported = await importRegistryEntry(auth, liveEntry);
      if (imported.error) return imported.error;
      registryServerId = imported.registryServerId;
    }
  }

  if (Boolean(registryServerId) === Boolean(customServerId)) {
    return json({ error: "Provide exactly one registryServerId, registryEntry, serverName, or customServerId" }, 400);
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

  // Use explicit lookup + update/insert instead of ON CONFLICT on partial unique indexes.
  let existingQuery = auth.supabase
    .from("user_mcp_connections")
    .select("id,enabled")
    .eq("user_id", auth.user.id);
  existingQuery = registryServerId
    ? existingQuery.eq("registry_server_id", registryServerId)
    : existingQuery.eq("custom_server_id", customServerId);
  const { data: existing, error: existingError } = await existingQuery.maybeSingle();
  if (existingError) return json({ error: "Could not check existing MCP connection", detail: existingError.message }, 400);

  if (existing?.id) {
    const nextEnabled = typeof body.enabled === "boolean" ? body.enabled : existing.enabled;
    const { data, error } = await auth.supabase
      .from("user_mcp_connections")
      .update({ enabled: nextEnabled, updated_at: new Date().toISOString() })
      .eq("id", existing.id)
      .eq("user_id", auth.user.id)
      .select("id,registry_server_id,custom_server_id,enabled,updated_at")
      .single();
    if (error) return json({ error: "Could not update existing MCP connection", detail: error.message }, 400);
    return json({ connection: data, existed: true }, 200);
  }

  const payload = {
    user_id: auth.user.id,
    registry_server_id: registryServerId,
    custom_server_id: customServerId,
    enabled: desiredEnabled,
  };
  const { data, error } = await auth.supabase
    .from("user_mcp_connections")
    .insert(payload)
    .select("id,registry_server_id,custom_server_id,enabled")
    .single();
  if (error) return json({ error: "Could not add MCP to your connections", detail: error.message }, 400);
  return json({ connection: data, existed: false }, 201);
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

export async function DELETE(request) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  let id = searchParams.get("id");
  if (!id) {
    try {
      const body = await request.json();
      if (typeof body?.id === "string") id = body.id;
    } catch {}
  }
  if (!id) return json({ error: "Provide connection id to remove" }, 400);

  const { error } = await auth.supabase
    .from("user_mcp_connections")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);
  if (error) return json({ error: "Could not remove MCP connection", detail: error.message }, 400);
  return json({ deleted: true, id });
}
