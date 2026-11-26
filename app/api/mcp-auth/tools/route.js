import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getUserMcpToken, isSafeHttpsUrl } from "../../../../lib/mcp-token-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseMcpResponse(response) {
  const ct = (response.headers.get("content-type") || "").toLowerCase();
  const text = await response.text();
  if (!text.trim()) return null;

  if (ct.includes("text/event-stream") || text.includes("data:")) {
    const lines = text.split(/\r?\n/);
    let lastJson = null;
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload);
        if (parsed?.result || parsed?.error) lastJson = parsed;
      } catch {}
    }
    return lastJson;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function POST(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
  }
  if (!token) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const connectionId = String(body.connectionId || "").trim();
  const endpointUrl = String(body.endpointUrl || "").trim();
  if (!connectionId || !isSafeHttpsUrl(endpointUrl)) {
    return NextResponse.json({ error: "Valid connectionId and HTTPS endpointUrl required." }, { status: 400 });
  }

  const cookieToken = request.cookies.get(`drive_mcp_tok_${connectionId.slice(0, 12)}`)?.value || "";
  const storedToken = getUserMcpToken(user, connectionId);
  const upstreamToken =
    (cookieToken && cookieToken !== "__public__" ? cookieToken : "") || storedToken || "";

  const baseHeaders = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "User-Agent": "DRIVE-MCP-Gateway/2.7",
  };
  if (upstreamToken) {
    baseHeaders.Authorization = `Bearer ${upstreamToken}`;
  }

  try {
    const initRes = await fetch(endpointUrl, {
      method: "POST",
      headers: baseHeaders,
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
      signal: AbortSignal.timeout(8000),
    });

    if (initRes.status === 401 || initRes.status === 403) {
      return NextResponse.json({
        tools: [],
        total: 0,
        requiresAuth: true,
        message: "MCP ini butuh otorisasi dulu supaya daftar tools-nya bisa dibaca.",
      });
    }

    const sessionId = initRes.headers.get("mcp-session-id") || "";
    const toolsHeaders = { ...baseHeaders };
    if (sessionId) toolsHeaders["Mcp-Session-Id"] = sessionId;

    fetch(endpointUrl, {
      method: "POST",
      headers: toolsHeaders,
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});

    const listRes = await fetch(endpointUrl, {
      method: "POST",
      headers: toolsHeaders,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      }),
      signal: AbortSignal.timeout(9000),
    });

    if (listRes.status === 401 || listRes.status === 403) {
      return NextResponse.json({
        tools: [],
        total: 0,
        requiresAuth: true,
        message: "MCP ini butuh otorisasi dulu supaya daftar tools-nya bisa dibaca.",
      });
    }

    if (!listRes.ok) {
      return NextResponse.json({
        tools: [],
        total: 0,
        requiresAuth: false,
        error: `Upstream MCP returned HTTP ${listRes.status}.`,
      });
    }

    const parsed = await parseMcpResponse(listRes);
    const rawTools = Array.isArray(parsed?.result?.tools) ? parsed.result.tools : [];
    const tools = rawTools.map((t) => ({
      name: String(t.name || "unnamed_tool"),
      description: String(t.description || "").trim(),
    }));

    return NextResponse.json({
      tools,
      total: tools.length,
      requiresAuth: false,
      authorized: Boolean(upstreamToken),
    });
  } catch (err) {
    return NextResponse.json({
      tools: [],
      total: 0,
      requiresAuth: false,
      error: err?.message || "Gagal mengambil daftar tools dari MCP endpoint.",
    });
  }
}
