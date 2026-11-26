"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, LayoutGrid, ShieldCheck } from "lucide-react";

export default function OAuthCompletePage() {
  const [callback, setCallback] = useState("");
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("callback") || "";
      const client = (params.get("client") || "").trim();
      try {
        const url = new URL(raw);
        if (url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") {
          const valid = url.toString();
          setCallback(valid);
          setClientName(client);
          window.sessionStorage.setItem("drive:oauth_callback", valid);
          if (client) window.sessionStorage.setItem("drive:oauth_client", client);
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const dashboardHref = callback
    ? `/?oauth_callback=${encodeURIComponent(callback)}${clientName ? `&oauth_client=${encodeURIComponent(clientName)}` : ""}`
    : "/";

  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: "24px", background: "radial-gradient(ellipse at 50% -10%,rgba(194,255,105,.15),transparent 48%),#080d12", color: "#f5f6ff" }}>
      <section style={{ width: "min(100%,520px)", padding: "30px", borderRadius: "28px", border: "1px solid rgba(255,255,255,.15)", background: "linear-gradient(145deg,rgba(22,35,42,.95),rgba(11,19,25,.98))", boxShadow: "0 30px 100px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, display: "grid", placeItems: "center", background: "rgba(194,255,105,.18)", color: "#d7ff8b" }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <strong style={{ letterSpacing: ".18em" }}>DRIVE</strong>
            <div style={{ fontSize: 12, color: "#9eb0c4" }}>One hub. Every connection.</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#86efac", fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>
          <CheckCircle2 size={16} /> Access approved
        </div>
        <h1 style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: "-.03em", margin: "12px 0 10px" }}>
          Koneksi disetujui.
        </h1>
        <p style={{ color: "#b7c6d8", lineHeight: 1.6, fontSize: 14, marginBottom: 24 }}>
          Kamu bisa langsung kembali ke {clientName || "AI provider"} sekarang, atau buka Dashboard DRIVE dulu untuk mengatur MCP &amp; Skills (tombol <strong>Kembali ke {clientName || "Provider"}</strong> akan tetap tampil di bagian atas Dashboard).
        </p>
        <div style={{ display: "grid", gap: 12 }}>
          {callback ? (
            <a
              href={callback}
              style={{ minHeight: 50, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, background: "linear-gradient(135deg,#d7ff8b,#9ef065)", color: "#0b1407", fontWeight: 750, textDecoration: "none" }}
            >
              Selesai &amp; Kembali ke {clientName || "Provider"} <ArrowUpRight size={17} />
            </a>
          ) : (
            <div role="alert" style={{ padding: 14, borderRadius: 14, background: "rgba(248,113,113,.12)", color: "#fca5a5", fontSize: 13 }}>
              URL callback provider tidak ditemukan. Ulangi koneksi dari AI provider kamu.
            </div>
          )}
          <Link
            href={dashboardHref}
            style={{ minHeight: 50, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.06)", color: "#eef4ff", fontWeight: 650, textDecoration: "none" }}
          >
            <LayoutGrid size={16} /> Buka Dashboard DRIVE dulu
          </Link>
        </div>
      </section>
    </main>
  );
}
