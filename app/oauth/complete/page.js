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
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: "24px", background: "radial-gradient(ellipse at 50% -10%,rgba(10,132,255,.22),transparent 50%),radial-gradient(circle at 100% 100%,rgba(90,200,250,.12),transparent 40%),#060a12", color: "#f5f9ff" }}>
      <section style={{ width: "min(100%,500px)", padding: "30px", borderRadius: "28px", border: "1px solid rgba(255,255,255,.16)", background: "linear-gradient(155deg,rgba(20,30,48,.92),rgba(9,14,24,.96))", backdropFilter: "blur(28px) saturate(190%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.22),0 28px 90px rgba(0,0,0,.52)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
          <div style={{ width: 46, height: 46, borderRadius: 15, display: "grid", placeItems: "center", background: "linear-gradient(145deg,rgba(10,132,255,.26),rgba(90,200,250,.14))", border: "1px solid rgba(124,212,255,.36)", color: "#8cdbff" }}>
            <ShieldCheck size={24} />
          </div>
          <div>
            <strong style={{ letterSpacing: ".18em" }}>DRIVE</strong>
            <div style={{ fontSize: 12, color: "#9eb0c4" }}>One hub. Every connection.</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#7cd4ff", fontSize: 12, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase" }}>
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
              style={{ minHeight: 50, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, background: "linear-gradient(135deg,#2b95ff,#0a84ff)", border: "1px solid rgba(145,212,255,.55)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35),0 8px 22px rgba(10,132,255,.32)", color: "#f7fbff", fontWeight: 700, textDecoration: "none" }}
            >
              Selesai &amp; Kembali ke {clientName || "Provider"} <ArrowUpRight size={17} />
            </a>
          ) : (
            <div role="alert" style={{ padding: 14, borderRadius: 14, background: "rgba(255,69,58,.14)", color: "#fca5a5", fontSize: 13 }}>
              URL callback provider tidak ditemukan. Ulangi koneksi dari AI provider kamu.
            </div>
          )}
          <Link
            href={dashboardHref}
            style={{ minHeight: 50, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center", gap: 9, border: "1px solid rgba(255,255,255,.18)", background: "rgba(255,255,255,.07)", color: "#eef4ff", fontWeight: 650, textDecoration: "none" }}
          >
            <LayoutGrid size={16} /> Buka Dashboard DRIVE dulu
          </Link>
        </div>
      </section>
    </main>
  );
}
