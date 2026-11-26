"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Globe, LoaderCircle, LockKeyhole, Plus, Server, ShieldCheck } from "lucide-react";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export default function CustomMcpForm() {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  async function handleSignIn() {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}` },
    });
  }

  async function addServer(event) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) {
      setStatus({ type: "error", text: "Authentication is not configured yet." });
      return;
    }
    setBusy(true);
    setStatus({ type: "", text: "" });
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setStatus({
          type: "auth",
          text: "Sign in di tab Account dulu untuk menyimpan custom MCP endpoint.",
        });
        setBusy(false);
        return;
      }
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
      if (!response.ok) {
        throw new Error(result.error || "Could not save this endpoint.");
      }
      setStatus({
        type: "success",
        text: `${name.trim()} berhasil disimpan ke akun DRIVE kamu.`,
      });
      setName("");
      setEndpoint("");
    } catch (err) {
      setStatus({
        type: "error",
        text: err?.message || "Could not save this endpoint.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="custom-form-clean">
      <form className="custom-fields" onSubmit={addServer}>
        <label className="custom-field-label">
          <span>
            <Server size={13} /> SERVER DISPLAY NAME
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Internal Analytics MCP"
            minLength={2}
            maxLength={80}
            required
          />
        </label>

        <label className="custom-field-label">
          <span>
            <Globe size={13} /> STREAMABLE HTTP ENDPOINT (HTTPS)
          </span>
          <input
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            placeholder="https://mcp.example.com/mcp"
            type="url"
            required
          />
        </label>

        <div className="custom-policy-pills">
          <span>
            <Globe size={11} /> Streamable HTTP
          </span>
          <span>
            <LockKeyhole size={11} /> TLS Required
          </span>
          <span>
            <ShieldCheck size={11} /> SSRF Protected
          </span>
        </div>

        <button type="submit" className="custom-submit-btn" disabled={busy}>
          {busy ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />}
          {busy ? "Saving..." : "Register Endpoint"}
        </button>
      </form>

      {status.text && (
        <div
          className={`custom-form-alert ${status.type === "success" ? "is-success" : "is-error"}`}
          role="status"
        >
          <span>{status.text}</span>
          {status.type === "auth" && (
            <button type="button" className="glass-chip-btn" onClick={handleSignIn}>
              Sign in with Google
            </button>
          )}
        </div>
      )}

      <p className="custom-form-hint">
        Only public HTTPS endpoints are accepted. Private IPv4/IPv6 ranges, localhost, and embedded
        credentials are automatically rejected by the SSRF guard.
      </p>
    </div>
  );
}
