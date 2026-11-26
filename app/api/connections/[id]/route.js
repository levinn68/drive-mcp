import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function PATCH(request, context) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;

  const params = await context.params;
  const id = typeof params?.id === "string" ? params.id.trim() : "";
  if (!id) return json({ error: "Missing connection id" }, 400);

  let body = {};
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (typeof body.enabled !== "boolean") {
    return json({ error: "Provide boolean enabled field" }, 400);
  }

  const { data, error } = await auth.supabase
    .from("user_mcp_connections")
    .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.user.id)
    .select("id,registry_server_id,custom_server_id,enabled,updated_at")
    .maybeSingle();

  if (error) return json({ error: "Could not update MCP setting", detail: error.message }, 400);
  if (!data) return json({ error: "MCP connection not found" }, 404);
  return json({ connection: data });
}

export async function DELETE(request, context) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;

  const params = await context.params;
  const id = typeof params?.id === "string" ? params.id.trim() : "";
  if (!id) return json({ error: "Missing connection id" }, 400);

  const { error } = await auth.supabase
    .from("user_mcp_connections")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) return json({ error: "Could not remove MCP connection", detail: error.message }, 400);
  return json({ deleted: true, id });
}
