"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe2,
  KeyRound,
  Lock,
  Search,
  Server,
  ShieldCheck,
  Star,
  Unlock,
} from "lucide-react";
import { AddMcpButton } from "./my-mcps";
import { useDriveLang } from "./lang-context";

export const MCP_CATEGORIES = [
  { id: "", idLabel: "Semua", enLabel: "All" },
  { id: "remote", idLabel: "Remote Siap", enLabel: "Remote Ready" },
  { id: "ai", idLabel: "AI & Agent", enLabel: "AI & Agents" },
  { id: "coding", idLabel: "Coding & Dev", enLabel: "Coding & Dev" },
  { id: "github", idLabel: "GitHub & Git", enLabel: "GitHub & Git" },
  { id: "database", idLabel: "Database", enLabel: "Database" },
  { id: "cloud", idLabel: "Cloud & DevOps", enLabel: "Cloud & DevOps" },
  { id: "search", idLabel: "Search & Docs", enLabel: "Search & Docs" },
  { id: "browser", idLabel: "Browser & Scrape", enLabel: "Browser & Scrape" },
  { id: "design", idLabel: "Desain & UI", enLabel: "Design & UI" },
  { id: "media", idLabel: "Media & Video", enLabel: "Media & Video" },
  { id: "ecommerce", idLabel: "E-Commerce", enLabel: "E-Commerce" },
  { id: "productivity", idLabel: "Produktivitas", enLabel: "Productivity" },
  { id: "messaging", idLabel: "Chat & Sosial", enLabel: "Messaging & Social" },
  { id: "finance", idLabel: "Keuangan", enLabel: "Finance & Pay" },
  { id: "web3", idLabel: "Web3 & Crypto", enLabel: "Web3 & Crypto" },
  { id: "crm", idLabel: "CRM & Sales", enLabel: "CRM & Sales" },
  { id: "maps", idLabel: "Maps & Travel", enLabel: "Maps & Travel" },
  { id: "automation", idLabel: "Otomatisasi", enLabel: "Automation" },
  { id: "security", idLabel: "Keamanan", enLabel: "Security & Auth" },
  { id: "data", idLabel: "Data & Analitik", enLabel: "Data & Analytics" },
];

const COLLAPSED_CAT_COUNT = 8;

const AUTH_BADGE_MAP = {
  none: { idLabel: "Tanpa Auth", enLabel: "No Auth", cls: "is-auth-none", Icon: Unlock },
  oauth: { idLabel: "OAuth 2.1", enLabel: "OAuth 2.1", cls: "is-auth-oauth", Icon: Lock },
  pat: { idLabel: "PAT / Token", enLabel: "PAT / Token", cls: "is-auth-pat", Icon: KeyRound },
  oauth_catalog: {
    idLabel: "OAuth Katalog",
    enLabel: "OAuth Catalog",
    cls: "is-auth-pat",
    Icon: Lock,
  },
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

function normalizeKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
}

function getEntryKeys(entry) {
  const server = entry?.server || entry || {};
  const keys = [];
  if (server.name) keys.push(normalizeKey(server.name));
  if (server.title) keys.push(normalizeKey(server.title));
  if (server.endpoint_url) keys.push(normalizeKey(server.endpoint_url));
  if (server.remote_url) keys.push(normalizeKey(server.remote_url));
  if (Array.isArray(server.remotes)) {
    for (const r of server.remotes) {
      if (r?.url) keys.push(normalizeKey(r.url));
    }
  }
  return keys.filter(Boolean);
}

