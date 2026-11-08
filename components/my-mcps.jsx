"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowUpRight,
  Cable,
  Check,
  CircleAlert,
  Command,
  Compass,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import CopyButton from "./copy-button";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createBrowserClient(url, key) : null;
}

async function accessToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token || null;
}

function navigateToTab(tabId) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("drive:navigate", { detail: { tab: tabId } }));
}

export function AddMcpButton({ serverName, version, remoteAvailable }) {
  const [state, setState] = useState("idle");

  async function add() {
    const token = await accessToken();
    if (!token) {
      setState("Sign in first");
      window.setTimeout(() => navigateToTab("add"), 600);
      return;
    }
    setState("busy");
    try {
      const response = await fetch("/api/connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ serverName, version }),
      });
      const result = await response.json();
      setState(response.ok ? "Added to My MCPs" : result.error || "Could not add");
      if (response.ok) {
        window.dispatchEvent(new Event("drive:connections-changed"));
      }
    } catch {
      setState("Network error");
    }
  }

  if (!remoteAvailable) {
    return <span className="availability-note">STDIO package · Local runtime only</span>;
  }

  const isAdded = state === "Added to My MCPs";
  const isBusy = state === "busy";

  return (
    <button
      className={`glass-add-button ${isAdded ? "is-added" : ""}`}
      type="button"
      onClick={add}
      disabled={isBusy || isAdded}
    >
      {isAdded ? <Check size={13} /> : <Plus size={13} />}
      <span>{isBusy ? "Adding…" : state === "idle" ? "Connect" : state}</span>
    </button>
  );
}

