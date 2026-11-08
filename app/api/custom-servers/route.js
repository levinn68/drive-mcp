import { createClient } from "@supabase/supabase-js";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

export const runtime = "nodejs";

function response(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function isPrivateIPv4(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0);
}

function isPrivateIPv6(address) {
  const value = address.toLowerCase().split("%")[0];
  if (value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") ||
      value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") ||
      value.startsWith("feb") || value.startsWith("ff") || value.startsWith("2001:db8:")) return true;
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIPv4(mapped[1]) : false;
}

async function isPublicHttpsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return false;

    const ipVersion = isIP(host);
    if (ipVersion === 4) return !isPrivateIPv4(host);
    if (ipVersion === 6) return !isPrivateIPv6(host);

    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length) return false;
    return addresses.every(({ address, family }) =>
      family === 4 ? !isPrivateIPv4(address) : !isPrivateIPv6(address)
    );
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
  if (!await isPublicHttpsUrl(endpointUrl)) {
    return response({ error: "Use a public HTTPS endpoint. Private, local and unresolved hosts are not allowed." }, 400);
  }
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
