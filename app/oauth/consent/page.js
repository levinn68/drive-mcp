"use client";

import "./consent.css";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  LockKeyhole,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  Chrome,
  Mail,
  KeyRound,
  Sparkles,
  LayoutGrid,
} from "lucide-react";
import DriveLogo from "../../../components/drive-logo";

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
  const [mode, setMode] = useState("password");
  const [accountMode, setAccountMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
      window.location.replace("/mcp");
      return;
    }
    let cancelled = false;
    supabase.auth.oauth
      .getAuthorizationDetails(authorizationId)
      .then(({ data, error: detailsError }) => {
        if (cancelled) return;
        if (detailsError) setError(detailsError.message || "Unable to load authorization details.");
        else setDetails(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Unable to load authorization details.");
      });
    return () => {
      cancelled = true;
    };
  }, [session, authorizationId, authContextReady, supabase]);

  async function signInWithGoogle() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    const nextPath = authorizationId
      ? `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
      : "/mcp";
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
  }

  async function submitEmail(e) {
    e.preventDefault();
    if (!supabase) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const nextPath = authorizationId
        ? `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`
        : "/mcp";
      if (mode === "magic") {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });
        if (otpError) throw otpError;
        setNotice("Check your inbox and click the magic link to continue.");
      } else if (accountMode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
          },
        });
        if (signUpError) throw signUpError;
        if (!data.session) setNotice("Account created. Check your email to confirm and continue.");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err?.message || "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function switchAccount() {
    if (!supabase) return;
    setBusy(true);
    setError("");
    try {
      await supabase.auth.signOut();
      setSession(null);
      setDetails(null);
      setNotice("Signed out. Choose another account to continue.");
    } catch (e) {
      setError(e?.message || "Failed to sign out.");
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
        const dest = new URL("/mcp", window.location.origin);
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
    <main className="oauth-page">
      <div className="oauth-ambient" aria-hidden="true">
        <span className="oauth-orb is-a" />
        <span className="oauth-orb is-b" />
      </div>

      <section className="oauth-card">
        <div className="oauth-brand">
          <div className="oauth-brand-mark">
            <DriveLogo size={28} />
          </div>
          <div className="oauth-brand-copy">
            <div>DRIVE</div>
            <small>One hub. Every connection.</small>
          </div>
          <div className="oauth-secure-pill">
            <LockKeyhole size={11} /> Secure OAuth
          </div>
        </div>

        {!authorizationId ? (
          <div className="oauth-error" role="alert">
            <AlertCircle size={16} style={{ flex: "none", marginTop: 2 }} />
            <span>Missing authorization_id. Restart the connection from your MCP client.</span>
          </div>
        ) : !session ? (
          <>
            <div className="oauth-intro">
              <div className="oauth-welcome-pill">
                <Sparkles size={12} /> Welcome to DRIVE
              </div>
              <h1 className="oauth-title">
                {accountMode === "signup" ? "Create your account" : "Sign in to DRIVE"}
              </h1>
              <p className="oauth-subtitle">Sign in to continue to your DRIVE workspace.</p>
            </div>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              className="oauth-google-button"
            >
              {busy ? <LoaderCircle size={17} className="spin" /> : <Chrome size={17} />}
              Continue with Google
            </button>

            <div className="oauth-divider">
              <span />
              <span>or use email</span>
              <span />
            </div>

            <div className="oauth-tabs">
              <button
                type="button"
                onClick={() => {
                  setMode("password");
                  setError("");
                  setNotice("");
                }}
                className={`oauth-tab ${mode === "password" ? "is-active" : ""}`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("magic");
                  setAccountMode("signin");
                  setError("");
                  setNotice("");
                }}
                className={`oauth-tab ${mode === "magic" ? "is-active" : ""}`}
              >
                Magic link
              </button>
            </div>

            <form onSubmit={submitEmail} className="oauth-form">
              <label className="oauth-field">
                <span>Email address</span>
                <span className="oauth-input-wrap">
                  <Mail size={16} />
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="oauth-input"
                  />
                </span>
              </label>

              {mode === "password" && (
                <label className="oauth-field">
                  <span>Password</span>
                  <span className="oauth-input-wrap">
                    <KeyRound size={16} />
                    <input
                      type="password"
                      autoComplete={accountMode === "signup" ? "new-password" : "current-password"}
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="oauth-input"
                    />
                  </span>
                </label>
              )}

              <button disabled={busy} className="oauth-submit-button">
                {busy ? <LoaderCircle size={17} className="spin" /> : <Mail size={17} />}
                {mode === "magic"
                  ? "Send magic link"
                  : accountMode === "signup"
                  ? "Create account"
                  : "Sign in with email"}
              </button>
            </form>

            {mode === "password" && (
              <div className="oauth-switch-mode">
                {accountMode === "signin" ? "New to DRIVE? " : "Already have an account? "}
                <button
                  type="button"
                  onClick={() => {
                    setAccountMode(accountMode === "signin" ? "signup" : "signin");
                    setError("");
                    setNotice("");
                  }}
                >
                  {accountMode === "signin" ? "Create account" : "Sign in"}
                </button>
              </div>
            )}

            <div className="oauth-security-note">
              <LockKeyhole size={14} />
              <span>Your sign-in is protected by Supabase. DRIVE never stores your password.</span>
            </div>
          </>
        ) : details ? (
          <>
            <div className="oauth-account-switch">
              <span>
                Signed in as <strong>{session.user?.email || "your account"}</strong>
              </span>
              <button type="button" onClick={switchAccount} disabled={busy}>
                Switch account
              </button>
            </div>

            <div className="oauth-permission-eyebrow">Permission request</div>
            <h1 className="oauth-title">Authorize {clientLabel}?</h1>
            <p className="oauth-subtitle">
              Review the access requested by this application before continuing.
            </p>

            <div className="oauth-details-box">
              <div className="oauth-client-row">
                <LockKeyhole size={15} />
                <span>Client</span>
                <strong>{clientLabel}</strong>
              </div>
              <div className="oauth-redirect">Redirect: {details.redirect_uri || "Not provided"}</div>
              <div className="oauth-scopes">
                <div>Requested scopes</div>
                {scopes.length ? (
                  <div className="oauth-scope-list">
                    {scopes.map((scope) => (
                      <span key={scope}>{scope}</span>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: "rgba(235,235,245,0.62)" }}>
                    No standard profile scopes requested. DRIVE permissions remain governed by your
                    account settings.
                  </p>
                )}
              </div>
            </div>

            <div className="oauth-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true, false)}
                className="oauth-submit-button"
              >
                {busy ? <LoaderCircle size={17} className="spin" /> : <CheckCircle2 size={17} />}
                Approve &amp; Return to {clientLabel}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(true, true)}
                className="oauth-secondary-button"
              >
                <LayoutGrid size={15} /> Approve &amp; Open Dashboard
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => decide(false, false)}
                className="oauth-deny-button"
              >
                Deny
              </button>
            </div>
          </>
        ) : (
          <div className="oauth-loading">
            <LoaderCircle className="spin" size={18} /> Loading authorization request…
          </div>
        )}

        {error && (
          <div role="alert" className="oauth-error">
            <AlertCircle size={16} style={{ flex: "none", marginTop: 2 }} />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div role="status" className="oauth-notice">
            {notice}
          </div>
        )}

        <p className="oauth-footer">DRIVE · Secure connection authorization</p>
      </section>
    </main>
  );
}
