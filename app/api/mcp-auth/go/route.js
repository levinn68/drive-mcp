import { NextResponse } from "next/server";
import {
  isSafeHttpsUrl,
  prepareUpstreamOAuthRedirect,
  verifySignedGoToken,
} from "../../../../lib/mcp-token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

// 1-tap direct OAuth redirect from AI chat (Grok, Claude, ChatGPT) straight to the provider's Allow screen
export async function GET(request) {
  const url = new URL(request.url);
  const origin = resolvePublicOrigin(request);
  const signedToken = url.searchParams.get("t") || "";

  const payload = verifySignedGoToken(signedToken);
  if (!payload || !payload.connectionId || !isSafeHttpsUrl(payload.endpointUrl) || !payload.userToken) {
    return NextResponse.redirect(`${origin}/mcp?mcp_auth=error&reason=link_expired_open_my_mcps`);
  }

  const prepared = await prepareUpstreamOAuthRedirect({
    endpointUrl: payload.endpointUrl,
    reqOrigin: origin,
    serverTitle: payload.serverTitle || "MCP Server",
    connectionId: payload.connectionId,
    userToken: payload.userToken,
  });

  if (prepared.mode === "oauth" && prepared.authorizeUrl) {
    const response = NextResponse.redirect(prepared.authorizeUrl);
    response.cookies.set("drive_upstream_oauth", prepared.pendingCookieValue, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return response;
  }

  if (prepared.mode === "none") {
    return NextResponse.redirect(
      `${origin}/mcp?mcp_auth=connected&server=${encodeURIComponent(payload.serverTitle || "MCP")}`
    );
  }

  // Provider requires PAT / manual OAuth App — send user straight to My MCPs to paste PAT
  return NextResponse.redirect(
    `${origin}/mcp?mcp_auth=token_required&server=${encodeURIComponent(payload.serverTitle || "MCP")}`
  );
}
