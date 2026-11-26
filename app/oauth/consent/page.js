"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ShieldCheck,
  LockKeyhole,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Chrome,
  Mail,
  KeyRound,
  Sparkles,
} from "lucide-react";

export default function OAuthConsentPage() {
  const supabase = useMemo(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) return null;
    return createBrowserClient(url, key);
  }, []);
  const [authorizationId, setAuthorizationId] = useState("");
  const [authContextReady, setAuthContextReady] = useState(false);
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
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const id = params.get("authorization_id") || "";
      setAuthorizationId(id);
      setAuthContextReady(true);
      const callbackError = params.get("auth_error");
      if (callbackError) setError(callbackError);
    }, 0);

    if (!supabase) return () => window.clearTimeout(timer);

    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession || null);
    });
    return () => {
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    if (!authContextReady || !session || !supabase) return;
    if (!authorizationId) {
      window.location.replace("/");
      return;
    }
    let cancelled = false;
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: detailsError }) => {
      if (cancelled) return;
      if (detailsError) setError(detailsError.message || "Unable to load authorization details.");
      else setDetails(data);
    }).catch((e) => {
      if (!cancelled) setError(e.message || "Unable to load authorization details.");
    });
    return () => { cancelled = true; };
  }, [session, authorizationId, authContextReady, supabase]);

  function authCallbackUrl() {
    const next = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
  }

  async function signInWithGoogle() {
    if (!supabase) { setError("Supabase authentication is not configured."); return; }
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
    event.preventDefault();
    if (!supabase) { setError("Supabase authentication is not configured."); return; }
    setBusy(true); setError(""); setNotice("");
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
    if (!supabase) return;
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

  async function decide(allow, openDashboardFirst = true) {
    if (!authorizationId || busy || !supabase) return;
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

      if (allow && openDashboardFirst) {
        const clientName = details?.client?.name || "";
        try {
          window.sessionStorage.setItem("drive:oauth_callback", redirectUrl);
          if (clientName) window.sessionStorage.setItem("drive:oauth_client", clientName);
        } catch {}
        const dest = new URL("/", window.location.origin);
        dest.searchParams.set("oauth_callback", redirectUrl);
        if (clientName) dest.searchParams.set("oauth_client", clientName);
        window.location.replace(dest.toString());
        return;
      }

      window.location.replace(redirectUrl);
    } catch (e) {
      setError(e?.message || "Could not complete authorization. Please try again.");
      setBusy(false);
    }
  }

  const scopes = (details?.scope || "").split(/\s+/).filter(Boolean);
  const clientLabel = details?.client?.name || "MCP client";

  return (
    <main className="oauth-page" style={{ background: "radial-gradient(ellipse at 50% -15%, rgba(10,132,255,.22), transparent 50%), radial-gradient(circle at 100% 100%, rgba(90,200,250,.13), transparent 38%), #060a12", color: "#f5f9ff" }}>
      <div className="oauth-grid" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.04) 1px, transparent 1px),linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px)", backgroundSize: "42px 42px" }} />
      <section className="oauth-card" style={{ background: "linear-gradient(155deg,rgba(20,30,48,.92),rgba(9,14,24,.96))", borderColor: "rgba(255,255,255,.16)", boxShadow: "0 30px 100px rgba(0,0,0,.55),inset 0 1px rgba(255,255,255,.2)" }}>
        <div className="oauth-brand">
          <div className="oauth-brand-mark" style={{ background: "linear-gradient(145deg,rgba(10,132,255,.26),rgba(90,200,250,.14))", borderColor: "rgba(124,212,255,.36)", color: "#8cdbff", boxShadow: "0 8px 28px rgba(10,132,255,.18)" }}>
            <ShieldCheck size={25} />
          </div>
          <div className="oauth-brand-copy"><div>DRIVE</div><small>One hub. Every connection.</small></div>
          <div className="oauth-secure-pill" style={{ borderColor: "rgba(124,212,255,.28)", background: "rgba(10,132,255,.12)", color: "#bfe6ff" }}><LockKeyhole size={11} /> Secure OAuth</div>
        </div>

        {!authorizationId ? (
          <div className="rounded-2xl p-4 text-sm" style={{ background: "rgba(255,69,58,.14)", color: "#fca5a5" }}>
            Missing authorization_id. Restart the connection from your MCP client.
          </div>
        ) : !session ? (
          <>
            <div className="oauth-intro">
              <div className="oauth-welcome-pill" style={{ background: "rgba(10,132,255,.16)", color: "#8cdbff" }}><Sparkles size={13} /> Welcome to DRIVE</div>
              <h1 className="oauth-title">{accountMode === "signup" ? "Create your account" : "Sign in to DRIVE"}</h1>
              <p className="oauth-subtitle">Sign in to continue to your DRIVE workspace.</p>
            </div>

            <button type="button" onClick={signInWithGoogle} disabled={busy} className="oauth-google-button">
              {busy ? <LoaderCircle size={18} className="animate-spin" /> : <Chrome size={18} />} Continue with Google
            </button>

            <div className="oauth-divider"><span className="h-px flex-1 bg-white/10" /><span>or use email</span><span className="h-px flex-1 bg-white/10" /></div>

            <div className="oauth-tabs">
              <button type="button" onClick={() => { setMode("password"); setError(""); setNotice(""); }} className="oauth-tab" style={mode === "password" ? { background: "rgba(10,132,255,.22)", color: "#eef7ff" } : { color: "rgba(255,255,255,.52)" }}>Password</button>
              <button type="button" onClick={() => { setMode("magic"); setAccountMode("signin"); setError(""); setNotice(""); }} className="oauth-tab" style={mode === "magic" ? { background: "rgba(10,132,255,.22)", color: "#eef7ff" } : { color: "rgba(255,255,255,.52)" }}>Magic link</button>
            </div>

            <form onSubmit={submitEmail} className="oauth-form">
              <label className="oauth-field">
                <span>Email address</span>
                <span className="oauth-input-wrap">
                  <Mail size={16} />
                  <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="oauth-input" />
                </span>
              </label>
              {mode === "password" && (
                <label className="oauth-field">
                  <span>Password</span>
                  <span className="oauth-input-wrap">
                    <KeyRound size={16} />
                    <input type="password" autoComplete={accountMode === "signup" ? "new-password" : "current-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="oauth-input" />
                  </span>
                </label>
              )}
              <button disabled={busy} className="oauth-submit-button" style={{ background: "linear-gradient(135deg,#2b95ff,#0a84ff)", color: "#f7fbff", border: "1px solid rgba(145,212,255,.5)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35),0 8px 22px rgba(10,132,255,.32)" }}>
                {busy ? <LoaderCircle size={17} className="animate-spin" /> : <Mail size={17} />}
                {mode === "magic" ? "Send magic link" : accountMode === "signup" ? "Create account" : "Sign in with email"}
              </button>
            </form>
            {mode === "password" && (
              <div className="oauth-switch-mode">
                {accountMode === "signin" ? "New to DRIVE? " : "Already have an account? "}
                <button type="button" onClick={() => { setAccountMode(accountMode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}>
                  {accountMode === "signin" ? "Create account" : "Sign in"}
                </button>
              </div>
            )}
            <div className="oauth-security-note"><LockKeyhole size={14} /> Your sign-in is protected by Supabase. DRIVE never stores your password.</div>
          </>
        ) : details ? (
          <>
            <div className="oauth-account-switch">
              <span>Signed in as <strong>{session.user?.email || "your account"}</strong></span>
              <button type="button" onClick={switchAccount} disabled={busy} style={{ borderColor: "rgba(124,212,255,.35)", color: "#8cdbff" }}>Switch account</button>
            </div>
            <div className="oauth-permission-eyebrow" style={{ color: "#7cd4ff" }}>Permission request</div>
            <h1 className="oauth-title">Authorize {clientLabel}?</h1>
            <p className="oauth-subtitle">Review the access requested by this application before continuing.</p>
            <div className="oauth-details-box">
              <div className="oauth-client-row"><LockKeyhole size={16} style={{ color: "#7cd4ff" }} /> <span>Client</span><strong>{clientLabel}</strong></div>
              <div className="oauth-redirect">Redirect: {details.redirect_uri || "Not provided"}</div>
              <div className="oauth-scopes">
                <div>Requested scopes</div>
                {scopes.length ? (
                  <div className="oauth-scope-list">{scopes.map((scope) => <span key={scope} style={{ borderColor: "rgba(124,212,255,.28)", background: "rgba(10,132,255,.14)", color: "#d6efff" }}>{scope}</span>)}</div>
                ) : (
                  <p>No standard profile scopes requested. DRIVE permissions remain governed by your account settings.</p>
                )}
              </div>
            </div>
            <div className="oauth-actions" style={{ display: "grid", gap: 10, marginTop: 22 }}>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true, false)}
                className="oauth-submit-button"
                style={{ background: "linear-gradient(135deg,#2b95ff,#0a84ff)", color: "#f7fbff", border: "1px solid rgba(145,212,255,.55)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35),0 8px 22px rgba(10,132,255,.32)" }}
              >
                {busy ? <LoaderCircle size={17} className="animate-spin" /> : <CheckCircle2 size={17} />}
                Approve &amp; Return to {clientLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true, true)}
                className="oauth-deny-button"
                style={{ borderColor: "rgba(124,212,255,.36)", color: "#bfe6ff", background: "rgba(10,132,255,.1)" }}
              >
                Approve &amp; Open Dashboard (with Return Button)
              </button>
              <button type="button" disabled={busy} onClick={() => decide(false, false)} className="oauth-deny-button">
                Deny
              </button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 text-sm text-white/60"><LoaderCircle className="animate-spin" size={18} /> Loading authorization request…</div>
        )}

        {error && <div role="alert" className="oauth-error"><AlertCircle size={17} />{error}</div>}
        {notice && <div role="status" className="oauth-notice">{notice}</div>}
        <p className="oauth-footer">DRIVE · Secure connection authorization</p>
      </section>
    </main>
  );
}
