export const dynamic = "force-dynamic";

const CORS_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  if (!supabaseUrl) {
    return Response.json(
      { error: "OAuth issuer is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } }
    );
  }

  const issuer = `${supabaseUrl}/auth/v1`;
  const candidates = [
    `${issuer}/.well-known/oauth-authorization-server`,
    `${issuer}/.well-known/openid-configuration`,
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { accept: "application/json", "user-agent": "DRIVE-MCP/4.2" },
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(6000),
      });
      if (res.ok) {
        const doc = await res.json();
        if (doc && typeof doc === "object" && doc.authorization_endpoint) {
          return Response.json(doc, { headers: CORS_HEADERS });
        }
      }
    } catch {}
  }

  return Response.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      jwks_uri: `${issuer}/.well-known/jwks.json`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: ["openid", "email", "profile"],
      token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
