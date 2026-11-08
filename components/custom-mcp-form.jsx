"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  CheckCircle2,
  Chrome,
  CircleAlert,
  Globe,
  Link2,
  LockKeyhole,
  LogOut,
  Plus,
  Server,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createBrowserClient(url, key) : null;
}

export default function CustomMcpForm() {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [message, setMessage] = useState("");
  const [statusType, setStatusType] = useState("info");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user: current } }) => setUser(current || null));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
      window.dispatchEvent(new Event("drive:auth-changed"));
    });
    return () => subscription.unsubscribe();
  }, []);

  async function signIn() {
    const supabase = getSupabase();
    if (!supabase) {
      setStatusType("error");
      setMessage("Supabase authentication is not configured in environment variables.");
      return;
    }
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatusType("error");
      setMessage(error.message);
      setBusy(false);
    }
  }

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    setStatusType("info");
    setMessage("Signed out of your DRIVE workspace.");
    window.dispatchEvent(new Event("drive:connections-changed"));
    window.dispatchEvent(new Event("drive:auth-changed"));
  }

  async function addServer(event) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      setStatusType("error");
      setMessage("Authentication is not configured.");
      return;
    }
    setBusy(true);
    setMessage("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setBusy(false);
      setStatusType("error");
      setMessage("Sign in with Google before adding a custom server.");
      return;
    }
    try {
      const response = await fetch("/api/custom-servers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          displayName: name.trim(),
          endpointUrl: endpoint.trim(),
          authType: "none",
        }),
      });
      const result = await response.json();
      setBusy(false);
      if (response.ok) {
        setStatusType("success");
        setMessage("Endpoint saved to your account. It is queued for verification.");
        setName("");
        setEndpoint("");
        window.dispatchEvent(new Event("drive:connections-changed"));
      } else {
        setStatusType("error");
        setMessage(result.error || "Could not save this endpoint.");
      }
    } catch {
      setBusy(false);
      setStatusType("error");
      setMessage("Network error while saving endpoint. Please try again.");
    }
  }

  return (
    <div className="custom-form glass-card-elevated">
      <div className="google-auth-row">
        <div className="google-user">
          <span className={`google-avatar ${user ? "is-authenticated" : ""}`}>
            <UserRound size={18} />
          </span>
          <div className="google-user-meta">
            <div className="google-user-title-row">
              <strong>{user?.email || "Google Workspace Identity"}</strong>
              <span className={`auth-pill ${user ? "is-online" : "is-offline"}`}>
                {user ? "Synced" : "Guest"}
              </span>
            </div>
            <small>
              {user
                ? "Signed in to DRIVE · Custom endpoints are scoped to your account"
                : "Sign in with Google OAuth to register and sync private MCP endpoints"}
            </small>
          </div>
        </div>
        {user ? (
          <button type="button" className="google-button secondary-google" onClick={signOut}>
            <LogOut size={15} />
            <span>Sign out</span>
          </button>
        ) : (
          <button type="button" className="google-button primary-google" onClick={signIn} disabled={busy}>
            <Chrome size={16} />
            <span>{busy ? "Opening Google…" : "Continue with Google"}</span>
          </button>
        )}
      </div>

      <form className="custom-fields" onSubmit={addServer}>
        <div className="field-group">
          <label htmlFor="custom-mcp-name">
            <span className="field-label">
              <Server size={13} /> SERVER DISPLAY NAME
            </span>
            <div className="glass-input-wrap">
              <input
                id="custom-mcp-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Internal Analytics MCP"
                minLength={2}
                maxLength={80}
                required
              />
            </div>
          </label>

          <label htmlFor="custom-mcp-endpoint">
            <span className="field-label">
              <Link2 size={13} /> STREAMABLE HTTP ENDPOINT (HTTPS)
            </span>
            <div className="glass-input-wrap">
              <input
                id="custom-mcp-endpoint"
                value={endpoint}
                onChange={(event) => setEndpoint(event.target.value)}
                placeholder="https://mcp.example.com/mcp"
                type="url"
                required
              />
            </div>
          </label>
        </div>

        <div className="custom-submit-row">
          <div className="transport-chips">
            <span className="glass-chip">
              <Globe size={12} /> Streamable HTTP
            </span>
            <span className="glass-chip">
              <LockKeyhole size={12} /> TLS Required
            </span>
            <span className="glass-chip">
              <ShieldCheck size={12} /> SSRF Protected
            </span>
          </div>

          <button type="submit" className="glass-submit-btn" disabled={busy || !user}>
            <Plus size={16} />
            <span>{busy ? "Saving Endpoint…" : "Register Endpoint"}</span>
          </button>
        </div>
      </form>

      {message && (
        <div className={`form-message is-${statusType}`} role="status">
          {statusType === "success" ? (
            <CheckCircle2 size={15} />
          ) : statusType === "error" ? (
            <CircleAlert size={15} />
          ) : (
            <Sparkles size={15} />
          )}
          <span>{message}</span>
        </div>
      )}

      <p className="form-hint">
        Only public HTTPS endpoints are accepted. Private IPv4/IPv6 ranges, localhost, and embedded credentials are automatically rejected by the SSRF guard.
      </p>
    </div>
  );
}
