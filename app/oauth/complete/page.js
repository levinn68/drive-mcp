"use client";

import "../consent/consent.css";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, LayoutGrid } from "lucide-react";
import DriveLogo from "../../../components/drive-logo";

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
    ? `/mcp?oauth_callback=${encodeURIComponent(callback)}${
        clientName ? `&oauth_client=${encodeURIComponent(clientName)}` : ""
      }`
    : "/mcp";

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
        </div>

        <div className="oauth-welcome-pill" style={{ color: "#86efac", borderColor: "rgba(48,209,88,0.34)", background: "rgba(48,209,88,0.14)" }}>
          <CheckCircle2 size={14} /> Access approved
        </div>
        <h1 className="oauth-title">Connection approved.</h1>
        <p className="oauth-subtitle" style={{ marginBottom: 22 }}>
          You can return directly to {clientName || "your AI client"} now, or open the DRIVE
          Dashboard first to manage your MCPs &amp; Skills.
        </p>

        <div className="oauth-actions" style={{ marginTop: 0 }}>
          {callback ? (
            <a href={callback} className="oauth-submit-button" style={{ textDecoration: "none" }}>
              Finish &amp; Return to {clientName || "Provider"} <ArrowUpRight size={16} />
            </a>
          ) : (
            <div role="alert" className="oauth-error">
              Provider callback URL is missing. Please restart the connection from your AI client.
            </div>
          )}
          <Link href={dashboardHref} className="oauth-secondary-button" style={{ textDecoration: "none" }}>
            <LayoutGrid size={15} /> Open DRIVE Dashboard
          </Link>
        </div>

        <p className="oauth-footer">DRIVE · Secure connection authorization</p>
      </section>
    </main>
  );
}
