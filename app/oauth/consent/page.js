"use client";

import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { ShieldCheck, LockKeyhole, LoaderCircle, AlertCircle, CheckCircle2 } from "lucide-react";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("authorization_id") || "";
    setAuthorizationId(id);
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!session || !authorizationId) return;
    let cancelled = false;
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: authError }) => {
      if (cancelled) return;
      if (authError) setError(authError.message);
      else if (data && !("authorization_id" in data) && data.redirect_url) window.location.assign(data.redirect_url);
      else setDetails(data);
    }).catch((e) => { if (!cancelled) setError(e.message || "Unable to load authorization details."); });
    return () => { cancelled = true; };
  }, [session, authorizationId, supabase]);

  async function signIn(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
    } catch (e) { setError(e.message || "Sign-in failed."); }
    finally { setBusy(false); }
  }

  async function decide(allow) {
    if (!authorizationId) return;
    setBusy(true); setError("");
    try {
      const result = allow
        ? await supabase.auth.oauth.approveAuthorization(authorizationId)
        : await supabase.auth.oauth.denyAuthorization(authorizationId);
      if (result.error) throw result.error;
      if (!result.data?.redirect_url) throw new Error("OAuth provider did not return a redirect URL.");
      window.location.assign(result.data.redirect_url);
    } catch (e) { setError(e.message || "Could not complete authorization."); setBusy(false); }
  }

  const scopes = (details?.scope || "").split(/\s+/).filter(Boolean);
  return (
    <main className="min-h-screen flex items-center justify-center px-5 py-12" style={{background:"radial-gradient(circle at 50% 0%, rgba(87,72,190,.22), transparent 42%), #080a12", color:"#f5f6ff"}}>
      <section className="w-full max-w-lg rounded-3xl border p-7 sm:p-9" style={{background:"rgba(18,21,34,.94)",borderColor:"rgba(255,255,255,.12)",boxShadow:"0 24px 90px rgba(0,0,0,.38)"}}>
        <div className="flex items-center gap-3 mb-8">
          <div className="h-11 w-11 rounded-2xl flex items-center justify-center" style={{background:"rgba(139,124,255,.16)",color:"#a99cff"}}><ShieldCheck size={23}/></div>
          <div><div className="font-semibold tracking-wide">DRIVE</div><div className="text-xs text-white/45">Secure authorization</div></div>
        </div>
        {!authorizationId ? <div className="rounded-2xl p-4 text-sm" style={{background:"rgba(248,113,113,.1)",color:"#fca5a5"}}>Missing authorization_id. Restart the connection from your MCP client.</div> :
        !session ? <>
          <h1 className="text-2xl font-semibold mb-2">Sign in to DRIVE</h1>
          <p className="text-sm text-white/55 mb-6">Sign in before reviewing this connection request. Your password is sent directly to Supabase Auth.</p>
          <form onSubmit={signIn} className="space-y-3">
            <input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" className="w-full rounded-xl px-4 py-3 outline-none border bg-white/5 border-white/10 text-white"/>
            <input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full rounded-xl px-4 py-3 outline-none border bg-white/5 border-white/10 text-white"/>
            <button disabled={busy} className="w-full rounded-xl py-3 font-semibold disabled:opacity-50" style={{background:"#a99cff",color:"#10101a"}}>{busy ? "Signing in…" : "Sign in securely"}</button>
          </form>
        </> : details ? <>
          <div className="text-xs uppercase tracking-[.18em] text-violet-300 mb-3">Permission request</div>
          <h1 className="text-2xl font-semibold mb-2">Authorize {details.client?.name || "MCP client"}?</h1>
          <p className="text-sm text-white/55 mb-6">This application is requesting access through your DRIVE account. Review the request before continuing.</p>
          <div className="rounded-2xl p-4 border border-white/10 bg-white/[.035] space-y-3">
            <div className="flex items-center gap-2 text-sm"><LockKeyhole size={16} className="text-violet-300"/> <span className="text-white/50">Client</span><strong className="ml-auto text-right">{details.client?.name || "Unknown client"}</strong></div>
            <div className="text-xs text-white/45 break-all">Redirect: {details.redirect_uri || "Not provided"}</div>
            <div className="pt-2 border-t border-white/10"><div className="text-xs uppercase tracking-wider text-white/45 mb-2">Requested scopes</div>
              {scopes.length ? <div className="flex flex-wrap gap-2">{scopes.map(scope=><span key={scope} className="rounded-full px-3 py-1 text-xs bg-violet-400/10 text-violet-200 border border-violet-300/15">{scope}</span>)}</div> : <p className="text-sm text-white/55">No standard profile scopes requested. DRIVE permissions are still governed by your account's enabled connections and Skills.</p>}
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button disabled={busy} onClick={()=>decide(false)} className="flex-1 rounded-xl py-3 border border-white/15 text-white/75 disabled:opacity-50">Deny</button>
            <button disabled={busy} onClick={()=>decide(true)} className="flex-1 rounded-xl py-3 font-semibold disabled:opacity-50 flex items-center justify-center gap-2" style={{background:"#a99cff",color:"#10101a"}}>{busy ? <LoaderCircle size={17} className="animate-spin"/> : <CheckCircle2 size={17}/>} Approve access</button>
          </div>
        </> : <div className="flex items-center gap-3 text-sm text-white/60"><LoaderCircle className="animate-spin" size={18}/> Loading authorization request…</div>}
        {error && <div role="alert" className="mt-5 rounded-xl p-3 text-sm flex gap-2" style={{background:"rgba(248,113,113,.1)",color:"#fca5a5"}}><AlertCircle size={17} className="shrink-0"/>{error}</div>}
        {notice && <p className="mt-4 text-sm text-emerald-300">{notice}</p>}
        <p className="mt-8 text-xs text-center text-white/35">You can revoke authorized applications from your account settings.</p>
      </section>
    </main>
  );
}
