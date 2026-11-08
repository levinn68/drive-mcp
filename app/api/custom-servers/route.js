import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function response(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isPublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;
    if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(host)) return false;
    if (host === "0.0.0.0" || host === "::1" || host.startsWith("fc") || host.startsWith("fd")) return false;
    return true;
  } catch {
    return false;
  }
}

export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return response({ error: "Authentication is not configured" }, 503);

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return response({ error: "Sign in is required" }, 401);

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return response({ error: "Invalid session" }, 401);

  let body;
  try { body = await request.json(); } catch { return response({ error: "Invalid JSON body" }, 400); }
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const endpointUrl = typeof body.endpointUrl === "string" ? body.endpointUrl.trim() : "";
  const authType = ["none", "bearer", "oauth2", "custom_header"].includes(body.authType) ? body.authType : "none";
  if (displayName.length < 2 || displayName.length > 80) return response({ error: "Name must be between 2 and 80 characters" }, 400);
  if (!isPublicHttpsUrl(endpointUrl)) return response({ error: "Use a public HTTPS endpoint. Local and private network addresses are not allowed." }, 400);
  if (authType !== "none") return response({ error: "Credential setup is not enabled yet. Add the endpoint without credentials first." }, 400);

  const { data, error } = await supabase.from("user_custom_mcp_servers").insert({
    user_id: user.id,
    display_name: displayName,
    endpoint_url: endpointUrl,
    transport: "streamable_http",
    auth_type: authType,
    status: "pending",
  }).select("id,display_name,endpoint_url,transport,status,created_at").single();
  if (error) return response({ error: "Could not save custom server", detail: error.message }, 400);
  return response({ server: data }, 201);
}
