import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const allCookies = request.cookies.getAll();
  const authorizedPrefixes = [];
  for (const c of allCookies) {
    if (c.name.startsWith("drive_mcp_tok_") && c.value) {
      authorizedPrefixes.push(c.name.slice("drive_mcp_tok_".length));
    }
  }
  return NextResponse.json(
    { authorizedPrefixes },
    { headers: { "Cache-Control": "no-store" } }
  );
}