export default function McpDirectoryGrid({
  initialServers = [],
  initialQuery = "",
  unavailable = false,
}) {
  const { lang, t } = useDriveLang();
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("");
  const [showAllCats, setShowAllCats] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(36);
  const [connectedKeys, setConnectedKeys] = useState(() => new Set());

  const loadConnected = useCallback(async () => {
    try {
      const supabase = getSupabase();
      if (!supabase) return;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setConnectedKeys(new Set());
        return;
      }
      const res = await fetch("/api/connections", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      const rows = Array.isArray(data.connections) ? data.connections : [];
      const nextSet = new Set();
      for (const row of rows) {
        const srv = row.server || {};
        const candidates = [
          row.server_name,
          srv.server_name,
          srv.name,
          srv.title,
          srv.display_name,
          srv.endpoint_url,
          srv.remote_url,
          ...(Array.isArray(srv.remotes) ? srv.remotes.map((r) => r?.url) : []),
        ];
        for (const c of candidates) {
          const norm = normalizeKey(c);
          if (norm) nextSet.add(norm);
        }
      }
      setConnectedKeys(nextSet);
    } catch {}
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => loadConnected(), 0);
    const refresh = () => loadConnected();
    window.addEventListener("drive:connections-changed", refresh);
    window.addEventListener("drive:auth-changed", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("drive:connections-changed", refresh);
      window.removeEventListener("drive:auth-changed", refresh);
    };
  }, [loadConnected]);

  const handleOptimisticConnected = useCallback((entry) => {
    const keys = getEntryKeys(entry);
    if (!keys.length) return;
    setConnectedKeys((prev) => {
      const next = new Set(prev);
      for (const k of keys) next.add(k);
      return next;
    });
  }, []);

  const filteredServers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cat = category.trim().toLowerCase();

    return initialServers.filter((entry) => {
      if (connectedKeys.size > 0) {
        const entryKeys = getEntryKeys(entry);
        if (entryKeys.some((k) => connectedKeys.has(k))) {
          return false;
        }
      }

      if (cat === "remote") {
        if (!entry.isRemote) return false;
      } else if (cat) {
        const entryCat = String(entry.category || "").toLowerCase();
        if (entryCat !== cat) return false;
      }

      if (!q) return true;
      const hay = [
        entry.name,
        entry.id,
        entry.description,
        entry.category,
        entry.transport,
        entry.authType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [initialServers, connectedKeys, category, query]);

  const visibleServers = useMemo(
    () => filteredServers.slice(0, visibleLimit),
    [filteredServers, visibleLimit]
  );

  const displayedCategories = useMemo(() => {
    if (showAllCats) return MCP_CATEGORIES;
    const base = MCP_CATEGORIES.slice(0, COLLAPSED_CAT_COUNT);
    if (category && !base.some((c) => c.id === category)) {
      const activeObj = MCP_CATEGORIES.find((c) => c.id === category);
      if (activeObj) return [...base.slice(0, COLLAPSED_CAT_COUNT - 1), activeObj];
    }
    return base;
  }, [showAllCats, category]);

  const remainingCatCount = MCP_CATEGORIES.length - COLLAPSED_CAT_COUNT;

  return (
    <section className="catalog-section" id="directory">
      <form
        className="catalog-search"
        onSubmit={(e) => {
          e.preventDefault();
          setVisibleLimit(36);
        }}
      >
        <Search size={15} />
        <input
          name="q"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisibleLimit(36);
          }}
          placeholder={t(
            "Cari 8.000+ MCP (GitHub, Supabase, Vercel, Figma...)",
            "Search 8,000+ MCPs (GitHub, Supabase, Vercel, Figma...)"
          )}
          aria-label={t("Cari server MCP", "Search MCP servers")}
        />
        {query ? (
          <button
            type="button"
            className="glass-chip-btn"
            onClick={() => {
              setQuery("");
              setVisibleLimit(36);
            }}
            style={{ minHeight: 32, padding: "0 10px" }}
          >
            {t("Hapus", "Clear")}
          </button>
        ) : (
          <button type="submit">{t("Cari", "Search")}</button>
        )}
      </form>

      <div
        className="mcp-category-filter"
        aria-label={t("Kategori MCP", "MCP categories")}
      >
        {displayedCategories.map((cat) => (
          <button
            key={cat.id || "all"}
            type="button"
            className={`category-chip ${category === cat.id ? "is-active" : ""}`}
            onClick={() => {
              setCategory(cat.id);
              setVisibleLimit(36);
            }}
          >
            {lang === "en" ? cat.enLabel : cat.idLabel}
          </button>
        ))}
        {remainingCatCount > 0 && (
          <button
            type="button"
            className="category-chip is-more-chip"
            onClick={() => setShowAllCats((prev) => !prev)}
          >
            {showAllCats ? (
              <>
                <ChevronUp size={12} /> {t("Ringkas", "Less")}
              </>
            ) : (
              <>
                <ChevronDown size={12} /> +{remainingCatCount} {t("Kategori", "More")}
              </>
            )}
          </button>
        )}
      </div>

      <div className="directory-toolbar">
        <div className="directory-stats">
          <strong>{filteredServers.length.toLocaleString()}</strong>{" "}
          {query
            ? t(`hasil untuk "${query}"`, `results for "${query}"`)
            : t("MCP tersedia", "MCPs available")}
          <span className="registry-live">
            <i /> {t("Urut Terpopuler", "Sorted by Most Used")}
          </span>
        </div>
      </div>

      {unavailable ? (
        <div className="empty-state">
          <Globe2 size={22} />
          <h3>{t("Registri sedang tidak tersedia", "Registry temporarily unavailable")}</h3>
          <p>{t("Coba muat ulang sebentar lagi.", "Try refreshing in a moment.")}</p>
        </div>
      ) : visibleServers.length ? (
        <>
          <div className="integration-grid">
            {visibleServers.map((item, index) => {
              const authBadge = AUTH_BADGE_MAP[item.authType] || AUTH_BADGE_MAP.oauth;
              const AuthIcon = authBadge.Icon;
              return (
                <article
                  key={`${item.id || item.name}-${index}`}
                  className="integration-card server-card"
                >
                  <div className="card-top">
                    <div className="integration-icon">
                      {item.verifiedPopular ? (
                        <ShieldCheck size={16} />
                      ) : (
                        <Server size={16} />
                      )}
                    </div>
                    <span
                      className={`status ${item.verifiedPopular ? "is-enabled" : ""}`}
                    >
                      {item.verifiedPopular
                        ? t("Terverifikasi", "Verified")
                        : item.isRemote
                        ? "Remote"
                        : "STDIO"}
                    </span>
                  </div>

                  <div className="server-meta">
                    {item.stars > 0 && (
                      <span className="version-pill is-star-pill">
                        <Star size={10} /> {Number(item.stars).toLocaleString()}
                      </span>
                    )}
                    <span className={`transport-pill ${authBadge.cls}`}>
                      <AuthIcon size={9} />{" "}
                      {lang === "en" ? authBadge.enLabel : authBadge.idLabel}
                    </span>
                    {item.category && (
                      <span className="version-pill">{item.category}</span>
                    )}
                  </div>

                  <h3>{item.name}</h3>
                  <p>{item.description}</p>

                  <div className="card-bottom">
                    {item.repository ? (
                      <div className="server-actions">
                        <a href={item.repository} target="_blank" rel="noreferrer">
                          {t("Sumber", "Source")} <ExternalLink size={11} />
                        </a>
                      </div>
                    ) : null}
                    <AddMcpButton
                      serverName={item.id}
                      version={item.version}
                      registryEntry={item.rawEntry}
                      remoteAvailable={item.isRemote}
                      onConnected={() => handleOptimisticConnected(item.rawEntry)}
                    />
                  </div>
                </article>
              );
            })}
          </div>

          {visibleLimit < filteredServers.length && (
            <div className="load-more-row" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="load-more-button"
                onClick={() => setVisibleLimit((prev) => prev + 48)}
              >
                {t(
                  `Muat lagi (${(filteredServers.length - visibleLimit).toLocaleString()} tersisa)`,
                  `Load more (${(filteredServers.length - visibleLimit).toLocaleString()} remaining)`
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <Search size={22} />
          <h3>{t("Tidak ada MCP yang cocok", "No matching MCPs")}</h3>
          <p>
            {t(
              "Coba kata kunci lain atau pilih kategori berbeda.",
              "Try a broader keyword or select another category."
            )}
          </p>
        </div>
      )}
    </section>
  );
}
