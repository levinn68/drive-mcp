"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  ExternalLink,
  Globe2,
  Search,
  Server,
  ShieldCheck,
} from "lucide-react";
import { AddMcpButton } from "./my-mcps";

export const MCP_CATEGORIES = [
  { id: "", label: "All" },
  { id: "remote", label: "Remote Ready" },
  { id: "ai", label: "AI & Agents" },
  { id: "coding", label: "Coding & Dev" },
  { id: "github", label: "GitHub & Git" },
  { id: "database", label: "Database" },
  { id: "cloud", label: "Cloud & DevOps" },
  { id: "search", label: "Search & Docs" },
  { id: "browser", label: "Browser & Scraping" },
  { id: "design", label: "Design & UI" },
  { id: "productivity", label: "Productivity" },
  { id: "messaging", label: "Messaging & Social" },
  { id: "finance", label: "Finance & Payments" },
  { id: "security", label: "Security & Auth" },
  { id: "data", label: "Data & Analytics" },
];

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
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("");
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
      // 1. Hide MCPs already connected in My MCPs
      if (connectedKeys.size > 0) {
        const entryKeys = getEntryKeys(entry);
        if (entryKeys.some((k) => connectedKeys.has(k))) {
          return false;
        }
      }

      // 2. Category filter
      if (cat === "remote") {
        if (!entry.isRemote) return false;
      } else if (cat) {
        const entryCat = String(entry.category || "").toLowerCase();
        if (entryCat !== cat) return false;
      }

      // 3. Live search filter
      if (!q) return true;
      const hay = [
        entry.name,
        entry.id,
        entry.description,
        entry.category,
        entry.transport,
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
          placeholder="Search 3,000+ MCPs (GitHub, Supabase, Vercel, Figma...)"
          aria-label="Search MCP servers"
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
            Clear
          </button>
        ) : (
          <button type="submit">Search</button>
        )}
      </form>

      <div className="mcp-category-filter" aria-label="MCP categories">
        {MCP_CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            type="button"
            className={`category-chip ${category === cat.id ? "is-active" : ""}`}
            onClick={() => {
              setCategory(cat.id);
              setVisibleLimit(36);
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <div className="directory-toolbar">
        <div className="directory-stats">
          <strong>{filteredServers.length.toLocaleString()}</strong>{" "}
          {query ? `results for "${query}"` : "MCPs available"}
          <span className="registry-live">
            <i /> Verified Remote First
          </span>
        </div>
      </div>

      {unavailable ? (
        <div className="empty-state">
          <Globe2 size={22} />
          <h3>Registry temporarily unavailable</h3>
          <p>Try refreshing in a moment.</p>
        </div>
      ) : visibleServers.length ? (
        <>
          <div className="integration-grid">
            {visibleServers.map((item, index) => (
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
                      ? "Verified"
                      : item.isRemote
                      ? "Remote"
                      : "STDIO"}
                  </span>
                </div>

                <div className="server-meta">
                  <span className="transport-pill">{item.transport}</span>
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
                        Source <ExternalLink size={11} />
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
            ))}
          </div>

          {visibleLimit < filteredServers.length && (
            <div className="load-more-row" style={{ marginTop: 14 }}>
              <button
                type="button"
                className="load-more-button"
                onClick={() => setVisibleLimit((prev) => prev + 48)}
              >
                Load more ({(filteredServers.length - visibleLimit).toLocaleString()} remaining)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <Search size={22} />
          <h3>No matching MCPs</h3>
          <p>Try a broader keyword or select another category.</p>
        </div>
      )}
    </section>
  );
}
