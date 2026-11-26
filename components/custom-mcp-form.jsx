"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Globe, LoaderCircle, LockKeyhole, Plus, Server, ShieldCheck } from "lucide-react";
import { useDriveLang } from "./lang-context";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export default function CustomMcpForm() {
  const { t } = useDriveLang();
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
      setStatus({ type: "error", text: t("Autentikasi belum dikonfigurasi.", "Authentication is not configured yet.") });
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
          text: t(
            "Masuk di tab Akun dulu untuk menyimpan custom MCP endpoint.",
            "Sign in on the Account tab first to save a custom MCP endpoint."
          ),
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
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || t("Gagal menyimpan endpoint ini.", "Could not save this endpoint."));
      }
      setStatus({
        type: "success",
        text: t(
          `${name.trim()} berhasil disimpan ke akun DRIVE kamu.`,
          `${name.trim()} saved to your DRIVE account.`
        ),
      });
      setName("");
      setEndpoint("");
      window.dispatchEvent(new Event("drive:connections-changed"));
    } catch (err) {
      setStatus({
        type: "error",
        text: err?.message || t("Gagal menyimpan endpoint ini.", "Could not save this endpoint."),
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
            <Server size={13} /> {t("NAMA TAMPILAN SERVER", "SERVER DISPLAY NAME")}
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t("cth. Internal Analytics MCP", "e.g. Internal Analytics MCP")}
            minLength={2}
            maxLength={80}
            required
          />
        </label>

        <label className="custom-field-label">
          <span>
            <Globe size={13} /> {t("ENDPOINT STREAMABLE HTTP (HTTPS)", "STREAMABLE HTTP ENDPOINT (HTTPS)")}
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
            <LockKeyhole size={11} /> {t("Wajib TLS", "TLS Required")}
          </span>
          <span>
            <ShieldCheck size={11} /> {t("Proteksi SSRF", "SSRF Protected")}
          </span>
        </div>

        <button type="submit" className="custom-submit-btn" disabled={busy}>
          {busy ? <LoaderCircle size={15} className="spin" /> : <Plus size={15} />}
          {busy
            ? t("Menyimpan...", "Saving...")
            : t("Daftarkan Endpoint", "Register Endpoint")}
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
              {t("Masuk dengan Google", "Sign in with Google")}
            </button>
          )}
        </div>
      )}

      <p className="custom-form-hint">
        {t(
          "Hanya endpoint HTTPS publik yang diterima. IP privat, localhost, dan kredensial tertanam otomatis ditolak oleh proteksi SSRF.",
          "Only public HTTPS endpoints are accepted. Private IPv4/IPv6 ranges, localhost, and embedded credentials are automatically rejected by the SSRF guard."
        )}
      </p>
    </div>
  );
}
