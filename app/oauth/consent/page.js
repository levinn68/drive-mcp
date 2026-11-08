"use client";

import "./consent.css";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ShieldCheck, LockKeyhole, LoaderCircle, AlertCircle, CheckCircle2,
  Chrome, Mail, KeyRound, ArrowLeft, Sparkles
} from "lucide-react";

export default function OAuthConsentPage() {
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ), []);
  const [authorizationId, setAuthorizationId] = useState("");
  const [session, setSession] = useState(null);
  const [details, setDetails] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("password");
  const [accountMode, setAccountMode] = useState("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("authorization_id") || "";
    setAuthorizationId(id);
    const callbackError = new URLSearchParams(window.location.search).get("auth_error");
    if (callbackError) setError(callbackError);
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session) return;
    // Normal DRIVE login should return to the workspace. OAuth client logins
    // carry authorization_id and must remain here to complete the consent flow.
    if (!authorizationId) {
      window.location.replace("/");
      return;
    }
    let cancelled = false;
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: authError }) => {
      if (cancelled) return;
      if (authError) setError(authError.message);
      else if (data && !("authorization_id" in data) && data.redirect_url) window.location.assign(data.redirect_url);
      else setDetails(data);
    }).catch((e) => { if (!cancelled) setError(e.message || "Unable to load authorization details."); });
    return () => { cancelled = true; };
  }, [session, authorizationId, supabase]);

  function authCallbackUrl() {
    const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function signInWithGoogle() {
    setBusy(true); setError(""); setNotice("");
    try {
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: authCallbackUrl(), queryParams: { prompt: "select_account" } }
      });
      if (authError) throw authError;
    } catch (e) { setError(e.message || "Google sign-in failed."); setBusy(false); }
  }

  async function submitEmail(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      if (mode === "magic") {
        const { error: authError } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: authCallbackUrl(), shouldCreateUser: false }
        });
        if (authError) throw authError;
        setNotice("Magic link sent. Check your email to continue securely.");
      } else if (accountMode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: authCallbackUrl() }
        });
        if (authError) throw authError;
        if (!data.session) setNotice("Check your email to confirm your new DRIVE account.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
    } catch (e) { setError(e.message || "Authentication failed."); }
    finally { setBusy(false); }
  }

  async function switchAccount() {
    setBusy(true);
    setError("");
    try {
      await supabase.auth.signOut({ scope: "local" });
      setSession(null);
      setDetails(null);
      setPassword("");
      setNotice("Signed out. Choose another account to continue.");
    } catch (e) {
      setError(e.message || "Could not switch account.");
    } finally {
      setBusy(false);
    }
  }

  async function decide(allow) {
    if (!authorizationId || busy) return;
    // Open DRIVE synchronously inside the Approve click, before awaiting the
    // network. This avoids the extra confirmation screen on browsers that
    // permit a user-initiated tab, while preserving the provider OAuth callback.
    let dashboardTab = null;
    if (allow) {
      try {
        dashboardTab = window.open("/", "_blank");
        if (dashboardTab) dashboardTab.opener = null;
      } catch {}
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { data, error: decisionError } = allow
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);

      if (decisionError) throw decisionError;
      const redirectUrl = data?.redirect_url;
      if (!redirectUrl) throw new Error("Supabase did not return the OAuth callback URL.");

      if (allow) {
        if (dashboardTab && !dashboardTab.closed) {
          // Dashboard is already open. Complete OAuth in this tab so the
          // MCP provider receives its authorization code as expected.
          window.location.replace(redirectUrl);
          return;
        }
        // Popup blocked: keep a functional fallback instead of losing OAuth.
        const handoff = new URL("/oauth/complete", window.location.origin);
        handoff.searchParams.set("callback", redirectUrl);
        window.location.replace(handoff.toString());
        return;
      }

      window.location.assign(redirectUrl);
    } catch (e) {
      setError(e?.message || "Could not complete authorization. Please try again.");
      setBusy(false);
    }
  }

  const scopes = (details?.scope || "").split(/\s+/).filter(Boolean);

  return (
    <main className="oauth-page" style={{background:"radial-gradient(ellipse at 50% -15%, rgba(111,87,255,.28), transparent 48%), radial-gradient(circle at 100% 100%, rgba(48,104,190,.13), transparent 35%), #080a12",color:"#f5f6ff"}}>
      <div className="oauth-grid" style={{backgroundImage:"linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)",backgroundSize:"42px 42px"}}/>
      <section className="oauth-card" style={{background:"linear-gradient(145deg,rgba(24,27,44,.96),rgba(13,16,28,.97))",borderColor:"rgba(255,255,255,.12)",boxShadow:"0 30px 100px rgba(0,0,0,.5),inset 0 1px rgba(255,255,255,.07)"}}>
        <div className="oauth-brand">
          <div className="oauth-brand-mark" style={{background:"linear-gradient(145deg,rgba(150,132,255,.25),rgba(94,77,195,.12))",borderColor:"rgba(171,157,255,.3)",color:"#b9adff",boxShadow:"0 8px 30px rgba(126,105,255,.15)"}}><ShieldCheck size={25}/></div>
          <div className="oauth-brand-copy"><div>DRIVE</div><small>One hub. Every connection.</small></div>
          <div className="oauth-secure-pill" style={{borderColor:"rgba(52,211,153,.2)",background:"rgba(16,185,129,.08)"}}><LockKeyhole size={11}/> Secure OAuth</div>
        </div>

        {!authorizationId ? <div className="rounded-2xl p-4 text-sm" style={{background:"rgba(248,113,113,.1)",color:"#fca5a5"}}>Missing authorization_id. Restart the connection from your MCP client.</div> :
        !session ? <>
          <div className="oauth-intro">
            <div className="oauth-welcome-pill" style={{background:"rgba(139,124,255,.12)"}}><Sparkles size={13}/> Welcome to DRIVE</div>
            <h1 className="oauth-title">{accountMode === "signup" ? "Create your account" : "Sign in to DRIVE"}</h1>
            <p className="oauth-subtitle">Sign in to continue to your DRIVE workspace.</p>
          </div>

          <button type="button" onClick={signInWithGoogle} disabled={busy} className="oauth-google-button">
            {busy ? <LoaderCircle size={18} className="animate-spin"/> : <Chrome size={18}/>} Continue with Google
          </button>

          <div className="oauth-divider"><span className="h-px flex-1 bg-white/10"/><span>or use email</span><span className="h-px flex-1 bg-white/10"/></div>

          <div className="oauth-tabs">
            <button type="button" onClick={()=>{setMode("password");setError("");setNotice("");}} className="oauth-tab" style={mode==="password"?{background:"rgba(155,139,255,.18)",color:"#d5ceff"}:{color:"rgba(255,255,255,.48)"}}>Password</button>
            <button type="button" onClick={()=>{setMode("magic");setAccountMode("signin");setError("");setNotice("");}} className="oauth-tab" style={mode==="magic"?{background:"rgba(155,139,255,.18)",color:"#d5ceff"}:{color:"rgba(255,255,255,.48)"}}>Magic link</button>
          </div>

          <form onSubmit={submitEmail} className="oauth-form">
            <label className="oauth-field">
              <span className="oauth-field-label">Email address</span>
              <span className="oauth-input-wrap">
                <Mail size={16} className="text-white/35"/>
                <input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" className="oauth-input"/>
              </span>
            </label>
            {mode==="password" && <label className="oauth-field">
              <span className="oauth-field-label">Password</span>
              <span className="oauth-input-wrap">
                <KeyRound size={16}/>
                <input type="password" autoComplete={accountMode==="signup"?"new-password":"current-password"} required minLength={6} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" className="oauth-input"/>
              </span>
            </label>}
            <button disabled={busy} className="oauth-submit-button" style={{background:"linear-gradient(100deg,#b5a8ff,#8c7af0)",color:"#11111c"}}>
              {busy ? <LoaderCircle size={17} className="animate-spin"/> : <Mail size={17}/>}
              {mode==="magic" ? "Send magic link" : accountMode==="signup" ? "Create account" : "Sign in with email"}
            </button>
          </form>
          {mode==="password" && <div className="oauth-switch">
            {accountMode==="signin" ? "New to DRIVE? " : "Already have an account? "}
            <button type="button" onClick={()=>{setAccountMode(accountMode==="signin"?"signup":"signin");setError("");setNotice("");}} className="oauth-switch-link">{accountMode==="signin"?"Create account":"Sign in"}</button>
          </div>}
          <div className="oauth-security-note"><LockKeyhole size={14} className="mt-0.5 shrink-0 text-emerald-300/70"/> Your sign-in is protected by Supabase. DRIVE never stores your password.</div>
        </> : details ? <>
          <div className="oauth-account-switch">
            <span>Signed in as <strong>{session.user?.email || "your account"}</strong></span>
            <button type="button" onClick={switchAccount} disabled={busy}>Switch account</button>
          </div>
          <div className="oauth-permission-eyebrow">Permission request</div>
          <h1 className="oauth-title">Authorize {details.client?.name || "MCP client"}?</h1>
          <p className="oauth-subtitle">Review the access requested by this application before continuing.</p>
          <div className="oauth-permission-card">
            <div className="oauth-client-row"><LockKeyhole size={16} className="text-violet-300"/> <span className="text-white/50">Client</span><strong className="ml-auto text-right">{details.client?.name || "Unknown client"}</strong></div>
            <div className="oauth-redirect">Redirect: {details.redirect_uri || "Not provided"}</div>
            <div className="oauth-scopes"><div className="oauth-scopes-title">Requested scopes</div>
              {scopes.length ? <div className="oauth-scope-list">{scopes.map(scope=><span key={scope} className="oauth-scope">{scope}</span>)}</div> : <p className="text-sm text-white/55">No standard profile scopes requested. DRIVE permissions remain governed by your account settings.</p>}
            </div>
          </div>
          <div className="oauth-decision-actions">
            <button disabled={busy} onClick={()=>decide(false)} className="oauth-deny-button">Deny</button>
            <button disabled={busy} onClick={()=>decide(true)} className="oauth-approve-button" style={{background:"linear-gradient(100deg,#b5a8ff,#8c7af0)",color:"#11111c"}}>{busy ? <LoaderCircle size={17} className="animate-spin"/> : <CheckCircle2 size={17}/>} Approve & Open Dashboard</button>
          </div>
        </> : <div className="oauth-loading"><LoaderCircle className="animate-spin" size={18}/> Loading authorization request…</div>}
        {error && <div role="alert" className="oauth-error" style={{background:"rgba(248,113,113,.1)",color:"#fca5a5"}}><AlertCircle size={17} className="shrink-0"/>{error}</div>}
        {notice && <div role="status" className="oauth-notice">{notice}</div>}
        <p className="oauth-footer">DRIVE · Secure connection authorization</p>
      </section>
    </main>
  );
}
