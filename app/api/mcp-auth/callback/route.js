import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { saveUserMcpToken } from "../../../../lib/mcp-token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const oauthError = url.searchParams.get("error") || "";
  const oauthErrorDesc = url.searchParams.get("error_description") || "";
  const origin = url.origin;

  const cookieRaw = request.cookies.get("drive_upstream_oauth")?.value || "";
  if (oauthError) {
    const reason = oauthErrorDesc ? `${oauthError}: ${oauthErrorDesc}` : oauthError;
    return NextResponse.redirect(
      `${origin}/mcp?mcp_auth=error&reason=${encodeURIComponent(reason.slice(0, 160))}`
    );
  }
  if (!code || !state || !cookieRaw) {
    return NextResponse.redirect(`${origin}/mcp?mcp_auth=error&reason=missing_oauth_state`);
  }

  let pending;
  try {
    pending = JSON.parse(Buffer.from(cookieRaw, "base64url").toString("utf8"));
  } catch {
    return NextResponse.redirect(`${origin}/mcp?mcp_auth=error&reason=invalid_state`);
  }

  if (pending.state !== state) {
    return NextResponse.redirect(`${origin}/mcp?mcp_auth=error&reason=state_mismatch`);
  }

  try {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: pending.redirectUri,
      client_id: pending.clientId,
      code_verifier: pending.codeVerifier,
    });
    if (pending.clientSecret) {
      form.set("client_secret", pending.clientSecret);
    }
    if (pending.resource) {
      form.set("resource", pending.resource);
    }

    const tokenRes = await fetch(pending.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: form.toString(),
      signal: AbortSignal.timeout(10000),
    });

    const tokenData = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenData.access_token) {
      const reason = tokenData.error_description || tokenData.error || "token_exchange_failed";
      return NextResponse.redirect(
        `${origin}/mcp?mcp_auth=error&reason=${encodeURIComponent(String(reason).slice(0, 160))}`
      );
    }

    // Mark connection enabled AND persist encrypted upstream token in user's Supabase account
    // so AI clients (Grok, Claude, Gemini, ChatGPT) can directly proxy this OAuth MCP's tools!
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey && pending.userToken && pending.connectionId) {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${pending.userToken}` } },
      });
      await supabase
        .from("user_mcp_connections")
        .update({ enabled: true, updated_at: new Date().toISOString() })
        .eq("id", pending.connectionId);

      const {
        data: { user },
      } = await supabase.auth.getUser(pending.userToken);
      if (user) {
        await saveUserMcpToken(supabase, user, pending.connectionId, tokenData.access_token, {
          expiresIn: tokenData.expires_in,
          userToken: pending.userToken,
          endpointUrl: pending.resource || "",
        });
      }
    }

    const dest = `${origin}/mcp?mcp_auth=connected&server=${encodeURIComponent(
      pending.serverTitle || "MCP"
    )}`;
    const response = NextResponse.redirect(dest);
    response.cookies.delete("drive_upstream_oauth");
    if (pending.connectionId) {
      response.cookies.set(
        `drive_mcp_tok_${String(pending.connectionId).slice(0, 12)}`,
        tokenData.access_token,
        {
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: Number(tokenData.expires_in || 60 * 60 * 24 * 30),
        }
      );
    }
    return response;
  } catch {
    return NextResponse.redirect(`${origin}/mcp?mcp_auth=error&reason=exchange_exception`);
  }
}