export default function MyMcpPanel() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    const token = await accessToken();
    if (!token) {
      setSignedIn(false);
      setConnections([]);
      setLoading(false);
      return;
    }
    setSignedIn(true);
    try {
      const response = await fetch("/api/connections", {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "Could not load your MCPs.");
      } else {
        setConnections(result.connections || []);
      }
    } catch {
      setMessage("Could not reach connection service.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("drive:connections-changed", refresh);
    window.addEventListener("drive:auth-changed", refresh);
    return () => {
      window.removeEventListener("drive:connections-changed", refresh);
      window.removeEventListener("drive:auth-changed", refresh);
    };
  }, [load]);

  async function toggle(connection) {
    const token = await accessToken();
    if (!token) {
      setSignedIn(false);
      return;
    }
    setBusyId(connection.id);
    setMessage("");
    try {
      const response = await fetch("/api/connections", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id: connection.id, enabled: !connection.enabled }),
      });
      const result = await response.json();
      if (response.ok) {
        setConnections((items) =>
          items.map((item) =>
            item.id === connection.id
              ? {
                  ...item,
                  enabled: result.connection.enabled,
                  updated_at: result.connection.updated_at,
                }
              : item
          )
        );
      } else {
        setMessage(result.error || "Could not update this connection.");
      }
    } catch {
      setMessage("Network error while updating switch.");
    }
    setBusyId("");
  }

  const enabledCount = connections.filter((item) => item.enabled).length;
  const filteredConnections = connections.filter((connection) => {
    const server = connection.server || {};
    const title = (server.title || server.display_name || server.server_name || "").toLowerCase();
    const detail = (server.description || server.endpoint_url || "").toLowerCase();
    const matchesQuery =
      !filterText.trim() ||
      title.includes(filterText.trim().toLowerCase()) ||
      detail.includes(filterText.trim().toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "enabled" && connection.enabled) ||
      (statusFilter === "disabled" && !connection.enabled);
    return matchesQuery && matchesStatus;
  });

  return (
    <section className="my-mcps glass-surface" id="my-mcps">
      <div className="my-mcps-heading">
        <div>
          <div className="eyebrow">
            <span className="pulse" /> PERSONAL WORKSPACE
          </div>
          <h2>
            My MCPs<span className="heading-period">.</span>
          </h2>
          <p>Manage your saved remote MCP servers and control active runtime switches.</p>
        </div>
        <button
          type="button"
          className="glass-icon-button"
          onClick={load}
          aria-label="Refresh MCP connections"
          disabled={loading}
        >
          <RefreshCw className={loading ? "spin" : ""} size={16} />
        </button>
      </div>

      <div className="connection-summary">
        <div className="summary-metric">
          <span className="summary-value">{connections.length}</span>
          <span className="summary-label">SAVED SERVERS</span>
        </div>
        <div className="summary-metric">
          <span className="summary-value is-accent">{enabledCount}</span>
          <span className="summary-label">ACTIVE NOW</span>
        </div>
        <div className="summary-status">
          <span className={enabledCount ? "live-dot" : "idle-dot"} />
          <span>{enabledCount ? `${enabledCount} active in workspace` : "All connections standby"}</span>
        </div>
      </div>

      {signedIn && connections.length > 0 && (
        <div className="connection-filter-bar">
          <div className="connection-search-input">
            <Search size={14} />
            <input
              type="search"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter saved connections…"
              aria-label="Filter saved connections"
            />
          </div>
          <div className="segmented-pills" role="tablist" aria-label="Filter connections by state">
            {["all", "enabled", "disabled"].map((mode) => (
              <button
                key={mode}
                type="button"
                role="tab"
                aria-selected={statusFilter === mode}
                className={`segmented-pill ${statusFilter === mode ? "is-active" : ""}`}
                onClick={() => setStatusFilter(mode)}
              >
                {mode === "all" ? "All" : mode === "enabled" ? "Active" : "Off"}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="connection-empty">
          <div className="empty-orb">
            <RefreshCw className="spin" size={22} />
          </div>
          <h3>Syncing your workspace</h3>
          <p>Fetching your personal MCP connections and switch states…</p>
        </div>
      ) : !signedIn ? (
        <div className="connection-empty">
          <div className="empty-orb">
            <Command size={24} />
          </div>
          <h3>Your personal MCP dock is ready</h3>
          <p>
            Sign in with Google from the Add MCP tab to save remote servers, register custom endpoints, and toggle connections across devices.
          </p>
          <div className="empty-actions">
            <button type="button" className="glass-link is-primary" onClick={() => navigateToTab("add")}>
              <Sparkles size={14} />
              <span>Sign in & Add Server</span>
              <ArrowUpRight size={14} />
            </button>
            <button type="button" className="glass-link" onClick={() => navigateToTab("discover")}>
              <Compass size={14} />
              <span>Browse Directory</span>
            </button>
          </div>
        </div>
      ) : connections.length === 0 ? (
        <div className="connection-empty">
          <div className="empty-orb">
            <Cable size={24} />
          </div>
          <h3>No MCPs connected yet</h3>
          <p>
            Explore the public directory to connect remote-ready servers, or register your own custom Streamable HTTP endpoint.
          </p>
          <div className="empty-actions">
            <button type="button" className="glass-link is-primary" onClick={() => navigateToTab("discover")}>
              <Compass size={14} />
              <span>Explore Directory</span>
              <ArrowUpRight size={14} />
            </button>
            <button type="button" className="glass-link" onClick={() => navigateToTab("add")}>
              <Plus size={14} />
              <span>Add Custom Endpoint</span>
            </button>
          </div>
        </div>
      ) : filteredConnections.length === 0 ? (
        <div className="connection-empty">
          <div className="empty-orb">
            <Search size={22} />
          </div>
          <h3>No matching connections</h3>
          <p>No saved servers match your current filter criteria.</p>
          <button
            type="button"
            className="glass-link"
            onClick={() => {
              setFilterText("");
              setStatusFilter("all");
            }}
          >
            Reset filter
          </button>
        </div>
      ) : (
        <div className="connection-list">
          {filteredConnections.map((connection) => {
            const server = connection.server || {};
            const title = server.title || server.display_name || server.server_name || "MCP server";
            const detail =
              server.description || server.endpoint_url || server.server_name || "Personal MCP connection";
            const ready =
              connection.kind === "registry"
                ? Array.isArray(server.remotes) && server.remotes.length > 0
                : server.status === "verified";
            return (
              <article className="connection-row" key={connection.id}>
                <div className="connection-symbol">
                  <Cable size={19} />
                </div>
                <div className="connection-info">
                  <div className="connection-title">
                    <span>{title}</span>
                    <span className={`connection-kind is-${connection.kind}`}>
                      {connection.kind === "custom" ? "CUSTOM" : "REGISTRY"}
                    </span>
                  </div>
                  <p>{detail}</p>
                  <div className="connection-meta-row">
                    <span className="connection-meta">
                      {ready ? "Remote endpoint verified" : "Verification pending"} · Added{" "}
                      {new Date(connection.created_at).toLocaleDateString()}
                    </span>
                    <CopyButton
                      value={server.endpoint_url || server.repository_url || server.server_name || title}
                      label="Copy URI"
                    />
                  </div>
                </div>
                <div className="connection-control">
                  <span className={connection.enabled ? "switch-label is-on" : "switch-label"}>
                    {connection.enabled ? "ON" : "OFF"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={connection.enabled}
                    aria-label={`${connection.enabled ? "Disable" : "Enable"} ${title}`}
                    className={`ios-switch ${connection.enabled ? "checked" : ""}`}
                    onClick={() => toggle(connection)}
                    disabled={busyId === connection.id || !ready}
                  >
                    <span />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {message && (
        <p className="connection-message" role="status">
          <CircleAlert size={15} />
          <span>{message}</span>
        </p>
      )}

      <div className="workspace-foot">
        <ShieldCheck size={15} />
        <span>Row-level security isolates your saved MCP list and toggle states to your authenticated identity.</span>
      </div>
    </section>
  );
}
