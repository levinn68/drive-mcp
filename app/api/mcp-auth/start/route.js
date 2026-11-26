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

function resolvePublicOrigin(request) {
  const url = new URL(request.url);
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    url.protocol.replace(":", "") ||
    "https";
  const host =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    request.headers.get("host") ||
    url.host;
  return `${proto}://${host}`;
}

function getProviderHints(endpointUrl) {
  const lower = String(endpointUrl || "").toLowerCase();
  if (lower.includes("githubcopilot.com") || lower.includes("github.com")) {
    return {
      envClientId: process.env.GITHUB_MCP_CLIENT_ID || process.env.GITHUB_CLIENT_ID || "",
      envClientSecret: process.env.GITHUB_MCP_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || "",
      tokenPortalUrl: "https://github.com/settings/personal-access-tokens/new",
      tokenPortalLabel: "Buat GitHub Personal Access Token",
      preferCimd: false,
      defaultScopes: "repo read:org read:user",
    };
  }
  if (lower.includes("mcp.vercel.com") || lower.includes("vercel.com")) {
    return {
      envClientId: process.env.VERCEL_MCP_CLIENT_ID || "",
      envClientSecret: process.env.VERCEL_MCP_CLIENT_SECRET || "",
      tokenPortalUrl: "https://vercel.com/account/tokens",
      tokenPortalLabel: "Buat Vercel Access Token",
      preferCimd: true,
      defaultScopes: "openid",
    };
  }
  if (lower.includes("supabase.com")) {
    return {
      envClientId: process.env.SUPABASE_MCP_CLIENT_ID || "",
      envClientSecret: process.env.SUPABASE_MCP_CLIENT_SECRET || "",
      tokenPortalUrl: "https://supabase.com/dashboard/account/tokens",
      tokenPortalLabel: "Buat Supabase Access Token",
      preferCimd: true,
      defaultScopes: "",
    };
  }
  if (lower.includes("stripe.com")) {
    return {
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://dashboard.stripe.com/apikeys",
      tokenPortalLabel: "Buka Stripe API Keys",
      preferCimd: true,
      defaultScopes: "",
    };
  }
  if (lower.includes("notion.com")) {
    return {
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://www.notion.so/profile/integrations",
      tokenPortalLabel: "Buka Notion Integrations",
      preferCimd: true,
      defaultScopes: "",
    };
  }
  if (lower.includes("linear.app")) {
    return {
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://linear.app/settings/api",
      tokenPortalLabel: "Buka Linear API Settings",
      preferCimd: true,
      defaultScopes: "",
    };
  }
  if (lower.includes("figma.com")) {
    return {
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://www.figma.com/developers/api#access-tokens",
      tokenPortalLabel: "Buat Figma Personal Access Token",
      preferCimd: true,
      defaultScopes: "",
    };
  }
  if (lower.includes("sentry.dev") || lower.includes("sentry.io")) {
    return {
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://sentry.io/settings/account/api/auth-tokens/",
      tokenPortalLabel: "Buat Sentry Auth Token",
      preferCimd: true,
      defaultScopes: "",
    };
  }
  if (lower.includes("cloudflare.com")) {
    return {
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://dash.cloudflare.com/profile/api-tokens",
      tokenPortalLabel: "Buat Cloudflare API Token",
      preferCimd: true,
      defaultScopes: "",
    };
  }
  if (lower.includes("neon.tech")) {
    return {
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://console.neon.tech/app/settings/api-keys",
      tokenPortalLabel: "Buat Neon API Key",
      preferCimd: true,
      defaultScopes: "",
    };
  }
  return {
    envClientId: "",
    envClientSecret: "",
    tokenPortalUrl: "",
    tokenPortalLabel: "",
    preferCimd: false,
    defaultScopes: "",
  };
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
      headers: { accept: "application/json", "user-agent": "DRIVE-MCP-Gateway/2.4" },
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

  // Step 1: Probe MCP endpoint directly (zero-auth public MCPs return 200 OK)
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
          clientInfo: { name: "DRIVE MCP", version: "2.4" },
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

  const cleanPath = target.pathname.replace(/\/$/, "");
  const prmCandidates = [
    resourceMetaUrl,
    cleanPath ? `${origin}/.well-known/oauth-protected-resource${cleanPath}` : "",
    `${origin}/.well-known/oauth-protected-resource`,
  ].filter(Boolean);

  let authServerOrigin = origin;
  let scopesSupported = [];
  let canonicalResource = endpointUrl.replace(/\/$/, "");

  for (const candidate of prmCandidates) {
    const prm = await fetchJsonSafe(candidate);
    if (prm && Array.isArray(prm.authorization_servers) && prm.authorization_servers[0]) {
      authServerOrigin = prm.authorization_servers[0].replace(/\/$/, "");
      if (Array.isArray(prm.scopes_supported)) scopesSupported = prm.scopes_supported;
      if (typeof prm.resource === "string" && prm.resource.startsWith("https://")) {
        canonicalResource = prm.resource;
      }
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
      canonicalResource,
      message: "MCP ini menggunakan API Key / Personal Access Token (tidak menyediakan OAuth otomatis).",
    };
  }

  return {
    mode: "oauth",
    metadata,
    canonicalResource,
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
  const customClientId = typeof body.oauthClientId === "string" ? body.oauthClientId.trim() : "";
  const customClientSecret =
    typeof body.oauthClientSecret === "string" ? body.oauthClientSecret.trim() : "";

  if (!connectionId || !isSafeHttpsUrl(endpointUrl)) {
    return NextResponse.json(
      { error: "Valid connectionId and HTTPS endpointUrl are required." },
      { status: 400 }
    );
  }

  const hints = getProviderHints(endpointUrl);

  // Direct Bearer / Personal Access Token save mode
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

  // OAuth 2.1 Discovery
  const discovery = await discoverUpstreamOAuth(endpointUrl);
  const reqOrigin = resolvePublicOrigin(request);
  const redirectUri = `${reqOrigin}/api/mcp-auth/callback`;
  const cimdClientId = `${reqOrigin}/.well-known/oauth-client-metadata.json`;

  if (discovery.mode === "none") {
    await auth.supabase
      .from("user_mcp_connections")
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq("id", connectionId)
      .eq("user_id", auth.user.id);
    return NextResponse.json({
      mode: "none",
      verified: true,
      message: `${serverTitle} langsung aktif (publik, tanpa login tambahan).`,
    });
  }

  if (discovery.mode === "bearer") {
    return NextResponse.json({
      mode: "bearer",
      message: discovery.message,
      tokenPortalUrl: hints.tokenPortalUrl,
      tokenPortalLabel: hints.tokenPortalLabel,
      supportsOAuthApp: false,
      callbackUrl: redirectUri,
    });
  }

  const { metadata, canonicalResource } = discovery;
  const scopes = discovery.scopes || hints.defaultScopes || "";

  // MCP OAuth 2.1 Client Registration Priority:
  // 1. User-supplied or Pre-registered OAuth App credentials
  let clientId = customClientId || hints.envClientId || "";
  let clientSecret = customClientSecret || hints.envClientSecret || "";
  let registrationMethod = clientId ? "preregistered" : "";

  // 2. Client ID Metadata Document (CIMD) — MCP 2025-11-25 standard (used by Vercel MCP, etc.)
  const supportsCimd =
    Boolean(metadata.client_id_metadata_document_supported) ||
    (hints.preferCimd && reqOrigin.startsWith("https://"));

  if (!clientId && supportsCimd && reqOrigin.startsWith("https://")) {
    clientId = cimdClientId;
    registrationMethod = "cimd";
  }

  // 3. RFC 7591 Dynamic Client Registration fallback
  if (!clientId && metadata.registration_endpoint) {
    try {
      const regRes = await fetch(metadata.registration_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          client_name: "DRIVE MCP",
          client_uri: reqOrigin,
          redirect_uris: [redirectUri],
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
          token_endpoint_auth_method: "none",
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (regRes.ok) {
        const reg = await regRes.json();
        clientId = reg.client_id || "";
        clientSecret = reg.client_secret || "";
        registrationMethod = "dcr";
      } else if (reqOrigin.startsWith("https://") && metadata.client_id_metadata_document_supported !== false) {
        // If DCR rejected our redirect URI (e.g. HTTP 400), try CIMD URL client_id as standard MCP 2025-11-25 fallback
        clientId = cimdClientId;
        registrationMethod = "cimd_fallback";
      }
    } catch {
      // Fall through to manual credentials prompt
    }
  }

  if (!clientId) {
    return NextResponse.json({
      mode: "bearer",
      supportsOAuthApp: Boolean(metadata.authorization_endpoint),
      callbackUrl: redirectUri,
      tokenPortalUrl: hints.tokenPortalUrl,
      tokenPortalLabel: hints.tokenPortalLabel,
      message: `${serverTitle} memerlukan Personal Access Token (PAT) atau OAuth App Client ID & Secret sendiri karena provider belum membuka pendaftaran OAuth otomatis.`,
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
  if (canonicalResource) {
    authorizeUrl.searchParams.set("resource", canonicalResource);
  }
  if (scopes) {
    authorizeUrl.searchParams.set("scope", scopes);
  }

  const pendingPayload = JSON.stringify({
    state,
    codeVerifier,
    clientId,
    clientSecret,
    tokenEndpoint: metadata.token_endpoint,
    redirectUri,
    resource: canonicalResource,
    connectionId,
    serverTitle,
    registrationMethod,
    userToken: auth.token,
  });

  const response = NextResponse.json({
    mode: "oauth",
    registrationMethod,
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
