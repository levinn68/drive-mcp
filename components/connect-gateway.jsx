"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft,
  Cable,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  LockKeyhole,
  Plus,
  Power,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

function getRemoteUrl(entry) {
  const server = entry?.server || entry || {};
  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const preferred = remotes.find((item) => {
    if (typeof item?.url !== "string" || !item.url.startsWith("https://")) return false;
    const kind = String(item?.type || item?.transport || "streamable_http").trim();
    return /^(streamable.?http|http)$/i.test(kind);
  });
  return (preferred || remotes.find((item) => typeof item?.url === "string" && item.url.startsWith("https://")))?.url || "";
}

export default function ConnectGateway({
  serverParam = "",
  queryParam = "",
  endpointParam = "",
  initialEntry = null,
  candidates = [],
  lookupError = null,
}) {
  const router = useRouter();
  const [selectedEntry, setSelectedEntry] = useState(initialEntry);
  const [searchInput, setSearchInput] = useState(serverParam || queryParam || "");
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [connections, setConnections] = useState([]);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState(lookupError || "");

  const [customName, setCustomName] = useState(serverParam || queryParam || "");
  const [customEndpoint, setCustomEndpoint] = useState(endpointParam || "");
  const [customBusy, setCustomBusy] = useState(false);

  useEffect(() => {
    setSelectedEntry(initialEntry);
    setSearchInput(serverParam || queryParam || "");
    setCustomName(serverParam || queryParam || "");
    setCustomEndpoint(endpointParam || "");
  }, [initialEntry, serverParam, queryParam, endpointParam]);

  const loadSessionAndConnections = useCallback(async () => {
    setAuthLoading(true);
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) {
        setErrorMessage("Supabase authentication is not configured.");
        return;
      }
      const supabase = createBrowserClient(url, key);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession || null);
      if (!currentSession) {
        setConnections([]);
        return;
      }
      const res = await fetch("/api/connections", {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.connections)) {
        setConnections(data.connections);
      }
    } catch (err) {
      setErrorMessage(err?.message || "Could not load DRIVE session.");
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSessionAndConnections();
  }, [loadSessionAndConnections]);

  async function signInWithGoogle() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return;
    const supabase = createBrowserClient(url, key);
    const nextPath = `${window.location.pathname}${window.location.search}`;
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    router.push(`/connect?query=${encodeURIComponent(trimmed)}`);
  }

  async function copyDirectLink() {
    if (typeof window === "undefined") return;
    const activeName = (selectedEntry?.server || selectedEntry)?.name;
    const link = activeName
      ? `${window.location.origin}/connect?server=${encodeURIComponent(activeName)}`
      : window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  const activeServer = selectedEntry?.server || selectedEntry || null;
  const activeRemoteUrl = getRemoteUrl(selectedEntry);
  const existingConnection = activeServer?.name
    ? connections.find((c) => c.server?.server_name === activeServer.name)
    : null;

  async function connectRegistryServer(entry) {
    if (!session?.access_token) return;
    const server = entry?.server || entry || {};
    setBusy(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const res = await fetch("/api/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          serverName: server.name,
          version: server.version,
          registryEntry: entry,
          enabled: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error([data.error, data.detail].filter(Boolean).join(": ") || "Could not connect MCP server.");
      }
      setStatusMessage(`${server.title || server.name} sekarang terhubung dan aktif di gateway DRIVE MCP kamu.`);
      await loadSessionAndConnections();
    } catch (err) {
      setErrorMessage(err?.message || "Connection failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleConnection(conn) {
    if (!session?.access_token) return;
    setBusy(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const res = await fetch("/api/connections", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: conn.id, enabled: !conn.enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update connection.");
      setStatusMessage(!conn.enabled ? "MCP diaktifkan kembali di gateway DRIVE." : "MCP dijeda sementara di gateway DRIVE.");
      await loadSessionAndConnections();
    } catch (err) {
      setErrorMessage(err?.message || "Update failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnectConnection(conn) {
    if (!session?.access_token) return;
    setBusy(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const res = await fetch(`/api/connections?id=${encodeURIComponent(conn.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not disconnect MCP.");
      setStatusMessage("Koneksi MCP dihapus dari akun DRIVE kamu.");
      await loadSessionAndConnections();
    } catch (err) {
      setErrorMessage(err?.message || "Disconnect failed.");
    } finally {
      setBusy(false);
    }
  }

  async function connectCustomServer(event) {
    event.preventDefault();
    if (!session?.access_token) return;
    setCustomBusy(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const registerRes = await fetch("/api/custom-servers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          displayName: customName.trim(),
          endpointUrl: customEndpoint.trim(),
        }),
      });
      const registerData = await registerRes.json();
      if (!registerRes.ok) {
        throw new Error(registerData.error || "Could not verify custom MCP endpoint.");
      }
      const customId = registerData.server?.id || registerData.id;
      if (customId) {
        const connRes = await fetch("/api/connections", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ customServerId: customId, enabled: true }),
        });
        const connData = await connRes.json();
        if (!connRes.ok) {
          throw new Error([connData.error, connData.detail].filter(Boolean).join(": ") || "Registered server, but could not enable it.");
        }
      }
      setStatusMessage(`${customName.trim()} berhasil diverifikasi dan aktif di gateway DRIVE MCP kamu.`);
      await loadSessionAndConnections();
    } catch (err) {
      setErrorMessage(err?.message || "Could not connect custom MCP server.");
    } finally {
      setCustomBusy(false);
    }
  }

  const targetLabel = activeServer?.title || activeServer?.name || serverParam || queryParam || "MCP Gateway";

  return (
    <main className="connect-shell">
      <nav className="connect-topbar" aria-label="Gateway navigation">
        <Link href="/#mcp" className="connect-back-link">
          <ArrowLeft size={15} /> Workspace
        </Link>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/marketplace" className="connect-back-link">
            <Sparkles size={15} /> Marketplace
          </Link>
          <button type="button" className="connect-back-link" onClick={copyDirectLink}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Link Copied" : "Copy Direct URL"}
          </button>
        </div>
      </nav>

      <section className="connect-panel" aria-labelledby="connect-heading">
        <div className="connect-eyebrow">
          <Cable size={14} /> DRIVE MCP DIRECT GATEWAY
        </div>

        <h1 id="connect-heading" className="connect-title">
          Connect {targetLabel}
        </h1>
        <p className="connect-subtitle">
          Hubungkan MCP server langsung ke akun DRIVE kamu. Begitu aktif, AI provider yang terhubung ke DRIVE MCP otomatis bisa membaca dan memakai tool dari server ini.
        </p>

        <form onSubmit={handleSearchSubmit} className="connect-search-row" role="search">
          <input
            type="search"
            className="connect-input"
            aria-label="Search MCP server to connect"
            placeholder="Cari MCP lain (contoh: figcraft, github, supabase, context7)..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
          <button type="submit" className="connect-btn">
            <Search size={15} /> Cari
          </button>
        </form>

        <div aria-live="polite">
          {errorMessage && (
            <div className="connect-alert is-error" role="alert">
              {errorMessage}
            </div>
          )}
          {statusMessage && (
            <div className="connect-alert is-success" role="status">
              <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {authLoading ? (
          <div className="connect-card" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Loader2 size={16} className="spin" /> Memeriksa sesi DRIVE kamu...
          </div>
        ) : !session ? (
          <div className="connect-card">
            <div className="connect-card-head">
              <div>
                <h2 className="connect-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <LockKeyhole size={18} /> Masuk ke DRIVE
                </h2>
                <p className="connect-card-meta" style={{ marginTop: 6 }}>
                  Login dulu agar koneksi MCP tersimpan khusus ke akun kamu. Setelah login, kamu otomatis kembali ke halaman ini.
                </p>
              </div>
            </div>
            <div className="connect-actions" style={{ marginTop: 16 }}>
              <button type="button" className="connect-btn is-primary" onClick={signInWithGoogle}>
                Sign in with Google
              </button>
            </div>
          </div>
        ) : null}

        {activeServer && (
          <article className="connect-card">
            <div className="connect-card-head">
              <div>
                <h2 className="connect-card-title">{activeServer.title || activeServer.name}</h2>
                <div className="connect-card-meta">
                  {activeServer.name} {activeServer.version ? `· v${activeServer.version}` : ""}
                </div>
              </div>
              {activeServer.repository?.url && (
                <a
                  href={activeServer.repository.url}
                  target="_blank"
                  rel="noreferrer"
                  className="connect-back-link"
                >
                  Source <ExternalLink size={13} />
                </a>
              )}
            </div>

            <div className="connect-badges">
              <span className={`connect-pill ${activeRemoteUrl ? "is-ready" : ""}`}>
                <Globe size={12} /> {activeRemoteUrl ? "1-Click Remote HTTPS" : "Local / STDIO Package"}
              </span>
              {existingConnection && (
                <span className={`connect-pill ${existingConnection.enabled ? "is-active" : ""}`}>
                  {existingConnection.enabled ? "Active in DRIVE" : "Paused"}
                </span>
              )}
            </div>

            {activeServer.description && (
              <p className="connect-subtitle" style={{ marginBottom: 14 }}>
                {activeServer.description}
              </p>
            )}

            {activeRemoteUrl ? (
              <div className="connect-endpoint">
                Remote endpoint: <code>{activeRemoteUrl}</code>
              </div>
            ) : (
              <p className="connect-card-meta" style={{ marginBottom: 16, lineHeight: 1.55 }}>
                Entry ini belum mencantumkan remote Streamable HTTP endpoint di registry publik. Kalau kamu punya URL endpoint-nya, langsung tempel di form Custom Remote MCP di bawah.
              </p>
            )}

            {session && activeRemoteUrl && (
              <div className="connect-actions">
                {existingConnection ? (
                  <>
                    <button
                      type="button"
                      className={`connect-btn ${existingConnection.enabled ? "" : "is-primary"}`}
                      disabled={busy}
                      onClick={() => toggleConnection(existingConnection)}
                    >
                      {busy ? <Loader2 size={15} className="spin" /> : <Power size={15} />}
                      {existingConnection.enabled ? "Pause MCP" : "Enable in DRIVE"}
                    </button>
                    <button
                      type="button"
                      className="connect-btn is-danger"
                      disabled={busy}
                      onClick={() => disconnectConnection(existingConnection)}
                    >
                      <Trash2 size={15} /> Disconnect
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="connect-btn is-primary"
                    disabled={busy}
                    onClick={() => connectRegistryServer(selectedEntry)}
                  >
                    {busy ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
                    Connect &amp; Enable in DRIVE
                  </button>
                )}
                <Link href="/#mcp" className="connect-btn">
                  Open My MCPs
                </Link>
              </div>
            )}
          </article>
        )}

        {candidates.length > 1 && (
          <section aria-label="Matching MCP servers">
            <h3 className="connect-eyebrow" style={{ color: "#b9c8d9", marginBottom: 10 }}>
              Kandidat MCP yang Cocok ({candidates.length})
            </h3>
            <div className="connect-candidates">
              {candidates.map((entry) => {
                const s = entry.server || entry;
                const isSelected = activeServer?.name === s.name;
                const remoteReady = Boolean(getRemoteUrl(entry));
                return (
                  <button
                    key={`${s.name}@${s.version}`}
                    type="button"
                    className={`connect-candidate ${isSelected ? "is-selected" : ""}`}
                    onClick={() => setSelectedEntry(entry)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{s.title || s.name}</div>
                      <div className="connect-card-meta">{s.name}</div>
                    </div>
                    <span className={`connect-pill ${remoteReady ? "is-ready" : ""}`}>
                      {remoteReady ? "Remote Ready" : "STDIO"}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {session && (!activeRemoteUrl || endpointParam) && (
          <form onSubmit={connectCustomServer} className="connect-card" style={{ marginBottom: 0 }}>
            <h3 className="connect-card-title" style={{ fontSize: 17, marginBottom: 6 }}>
              Connect Custom Remote MCP Gateway
            </h3>
            <p className="connect-card-meta" style={{ marginBottom: 16, lineHeight: 1.5 }}>
              Punya URL Streamable HTTP sendiri (misalnya server pribadi atau Figcraft hosted endpoint)? Masukkan di sini untuk verifikasi &amp; aktivasi instan.
            </p>
            <div className="connect-form-grid">
              <label className="connect-label">
                Nama MCP
                <input
                  type="text"
                  required
                  className="connect-input"
                  placeholder="Contoh: Figcraft"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                />
              </label>
              <label className="connect-label">
                Endpoint URL (HTTPS)
                <input
                  type="url"
                  required
                  className="connect-input"
                  placeholder="https://example.com/mcp"
                  value={customEndpoint}
                  onChange={(e) => setCustomEndpoint(e.target.value)}
                />
              </label>
            </div>
            <div className="connect-actions">
              <button type="submit" className="connect-btn is-primary" disabled={customBusy}>
                {customBusy ? <Loader2 size={15} className="spin" /> : <Cable size={15} />}
                Verify &amp; Connect Custom MCP
              </button>
            </div>
          </form>
        )}
      </section>
    </main>
  );
}
