"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowUpRight, Cable, CircleAlert, Command, RefreshCw, ShieldCheck } from "lucide-react";
import CopyButton from "./copy-button";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createBrowserClient(url, key) : null;
}
async function accessToken() {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

export function AddMcpButton({ serverId, remoteAvailable }) {
  const [state, setState] = useState("idle");
  async function add() {
    const token = await accessToken();
    if (!token) { setState("Sign in first"); return; }
    setState("busy");
    const response = await fetch("/api/connections", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ registryServerId: serverId }),
    });
    const result = await response.json();
    setState(response.ok ? "Added to My MCPs" : result.error || "Could not add");
    if (response.ok) window.dispatchEvent(new Event("drive:connections-changed"));
  }
  if (!remoteAvailable) return <span className="availability-note">Package only · not remotely connectable</span>;
  return <button className="glass-add-button" type="button" onClick={add} disabled={state === "busy" || state === "Added to My MCPs"}>
    {state === "busy" ? "Adding…" : state}
  </button>;
}

export default function MyMcpPanel() {
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    const token = await accessToken();
    if (!token) { setSignedIn(false); setConnections([]); setLoading(false); return; }
    setSignedIn(true);
    const response = await fetch("/api/connections", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const result = await response.json();
    if (!response.ok) setMessage(result.error || "Could not load your MCPs.");
    else setConnections(result.connections || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const refresh = () => load();
    window.addEventListener("drive:connections-changed", refresh);
    return () => window.removeEventListener("drive:connections-changed", refresh);
  }, [load]);

  async function toggle(connection) {
    const token = await accessToken();
    if (!token) { setSignedIn(false); return; }
    setBusyId(connection.id); setMessage("");
    const response = await fetch("/api/connections", {
      method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: connection.id, enabled: !connection.enabled }),
    });
    const result = await response.json();
    if (response.ok) setConnections((items) => items.map((item) => item.id === connection.id ? { ...item, enabled: result.connection.enabled, updated_at: result.connection.updated_at } : item));
    else setMessage(result.error || "Could not update this connection.");
    setBusyId("");
  }

  const enabledCount = connections.filter((item) => item.enabled).length;
  return <section className="my-mcps glass-panel" id="my-mcps">
    <div className="my-mcps-heading"><div><div className="eyebrow"><span className="pulse"/> PERSONAL WORKSPACE</div><h2>My MCPs<span className="heading-period">.</span></h2><p>Your own connections. Only servers you add appear here.</p></div>
      <button className="glass-icon-button" onClick={load} aria-label="Refresh MCP connections" disabled={loading}><RefreshCw size={16}/></button>
    </div>
    <div className="connection-summary"><div><span className="summary-value">{connections.length}</span><span className="summary-label">SAVED</span></div><div><span className="summary-value">{enabledCount}</span><span className="summary-label">TURNED ON</span></div><div className="summary-status"><span className={enabledCount ? "live-dot" : "idle-dot"}/>{enabledCount ? "Personal tools enabled" : "All connections off"}</div></div>
    {loading ? <div className="connection-empty"><RefreshCw className="spin" size={19}/><span>Loading your connections…</span></div>
      : !signedIn ? <div className="connection-empty"><Command size={22}/><h3>Your workspace starts here</h3><p>Sign in with the email link below to see and manage your personal MCP connections.</p><a href="#custom" className="glass-link">Sign in <ArrowUpRight size={14}/></a></div>
      : connections.length === 0 ? <div className="connection-empty"><Cable size={24}/><h3>No MCPs added yet</h3><p>Find a remote MCP in Discover and add it here. Public registry entries never appear here automatically.</p><a href="#directory" className="glass-link">Explore available servers <ArrowUpRight size={14}/></a></div>
      : <div className="connection-list">{connections.map((connection) => {
        const server = connection.server || {};
        const title = server.title || server.display_name || server.server_name || "MCP server";
        const detail = server.description || server.endpoint_url || server.server_name || "Personal MCP connection";
        const ready = connection.kind === "registry" ? Array.isArray(server.remotes) && server.remotes.length > 0 : server.status === "verified";
        return <article className="connection-row" key={connection.id}>
          <div className="connection-symbol"><Cable size={19}/></div>
          <div className="connection-info"><div className="connection-title">{title}<span className="connection-kind">{connection.kind === "custom" ? "CUSTOM" : "REGISTRY"}</span></div><p>{detail}</p><span className="connection-meta">{ready ? "Remote endpoint listed" : "Needs verification"} · Added {new Date(connection.created_at).toLocaleDateString()}</span><div className="connection-copy"><CopyButton value={server.endpoint_url || server.repository_url || server.server_name || title} label="Copy details"/></div></div>
          <div className="connection-control"><span className={connection.enabled ? "switch-label is-on" : "switch-label"}>{connection.enabled ? "ON" : "OFF"}</span><button type="button" role="switch" aria-checked={connection.enabled} aria-label={`${connection.enabled ? "Disable" : "Enable"} ${title}`} className={`ios-switch ${connection.enabled ? "checked" : ""}`} onClick={() => toggle(connection)} disabled={busyId === connection.id || !ready}><span/></button></div>
        </article>;
      })}</div>}
    {message && <p className="connection-message" role="status"><CircleAlert size={15}/>{message}</p>}
    <div className="workspace-foot"><ShieldCheck size={14}/> Each account has its own connection list and switch settings.</div>
  </section>;
}
