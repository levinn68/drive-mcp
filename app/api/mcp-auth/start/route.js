import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  isSafeHttpsUrl,
  prepareUpstreamOAuthRedirect,
  saveUserMcpToken,
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

  // Direct Bearer / Personal Access Token save mode (persisted in Supabase + cookie)
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

    await saveUserMcpToken(auth.supabase, auth.user, connectionId, bearerToken);

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

  const reqOrigin = resolvePublicOrigin(request);
  const prepared = await prepareUpstreamOAuthRedirect({
    endpointUrl,
    reqOrigin,
    serverTitle,
    connectionId,
    userToken: auth.token,
    customClientId,
    customClientSecret,
  });

  if (prepared.mode === "none") {
    await auth.supabase
      .from("user_mcp_connections")
      .update({ enabled: true, updated_at: new Date().toISOString() })
      .eq("id", connectionId)
      .eq("user_id", auth.user.id);
    const res = NextResponse.json({
      mode: "none",
      verified: true,
      authorized: true,
      message: `${serverTitle} langsung aktif (publik, tidak perlu login atau token).`,
    });
    res.cookies.set(`drive_mcp_tok_${connectionId.slice(0, 12)}`, "__public__", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  if (prepared.mode === "bearer") {
    return NextResponse.json({
      mode: "bearer",
      authType: prepared.hints?.authType || "oauth",
      supportsOAuthApp: Boolean(prepared.supportsOAuthApp),
      callbackUrl: prepared.redirectUri,
      tokenPortalUrl: prepared.hints?.tokenPortalUrl || "",
      tokenPortalLabel: prepared.hints?.tokenPortalLabel || "",
      oauthAppPortalUrl: prepared.hints?.oauthAppPortalUrl || "",
      oauthAppPortalLabel: prepared.hints?.oauthAppPortalLabel || "",
      message: prepared.message,
    });
  }

  const response = NextResponse.json({
    mode: "oauth",
    registrationMethod: prepared.registrationMethod,
    authorizeUrl: prepared.authorizeUrl,
  });
  response.cookies.set("drive_upstream_oauth", prepared.pendingCookieValue, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
