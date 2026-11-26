"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@supabase/ssr";
import {
  ArrowLeft,
  BookOpen,
  Cable,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";

export default function MarketplaceExplorer({
  initialTab = "mcp",
  initialQuery = "",
  mcps = [],
  skills = [],
}) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState(initialQuery);
  const [remoteOnly, setRemoteOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [copiedKey, setCopiedKey] = useState("");
  const [installingId, setInstallingId] = useState("");
  const [installedIds, setInstalledIds] = useState({});
  const [toast, setToast] = useState({ type: "", message: "" });

  const filteredMcps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mcps.filter((item) => {
      if (remoteOnly && !item.remoteReady) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q)
      );
    });
  }, [mcps, query, remoteOnly]);

  const filteredSkills = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills.filter((item) => {
      if (verifiedOnly && !item.verified) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [skills, query, verifiedOnly]);

  async function copyConnectUrl(serverName) {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/connect?server=${encodeURIComponent(serverName)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(serverName);
      setTimeout(() => setCopiedKey(""), 1800);
    } catch {}
  }

  async function quickInstallSkill(item) {
    setInstallingId(item.id);
    setToast({ type: "", message: "" });
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("Supabase auth belum dikonfigurasi.");
      const supabase = createBrowserClient(url, key);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        const nextPath = `${window.location.pathname}${window.location.search}`;
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}` },
        });
        return;
      }

      const repo = item.sourceUrl
        ? item.sourceUrl.replace(/^https?:\/\/github\.com\//i, "").split("/blob/")[0]
        : item.id.split("/").slice(0, 2).join("/");

      const res = await fetch("/api/skills/quick-install", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          repository: repo,
          slug: item.slug,
          name: item.name,
          description: item.description,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error([data.error, data.detail].filter(Boolean).join(": ") || "Gagal memasang Skill.");
      setInstalledIds((prev) => ({ ...prev, [item.id]: true }));
      setToast({ type: "success", message: `${item.name} berhasil dipasang dan langsung aktif di DRIVE MCP kamu.` });
    } catch (err) {
      setToast({ type: "error", message: err?.message || "Gagal memasang Skill." });
    } finally {
      setInstallingId("");
    }
  }

  return (
    <main className="mkt-shell">
      <nav className="mkt-nav" aria-label="Marketplace navigation">
        <Link href="/#mcp" className="mkt-nav-link">
          <ArrowLeft size={15} /> Workspace
        </Link>
        <Link href="/connect" className="mkt-nav-link">
          <Cable size={15} /> Direct Gateway
        </Link>
      </nav>

      <header className="mkt-hero">
        <div className="mkt-eyebrow">
          <Sparkles size={13} /> DRIVE MULTI-SOURCE MARKETPLACE
        </div>
        <h1 className="mkt-title">MCP &amp; Agent Skills Hub</h1>
        <p className="mkt-desc">
          Tampilan 2 kolom ringkas untuk MCP dan Skills. Klik tombol Connect atau Install untuk langsung aktif di akun DRIVE kamu.
        </p>

        <div className="mkt-controls">
          <div className="mkt-segmented" role="tablist" aria-label="Marketplace category">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "mcp"}
              className={`mkt-seg-btn ${tab === "mcp" ? "is-active" : ""}`}
              onClick={() => setTab("mcp")}
            >
              <Cable size={15} /> MCPs ({mcps.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "skills"}
              className={`mkt-seg-btn ${tab === "skills" ? "is-active" : ""}`}
              onClick={() => setTab("skills")}
            >
              <BookOpen size={15} /> Skills ({skills.length})
            </button>
          </div>

          <div className="mkt-search-wrap">
            <Search size={16} className="mkt-search-icon" />
            <input
              type="search"
              className="mkt-search-input"
              aria-label={tab === "mcp" ? "Search MCP servers" : "Search Agent Skills"}
              placeholder={tab === "mcp" ? "Cari MCP (github, figcraft, supabase)..." : "Cari Skill (react, supabase, security)..."}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="mkt-filters">
          {tab === "mcp" ? (
            <>
              <button
                type="button"
                className={`mkt-chip ${!remoteOnly ? "is-active" : ""}`}
                onClick={() => setRemoteOnly(false)}
              >
                All ({mcps.length})
              </button>
              <button
                type="button"
                className={`mkt-chip ${remoteOnly ? "is-active" : ""}`}
                onClick={() => setRemoteOnly(true)}
              >
                <Globe size={13} /> Remote Ready ({mcps.filter((m) => m.remoteReady).length})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`mkt-chip ${!verifiedOnly ? "is-active" : ""}`}
                onClick={() => setVerifiedOnly(false)}
              >
                All ({skills.length})
              </button>
              <button
                type="button"
                className={`mkt-chip ${verifiedOnly ? "is-active" : ""}`}
                onClick={() => setVerifiedOnly(true)}
              >
                <ShieldCheck size={13} /> Verified ({skills.filter((s) => s.verified).length})
              </button>
            </>
          )}
        </div>
      </header>

      <div aria-live="polite">
        {toast.message && (
          <div className={`mkt-toast ${toast.type === "error" ? "is-error" : ""}`} role={toast.type === "error" ? "alert" : "status"}>
            {toast.message}
          </div>
        )}
      </div>

      {tab === "mcp" ? (
        filteredMcps.length === 0 ? (
          <div className="mkt-empty">
            <p style={{ margin: "0 0 14px" }}>Tidak ada MCP yang cocok dengan &ldquo;{query}&rdquo;.</p>
            <Link
              href={`/connect?query=${encodeURIComponent(query.trim())}`}
              className="mkt-action is-primary"
              style={{ display: "inline-flex" }}
            >
              <Cable size={14} /> Custom MCP
            </Link>
          </div>
        ) : (
          <section className="mkt-grid" aria-label="MCP server list">
            {filteredMcps.map((item) => (
              <article key={item.name} className="mkt-card">
                <div>
                  <div className="mkt-card-badges">
                    <span className={`mkt-badge ${item.remoteReady ? "is-lime" : ""}`}>
                      {item.remoteReady ? "Remote" : "STDIO"}
                    </span>
                  </div>
                  <h2>{item.title}</h2>
                  <div className="mkt-card-sub">{item.name}</div>
                  <p className="mkt-card-desc">
                    {item.description || "MCP server siap dihubungkan via DRIVE."}
                  </p>
                </div>

                <div className="mkt-card-footer">
                  <Link href={`/connect?server=${encodeURIComponent(item.name)}`} className="mkt-action is-primary">
                    <Plus size={13} /> Connect
                  </Link>
                  <button
                    type="button"
                    className="mkt-action"
                    title="Copy direct connect URL"
                    aria-label={`Copy connect URL for ${item.title}`}
                    onClick={() => copyConnectUrl(item.name)}
                  >
                    {copiedKey === item.name ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )
      ) : filteredSkills.length === 0 ? (
        <div className="mkt-empty">
          Tidak ada Skill yang cocok dengan &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <section className="mkt-grid" aria-label="Agent Skills list">
          {filteredSkills.map((item) => {
            const isInstalled = Boolean(installedIds[item.id]);
            const isBusy = installingId === item.id;
            return (
              <article key={item.id} className="mkt-card">
                <div>
                  <div className="mkt-card-badges">
                    {item.verified && (
                      <span className="mkt-badge is-lime">
                        <ShieldCheck size={10} /> Verified
                      </span>
                    )}
                    {item.stars > 0 && (
                      <span className="mkt-badge">
                        <Star size={10} /> {item.stars.toLocaleString()}
                      </span>
                    )}
                  </div>
                  <h2>{item.name}</h2>
                  <div className="mkt-card-sub">{item.category} · {item.slug}</div>
                  <p className="mkt-card-desc">
                    {item.description || "Agent Skill siap dipasang 1-klik ke DRIVE."}
                  </p>
                </div>

                <div className="mkt-card-footer">
                  <button
                    type="button"
                    disabled={isBusy}
                    className={`mkt-action ${isInstalled ? "is-installed" : "is-primary"}`}
                    onClick={() => quickInstallSkill(item)}
                  >
                    {isBusy ? (
                      <Loader2 size={13} className="spin" />
                    ) : isInstalled ? (
                      <Check size={13} />
                    ) : (
                      <Plus size={13} />
                    )}
                    {isBusy ? "Installing..." : isInstalled ? "Terpasang" : "Install"}
                  </button>
                  {item.sourceUrl && (
                    <a
                      href={item.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mkt-action"
                      aria-label={`Open source for ${item.name}`}
                    >
                      <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
