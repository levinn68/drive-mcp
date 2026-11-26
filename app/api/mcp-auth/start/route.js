import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function base64Url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function isSafeHttpsUrl(raw) {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

async function getUserClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return { error: NextResponse.json({ error: "Auth not configured" }, { status: 503 }) };
  if (!token) return { error: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return { error: NextResponse.json({ error: "Invalid session" }, { status: 401 }) };
  return { supabase, user, token };
}

async function fetchJsonSafe(url) {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "DRIVE-MCP-Gateway/2.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(6500),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function discoverUpstreamOAuth(endpointUrl) {
  const target = new URL(endpointUrl);
  const origin = target.origin;

  // Step 1: Probe MCP endpoint directly to see if it works without auth or returns WWW-Authenticate
  let wwwAuth = "";
  try {
    const probe = await fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "DRIVE MCP", version: "2.0" },
        },
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (probe.ok) {
      return { mode: "none", verified: true };
    }
    wwwAuth = probe.headers.get("www-authenticate") || "";
  } catch {}

  // Step 2: RFC 9728 Protected Resource Metadata discovery
  let resourceMetaUrl = "";
  const match = wwwAuth.match(/resource_metadata="([^"]+)"/i);
  if (match && isSafeHttpsUrl(match[1])) {
    resourceMetaUrl = match[1];
  }

  const prmCandidates = [
    resourceMetaUrl,
    `${origin}/.well-known/oauth-protected-resource${target.pathname.replace(/\/$/, "")}`,
    `${origin}/.well-known/oauth-protected-resource`,
  ].filter(Boolean);

  let authServerOrigin = origin;
  let scopesSupported = [];
  for (const candidate of prmCandidates) {
    const prm = await fetchJsonSafe(candidate);
    if (prm && Array.isArray(prm.authorization_servers) && prm.authorization_servers[0]) {
      authServerOrigin = prm.authorization_servers[0].replace(/\/$/, "");
      if (Array.isArray(prm.scopes_supported)) scopesSupported = prm.scopes_supported;
      break;
    }
  }

  // Step 3: RFC 8414 Authorization Server Metadata discovery
  const asCandidates = [
    `${authServerOrigin}/.well-known/oauth-authorization-server`,
    `${authServerOrigin}/.well-known/openid-configuration`,
    `${origin}/.well-known/oauth-authorization-server`,
  ];

  let metadata = null;
  for (const candidate of asCandidates) {
    const doc = await fetchJsonSafe(candidate);
    if (doc?.authorization_endpoint && doc?.token_endpoint) {
      metadata = doc;
      break;
    }
  }

  if (!metadata) {
    return {
      mode: "bearer",
      message: "MCP ini menggunakan API Key / Bearer Token (tidak menyediakan OAuth otomatis).",
    };
  }

  return {
    mode: "oauth",
    metadata,
    scopes: scopesSupported.length
      ? scopesSupported.slice(0, 6).join(" ")
      : Array.isArray(metadata.scopes_supported)
      ? metadata.scopes_supported.slice(0, 6).join(" ")
      : "",
  };
}

export async function POST(request) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const connectionId = String(body.connectionId || "").trim();
  const endpointUrl = String(body.endpointUrl || "").trim();
  const serverTitle = String(body.serverTitle || "MCP Server").trim().slice(0, 100);
  const bearerToken = typeof body.bearerToken === "string" ? body.bearerToken.trim() : "";

  if (!connectionId || !isSafeHttpsUrl(endpointUrl)) {
    return NextResponse.json(
      { error: "Valid connectionId and HTTPS endpointUrl are required." },
      { status: 400 }
    );
  }

  // Direct Bearer / API Key save mode
  if (bearerToken) {
    const { error } = await auth.supabase
      .from("user_mcp_connections")
      .update({
        enabled: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId)
      .eq("user_id", auth.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const res = NextResponse.json({ mode: "bearer_saved", authorized: true });
    res.cookies.set(`drive_mcp_tok_${connectionId.slice(0, 12)}`, bearerToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  // OAuth 2.1 Discovery & Dynamic Client Registration
  const discovery = await discoverUpstreamOAuth(endpointUrl);

  if (discovery.mode === "none") {
    await auth.supabase
      .from("user_mcp_connections")
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq("id", connectionId)
      .eq("user_id", auth.user.id);
    return NextResponse.json({
      mode: "none",
      verified: true,
      message: `${serverTitle} langsung aktif (publik, tidak perlu login tambahan).`,
    });
  }

  if (discovery.mode === "bearer") {
    return NextResponse.json({
      mode: "bearer",
      message: discovery.message,
    });
  }

  const { metadata, scopes } = discovery;
  const reqOrigin = new URL(request.url).origin;
  const redirectUri = `${reqOrigin}/api/mcp-auth/callback`;

  if (!metadata.registration_endpoint) {
    return NextResponse.json({
      mode: "bearer",
      authorizePortal: metadata.authorization_endpoint,
      message: `${serverTitle} tidak mendukung Dynamic Client Registration otomatis. Masukkan API Key / Personal Access Token di bawah ini.`,
    });
  }

  // RFC 7591 Dynamic Client Registration
  let clientId = "";
  let clientSecret = "";
  try {
    const regRes = await fetch(metadata.registration_endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_name: "DRIVE MCP Gateway",
        redirect_uris: [redirectUri],
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        token_endpoint_auth_method: "none",
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!regRes.ok) {
      return NextResponse.json({
        mode: "bearer",
        message: `${serverTitle} menolak pendaftaran OAuth otomatis (HTTP ${regRes.status}). Gunakan API Key / Token untuk menyambungkan.`,
      });
    }
    const reg = await regRes.json();
    clientId = reg.client_id || "";
    clientSecret = reg.client_secret || "";
  } catch {
    return NextResponse.json({
      mode: "bearer",
      message: `Gagal mendaftar OAuth ke ${serverTitle}. Gunakan API Key / Token.`,
    });
  }

  if (!clientId) {
    return NextResponse.json({
      mode: "bearer",
      message: `${serverTitle} tidak mengembalikan client_id OAuth. Gunakan API Key / Token.`,
    });
  }

  const state = base64Url(randomBytes(24));
  const codeVerifier = base64Url(randomBytes(32));
  const codeChallenge = base64Url(createHash("sha256").update(codeVerifier).digest());

  const authorizeUrl = new URL(metadata.authorization_endpoint);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", codeChallenge);
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  if (scopes) authorizeUrl.searchParams.set("scope", scopes);

  const pendingPayload = JSON.stringify({
    state,
    codeVerifier,
    clientId,
    clientSecret,
    tokenEndpoint: metadata.token_endpoint,
    redirectUri,
    connectionId,
    serverTitle,
    userToken: auth.token,
  });

  const response = NextResponse.json({
    mode: "oauth",
    authorizeUrl: authorizeUrl.toString(),
  });
  response.cookies.set("drive_upstream_oauth", Buffer.from(pendingPayload).toString("base64url"), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
