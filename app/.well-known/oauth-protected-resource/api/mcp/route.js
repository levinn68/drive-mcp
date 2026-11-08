export const dynamic = "force-dynamic";

export async function GET() {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://drive-mcp-five.vercel.app").replace(/\/$/, "");
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return Response.json({ error: "OAuth issuer is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  return Response.json({
    resource: `${base}/api/mcp`,
    authorization_servers: [`${supabaseUrl.replace(/\/$/, "")}/auth/v1`],
    bearer_methods_supported: ["header"],
    resource_documentation: base,
  }, {
    headers: {
      "Cache-Control": "public, max-age=300, stale-while-revalidate=60",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
