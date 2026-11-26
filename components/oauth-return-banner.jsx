"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, X } from "lucide-react";
import DriveLogo from "./drive-logo";

const STORAGE_URL_KEY = "drive:oauth_callback";
const STORAGE_CLIENT_KEY = "drive:oauth_client";

function isSafeCallbackUrl(raw) {
  if (!raw || typeof raw !== "string") return "";
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return url.toString();
    }
  } catch {}
  return "";
}

function inferProviderLabel(callbackUrl, explicitName) {
  if (explicitName && explicitName.trim()) return explicitName.trim();
  try {
    const host = new URL(callbackUrl).hostname.toLowerCase();
    if (host.includes("grok")) return "Grok";
    if (host.includes("chatgpt") || host.includes("openai")) return "ChatGPT";
    if (host.includes("claude") || host.includes("anthropic")) return "Claude";
    if (host.includes("gemini") || host.includes("google")) return "Gemini";
    return host.replace(/^www\./, "");
  } catch {
    return "AI Provider";
  }
}

export default function OAuthReturnBanner() {
  const [pending, setPending] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const params = new URLSearchParams(window.location.search);
        const fromQuery = isSafeCallbackUrl(params.get("oauth_callback") || "");
        const clientQuery = (params.get("oauth_client") || "").trim();

        if (fromQuery) {
          window.sessionStorage.setItem(STORAGE_URL_KEY, fromQuery);
          if (clientQuery) window.sessionStorage.setItem(STORAGE_CLIENT_KEY, clientQuery);
          params.delete("oauth_callback");
          params.delete("oauth_client");
          const nextSearch = params.toString();
          const cleanUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;
          window.history.replaceState({}, "", cleanUrl);
          setPending({
            url: fromQuery,
            label: inferProviderLabel(fromQuery, clientQuery),
          });
          return;
        }

        const storedUrl = isSafeCallbackUrl(window.sessionStorage.getItem(STORAGE_URL_KEY) || "");
        const storedClient = window.sessionStorage.getItem(STORAGE_CLIENT_KEY) || "";
        if (storedUrl) {
          setPending({
            url: storedUrl,
            label: inferProviderLabel(storedUrl, storedClient),
          });
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  if (!pending) return null;

  function finishReturn() {
    try {
      window.sessionStorage.removeItem(STORAGE_URL_KEY);
      window.sessionStorage.removeItem(STORAGE_CLIENT_KEY);
    } catch {}
    window.location.replace(pending.url);
  }

  function dismiss() {
    try {
      window.sessionStorage.removeItem(STORAGE_URL_KEY);
      window.sessionStorage.removeItem(STORAGE_CLIENT_KEY);
    } catch {}
    setPending(null);
  }

  return (
    <div className="oauth-return-bar" role="region" aria-label="Finish OAuth connection">
      <div className="oauth-return-inner">
        <div className="oauth-return-copy">
          <span className="oauth-return-icon">
            <DriveLogo size={18} />
          </span>
          <div>
            <strong>Return to {pending.label}</strong>
            <small>Finish connecting DRIVE when ready</small>
          </div>
        </div>
        <div className="oauth-return-actions">
          <button type="button" className="oauth-return-btn" onClick={finishReturn}>
            Return to {pending.label} <ArrowUpRight size={14} />
          </button>
          <button
            type="button"
            className="oauth-return-dismiss"
            onClick={dismiss}
            aria-label="Dismiss return banner"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
