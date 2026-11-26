export const dynamic = "force-dynamic";

function resolveBase(request) {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  try {
    const url = new URL(request.url);
    const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || url.protocol.replace(":", "") || "https";
    const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host") || url.host;
    return `${proto}://${host}`.replace(/\/$/, "");
  } catch {
    return "https://drive-mcp-five.vercel.app";
  }
}

const CORS_HEADERS = {
  "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version",
  "X-Content-Type-Options": "nosniff",
};

export async function GET(request) {
  const base = resolveBase(request);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return Response.json(
      { error: "OAuth issuer is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" } }
    );
  }
  return Response.json(
    {
      resource: `${base}/api/mcp`,
      authorization_servers: [`${supabaseUrl.replace(/\/$/, "")}/auth/v1`],
      scopes_supported: ["openid", "email", "profile"],
      bearer_methods_supported: ["header"],
      resource_documentation: base,
    },
    { headers: CORS_HEADERS }
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
