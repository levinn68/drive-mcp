"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowLeft, Cable, CheckCircle2, ExternalLink, Loader2, LockKeyhole, Plus, Power } from "lucide-react";

function getRemoteUrl(entry) {
  const server = entry?.server || entry || {};
  const remotes = Array.isArray(server.remotes) ? server.remotes : [];
  const match = remotes.find((item) => typeof item?.url === "string" && item.url.startsWith("https://"));
  return match?.url || "";
}

export default function ConnectGateway({
  serverParam = "",
  queryParam = "",
  endpointParam = "",
  initialEntry = null,
  candidates = [],
  lookupError = null,
}) {
  const [selectedEntry, setSelectedEntry] = useState(initialEntry);
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [connections, setConnections] = useState([]);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState(lookupError || "");

  const [customName, setCustomName] = useState(serverParam || queryParam || "");
  const [customEndpoint, setCustomEndpoint] = useState(endpointParam || "");
  const [customBusy, setCustomBusy] = useState(false);

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
    const initialLoad = window.setTimeout(() => {
      loadSessionAndConnections();
    }, 0);
    return () => window.clearTimeout(initialLoad);
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
      setStatusMessage(`${server.title || server.name} is now connected and enabled in your DRIVE MCP gateway.`);
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
      setStatusMessage(!conn.enabled ? "MCP enabled in your DRIVE gateway." : "MCP paused in your DRIVE gateway.");
      await loadSessionAndConnections();
    } catch (err) {
      setErrorMessage(err?.message || "Update failed.");
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
      setStatusMessage(`${customName.trim()} connected and enabled in your DRIVE MCP gateway.`);
      await loadSessionAndConnections();
    } catch (err) {
      setErrorMessage(err?.message || "Could not connect custom MCP server.");
    } finally {
      setCustomBusy(false);
    }
  }

  const targetLabel = activeServer?.title || activeServer?.name || serverParam || queryParam || "MCP Gateway";

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 64px" }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/#mcp" style={{ display: "inline-flex", alignItems: "center", gap: 8, opacity: 0.85, textDecoration: "none" }}>
          <ArrowLeft size={16} /> Back to DRIVE Workspace
        </Link>
      </div>

      <section className="glass-surface" style={{ padding: 28, borderRadius: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, opacity: 0.8, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          <Cable size={15} /> DRIVE MCP Direct Gateway
        </div>

        <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>Connect {targetLabel}</h1>
        <p style={{ margin: "0 0 20px", opacity: 0.8, lineHeight: 1.5 }}>
          Hubungkan MCP server langsung ke akun DRIVE kamu. Setelah aktif, AI provider yang terhubung ke DRIVE MCP otomatis bisa membaca dan memakai tool dari server ini.
        </p>

        {errorMessage && (
          <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(239,68,68,0.14)", border: "1px solid rgba(239,68,68,0.35)", marginBottom: 16 }}>
            {errorMessage}
          </div>
        )}

        {statusMessage && (
          <div style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(34,197,94,0.14)", border: "1px solid rgba(34,197,94,0.35)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={16} /> {statusMessage}
          </div>
        )}

        {authLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 0", opacity: 0.8 }}>
            <Loader2 size={16} className="spin" /> Checking DRIVE session...
          </div>
        ) : !session ? (
          <div style={{ padding: 20, borderRadius: 18, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.14)", marginBottom: 20 }}>
            <p style={{ margin: "0 0 14px", display: "flex", alignItems: "center", gap: 8 }}>
              <LockKeyhole size={16} /> Sign in to your DRIVE account to connect this MCP.
            </p>
            <button type="button" className="glass-chip-btn" onClick={signInWithGoogle}>
              Sign in with Google
            </button>
          </div>
        ) : null}

        {activeServer && (
          <div style={{ padding: 20, borderRadius: 18, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>{activeServer.title || activeServer.name}</h2>
                <div style={{ fontSize: 13, opacity: 0.72 }}>
                  {activeServer.name} {activeServer.version ? `· v${activeServer.version}` : ""}
                </div>
              </div>
              {activeServer.repository?.url && (
                <a href={activeServer.repository.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  Source <ExternalLink size={13} />
                </a>
              )}
            </div>

            {activeServer.description && (
              <p style={{ margin: "12px 0", opacity: 0.85, lineHeight: 1.5 }}>{activeServer.description}</p>
            )}

            {activeRemoteUrl ? (
              <div style={{ fontSize: 12, opacity: 0.72, wordBreak: "break-all", marginBottom: 16 }}>
                Remote endpoint: <code>{activeRemoteUrl}</code>
              </div>
            ) : (
              <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 16 }}>
                Entry ini tidak memiliki remote Streamable HTTP endpoint di registry publik. Kamu tetap bisa menghubungkannya lewat form Custom Remote MCP di bawah jika punya URL endpoint-nya.
              </div>
            )}

            {session && activeRemoteUrl && (
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {existingConnection ? (
                  <button type="button" className="glass-chip-btn" disabled={busy} onClick={() => toggleConnection(existingConnection)}>
                    <Power size={14} /> {existingConnection.enabled ? "Pause MCP" : "Enable in DRIVE"}
                  </button>
                ) : (
                  <button type="button" className="glass-chip-btn" disabled={busy} onClick={() => connectRegistryServer(selectedEntry)}>
                    {busy ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Connect &amp; Enable in DRIVE
                  </button>
                )}
                <Link href="/#mcp" className="glass-chip-btn" style={{ textDecoration: "none" }}>
                  Open My MCPs
                </Link>
              </div>
            )}
          </div>
        )}

        {candidates.length > 1 && (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 15, opacity: 0.85 }}>Matching MCP servers in Official Registry</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {candidates.map((entry) => {
                const s = entry.server || entry;
                const isSelected = activeServer?.name === s.name;
                return (
                  <button
                    key={`${s.name}@${s.version}`}
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: 14,
                      background: isSelected ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.14)",
                      color: "inherit",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{s.title || s.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.72 }}>{s.name} · {getRemoteUrl(entry) ? "Remote HTTPS ready" : "Local / STDIO"}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {session && (!activeRemoteUrl || endpointParam) && (
          <form onSubmit={connectCustomServer} style={{ padding: 20, borderRadius: 18, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 16 }}>Connect Custom Remote MCP Gateway</h3>
            <p style={{ margin: "0 0 14px", fontSize: 13, opacity: 0.78 }}>
              Masukkan URL HTTPS Streamable HTTP endpoint untuk menghubungkan {customName || "MCP server"} langsung ke akun DRIVE kamu.
            </p>
            <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              <input
                type="text"
                required
                placeholder="MCP Display Name (e.g. Figcraft)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.22)", color: "inherit" }}
              />
              <input
                type="url"
                required
                placeholder="https://example.com/mcp"
                value={customEndpoint}
                onChange={(e) => setCustomEndpoint(e.target.value)}
                style={{ padding: "10px 12px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.18)", background: "rgba(0,0,0,0.22)", color: "inherit" }}
              />
            </div>
            <button type="submit" className="glass-chip-btn" disabled={customBusy}>
              {customBusy ? <Loader2 size={14} className="spin" /> : <Cable size={14} />} Verify &amp; Connect Custom MCP
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
