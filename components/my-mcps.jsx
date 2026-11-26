"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  Cable,
  Check,
  Copy,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
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

export function AddMcpButton({ serverName, version, registryEntry, remoteAvailable }) {
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
      if (response.ok) {
        setState("added");
        window.dispatchEvent(new Event("drive:connections-changed"));
      } else {
        setState([result.error, result.detail].filter(Boolean).join(": ") || "Could not add");
      }
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
          ? "Connect this remote MCP to your DRIVE workspace"
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
        {isBusy ? "Adding..." : isAdded ? "Connected" : isError ? "Retry" : "Connect"}
      </span>
    </button>
  );
}

export default function MyMcpPanel() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [error, setError] = useState("");

  // Cache token in memory so ON/OFF toggles execute with 0ms UI delay and no extra getSession roundtrip
  const tokenRef = useRef("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = await getAccessToken();
      tokenRef.current = token || "";
      if (!token) {
        setSignedIn(false);
        setConnections([]);
        return;
      }
      setSignedIn(true);
      const response = await fetch("/api/connections", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Could not load saved connections.");
      }
      setConnections(Array.isArray(data.connections) ? data.connections : []);
    } catch (err) {
      setError(err?.message || "Could not load saved connections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => load(), 0);
    const refresh = () => load();
    window.addEventListener("drive:connections-changed", refresh);
    window.addEventListener("drive:auth-changed", refresh);
    return () => {
      window.clearTimeout(initialLoad);
      window.removeEventListener("drive:connections-changed", refresh);
      window.removeEventListener("drive:auth-changed", refresh);
    };
  }, [load]);

  async function toggleConnection(item) {
    const prevEnabled = Boolean(item.enabled);
    const nextEnabled = !prevEnabled;
    setError("");

    // Instant 0ms optimistic UI toggle
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
      // Revert cleanly if server rejected the toggle
      setConnections((prev) =>
        prev.map((row) => (row.id === item.id ? { ...row, enabled: prevEnabled } : row))
      );
      setError(err?.message || "Could not update MCP state.");
    }
  }

  async function removeConnection(item) {
    const snapshot = connections;
    setError("");
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
    } catch (err) {
      setConnections(snapshot);
      setError(err?.message || "Could not remove connection.");
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

      {error && (
        <div className="custom-form-alert is-error" role="alert" style={{ marginBottom: 12 }}>
          <span>{error}</span>
        </div>
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
                    </div>
                    <p>{endpoint || item.server?.description || "Connected via DRIVE MCP"}</p>
                    <div className="my-mcp-row-actions">
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
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
