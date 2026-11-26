import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const MAX_STORED_TOKENS = 15;

function getMasterSecret() {
  return (
    process.env.DRIVE_TOKEN_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "drive-mcp-gateway-secret"
  );
}

function deriveUserKey(userId) {
  return createHash("sha256")
    .update(`drive-mcp-v1:${getMasterSecret()}:${String(userId || "")}`)
    .digest();
}

export function base64Url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function encryptUserToken(plainText, userId) {
  const key = deriveUserKey(userId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${base64Url(iv)}.${base64Url(tag)}.${base64Url(enc)}`;
}

export function decryptUserToken(packed, userId) {
  try {
    const parts = String(packed || "").split(".");
    if (parts.length !== 3) return "";
    const iv = Buffer.from(parts[0], "base64url");
    const tag = Buffer.from(parts[1], "base64url");
    const enc = Buffer.from(parts[2], "base64url");
    const key = deriveUserKey(userId);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function connectionPrefix(connectionId) {
  return String(connectionId || "").trim().slice(0, 12);
}

export function getUserMcpToken(user, connectionId) {
  if (!user || !connectionId) return "";
  const map = user.user_metadata?.drive_mcp_tokens;
  if (!map || typeof map !== "object") return "";
  const prefix = connectionPrefix(connectionId);
  const entry = map[prefix] || map[connectionId];
  if (!entry) return "";
  const packed = typeof entry === "string" ? entry : entry.v || "";
  if (!packed) return "";
  if (typeof entry === "object" && entry.exp && Date.now() > Number(entry.exp)) {
    return "";
  }
  return decryptUserToken(packed, user.id);
}

export function getAuthorizedPrefixesFromUser(user) {
  const map = user?.user_metadata?.drive_mcp_tokens;
  if (!map || typeof map !== "object") return [];
  const now = Date.now();
  const out = [];
  for (const [prefix, entry] of Object.entries(map)) {
    if (!entry) continue;
    if (typeof entry === "object" && entry.exp && now > Number(entry.exp)) continue;
    out.push(prefix);
  }
  return out;
}

export async function saveUserMcpToken(supabase, user, connectionId, accessToken, { expiresIn } = {}) {
  if (!supabase || !user?.id || !connectionId || !accessToken) return false;
  try {
    const prefix = connectionPrefix(connectionId);
    const existing =
      user.user_metadata?.drive_mcp_tokens && typeof user.user_metadata.drive_mcp_tokens === "object"
        ? { ...user.user_metadata.drive_mcp_tokens }
        : {};

    const exp =
      expiresIn && Number(expiresIn) > 0
        ? Date.now() + Math.min(Number(expiresIn), 60 * 60 * 24 * 365) * 1000
        : Date.now() + 1000 * 60 * 60 * 24 * 90;

    existing[prefix] = {
      v: encryptUserToken(accessToken, user.id),
      t: Date.now(),
      exp,
    };

    // Keep metadata compact by retaining the most recent MAX_STORED_TOKENS entries
    const entries = Object.entries(existing)
      .sort((a, b) => Number(b[1]?.t || 0) - Number(a[1]?.t || 0))
      .slice(0, MAX_STORED_TOKENS);
    const nextMap = Object.fromEntries(entries);

    const { error } = await supabase.auth.updateUser({
      data: { drive_mcp_tokens: nextMap },
    });
    return !error;
  } catch {
    return false;
  }
}

export function createSignedGoToken(payload) {
  const data = {
    ...payload,
    exp: Date.now() + 10 * 60 * 1000, // 10 minutes
  };
  const body = base64Url(JSON.stringify(data));
  const sig = base64Url(
    createHmac("sha256", getMasterSecret()).update(`drive-go:${body}`).digest()
  );
  return `${body}.${sig}`;
}

export function verifySignedGoToken(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expected = base64Url(
      createHmac("sha256", getMasterSecret()).update(`drive-go:${body}`).digest()
    );
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed?.exp || Date.now() > Number(parsed.exp)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isSafeHttpsUrl(raw) {
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

export function getProviderHints(endpointUrl) {
  const lower = String(endpointUrl || "").toLowerCase();
  if (lower.includes("githubcopilot.com") || lower.includes("github.com")) {
    return {
      authType: "pat",
      envClientId: process.env.GITHUB_MCP_CLIENT_ID || process.env.GITHUB_CLIENT_ID || "",
      envClientSecret: process.env.GITHUB_MCP_CLIENT_SECRET || process.env.GITHUB_CLIENT_SECRET || "",
      tokenPortalUrl: "https://github.com/settings/personal-access-tokens/new",
      tokenPortalLabel: "Buat GitHub PAT (Token)",
      oauthAppPortalUrl: "https://github.com/settings/applications/new",
      oauthAppPortalLabel: "Buat GitHub OAuth App",
      preferCimd: false,
      catalogRestricted: false,
      defaultScopes: "repo read:org read:user",
    };
  }
  if (lower.includes("mcp.vercel.com") || lower.includes("vercel.com")) {
    return {
      authType: "oauth",
      envClientId: process.env.VERCEL_MCP_CLIENT_ID || "",
      envClientSecret: process.env.VERCEL_MCP_CLIENT_SECRET || "",
      tokenPortalUrl: "https://vercel.com/account/tokens",
      tokenPortalLabel: "Buat Vercel Access Token",
      oauthAppPortalUrl: "https://vercel.com/dashboard/integrations/console",
      oauthAppPortalLabel: "Buka Vercel Integrations Console",
      preferCimd: true,
      catalogRestricted: false,
      defaultScopes: "openid",
    };
  }
  if (lower.includes("supabase.com")) {
    return {
      authType: "oauth",
      envClientId: process.env.SUPABASE_MCP_CLIENT_ID || "",
      envClientSecret: process.env.SUPABASE_MCP_CLIENT_SECRET || "",
      tokenPortalUrl: "https://supabase.com/dashboard/account/tokens",
      tokenPortalLabel: "Buat Supabase Access Token",
      oauthAppPortalUrl: "https://supabase.com/dashboard/org/_/apps",
      oauthAppPortalLabel: "Buat Supabase OAuth App",
      preferCimd: false,
      catalogRestricted: false,
      defaultScopes: "",
    };
  }
  if (lower.includes("figma.com")) {
    return {
      authType: "oauth_catalog",
      envClientId: process.env.FIGMA_MCP_CLIENT_ID || "",
      envClientSecret: process.env.FIGMA_MCP_CLIENT_SECRET || "",
      tokenPortalUrl: "https://www.figma.com/developers/api#access-tokens",
      tokenPortalLabel: "Buka Figma Developer Tokens",
      oauthAppPortalUrl: "https://www.figma.com/developers/apps",
      oauthAppPortalLabel: "Buat Figma OAuth App",
      preferCimd: false,
      catalogRestricted: true,
      defaultScopes: "",
    };
  }
  if (lower.includes("stripe.com")) {
    return {
      authType: "oauth",
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://dashboard.stripe.com/apikeys",
      tokenPortalLabel: "Buka Stripe API Keys",
      oauthAppPortalUrl: "https://dashboard.stripe.com/settings/apps",
      oauthAppPortalLabel: "Buka Stripe Apps",
      preferCimd: false,
      catalogRestricted: false,
      defaultScopes: "",
    };
  }
  if (lower.includes("notion.com")) {
    return {
      authType: "oauth",
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://www.notion.so/profile/integrations",
      tokenPortalLabel: "Buka Notion Integrations",
      oauthAppPortalUrl: "https://www.notion.so/profile/integrations",
      oauthAppPortalLabel: "Buat Notion OAuth Integration",
      preferCimd: false,
      catalogRestricted: false,
      defaultScopes: "",
    };
  }
  if (lower.includes("linear.app")) {
    return {
      authType: "oauth",
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://linear.app/settings/api",
      tokenPortalLabel: "Buat Linear API Key",
      oauthAppPortalUrl: "https://linear.app/settings/api/applications/new",
      oauthAppPortalLabel: "Buat Linear OAuth App",
      preferCimd: false,
      catalogRestricted: false,
      defaultScopes: "",
    };
  }
  if (lower.includes("sentry.dev") || lower.includes("sentry.io")) {
    return {
      authType: "oauth",
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://sentry.io/settings/account/api/auth-tokens/",
      tokenPortalLabel: "Buat Sentry Auth Token",
      oauthAppPortalUrl: "https://sentry.io/settings/developer-settings/",
      oauthAppPortalLabel: "Buat Sentry OAuth App",
      preferCimd: false,
      catalogRestricted: false,
      defaultScopes: "",
    };
  }
  if (lower.includes("cloudflare.com")) {
    return {
      authType: "oauth",
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://dash.cloudflare.com/profile/api-tokens",
      tokenPortalLabel: "Buat Cloudflare API Token",
      oauthAppPortalUrl: "https://dash.cloudflare.com/",
      oauthAppPortalLabel: "Buka Cloudflare Dashboard",
      preferCimd: false,
      catalogRestricted: false,
      defaultScopes: "",
    };
  }
  if (lower.includes("neon.tech")) {
    return {
      authType: "oauth",
      envClientId: "",
      envClientSecret: "",
      tokenPortalUrl: "https://console.neon.tech/app/settings/api-keys",
      tokenPortalLabel: "Buat Neon API Key",
      oauthAppPortalUrl: "https://console.neon.tech/app/settings",
      oauthAppPortalLabel: "Buka Neon Console",
      preferCimd: false,
      catalogRestricted: false,
      defaultScopes: "",
    };
  }
  return {
    authType: "oauth",
    envClientId: "",
    envClientSecret: "",
    tokenPortalUrl: "",
    tokenPortalLabel: "",
    oauthAppPortalUrl: "",
    oauthAppPortalLabel: "",
    preferCimd: false,
    catalogRestricted: false,
    defaultScopes: "",
  };
}

async function fetchJsonSafe(url) {
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "DRIVE-MCP-Gateway/2.7" },
      cache: "no-store",
      signal: AbortSignal.timeout(6500),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function discoverUpstreamOAuth(endpointUrl) {
  const target = new URL(endpointUrl);
  const origin = target.origin;

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
          clientInfo: { name: "DRIVE MCP", version: "2.7" },
        },
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (probe.ok) {
      return { mode: "none", verified: true };
    }
    wwwAuth = probe.headers.get("www-authenticate") || "";
  } catch {}

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

export async function prepareUpstreamOAuthRedirect({
  endpointUrl,
  reqOrigin,
  serverTitle,
  connectionId,
  userToken,
  customClientId = "",
  customClientSecret = "",
}) {
  const hints = getProviderHints(endpointUrl);
  const discovery = await discoverUpstreamOAuth(endpointUrl);
  const redirectUri = `${reqOrigin}/api/mcp-auth/callback`;
  const cimdClientId = `${reqOrigin}/.well-known/oauth-client-metadata.json`;

  if (discovery.mode === "none") {
    return { mode: "none", hints };
  }

  if (discovery.mode === "bearer") {
    return {
      mode: "bearer",
      hints,
      redirectUri,
      supportsOAuthApp: false,
      message: discovery.message,
    };
  }

  const { metadata, canonicalResource } = discovery;

  if (hints.catalogRestricted && !hints.envClientId) {
    return {
      mode: "bearer",
      hints: {
        ...hints,
        oauthAppPortalUrl: "https://developers.figma.com/docs/figma-mcp-server/",
        oauthAppPortalLabel: "Buka Panduan Figma MCP",
      },
      redirectUri,
      supportsOAuthApp: false,
      message:
        "Figma Remote MCP (mcp.figma.com) membatasi scope OAuth 'mcp:connect' hanya untuk client yang terdaftar di Figma MCP Catalog. Gunakan Personal Access Token atau Figma API MCP.",
    };
  }

  const scopes = discovery.scopes || hints.defaultScopes || "";
  let clientId = customClientId || hints.envClientId || "";
  let clientSecret = customClientSecret || hints.envClientSecret || "";
  let registrationMethod = clientId ? "preregistered" : "";

  const explicitCimdSupported = metadata.client_id_metadata_document_supported === true;
  if (!clientId && (explicitCimdSupported || hints.preferCimd) && reqOrigin.startsWith("https://")) {
    clientId = cimdClientId;
    registrationMethod = "cimd";
  }

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
      }
    } catch {}
  }

  if (!clientId) {
    return {
      mode: "bearer",
      hints,
      redirectUri,
      supportsOAuthApp: Boolean(metadata.authorization_endpoint),
      message: `${serverTitle} membutuhkan Personal Access Token (PAT) atau OAuth App (Client ID & Secret).`,
    };
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
  if (canonicalResource) authorizeUrl.searchParams.set("resource", canonicalResource);
  if (scopes) authorizeUrl.searchParams.set("scope", scopes);

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
    userToken,
  });

  return {
    mode: "oauth",
    registrationMethod,
    authorizeUrl: authorizeUrl.toString(),
    pendingCookieValue: Buffer.from(pendingPayload).toString("base64url"),
  };
}
