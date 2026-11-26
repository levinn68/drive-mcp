"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  Cable,
  Check,
  Copy,
  ExternalLink,
  Globe,
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

  return (
    <main className="mkt-shell">
      <nav className="mkt-nav" aria-label="Marketplace navigation">
        <Link href="/#mcp" className="mkt-nav-link">
          <ArrowLeft size={15} /> Back to Workspace
        </Link>
        <Link href="/connect" className="mkt-nav-link">
          <Cable size={15} /> Direct Connect Gateway
        </Link>
      </nav>

      <header className="mkt-hero">
        <div className="mkt-eyebrow">
          <Sparkles size={13} /> DRIVE MULTI-SOURCE MARKETPLACE
        </div>
        <h1 className="mkt-title">MCP &amp; Agent Skills Hub</h1>
        <p className="mkt-desc">
          Jelajahi MCP server dan Agent Skills dari indeks multi-source DRIVE. Klik Connect untuk langsung menghubungkan MCP ke akun kamu atau salin direct gateway URL-nya.
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
              placeholder={tab === "mcp" ? "Cari MCP (github, figcraft, supabase, browser)..." : "Cari Skill (react, supabase, security, motion)..."}
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
                All MCPs ({mcps.length})
              </button>
              <button
                type="button"
                className={`mkt-chip ${remoteOnly ? "is-active" : ""}`}
                onClick={() => setRemoteOnly(true)}
              >
                <Globe size={13} /> 1-Click Remote Ready ({mcps.filter((m) => m.remoteReady).length})
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className={`mkt-chip ${!verifiedOnly ? "is-active" : ""}`}
                onClick={() => setVerifiedOnly(false)}
              >
                All Skills ({skills.length})
              </button>
              <button
                type="button"
                className={`mkt-chip ${verifiedOnly ? "is-active" : ""}`}
                onClick={() => setVerifiedOnly(true)}
              >
                <ShieldCheck size={13} /> Verified Only ({skills.filter((s) => s.verified).length})
              </button>
            </>
          )}
        </div>
      </header>

      {tab === "mcp" ? (
        filteredMcps.length === 0 ? (
          <div className="mkt-empty">
            <p style={{ margin: "0 0 14px" }}>Tidak ada MCP yang cocok dengan &ldquo;{query}&rdquo;.</p>
            <Link
              href={`/connect?query=${encodeURIComponent(query.trim())}`}
              className="mkt-action is-primary"
              style={{ display: "inline-flex" }}
            >
              <Cable size={14} /> Hubungkan sebagai Custom MCP
            </Link>
          </div>
        ) : (
          <section className="mkt-grid" aria-label="MCP server list">
            {filteredMcps.map((item) => (
              <article key={item.name} className="mkt-card">
                <div>
                  <div className="mkt-card-badges">
                    <span className={`mkt-badge ${item.remoteReady ? "is-lime" : ""}`}>
                      {item.remoteReady ? "Remote Ready" : "STDIO"}
                    </span>
                    <span className="mkt-badge">{item.source}</span>
                  </div>
                  <h2>{item.title}</h2>
                  <div className="mkt-card-sub">{item.name} · v{item.version}</div>
                  <p className="mkt-card-desc">
                    {item.description || "Model Context Protocol server siap dihubungkan melalui DRIVE gateway."}
                  </p>
                </div>

                <div className="mkt-card-footer">
                  <Link href={`/connect?server=${encodeURIComponent(item.name)}`} className="mkt-action is-primary">
                    <Cable size={13} /> Connect
                  </Link>
                  <button
                    type="button"
                    className="mkt-action"
                    title="Copy direct connect URL"
                    aria-label={`Copy connect URL for ${item.title}`}
                    onClick={() => copyConnectUrl(item.name)}
                  >
                    {copiedKey === item.name ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  {item.repositoryUrl && (
                    <a
                      href={item.repositoryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mkt-action"
                      aria-label={`Open source repository for ${item.title}`}
                    >
                      <ExternalLink size={14} />
                    </a>
                  )}
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
          {filteredSkills.map((item) => (
            <article key={item.id} className="mkt-card">
              <div>
                <div className="mkt-card-badges">
                  {item.verified && (
                    <span className="mkt-badge is-lime">
                      <ShieldCheck size={11} /> Verified
                    </span>
                  )}
                  <span className="mkt-badge">{item.category}</span>
                  {item.stars > 0 && (
                    <span className="mkt-badge">
                      <Star size={11} /> {item.stars.toLocaleString()}
                    </span>
                  )}
                </div>
                <h2>{item.name}</h2>
                <div className="mkt-card-sub">{item.author || item.source} · {item.slug}</div>
                <p className="mkt-card-desc">
                  {item.description || "Agent Skill siap diinspeksi, dipindai, dan diaktifkan di DRIVE."}
                </p>
              </div>

              <div className="mkt-card-footer">
                <Link
                  href={`/?tab=skills&q=${encodeURIComponent(item.slug)}#skills`}
                  className="mkt-action is-primary"
                >
                  <BookOpen size={13} /> Open in Skills
                </Link>
                {item.sourceUrl && (
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mkt-action"
                    aria-label={`Open source for ${item.name}`}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
