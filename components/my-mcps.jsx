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
import { useDriveLang } from "./lang-context";

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

function getAuthMethodLabel(endpointUrl, lang) {
  const lower = String(endpointUrl || "").toLowerCase();
  if (!lower) return { label: "STDIO", cls: "", isNoAuth: false };
  if (
    lower.includes("context7.com") ||
    lower.includes("deepwiki.com") ||
    lower.includes("developers.openai.com") ||
    lower.includes("docs.mcp.cloudflare.com")
  ) {
    return {
      label: lang === "en" ? "No Auth" : "Tanpa Auth",
      cls: "is-auth-none",
      isNoAuth: true,
    };
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
    return { label: "PAT / Token", cls: "is-auth-pat", isNoAuth: false };
  }
  if (lower.includes("figma.com")) {
    return {
      label: lang === "en" ? "OAuth Catalog" : "OAuth Katalog",
      cls: "is-auth-pat",
      isNoAuth: false,
    };
  }
  return { label: "OAuth 2.1", cls: "is-auth-oauth", isNoAuth: false };
}

export function AddMcpButton({
  serverName,
  version,
  registryEntry,
  remoteAvailable,
  onConnected,
}) {
  const { t } = useDriveLang();
  const [state, setState] = useState("idle");

  async function add() {
    const supabase = getSupabase();
    if (!supabase) {
      setState("Auth not configured");
      return;
    }
    setState("adding");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`,
          },
        });
        return;
      }

      const response = await fetch("/api/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ serverName, version, registryEntry }),
      });
      const result = await response.json();
      if (!response.ok) {
        setState(result.error || t("Gagal menyambungkan", "Could not connect"));
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
            Authorization: `Bearer ${session.access_token}`,
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
                tokenPortalLabel:
                  authData.tokenPortalLabel || t("Buat Token Provider", "Create Provider Token"),
                oauthAppPortalUrl: authData.oauthAppPortalUrl || "",
                oauthAppPortalLabel:
                  authData.oauthAppPortalLabel || t("Buat OAuth App", "Create OAuth App"),
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
      setState(t("Error jaringan", "Network error"));
    }
  }

  const isAdding = state === "adding";
  const isAdded = state === "added";
  const isError = state !== "idle" && !isAdding && !isAdded;

  return (
    <button
      type="button"
      className={`add-mcp-btn ${isAdded ? "is-installed" : ""}`}
      onClick={add}
      disabled={isAdding}
      title={
        isError
          ? state
          : remoteAvailable
          ? t("Sambungkan & otorisasi ke MCP resmi", "Connect & redirect to original MCP authorization")
          : t("Simpan MCP ini ke workspace kamu", "Save this MCP entry to your workspace")
      }
    >
      {isAdding ? (
        <LoaderCircle size={13} className="spin" />
      ) : isAdded ? (
        <Check size={13} />
      ) : (
        <Plus size={13} />
      )}
      <span>
        {isAdding
          ? t("Menyambungkan...", "Connecting...")
          : isAdded
          ? t("Tersambung", "Connected")
          : isError
          ? t("Coba Lagi", "Retry")
          : t("Sambungkan", "Connect")}
      </span>
    </button>
  );
}

export default function MyMcpPanel() {
  const { lang, t } = useDriveLang();
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
        setAuthorizedPrefixes(new Set());
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
      setBanner({
        type: "error",
        text: err?.message || t("Gagal memuat koneksi tersimpan.", "Could not load saved connections."),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => {
      load();
      const params = new URLSearchParams(window.location.search);
      const authStatus = params.get("mcp_auth");
      if (authStatus === "connected") {
        const srv = params.get("server") || "MCP";
        setBanner({
          type: "success",
          text:
            lang === "en"
              ? `${srv} authorized via OAuth and active in your DRIVE account!`
              : `${srv} berhasil diotorisasi via OAuth & langsung aktif di akun DRIVE kamu!`,
        });
        params.delete("mcp_auth");
        params.delete("server");
        const clean = params.toString();
        window.history.replaceState(
          null,
          "",
          clean ? `${window.location.pathname}?${clean}` : window.location.pathname
        );
      } else if (authStatus === "error") {
        setBanner({
          type: "error",
          text: `OAuth error: ${params.get("reason") || "authorization_failed"}`,
        });
        params.delete("mcp_auth");
        params.delete("reason");
        const clean = params.toString();
        window.history.replaceState(
          null,
          "",
          clean ? `${window.location.pathname}?${clean}` : window.location.pathname
        );
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
  }, [load, lang]);

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
      if (!token) throw new Error(t("Masuk terlebih dahulu.", "Sign in required."));
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
          error: err?.message || t("Gagal memuat daftar tools.", "Failed to load tools list."),
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
      item.server?.title ||
      item.server?.display_name ||
      item.server?.server_name ||
      item.server_name ||
      "MCP Server";

    if (!endpointUrl) {
      setBanner({
        type: "error",
        text: t("MCP ini tidak memiliki endpoint HTTPS remote.", "This MCP has no remote HTTPS endpoint."),
      });
      return;
    }

    setAuthBusyId(item.id);
    setBanner({ type: "", text: "" });
    try {
      const token = tokenRef.current || (await getAccessToken());
      if (!token) throw new Error(t("Masuk terlebih dahulu.", "Sign in required."));
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
      if (!res.ok) throw new Error(data.error || t("Gagal memulai otorisasi MCP.", "Failed to start MCP authorization."));

      if (data.mode === "oauth" && data.authorizeUrl) {
        window.location.assign(data.authorizeUrl);
        return;
      }
      if (data.mode === "none") {
        setBanner({
          type: "success",
          text: data.message || t(`${title} aktif tanpa login.`, `${title} active without login.`),
        });
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
          tokenPortalLabel: data.tokenPortalLabel || t("Buat Token Provider", "Create Provider Token"),
          oauthAppPortalUrl: data.oauthAppPortalUrl || "",
          oauthAppPortalLabel: data.oauthAppPortalLabel || t("Buat OAuth App", "Create OAuth App"),
          supportsOAuthApp: Boolean(data.supportsOAuthApp),
          callbackUrl: data.callbackUrl || `${window.location.origin}/api/mcp-auth/callback`,
        });
        setAuthModeTab("token");
        setBearerValue("");
        setOauthClientId("");
        setOauthClientSecret("");
      }
    } catch (err) {
      setBanner({ type: "error", text: err?.message || t("Gagal otorisasi MCP.", "MCP authorization failed.") });
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
      if (!res.ok) throw new Error(data.error || t("Gagal menyimpan kredensial.", "Failed to save credentials."));

      if (data.mode === "oauth" && data.authorizeUrl) {
        window.location.assign(data.authorizeUrl);
        return;
      }

      setBanner({
        type: "success",
        text: t(
          `Token untuk ${bearerTarget.title} berhasil disimpan & aktif.`,
          `Token for ${bearerTarget.title} saved & active.`
        ),
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
      setBanner({
        type: "error",
        text: err?.message || t("Gagal menyimpan kredensial.", "Failed to save credentials."),
      });
    } finally {
      setAuthBusyId("");
    }
  }

  async function toggleEnabled(item) {
    const nextEnabled = !item.enabled;
    setConnections((prev) =>
      prev.map((row) => (row.id === item.id ? { ...row, enabled: nextEnabled } : row))
    );
    try {
      const token = tokenRef.current || (await getAccessToken());
      if (!token) throw new Error(t("Masuk kembali.", "Sign in again."));
      const response = await fetch(`/api/connections/${item.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: nextEnabled }),
      });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Could not update connection.");
      }
      window.dispatchEvent(new Event("drive:connections-changed"));
    } catch (err) {
      setConnections((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, enabled: item.enabled } : row))
      );
      setBanner({
        type: "error",
        text: err?.message || t("Gagal memperbarui koneksi.", "Could not update connection."),
      });
    }
  }

  async function removeConnection(item) {
    const snapshot = connections;
    setConnections((prev) => prev.filter((row) => row.id !== item.id));
    try {
      const token = tokenRef.current || (await getAccessToken());
      if (!token) throw new Error(t("Masuk kembali.", "Sign in again."));
      const response = await fetch(`/api/connections/${item.id}`, {
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
      setBanner({
        type: "error",
        text: err?.message || t("Gagal menghapus koneksi.", "Could not remove connection."),
      });
    }
  }

  function copyUrl(id, url) {
    if (!url) return;
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((prev) => (prev === id ? "" : prev)), 1400);
  }

  const activeCount = useMemo(
    () => connections.filter((item) => item.enabled).length,
    [connections]
  );

  const visibleConnections = useMemo(() => {
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
        item.server_name,
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
            <span className="pulse" /> {t("WORKSPACE SAYA", "MY WORKSPACE")}
          </div>
          <h1>{t("MCP Saya", "My MCPs")}</h1>
        </div>
        <button type="button" className="glass-chip-btn" onClick={load} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} /> {t("Muat Ulang", "Refresh")}
        </button>
      </div>

      {banner.text && (
        <div
          className={`custom-form-alert ${banner.type === "error" ? "is-error" : "is-success"}`}
          style={{ marginBottom: 12 }}
          role={banner.type === "error" ? "alert" : "status"}
        >
          <span>{banner.text}</span>
          <button
            type="button"
            className="glass-chip-btn"
            onClick={() => setBanner({ type: "", text: "" })}
          >
            OK
          </button>
        </div>
      )}

      <div className="my-mcp-summary-strip">
        <div className="my-mcp-counts">
          <div>
            <strong>{connections.length}</strong>
            <span>{t("TERSIMPAN", "SAVED")}</span>
          </div>
          <div>
            <strong className="is-accent">{activeCount}</strong>
            <span>{t("AKTIF", "ACTIVE")}</span>
          </div>
        </div>
        <div className="my-mcp-filters" role="group" aria-label={t("Filter koneksi", "Filter connections")}>
          {[
            { id: "all", label: t("Semua", "All") },
            { id: "active", label: t("Aktif", "Active") },
            { id: "off", label: t("Nonaktif", "Off") },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={`category-chip ${filter === opt.id ? "is-active" : ""}`}
              onClick={() => setFilter(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="catalog-search" style={{ marginBottom: 12 }}>
        <Search size={15} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("Filter koneksi tersimpan...", "Filter saved connections...")}
          aria-label={t("Filter koneksi tersimpan", "Filter saved connections")}
        />
      </div>

      {bearerTarget && (
        <form
          className="custom-form-clean"
          onSubmit={saveManualAuth}
          style={{ marginBottom: 14 }}
        >
          <div className="custom-fields">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#7cd4ff", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <KeyRound size={13} /> {t("SAMBUNGKAN", "CONNECT")} — {bearerTarget.title.toUpperCase()}
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
                    placeholder={t("Tempel token dari provider di sini...", "Paste your provider token here...")}
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
                    {copiedId === "oauth-cb" ? t("Disalin", "Copied") : t("Salin Callback", "Copy Callback")}
                  </button>
                </div>
                <label className="custom-field-label">
                  <span>OAUTH CLIENT ID</span>
                  <input
                    value={oauthClientId}
                    onChange={(e) => setOauthClientId(e.target.value)}
                    placeholder={t("Masukkan Client ID dari OAuth App provider...", "Enter Client ID from provider OAuth App...")}
                    required
                  />
                </label>
                <label className="custom-field-label">
                  <span>{t("OAUTH CLIENT SECRET (OPSIONAL)", "OAUTH CLIENT SECRET (OPTIONAL)")}</span>
                  <input
                    type="password"
                    value={oauthClientSecret}
                    onChange={(e) => setOauthClientSecret(e.target.value)}
                    placeholder={t("Masukkan Client Secret jika diminta provider...", "Enter Client Secret if required...")}
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
                {authModeTab === "oauth_app"
                  ? t("Lanjut Login OAuth", "Continue OAuth Login")
                  : t("Simpan Token", "Save Token")}
              </button>
              <button
                type="button"
                className="glass-chip-btn"
                onClick={() => setBearerTarget(null)}
              >
                {t("Batal", "Cancel")}
              </button>
            </div>
          </div>
        </form>
      )}

      {!signedIn ? (
        <div className="empty-state">
          <ShieldCheck size={22} />
          <h3>{t("Masuk untuk mengelola MCP kamu", "Sign in to manage your MCPs")}</h3>
          <p>{t("Buka tab Akun lalu klik Masuk dengan Google.", "Open the Account tab and tap Sign in with Google.")}</p>
        </div>
      ) : loading ? (
        <div className="empty-state">
          <LoaderCircle size={22} className="spin" />
          <h3>{t("Memuat MCP Saya...", "Loading My MCPs...")}</h3>
        </div>
      ) : visibleConnections.length === 0 ? (
        <div className="empty-state">
          <Cable size={22} />
          <h3>{t("Belum ada koneksi MCP", "No MCP connections yet")}</h3>
          <p>
            {t(
              "Buka tab Direktori untuk menyambungkan MCP resmi seperti GitHub, Supabase, atau Vercel.",
              "Open the Directory tab to connect official MCPs like GitHub, Supabase, or Vercel."
            )}
          </p>
        </div>
      ) : (
        <div className="my-mcp-list">
          {visibleConnections.map((item) => {
            const title =
              item.server?.title ||
              item.server?.display_name ||
              item.server?.server_name ||
              item.server_name ||
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
            const authInfo = getAuthMethodLabel(endpoint, lang);
            const isAuthorized =
              authInfo.isNoAuth ||
              authorizedPrefixes.has(String(item.id).slice(0, 12)) ||
              (toolState?.loaded && !toolState?.requiresAuth && toolState?.total > 0);
            const toolFilter = (toolSearchById[item.id] || "").trim().toLowerCase();
            const filteredTools = (toolState?.tools || []).filter((tool) => {
              if (!toolFilter) return true;
              return `${tool.name} ${tool.description}`.toLowerCase().includes(toolFilter);
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
                          <CheckCircle2 size={10} /> {t("Terhubung", "Connected")}
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
                          {isAuthorizing
                            ? t("Otorisasi...", "Authorizing...")
                            : t("Otorisasi", "Authorize")}
                        </button>
                      )}
                      {endpoint && (
                        <button
                          type="button"
                          className="glass-chip-btn"
                          onClick={() => copyUrl(item.id, endpoint)}
                        >
                          {copiedId === item.id ? <Check size={11} /> : <Copy size={11} />}
                          {copiedId === item.id ? t("Disalin", "Copied") : t("Salin URL", "Copy URL")}
                        </button>
                      )}
                      <button
                        type="button"
                        className="glass-chip-btn is-danger"
                        onClick={() => removeConnection(item)}
                      >
                        <Trash2 size={11} /> {t("Hapus", "Remove")}
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`Toggle ${title}`}
                    className={`ios-toggle ${enabled ? "is-on" : ""}`}
                    onClick={() => toggleEnabled(item)}
                  >
                    <span className="ios-toggle-thumb" />
                  </button>
                </div>

                {isToolsOpen && (
                  <div className="mcp-tools-drawer">
                    {toolState?.loading ? (
                      <div className="mcp-tools-status">
                        <LoaderCircle size={14} className="spin" />
                        <span>
                          {t(`Mengambil daftar tools dari ${title}...`, `Loading tools from ${title}...`)}
                        </span>
                      </div>
                    ) : toolState?.requiresAuth ? (
                      <div className="mcp-tools-status">
                        <span>
                          {toolState.message ||
                            t(
                              "Perlu otorisasi untuk membaca daftar tools.",
                              "Authorization required to list available tools."
                            )}
                        </span>
                        <button
                          type="button"
                          className="glass-chip-btn"
                          onClick={() => authorizeUpstream(item)}
                        >
                          <ArrowUpRight size={11} /> {t("Otorisasi sekarang", "Authorize now")}
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
                          <RefreshCw size={11} /> {t("Coba lagi", "Retry")}
                        </button>
                      </div>
                    ) : (toolState?.tools || []).length === 0 ? (
                      <div className="mcp-tools-status">
                        <span>
                          {t(
                            "Server tidak melaporkan tools publik saat ini.",
                            "Server did not report any public tools right now."
                          )}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="mcp-tools-head">
                          <strong>
                            {toolState.total} {t("tools siap digunakan", "tools ready to use")}
                          </strong>
                          <button
                            type="button"
                            className="glass-chip-btn"
                            onClick={() => loadToolsForConnection(item, true)}
                          >
                            <RefreshCw size={11} /> {t("Muat Ulang", "Refresh")}
                          </button>
                        </div>
                        {toolState.total > 6 && (
                          <input
                            className="mcp-tools-search"
                            value={toolSearchById[item.id] || ""}
                            onChange={(e) =>
                              setToolSearchById((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            placeholder={t(`Filter ${toolState.total} tools...`, `Filter ${toolState.total} tools...`)}
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
