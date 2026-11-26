"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  BookOpen,
  Cable,
  Command,
  Compass,
  LockKeyhole,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Sparkles,
  User,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "mcp", label: "MCP Hub", short: "MCP", icon: Cable },
  { id: "skills", label: "Skills Library", short: "Skills", icon: BookOpen },
  { id: "account", label: "Account Status", short: "Account", icon: LockKeyhole },
];

const MCP_SUBTABS = [
  { id: "discover", label: "Directory" },
  { id: "my", label: "My MCPs" },
  { id: "custom", label: "+ Custom" },
];

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
    return () => window.clearTimeout(timer);
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
      setError(e?.message || "Failed to start Google sign-in.");
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
    } catch (e) {
      setError(e?.message || "Failed to sign out.");
    } finally {
      setAuthBusy(false);
    }
  }

  return (
    <section className="account-status-page" id="account">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            <span className="pulse" /> ACCOUNT
          </div>
          <h1>Account &amp; Status</h1>
        </div>
        <button type="button" className="glass-chip-btn" onClick={refresh} disabled={loading}>
          <RefreshCw size={13} className={loading ? "spin" : ""} /> Refresh
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
                  <span className="account-sync-pill">Synced</span>
                </div>
                <small>Signed in to DRIVE · MCPs &amp; Skills synced to your account</small>
              </>
            ) : (
              <>
                <strong>Not signed in</strong>
                <small>Sign in to sync MCP connections &amp; installed Skills</small>
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
            <LogOut size={13} /> {authBusy ? "Signing out..." : "Sign out"}
          </button>
        ) : (
          <button
            type="button"
            className="account-auth-btn is-primary"
            onClick={handleSignIn}
            disabled={authBusy}
          >
            <LogIn size={13} /> {authBusy ? "Redirecting..." : "Sign in with Google"}
          </button>
        )}
      </article>

      {error && <p className="skill-inline-error">{error}</p>}

      <div className="account-active-grid">
        <article className="account-active-card">
          <span className="account-active-icon">
            <Cable size={18} />
          </span>
          <small>ACTIVE MCPs</small>
          <strong>{loading ? "—" : mcp.length}</strong>
          <span>{mcp.length === 1 ? "server enabled" : "servers enabled"}</span>
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
            {!loading && !mcp.length && <p>No active MCPs yet.</p>}
            {mcp.length > 4 && <p>+{mcp.length - 4} more active</p>}
          </div>
        </article>

        <article className="account-active-card">
          <span className="account-active-icon">
            <BookOpen size={18} />
          </span>
          <small>ACTIVE SKILLS</small>
          <strong>{loading ? "—" : skills.length}</strong>
          <span>{skills.length === 1 ? "skill enabled" : "skills enabled"}</span>
          <div className="account-active-list">
            {skills.slice(0, 4).map((item) => (
              <div key={item.id}>
                <i />
                {item.name}
              </div>
            ))}
            {!loading && !skills.length && <p>No active Skills yet.</p>}
            {skills.length > 4 && <p>+{skills.length - 4} more active</p>}
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
  const [active, setActive] = useState(() => resolveInitialTab(initialTab, query));
  const [mcpView, setMcpView] = useState("discover");
  const [dragIndex, setDragIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingLens, setIsAnimatingLens] = useState(false);

  const dockRef = useRef(null);
  const glideTimerRef = useRef(null);

  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.id === active)
  );
  const subIndex = Math.max(
    0,
    MCP_SUBTABS.findIndex((item) => item.id === mcpView)
  );

  const selectTab = useCallback((nextTab) => {
    setActive((prev) => {
      if (prev !== nextTab) {
        setIsAnimatingLens(true);
        if (glideTimerRef.current) window.clearTimeout(glideTimerRef.current);
        glideTimerRef.current = window.setTimeout(() => setIsAnimatingLens(false), 340);
      }
      return nextTab;
    });
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const hash = window.location.hash.toLowerCase();
      if (!hash) return;
      const mapped = HASH_TO_TAB[hash];
      if (mapped) setActive(mapped);
      if (hash === "#my-mcps" || hash === "#connections") setMcpView("my");
      else if (hash === "#custom" || hash === "#add") setMcpView("custom");
      else if (hash === "#directory" || hash === "#discover") setMcpView("discover");
      // Keep the browser address bar clean without #mcp / #skills / #account
      const cleanUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState(null, "", cleanUrl);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      if (glideTimerRef.current) window.clearTimeout(glideTimerRef.current);
    };
  }, []);

  function getPointerTabIndex(clientX) {
    const dock = dockRef.current;
    if (!dock) return activeIndex;
    const rect = dock.getBoundingClientRect();
    const innerWidth = Math.max(1, rect.width - 12);
    const ratio = Math.min(0.999, Math.max(0, (clientX - rect.left - 6) / innerWidth));
    return Math.min(NAV_ITEMS.length - 1, Math.max(0, Math.floor(ratio * NAV_ITEMS.length)));
  }

  function handlePointerDown(event) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    setIsDragging(true);
    setDragIndex(getPointerTabIndex(event.clientX));
  }

  function handlePointerMove(event) {
    if (!isDragging) return;
    setDragIndex(getPointerTabIndex(event.clientX));
  }

  function finishPointerDrag(event) {
    if (!isDragging) return;
    const finalIdx =
      typeof event?.clientX === "number"
        ? getPointerTabIndex(event.clientX)
        : dragIndex ?? activeIndex;
    setIsDragging(false);
    setDragIndex(null);
    const target = NAV_ITEMS[Math.min(NAV_ITEMS.length - 1, Math.max(0, finalIdx))];
    if (target) selectTab(target.id);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(NAV_ITEMS[(activeIndex + 1) % NAV_ITEMS.length].id);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(NAV_ITEMS[(activeIndex - 1 + NAV_ITEMS.length) % NAV_ITEMS.length].id);
    }
  }

  const currentLensIndex = isDragging && dragIndex !== null ? dragIndex : activeIndex;

  const mcpPanel = (
    <div className="drive-mcp-workspace">
      <div className="drive-subtabs-wrap">
        <div
          className="drive-subtabs"
          role="tablist"
          aria-label="MCP sections"
          style={{ "--sub-index": subIndex }}
        >
          <span className="drive-subtabs-pill" aria-hidden="true" />
          {MCP_SUBTABS.map((tab) => {
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

      <div key={mcpView} className="drive-subpanel">
        {mcpView === "discover" ? discover : mcpView === "my" ? connections : add}
      </div>
    </div>
  );

  const panels = {
    mcp: mcpPanel,
    skills,
    account: <AccountStatusPanel />,
  };

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
            title="Browse MCP Directory"
          >
            <Compass size={13} />
            <span>
              {active === "mcp" && mcpView === "discover"
                ? serverCount
                  ? `${serverCount} MCPs`
                  : "Directory"
                : active === "skills"
                ? "MCPs"
                : "Directory"}
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
            title="Add Custom MCP"
          >
            {active === "account" ? <Sparkles size={12} /> : <Plus size={13} />}
            <span>{active === "account" ? "MCPs" : "Connect"}</span>
          </button>
        </div>
      </header>

      <section className="app-content" aria-live="polite">
        <div key={active} className="app-panel">
          {panels[active]}
        </div>
      </section>

      <div className="bottom-dock-stage">
        <nav
          ref={dockRef}
          className={`liquid-navbar-3 ${isDragging ? "is-dragging" : ""} ${
            isAnimatingLens ? "is-gliding" : ""
          }`}
          aria-label="Main navigation"
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
          {NAV_ITEMS.map(({ id, label, short, icon: Icon }) => {
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
