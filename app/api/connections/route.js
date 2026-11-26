import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MCP_REGISTRY = "https://registry.modelcontextprotocol.io/v0.1/servers";

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function getUserClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { error: json({ error: "Supabase auth is not configured" }, 503) };
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")?.trim();
  if (!token) return { error: json({ error: "Sign in required" }, 401) };
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return { error: json({ error: "Session expired. Please sign in again." }, 401) };
  return { supabase, user };
}

async function fetchRegistryEntryByName(serverName) {
  const url = new URL(MCP_REGISTRY);
  url.searchParams.set("search", serverName);
  url.searchParams.set("limit", "100");
  url.searchParams.set("version", "latest");
  const upstream = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "DRIVE-MCP/4.2" },
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
  const name = typeof server.name === "string" ? server.name.trim() : "";
  const version = typeof server.version === "string" && server.version.trim() ? server.version.trim() : "latest";
  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const packages = Array.isArray(server.packages) ? server.packages : [];
  if (!name) return { error: json({ error: "Registry entry is missing its name" }, 400) };

  const { data: existingServer } = await auth.supabase
    .from("mcp_servers")
    .select("id,remotes")
    .eq("server_name", name)
    .eq("version", version)
    .maybeSingle();
  if (existingServer?.id) return { registryServerId: existingServer.id };

  const sourceUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  const repository = server.repository?.url || server.repository || null;
  const repoUrl = typeof repository === "string" ? repository : repository?.url || null;

  if (sourceUrl && serviceKey) {
    const admin = createClient(sourceUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const officialMeta = entry._meta?.["io.modelcontextprotocol.registry/official"] || {};
    const transportTypes = [
      ...new Set([
        ...remotes.map((remote) => remote?.type || "streamable_http"),
        ...packages.map((pkg) => pkg?.transport?.type || "stdio"),
      ]),
    ];
    if (!transportTypes.length) transportTypes.push("stdio");

    const row = {
      id: `${name}@${version}`,
      server_name: name,
      version,
      title: server.title || name,
      description: server.description || "",
      repository_url: repoUrl,
      website_url: server.websiteUrl || null,
      transport_types: transportTypes,
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
    if (!importError && imported?.id) {
      return { registryServerId: imported.id };
    }
  }

  // Fallback: save directly in user_custom_mcp_servers if admin upsert is unavailable
  const fallbackEndpoint =
    remotes.find((r) => typeof r?.url === "string" && r.url.startsWith("https://"))?.url ||
    (repoUrl && repoUrl.startsWith("https://") ? repoUrl : "");

  if (fallbackEndpoint) {
    const { data: existingCustom } = await auth.supabase
      .from("user_custom_mcp_servers")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("endpoint_url", fallbackEndpoint)
      .maybeSingle();
    if (existingCustom?.id) return { customServerId: existingCustom.id };

    const { data: createdCustom, error: customErr } = await auth.supabase
      .from("user_custom_mcp_servers")
      .insert({
        user_id: auth.user.id,
        display_name: server.title || name,
        endpoint_url: fallbackEndpoint,
        transport: remotes.length ? "streamable_http" : "stdio",
        auth_type: "none",
        status: "verified",
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (!customErr && createdCustom?.id) {
      return { customServerId: createdCustom.id };
    }
  }

  return {
    error: json(
      {
        error: "Could not import this MCP into your DRIVE workspace. Verify SUPABASE_SERVICE_ROLE_KEY in environment variables.",
      },
      503
    ),
  };
}

export async function GET(request) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;
  const { data, error } = await auth.supabase
    .from("user_mcp_connections")
    .select("id,registry_server_id,custom_server_id,enabled,created_at,updated_at")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false });
  if (error) return json({ error: "Could not load your MCP connections" }, 400);

  const registryIds = (data || []).map((row) => row.registry_server_id).filter(Boolean);
  const customIds = (data || []).map((row) => row.custom_server_id).filter(Boolean);
  const [registryResult, customResult] = await Promise.all([
    registryIds.length
      ? auth.supabase
          .from("mcp_servers")
          .select("id,server_name,title,description,version,repository_url,transport_types,remotes")
          .in("id", registryIds)
      : Promise.resolve({ data: [], error: null }),
    customIds.length
      ? auth.supabase
          .from("user_custom_mcp_servers")
          .select("id,display_name,endpoint_url,status,transport")
          .in("id", customIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (registryResult.error || customResult.error) return json({ error: "Could not load MCP details" }, 400);
  const registryById = new Map((registryResult.data || []).map((item) => [item.id, item]));
  const customById = new Map((customResult.data || []).map((item) => [item.id, item]));
  const connections = (data || []).map((row) => ({
    ...row,
    server: row.registry_server_id
      ? registryById.get(row.registry_server_id) || null
      : customById.get(row.custom_server_id) || null,
    kind: row.registry_server_id ? "registry" : "custom",
  }));
  return json({ connections });
}

export async function POST(request) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  let registryServerId = typeof body.registryServerId === "string" ? body.registryServerId : null;
  let customServerId = typeof body.customServerId === "string" ? body.customServerId : null;
  const serverName = typeof body.serverName === "string" ? body.serverName.trim() : "";
  const version = typeof body.version === "string" ? body.version.trim() : "";
  const desiredEnabled = typeof body.enabled === "boolean" ? body.enabled : true;

  if (!registryServerId && !customServerId && body.registryEntry && typeof body.registryEntry === "object") {
    const imported = await importRegistryEntry(auth, body.registryEntry);
    if (imported.error) return imported.error;
    registryServerId = imported.registryServerId || null;
    customServerId = imported.customServerId || null;
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
      registryServerId = imported.registryServerId || null;
      customServerId = imported.customServerId || null;
    }
  }

  if (Boolean(registryServerId) === Boolean(customServerId)) {
    return json({ error: "Provide exactly one registryServerId, registryEntry, serverName, or customServerId" }, 400);
  }

  if (registryServerId) {
    const { data: server, error } = await auth.supabase
      .from("mcp_servers")
      .select("id,remotes")
      .eq("id", registryServerId)
      .maybeSingle();
    if (error || !server) return json({ error: "MCP server was not found after registry import" }, 404);
  } else {
    const { data: server, error } = await auth.supabase
      .from("user_custom_mcp_servers")
      .select("id,status")
      .eq("id", customServerId)
      .maybeSingle();
    if (error || !server) return json({ error: "Custom MCP server was not found" }, 404);
    if (server.status !== "verified") return json({ error: "Verify this custom endpoint before enabling it" }, 409);
  }

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
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!id || typeof body.enabled !== "boolean") {
    return json({ error: "Provide connection id and boolean enabled" }, 400);
  }
  const { data, error } = await auth.supabase
    .from("user_mcp_connections")
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id,registry_server_id,custom_server_id,enabled,updated_at")
    .single();
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
