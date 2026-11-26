"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  BookOpen,
  Cable,
  Command,
  Compass,
  Globe,
  LockKeyhole,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Sparkles,
  User,
} from "lucide-react";
import { useDriveLang } from "./lang-context";

const HASH_TO_TAB = {
  "#mcp": "mcp",
  "#home": "mcp",
  "#my-mcps": "mcp",
  "#connections": "mcp",
  "#directory": "mcp",
  "#discover": "mcp",
  "#custom": "mcp",
  "#add": "mcp",
  "#skills": "skills",
  "#my-skills": "skills",
  "#account": "account",
  "#security": "account",
  "#settings": "account",
};

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

function AccountStatusPanel() {
  const { t } = useDriveLang();
  const [session, setSession] = useState(null);
  const [mcp, setMcp] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Account status is not configured.");
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      setSession(currentSession || null);
      if (!currentSession) {
        setMcp([]);
        setSkills([]);
        return;
      }
      const [connectionResponse, skillResponse] = await Promise.all([
        fetch("/api/connections", {
          headers: { Authorization: `Bearer ${currentSession.access_token}` },
          cache: "no-store",
        }),
        supabase
          .from("user_skills")
          .select("id,name,status")
          .eq("status", "enabled")
          .order("updated_at", { ascending: false }),
      ]);
      const connectionData = await connectionResponse.json();
      if (!connectionResponse.ok) {
        throw new Error(connectionData.error || "Could not load MCP status.");
      }
      if (skillResponse.error) throw new Error(skillResponse.error.message);
      setMcp((connectionData.connections || []).filter((item) => item.enabled));
      setSkills(skillResponse.data || []);
    } catch (e) {
      setError(e?.message || "Could not load active status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      refresh();
    }, 0);
    const onSync = () => refresh();
    window.addEventListener("drive:connections-changed", onSync);
    window.addEventListener("drive:auth-changed", onSync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("drive:connections-changed", onSync);
      window.removeEventListener("drive:auth-changed", onSync);
    };
  }, [refresh]);

  async function handleSignIn() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setAuthBusy(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`,
        },
      });
    } catch (e) {
      setError(e?.message || t("Gagal memulai login Google.", "Failed to start Google sign-in."));
      setAuthBusy(false);
    }
  }

  async function handleSignOut() {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    setAuthBusy(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setMcp([]);
      setSkills([]);
      window.dispatchEvent(new Event("drive:auth-changed"));
    } catch (e) {
      setError(e?.message || t("Gagal keluar akun.", "Failed to sign out."));
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <section className="account-status-page" id="account">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            <span className="pulse" /> {t("AKUN", "ACCOUNT")}
          </div>
          <h1>{t("Akun & Status", "Account & Status")}</h1>
        </div>
        <button type="button" className="glass-chip-btn" onClick={refresh} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} /> {t("Muat Ulang", "Refresh")}
        </button>
      </div>

      <article className="account-profile-card">
        <div className="account-profile-left">
          <span className="account-profile-avatar">
            <User size={18} />
          </span>
          <div className="account-profile-meta">
            {session?.user ? (
              <>
                <div className="account-profile-email-row">
                  <strong>{session.user.email}</strong>
                  <span className="account-sync-pill">{t("Tersinkron", "Synced")}</span>
                </div>
                <small>
                  {t(
                    "Masuk ke DRIVE · MCP & Skills otomatis tersinkron ke akun kamu",
                    "Signed in to DRIVE · MCPs & Skills synced to your account"
                  )}
                </small>
              </>
            ) : (
              <>
                <strong>{t("Belum masuk", "Not signed in")}</strong>
                <small>
                  {t(
                    "Masuk dengan Google untuk menyinkronkan koneksi MCP & Skills",
                    "Sign in to sync MCP connections & installed Skills"
                  )}
                </small>
              </>
            )}
          </div>
        </div>
        {session?.user ? (
          <button
            type="button"
            className="account-auth-btn"
            onClick={handleSignOut}
            disabled={authBusy}
          >
            <LogOut size={13} />{" "}
            {authBusy ? t("Keluar...", "Signing out...") : t("Keluar", "Sign out")}
          </button>
        ) : (
          <button
            type="button"
            className="account-auth-btn is-primary"
            onClick={handleSignIn}
            disabled={authBusy}
          >
            <LogIn size={13} />{" "}
            {authBusy
              ? t("Mengalihkan...", "Redirecting...")
              : t("Masuk dengan Google", "Sign in with Google")}
          </button>
        )}
      </article>

      {error && <p className="skill-inline-error">{error}</p>}

      <div className="account-active-grid">
        <article className="account-active-card">
          <span className="account-active-icon">
            <Cable size={18} />
          </span>
          <small>{t("MCP AKTIF", "ACTIVE MCPs")}</small>
          <strong>{loading ? "—" : mcp.length}</strong>
          <span>
            {mcp.length === 1
              ? t("server aktif", "server enabled")
              : t("server aktif", "servers enabled")}
          </span>
          <div className="account-active-list">
            {mcp.slice(0, 4).map((item) => (
              <div key={item.id}>
                <i />
                {item.server?.title ||
                  item.server?.display_name ||
                  item.server?.server_name ||
                  "MCP connection"}
              </div>
            ))}
            {!loading && !mcp.length && (
              <p>{t("Belum ada MCP aktif.", "No active MCPs yet.")}</p>
            )}
            {mcp.length > 4 && (
              <p>
                +{mcp.length - 4} {t("lainnya aktif", "more active")}
              </p>
            )}
          </div>
        </article>

        <article className="account-active-card">
          <span className="account-active-icon">
            <BookOpen size={18} />
          </span>
          <small>{t("SKILLS AKTIF", "ACTIVE SKILLS")}</small>
          <strong>{loading ? "—" : skills.length}</strong>
          <span>
            {skills.length === 1
              ? t("skill aktif", "skill enabled")
              : t("skill aktif", "skills enabled")}
          </span>
          <div className="account-active-list">
            {skills.slice(0, 4).map((item) => (
              <div key={item.id}>
                <i />
                {item.name}
              </div>
            ))}
            {!loading && !skills.length && (
              <p>{t("Belum ada Skill aktif.", "No active Skills yet.")}</p>
            )}
            {skills.length > 4 && (
              <p>
                +{skills.length - 4} {t("lainnya aktif", "more active")}
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function resolveInitialTab(initialTab, query) {
  if (query) return "mcp";
  if (initialTab === "skills" || initialTab === "account" || initialTab === "mcp") {
    return initialTab;
  }
  return "mcp";
}

export default function WorkspaceTabs({
  connections,
  discover,
  add,
  skills,
  initialTab = "mcp",
  serverCount = 0,
  query = "",
}) {
  const { lang, setLang, t } = useDriveLang();
  const [active, setActive] = useState(() => resolveInitialTab(initialTab, query));
  const [mcpView, setMcpView] = useState("discover");
  const [dragIndex, setDragIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingLens, setIsAnimatingLens] = useState(false);

  const dockRef = useRef(null);
  const glideTimerRef = useRef(null);

  const navItems = [
    { id: "mcp", label: "MCP Hub", short: "MCP", icon: Cable },
    { id: "skills", label: t("Pustaka Skills", "Skills Library"), short: "Skills", icon: BookOpen },
    { id: "account", label: t("Status Akun", "Account Status"), short: t("Akun", "Account"), icon: LockKeyhole },
  ];

  const mcpSubtabs = [
    { id: "discover", label: t("Direktori", "Directory") },
    { id: "my", label: t("MCP Saya", "My MCPs") },
    { id: "custom", label: t("+ Kustom", "+ Custom") },
  ];

  const activeIndex = Math.max(
    0,
    navItems.findIndex((item) => item.id === active)
  );
  const subIndex = Math.max(
    0,
    mcpSubtabs.findIndex((item) => item.id === mcpView)
  );

  const selectTab = useCallback((nextTab) => {
    setActive((prev) => {
      if (prev !== nextTab) {
        setIsAnimatingLens(true);
        if (glideTimerRef.current) window.clearTimeout(glideTimerRef.current);
        glideTimerRef.current = window.setTimeout(() => setIsAnimatingLens(false), 260);
      }
      return nextTab;
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mcp_auth")) {
        setActive("mcp");
        setMcpView("my");
      }
      const hash = window.location.hash.toLowerCase();
      if (!hash) return;
      const mapped = HASH_TO_TAB[hash];
      if (mapped) setActive(mapped);
      if (hash === "#my-mcps" || hash === "#connections") setMcpView("my");
      else if (hash === "#custom" || hash === "#add") setMcpView("custom");
      else if (hash === "#directory" || hash === "#discover") setMcpView("discover");
      const cleanUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", cleanUrl);
    }, 0);

    const onOpenAuth = () => {
      setActive("mcp");
      setMcpView("my");
    };
    window.addEventListener("drive:open-mcp-auth", onOpenAuth);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("drive:open-mcp-auth", onOpenAuth);
      if (glideTimerRef.current) window.clearTimeout(glideTimerRef.current);
    };
  }, []);

  function getPointerTabIndex(clientX) {
    const dock = dockRef.current;
    if (!dock) return activeIndex;
    const rect = dock.getBoundingClientRect();
    const innerWidth = Math.max(1, rect.width - 12);
    const ratio = Math.min(0.999, Math.max(0, (clientX - rect.left - 6) / innerWidth));
    return Math.min(navItems.length - 1, Math.max(0, Math.floor(ratio * navItems.length)));
  }

  function handlePointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    setIsDragging(true);
    const idx = getPointerTabIndex(event.clientX);
    setDragIndex(idx);
    const target = navItems[idx];
    if (target && target.id !== active) {
      setActive(target.id);
    }
  }

  function handlePointerMove(event) {
    if (!isDragging) return;
    const idx = getPointerTabIndex(event.clientX);
    setDragIndex(idx);
    const target = navItems[idx];
    if (target && target.id !== active) {
      setActive(target.id);
    }
  }

  function finishPointerDrag(event) {
    if (!isDragging) return;
    const finalIdx =
      typeof event?.clientX === "number"
        ? getPointerTabIndex(event.clientX)
        : dragIndex ?? activeIndex;
    setIsDragging(false);
    setDragIndex(null);
    const target = navItems[Math.min(navItems.length - 1, Math.max(0, finalIdx))];
    if (target) selectTab(target.id);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(navItems[(activeIndex + 1) % navItems.length].id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(navItems[(activeIndex - 1 + navItems.length) % navItems.length].id);
    }
  }

  const currentLensIndex = isDragging && dragIndex !== null ? dragIndex : activeIndex;

  return (
    <main className="drive-app">
      <header className="app-topbar">
        <button
          type="button"
          className="app-brand"
          aria-label="DRIVE home"
          onClick={() => {
            selectTab("mcp");
            setMcpView("discover");
          }}
        >
          <span className="brand-mark">
            <Command size={17} />
          </span>
          <span>DRIVE</span>
        </button>

        <div className="app-top-actions">
          <div className="lang-toggle-group" role="group" aria-label={t("Pilih bahasa", "Language")}>
            <button
              type="button"
              className={lang === "id" ? "is-active" : ""}
              onClick={() => setLang("id")}
              aria-pressed={lang === "id"}
            >
              <Globe size={11} /> ID
            </button>
            <button
              type="button"
              className={lang === "en" ? "is-active" : ""}
              onClick={() => setLang("en")}
              aria-pressed={lang === "en"}
            >
              EN
            </button>
          </div>

          <button
            type="button"
            className="top-pill-btn"
            onClick={() => {
              if (active === "mcp") {
                setMcpView(mcpView === "discover" ? "my" : "discover");
              } else {
                selectTab("mcp");
                setMcpView("discover");
              }
            }}
            title={t("Buka Direktori MCP", "Browse MCP Directory")}
          >
            <Compass size={13} />
            <span>
              {active === "mcp" && mcpView === "discover"
                ? serverCount
                  ? `${serverCount.toLocaleString()} MCP`
                  : t("Direktori", "Directory")
                : active === "skills"
                ? "MCP"
                : t("Direktori", "Directory")}
            </span>
          </button>

          <button
            type="button"
            className="top-pill-btn is-accent"
            onClick={() => {
              if (active === "account") {
                selectTab("mcp");
                setMcpView("discover");
              } else {
                selectTab("mcp");
                setMcpView("custom");
              }
            }}
            title={t("Tambah MCP Kustom", "Add Custom MCP")}
          >
            {active === "account" ? <Sparkles size={12} /> : <Plus size={13} />}
            <span>{active === "account" ? "MCP" : t("Sambung", "Connect")}</span>
          </button>
        </div>
      </header>

      {/* Persistent mounted panels for 0ms instant switching (no unmount/re-fetch spinners) */}
      <section className="app-content" aria-live="polite">
        <div className="app-panel" hidden={active !== "mcp"}>
          <div className="drive-mcp-workspace">
            <div className="drive-subtabs-wrap">
              <div
                className="drive-subtabs"
                role="tablist"
                aria-label={t("Bagian MCP", "MCP sections")}
                style={{ "--sub-index": subIndex }}
              >
                <span className="drive-subtabs-pill" aria-hidden="true" />
                {mcpSubtabs.map((tab) => {
                  const isActive = mcpView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={`drive-subtab-btn ${isActive ? "is-active" : ""}`}
                      onClick={() => setMcpView(tab.id)}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="drive-subpanel" hidden={mcpView !== "discover"}>
              {discover}
            </div>
            <div className="drive-subpanel" hidden={mcpView !== "my"}>
              {connections}
            </div>
            <div className="drive-subpanel" hidden={mcpView !== "custom"}>
              {add}
            </div>
          </div>
        </div>

        <div className="app-panel" hidden={active !== "skills"}>
          {skills}
        </div>

        <div className="app-panel" hidden={active !== "account"}>
          <AccountStatusPanel />
        </div>
      </section>

      <div className="bottom-dock-stage">
        <nav
          ref={dockRef}
          className={`liquid-navbar-3 ${isDragging ? "is-dragging" : ""} ${
            isAnimatingLens ? "is-gliding" : ""
          }`}
          aria-label={t("Navigasi utama", "Primary navigation")}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={finishPointerDrag}
          onPointerCancel={finishPointerDrag}
          onKeyDown={handleKeyDown}
          style={{
            "--lens-index": currentLensIndex,
          }}
        >
          <span className="liquid-lens-pill" aria-hidden="true" />
          {navItems.map(({ id, label, short, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                className={`dock-item ${isActive ? "active is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
                onClick={() => selectTab(id)}
              >
                <span className="dock-icon">
                  <Icon size={17} />
                </span>
                <span className="dock-label">{short}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </main>
  );
}
