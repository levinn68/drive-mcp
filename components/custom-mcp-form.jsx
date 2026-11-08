"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export default function CustomMcpForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return setMessage("Authentication is not configured yet.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    setMessage(error ? error.message : "Check your email for the sign-in link.");
  }

  async function addServer(event) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return setMessage("Authentication is not configured yet.");
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setBusy(false);
      return setMessage("Sign in with your email first, then add your server.");
    }
    const response = await fetch("/api/custom-servers", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ displayName: name, endpointUrl: endpoint, authType: "none" }),
    });
    const result = await response.json();
    setBusy(false);
    setMessage(response.ok ? "Custom MCP endpoint saved. It is pending verification." : result.error || "Could not save this endpoint.");
    if (response.ok) { setName(""); setEndpoint(""); }
  }

  return <div className="custom-form">
    <form className="auth-row" onSubmit={signIn}>
      <label className="sr-only" htmlFor="drive-email">Email address</label>
      <input id="drive-email" type="email" autoComplete="email" placeholder="Your email for a secure sign-in link" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <button type="submit" disabled={busy}>{busy ? "Please wait…" : "Email me a sign-in link"}</button>
    </form>
    <form className="custom-fields" onSubmit={addServer}>
      <label>Server name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="My remote MCP" minLength={2} maxLength={80} required /></label>
      <label>Streamable HTTP endpoint<input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://mcp.example.com/mcp" type="url" required /></label>
      <button type="submit" disabled={busy}>{busy ? "Saving…" : "Add custom endpoint"}</button>
    </form>
    <p className="form-hint">Remote HTTPS endpoints only. Credential-based connections will be enabled after the encrypted secret store is in place.</p>
    {message && <p className="form-message" role="status">{message}</p>}
  </div>;
}
