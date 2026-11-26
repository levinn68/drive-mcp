"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowUpRight,
  Cable,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wrench,
} from "lucide-react";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

async function getAccessToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

function getAuthMethodLabel(endpointUrl) {
  const lower = String(endpointUrl || "").toLowerCase();
  if (!lower) return { label: "STDIO", cls: "" };
  if (
    lower.includes("context7.com") ||
    lower.includes("deepwiki.com") ||
    lower.includes("developers.openai.com") ||
    lower.includes("docs.mcp.cloudflare.com")
  ) {
    return { label: "No Auth", cls: "is-auth-none" };
  }
  if (
    lower.includes("githubcopilot.com") ||
    lower.includes("firecrawl") ||
    lower.includes("tavily") ||
    lower.includes("apify") ||
    lower.includes("exa.ai") ||
    lower.includes("snyk") ||
    lower.includes("datadog")
  ) {
    return { label: "PAT / Token", cls: "is-auth-pat" };
  }
  if (lower.includes("figma.com")) {
    return { label: "OAuth Catalog", cls: "is-auth-pat" };
  }
  return { label: "OAuth 2.1", cls: "is-auth-oauth" };
}

export function AddMcpButton({
  serverName,
  version,
  registryEntry,
  remoteAvailable,
  onConnected,
}) {
  const [state, setState] = useState("idle");

  async function add() {
    if (state === "adding") return;
    setState("adding");
    try {
      const token = await getAccessToken();
      if (!token) {
        const supabase = getSupabase();
        if (supabase) {
          await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
              redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`,
            },
          });
          return;
        }
        setState("Sign in required");
        return;
      }

      const response = await fetch("/api/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ serverName, version, registryEntry }),
      });
      const result = await response.json();
      if (!response.ok) {
        setState([result.error, result.detail].filter(Boolean).join(": ") || "Could not add");
        return;
      }

      if (typeof onConnected === "function") onConnected(result);
      window.dispatchEvent(new Event("drive:connections-changed"));

      const endpointUrl =
        registryEntry?.server?.remotes?.[0]?.url ||
        result?.connection?.server?.endpoint_url ||
        result?.connection?.server?.remote_url ||
        "";
      const connectionId = result?.connection?.id || "";
      const title = registryEntry?.server?.title || serverName;

      if (remoteAvailable && endpointUrl && connectionId) {
        const authRes = await fetch("/api/mcp-auth/start", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            connectionId,
            endpointUrl,
            serverTitle: title,
          }),
        });
        const authData = await authRes.json().catch(() => ({}));
        if (authData.mode === "oauth" && authData.authorizeUrl) {
          window.location.assign(authData.authorizeUrl);
          return;
        }
        if (authData.mode === "bearer") {
          window.dispatchEvent(
            new CustomEvent("drive:open-mcp-auth", {
              detail: {
                id: connectionId,
                title,
                endpointUrl,
                note: authData.message || "",
                tokenPortalUrl: authData.tokenPortalUrl || "",
                tokenPortalLabel: authData.tokenPortalLabel || "Buat Token Provider",
                oauthAppPortalUrl: authData.oauthAppPortalUrl || "",
                oauthAppPortalLabel: authData.oauthAppPortalLabel || "Buat OAuth App",
                supportsOAuthApp: Boolean(authData.supportsOAuthApp),
                callbackUrl:
                  authData.callbackUrl || `${window.location.origin}/api/mcp-auth/callback`,
              },
            })
          );
          setState("added");
          return;
        }
      }

      setState("added");
    } catch {
      setState("Network error");
    }
  }

  const isAdded = state === "added";
  const isBusy = state === "adding";
  const isError = !isAdded && !isBusy && state !== "idle";

  return (
    <button
      type="button"
      className={`add-mcp-btn ${isAdded ? "is-installed" : ""}`}
      disabled={isBusy}
      onClick={add}
      title={
        isError
          ? state
          : remoteAvailable
          ? "Connect & redirect to original MCP authorization"
          : "Save this MCP entry to your workspace"
      }
    >
      {isBusy ? (
        <LoaderCircle size={12} className="spin" />
      ) : isAdded ? (
        <Check size={12} />
      ) : (
        <Plus size={12} />
      )}
      <span>
        {isBusy ? "Connecting..." : isAdded ? "Connected" : isError ? "Retry" : "Connect"}
      </span>
    </button>
  );
}

export default function MyMcpPanel() {
  const [connections, setConnections] = useState([]);
  const [authorizedPrefixes, setAuthorizedPrefixes] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [authBusyId, setAuthBusyId] = useState("");
  const [bearerTarget, setBearerTarget] = useState(null);
  const [authModeTab, setAuthModeTab] = useState("token");
  const [bearerValue, setBearerValue] = useState("");
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [banner, setBanner] = useState({ type: "", text: "" });

  const [openToolsId, setOpenToolsId] = useState("");
  const [toolsById, setToolsById] = useState({});
  const [toolSearchById, setToolSearchById] = useState({});

  const tokenRef = useRef("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      tokenRef.current = token || "";
      if (!token) {
        setSignedIn(false);
        setConnections([]);
        return;
      }
      setSignedIn(true);
      const [connRes, authStatusRes] = await Promise.all([
        fetch("/api/connections", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch("/api/mcp-auth/status", { cache: "no-store" }),
      ]);
      const data = await connRes.json();
      if (!connRes.ok) {
        throw new Error(data.error || "Could not load saved connections.");
      }
      setConnections(Array.isArray(data.connections) ? data.connections : []);
      if (authStatusRes.ok) {
        const st = await authStatusRes.json();
        setAuthorizedPrefixes(
          new Set(Array.isArray(st.authorizedPrefixes) ? st.authorizedPrefixes : [])
        );
      }
    } catch (err) {
      setBanner({ type: "error", text: err?.message || "Could not load saved connections." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      load();
      const params = new URLSearchParams(window.location.search);
      const authStatus = params.get("mcp_auth");
      if (authStatus === "connected") {
        const srv = params.get("server") || "MCP";
        setBanner({
          type: "success",
          text: `Otorisasi ${srv} berhasil! Akun kamu sekarang terhubung langsung lewat DRIVE gateway.`,
        });
        params.delete("mcp_auth");
        params.delete("server");
        const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState(null, "", clean);
      } else if (authStatus === "error") {
        const reason = params.get("reason") || "oauth_failed";
        setBanner({
          type: "error",
          text: `Otorisasi upstream MCP gagal (${reason}). Kamu bisa coba lagi atau pakai API Key / Token.`,
        });
        params.delete("mcp_auth");
        params.delete("reason");
        const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
        window.history.replaceState(null, "", clean);
      }
    }, 0);
    const refresh = () => load();
    const openAuth = (ev) => {
      if (ev?.detail?.id) {
        setBearerTarget(ev.detail);
        setAuthModeTab("token");
        setBearerValue("");
      }
    };
    window.addEventListener("drive:connections-changed", refresh);
    window.addEventListener("drive:auth-changed", refresh);
    window.addEventListener("drive:open-mcp-auth", openAuth);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("drive:connections-changed", refresh);
      window.removeEventListener("drive:auth-changed", refresh);
      window.removeEventListener("drive:open-mcp-auth", openAuth);
    };
  }, [load]);

  async function loadToolsForConnection(item, forceRefresh = false) {
    const endpointUrl =
      item.server?.endpoint_url ||
      item.server?.remote_url ||
      item.server?.remotes?.[0]?.url ||
      "";
    if (!endpointUrl) return;

    if (!forceRefresh && openToolsId === item.id) {
      setOpenToolsId("");
      return;
    }

    setOpenToolsId(item.id);
    if (!forceRefresh && toolsById[item.id]?.loaded && !toolsById[item.id]?.requiresAuth) {
      return;
    }

    setToolsById((prev) => ({
      ...prev,
      [item.id]: { ...(prev[item.id] || {}), loading: true, error: "" },
    }));

    try {
      const token = tokenRef.current || (await getAccessToken());
      if (!token) throw new Error("Sign in terlebih dahulu.");
      const res = await fetch("/api/mcp-auth/tools", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          connectionId: item.id,
          endpointUrl,
        }),
      });
      const data = await res.json();
      const loadedTools = Array.isArray(data.tools) ? data.tools : [];
      if (loadedTools.length > 0 && !data.requiresAuth) {
        setAuthorizedPrefixes((prev) => {
          const next = new Set(prev);
          next.add(String(item.id).slice(0, 12));
          return next;
        });
      }
      setToolsById((prev) => ({
        ...prev,
        [item.id]: {
          loading: false,
          loaded: true,
          tools: loadedTools,
          total: Number(data.total || 0),
          requiresAuth: Boolean(data.requiresAuth),
          message: data.message || "",
          error: data.error || "",
        },
      }));
    } catch (err) {
      setToolsById((prev) => ({
        ...prev,
        [item.id]: {
          loading: false,
          loaded: true,
          tools: [],
          total: 0,
          requiresAuth: false,
          error: err?.message || "Gagal memuat daftar tools.",
        },
      }));
    }
  }

  async function authorizeUpstream(item) {
    const endpointUrl =
      item.server?.endpoint_url ||
      item.server?.remote_url ||
      item.server?.remotes?.[0]?.url ||
      "";
    const title =
      item.server?.title || item.server?.display_name || item.server?.server_name || "MCP";
    if (!endpointUrl) {
      setBanner({
        type: "error",
        text: `${title} tidak memiliki Remote HTTP URL (server STDIO lokal).`,
      });
      return;
    }

    setAuthBusyId(item.id);
    setBanner({ type: "", text: "" });
    try {
      const token = tokenRef.current || (await getAccessToken());
      if (!token) throw new Error("Sign in terlebih dahulu.");
      const res = await fetch("/api/mcp-auth/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          connectionId: item.id,
          endpointUrl,
          serverTitle: title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memulai otorisasi MCP.");

      if (data.mode === "oauth" && data.authorizeUrl) {
        window.location.assign(data.authorizeUrl);
        return;
      }
      if (data.mode === "none") {
        setBanner({ type: "success", text: data.message || `${title} aktif tanpa login.` });
        setAuthorizedPrefixes((prev) => {
          const next = new Set(prev);
          next.add(String(item.id).slice(0, 12));
          return next;
        });
        await load();
        loadToolsForConnection(item, true);
        return;
      }
      if (data.mode === "bearer") {
        setBearerTarget({
          id: item.id,
          title,
          endpointUrl,
          note: data.message,
          tokenPortalUrl: data.tokenPortalUrl || "",
          tokenPortalLabel: data.tokenPortalLabel || "Buat Token Provider",
          oauthAppPortalUrl: data.oauthAppPortalUrl || "",
          oauthAppPortalLabel: data.oauthAppPortalLabel || "Buat OAuth App",
          supportsOAuthApp: Boolean(data.supportsOAuthApp),
          callbackUrl: data.callbackUrl || `${window.location.origin}/api/mcp-auth/callback`,
        });
        setAuthModeTab("token");
        setBearerValue("");
        setOauthClientId("");
        setOauthClientSecret("");
      }
    } catch (err) {
      setBanner({ type: "error", text: err?.message || "Gagal otorisasi MCP." });
    } finally {
      setAuthBusyId("");
    }
  }

  async function saveManualAuth(event) {
    event.preventDefault();
    if (!bearerTarget) return;
    setAuthBusyId(bearerTarget.id);
    setBanner({ type: "", text: "" });
    try {
      const token = tokenRef.current || (await getAccessToken());
      const payload =
        authModeTab === "oauth_app"
          ? {
              connectionId: bearerTarget.id,
              endpointUrl: bearerTarget.endpointUrl,
              serverTitle: bearerTarget.title,
              oauthClientId: oauthClientId.trim(),
              oauthClientSecret: oauthClientSecret.trim(),
            }
          : {
              connectionId: bearerTarget.id,
              endpointUrl: bearerTarget.endpointUrl,
              serverTitle: bearerTarget.title,
              bearerToken: bearerValue.trim(),
            };

      const res = await fetch("/api/mcp-auth/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan kredensial.");

      if (data.mode === "oauth" && data.authorizeUrl) {
        window.location.assign(data.authorizeUrl);
        return;
      }

      setBanner({
        type: "success",
        text: `Token untuk ${bearerTarget.title} berhasil disimpan & aktif.`,
      });
      const savedTarget = bearerTarget;
      setAuthorizedPrefixes((prev) => {
        const next = new Set(prev);
        next.add(String(savedTarget.id).slice(0, 12));
        return next;
      });
      setBearerTarget(null);
      setBearerValue("");
      await load();
      loadToolsForConnection(
        { id: savedTarget.id, server: { endpoint_url: savedTarget.endpointUrl } },
        true
      );
    } catch (err) {
      setBanner({ type: "error", text: err?.message || "Gagal menyimpan kredensial." });
    } finally {
      setAuthBusyId("");
    }
  }

  async function toggleConnection(item) {
    const prevEnabled = Boolean(item.enabled);
    const nextEnabled = !prevEnabled;
    setBanner({ type: "", text: "" });

    setConnections((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, enabled: nextEnabled } : row))
    );

    try {
      const token = tokenRef.current || (await getAccessToken());
      if (!token) throw new Error("Session expired. Sign in again.");
      tokenRef.current = token;

      const response = await fetch("/api/connections", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: item.id, enabled: nextEnabled }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Could not update toggle state.");
      }
    } catch (err) {
      setConnections((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, enabled: prevEnabled } : row))
      );
      setBanner({ type: "error", text: err?.message || "Could not update MCP state." });
    }
  }

  async function removeConnection(item) {
    const snapshot = connections;
    setBanner({ type: "", text: "" });
    setConnections((prev) => prev.filter((row) => row.id !== item.id));
    try {
      const token = tokenRef.current || (await getAccessToken());
      if (!token) throw new Error("Session expired.");
      const response = await fetch(`/api/connections?id=${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Could not remove connection.");
      }
      window.dispatchEvent(new Event("drive:connections-changed"));
    } catch (err) {
      setConnections(snapshot);
      setBanner({ type: "error", text: err?.message || "Could not remove connection." });
    }
  }

  async function copyUrl(id, url) {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(""), 1400);
    } catch {}
  }

  const activeCount = useMemo(
    () => connections.filter((item) => item.enabled).length,
    [connections]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return connections.filter((item) => {
      if (filter === "active" && !item.enabled) return false;
      if (filter === "off" && item.enabled) return false;
      if (!q) return true;
      const hay = [
        item.server?.title,
        item.server?.display_name,
        item.server?.server_name,
        item.server?.endpoint_url,
        item.server?.description,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [connections, filter, search]);

  return (
    <section className="my-mcps-section" id="my-mcps">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            <span className="pulse" /> MY WORKSPACE
          </div>
          <h1>My MCPs</h1>
        </div>
        <button type="button" className="glass-chip-btn" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>

      <div className="my-mcp-summary-strip">
        <div className="my-mcp-stat">
          <strong>{connections.length}</strong>
          <span>SAVED</span>
        </div>
        <div className="my-mcp-stat">
          <strong style={{ color: "#7cd4ff" }}>{activeCount}</strong>
          <span>ACTIVE</span>
        </div>
        <div className="my-mcp-filter-pills">
          {[
            { id: "all", label: "All" },
            { id: "active", label: "Active" },
            { id: "off", label: "Off" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`category-chip ${filter === tab.id ? "is-active" : ""}`}
              onClick={() => setFilter(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="catalog-search" style={{ marginBottom: 12 }}>
        <Search size={14} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter saved connections..."
          aria-label="Filter saved connections"
        />
      </div>

      {banner.text && (
        <div
          className={`custom-form-alert ${banner.type === "error" ? "is-error" : "is-success"}`}
          role={banner.type === "error" ? "alert" : "status"}
          style={{ marginBottom: 12 }}
        >
          <span>{banner.text}</span>
        </div>
      )}

      {bearerTarget && (
        <form
          className="custom-form-clean"
          onSubmit={saveManualAuth}
          style={{ marginBottom: 14 }}
        >
          <div className="custom-fields">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#7cd4ff", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <KeyRound size={13} /> CONNECT — {bearerTarget.title.toUpperCase()}
              </span>
              {bearerTarget.supportsOAuthApp && (
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className={`category-chip ${authModeTab === "token" ? "is-active" : ""}`}
                    onClick={() => setAuthModeTab("token")}
                  >
                    Access Token (PAT)
                  </button>
                  <button
                    type="button"
                    className={`category-chip ${authModeTab === "oauth_app" ? "is-active" : ""}`}
                    onClick={() => setAuthModeTab("oauth_app")}
                  >
                    OAuth App
                  </button>
                </div>
              )}
            </div>

            <p className="custom-form-hint" style={{ marginTop: 0 }}>
              {bearerTarget.note}
            </p>

            {authModeTab === "token" ? (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {bearerTarget.tokenPortalUrl && (
                    <a
                      href={bearerTarget.tokenPortalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="glass-chip-btn"
                      style={{ textDecoration: "none" }}
                    >
                      <ExternalLink size={12} /> {bearerTarget.tokenPortalLabel}
                    </a>
                  )}
                  {bearerTarget.oauthAppPortalUrl && (
                    <a
                      href={bearerTarget.oauthAppPortalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="glass-chip-btn"
                      style={{ textDecoration: "none" }}
                    >
                      <ExternalLink size={12} /> {bearerTarget.oauthAppPortalLabel}
                    </a>
                  )}
                </div>
                <label className="custom-field-label">
                  <span>API KEY / PERSONAL ACCESS TOKEN</span>
                  <input
                    type="password"
                    value={bearerValue}
                    onChange={(e) => setBearerValue(e.target.value)}
                    placeholder="Tempel token dari provider di sini..."
                    required
                  />
                </label>
              </>
            ) : (
              <>
                {bearerTarget.oauthAppPortalUrl && (
                  <a
                    href={bearerTarget.oauthAppPortalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="glass-chip-btn"
                    style={{ width: "fit-content", textDecoration: "none" }}
                  >
                    <ExternalLink size={12} /> {bearerTarget.oauthAppPortalLabel}
                  </a>
                )}
                <div className="custom-policy-pills">
                  <span>Callback URL: {bearerTarget.callbackUrl}</span>
                  <button
                    type="button"
                    className="glass-chip-btn"
                    onClick={() => copyUrl("oauth-cb", bearerTarget.callbackUrl)}
                  >
                    {copiedId === "oauth-cb" ? <Check size={11} /> : <Copy size={11} />}
                    {copiedId === "oauth-cb" ? "Copied" : "Copy Callback"}
                  </button>
                </div>
                <label className="custom-field-label">
                  <span>OAUTH CLIENT ID</span>
                  <input
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    placeholder="Masukkan Client ID dari OAuth App provider..."
                    required
                  />
                </label>
                <label className="custom-field-label">
                  <span>OAUTH CLIENT SECRET (OPTIONAL)</span>
                  <input
                    type="password"
                    value={oauthClientSecret}
                    onChange={(e) => setOauthClientSecret(e.target.value)}
                    placeholder="Masukkan Client Secret jika diminta provider..."
                  />
                </label>
              </>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="submit"
                className="custom-submit-btn"
                disabled={authBusyId === bearerTarget.id}
              >
                {authModeTab === "oauth_app" ? "Continue OAuth Login" : "Save Token"}
              </button>
              <button
                type="button"
                className="glass-chip-btn"
                onClick={() => setBearerTarget(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="empty-state">
          <LoaderCircle size={22} className="spin" />
          <h3>Loading My MCPs...</h3>
        </div>
      ) : !signedIn ? (
        <div className="empty-state">
          <ShieldCheck size={22} />
          <h3>Sign in required</h3>
          <p>Buka tab Account untuk sign in dan kelola MCP kamu.</p>
        </div>
      ) : visible.length === 0 ? (
        <div className="empty-state">
          <Cable size={22} />
          <h3>Belum ada MCP tersimpan</h3>
          <p>Buka tab Directory lalu klik Connect di MCP yang kamu butuhkan.</p>
        </div>
      ) : (
        <div className="my-mcp-list">
          {visible.map((item) => {
            const title =
              item.server?.title ||
              item.server?.display_name ||
              item.server?.server_name ||
              "MCP Server";
            const endpoint =
              item.server?.endpoint_url ||
              item.server?.remote_url ||
              item.server?.remotes?.[0]?.url ||
              "";
            const isCustom = item.source === "custom" || Boolean(item.custom_server_id);
            const enabled = Boolean(item.enabled);
            const isAuthorizing = authBusyId === item.id;
            const isToolsOpen = openToolsId === item.id;
            const toolState = toolsById[item.id];
            const authInfo = getAuthMethodLabel(endpoint);
            const isAuthorized =
              authInfo.label === "No Auth" ||
              authorizedPrefixes.has(String(item.id).slice(0, 12)) ||
              (toolState?.loaded && !toolState?.requiresAuth && toolState?.total > 0);
            const toolFilter = (toolSearchById[item.id] || "").trim().toLowerCase();
            const filteredTools = (toolState?.tools || []).filter((t) => {
              if (!toolFilter) return true;
              return `${t.name} ${t.description}`.toLowerCase().includes(toolFilter);
            });

            return (
              <article key={item.id} className="my-mcp-row-card">
                <div className="my-mcp-row-main">
                  <div className="integration-icon">
                    <Cable size={16} />
                  </div>
                  <div className="my-mcp-row-copy">
                    <div className="my-mcp-row-title">
                      <strong>{title}</strong>
                      <span className="status">{isCustom ? "CUSTOM" : "REMOTE"}</span>
                      <span className={`transport-pill ${authInfo.cls}`}>{authInfo.label}</span>
                      {isAuthorized && (
                        <span className="status is-enabled">
                          <CheckCircle2 size={10} /> Connected
                        </span>
                      )}
                    </div>
                    <p>{endpoint || item.server?.description || "Connected via DRIVE MCP"}</p>
                    <div className="my-mcp-row-actions">
                      {endpoint && (
                        <button
                          type="button"
                          className="glass-chip-btn"
                          onClick={() => loadToolsForConnection(item)}
                        >
                          <Wrench size={11} />
                          {toolState?.loaded && toolState.total > 0
                            ? `Tools (${toolState.total})`
                            : "Tools"}
                          {isToolsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      )}
                      {endpoint && !isAuthorized && (
                        <button
                          type="button"
                          className="glass-chip-btn"
                          onClick={() => authorizeUpstream(item)}
                          disabled={isAuthorizing}
                        >
                          {isAuthorizing ? (
                            <LoaderCircle size={11} className="spin" />
                          ) : (
                            <ArrowUpRight size={11} />
                          )}
                          {isAuthorizing ? "Checking..." : "Authorize"}
                        </button>
                      )}
                      {endpoint && (
                        <button
                          type="button"
                          className="glass-chip-btn"
                          onClick={() => copyUrl(item.id, endpoint)}
                        >
                          {copiedId === item.id ? <Check size={11} /> : <Copy size={11} />}
                          {copiedId === item.id ? "Copied" : "Copy URL"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="glass-chip-btn"
                        onClick={() => removeConnection(item)}
                        aria-label={`Remove ${title}`}
                      >
                        <Trash2 size={11} /> Remove
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`Toggle ${title}`}
                    className={`ios-toggle ${enabled ? "is-on" : ""}`}
                    onClick={() => toggleConnection(item)}
                  >
                    <span className="ios-toggle-thumb" />
                  </button>
                </div>

                {isToolsOpen && (
                  <div className="mcp-tools-drawer">
                    {toolState?.loading ? (
                      <div className="mcp-tools-status">
                        <LoaderCircle size={14} className="spin" />
                        <span>Mengambil daftar tools dari {title}...</span>
                      </div>
                    ) : toolState?.requiresAuth ? (
                      <div className="mcp-tools-status">
                        <span>{toolState.message || "Perlu otorisasi untuk membaca daftar tools."}</span>
                        <button
                          type="button"
                          className="glass-chip-btn"
                          onClick={() => authorizeUpstream(item)}
                        >
                          <ArrowUpRight size={11} /> Authorize sekarang
                        </button>
                      </div>
                    ) : toolState?.error ? (
                      <div className="mcp-tools-status">
                        <span>{toolState.error}</span>
                        <button
                          type="button"
                          className="glass-chip-btn"
                          onClick={() => loadToolsForConnection(item, true)}
                        >
                          <RefreshCw size={11} /> Retry
                        </button>
                      </div>
                    ) : (toolState?.tools || []).length === 0 ? (
                      <div className="mcp-tools-status">
                        <span>Server tidak melaporkan tools publik saat ini.</span>
                      </div>
                    ) : (
                      <>
                        <div className="mcp-tools-head">
                          <strong>{toolState.total} tools siap digunakan</strong>
                          <button
                            type="button"
                            className="glass-chip-btn"
                            onClick={() => loadToolsForConnection(item, true)}
                          >
                            <RefreshCw size={11} /> Refresh
                          </button>
                        </div>
                        {toolState.total > 6 && (
                          <input
                            className="mcp-tools-search"
                            value={toolSearchById[item.id] || ""}
                            onChange={(e) =>
                              setToolSearchById((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            placeholder={`Filter ${toolState.total} tools...`}
                            aria-label={`Filter tools for ${title}`}
                          />
                        )}
                        <div className="mcp-tools-list">
                          {filteredTools.map((tool) => (
                            <div key={tool.name} className="mcp-tool-item">
                              <code>{tool.name}</code>
                              {tool.description && <p>{tool.description}</p>}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
