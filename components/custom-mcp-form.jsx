"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Chrome, LogOut, UserRound } from "lucide-react";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createBrowserClient(url, key) : null;
}

export default function CustomMcpForm() {
  const [name, setName] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    supabase.auth.getUser().then(({ data: { user: current } }) => setUser(current));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user || null));
    return () => subscription.unsubscribe();
  }, []);


  async function signIn() {
    const supabase = getSupabase();
    if (!supabase) return setMessage("Supabase authentication is not configured.");
    setBusy(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setMessage(error.message); setBusy(false); }
  }

  async function signOut() {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
    window.dispatchEvent(new Event("drive:connections-changed"));
  }

  async function addServer(event) {
    event.preventDefault();
    const supabase = getSupabase();
    if (!supabase) return setMessage("Authentication is not configured.");
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) { setBusy(false); return setMessage("Sign in with Google before adding a server."); }
    const response = await fetch("/api/custom-servers", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ displayName: name, endpointUrl: endpoint, authType: "none" }),
    });
    const result = await response.json();
    setBusy(false);
    setMessage(response.ok ? "Endpoint saved. It is waiting for verification." : result.error || "Could not save this endpoint.");
    if (response.ok) { setName(""); setEndpoint(""); }
  }

  return <div className="custom-form">
    <div className="google-auth-row">
      <div className="google-user"><span className="google-avatar"><UserRound size={17}/></span><div><strong>{user?.email || "Google account"}</strong><small>{user ? "Signed in to DRIVE" : "Sign in to sync your MCP connections"}</small></div></div>
      {user ? <button type="button" className="google-button secondary-google" onClick={signOut}><LogOut size={15}/> Sign out</button> : <button type="button" className="google-button" onClick={signIn} disabled={busy}><Chrome size={16}/>{busy ? "Opening Google…" : "Continue with Google"}</button>}
    </div>
    <form className="custom-fields" onSubmit={addServer}>
      <label>Server name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="My remote MCP" minLength={2} maxLength={80} required /></label>
      <label>Streamable HTTP endpoint<input value={endpoint} onChange={(event) => setEndpoint(event.target.value)} placeholder="https://mcp.example.com/mcp" type="url" required /></label>
      <button type="submit" disabled={busy || !user}>{busy ? "Saving…" : "Add endpoint"}</button>
    </form>
    <p className="form-hint">Google sign-in uses Supabase OAuth. Configure the Google provider and authorized redirect URL in Supabase before enabling it.</p>
    {message && <p className="form-message" role="status">{message}</p>}
  </div>;
}
