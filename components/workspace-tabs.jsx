"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  BookOpen,
  Cable,
  Check,
  Command,
  Compass,
  Copy,
  Globe,
  Layers,
  Link2,
  LockKeyhole,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import { useDriveLang } from "./lang-context";

const NAV_ITEMS = [
  { id: "mcp", label: "MCP Hub", short: "MCP", path: "/mcp", icon: Cable },
  { id: "skills", label: "Skills Library", short: "Skills", path: "/skills", icon: BookOpen },
  { id: "account", label: "Account", short: "Account", path: "/acc", icon: LockKeyhole },
];

const TAB_TO_PATH = {
  mcp: "/mcp",
  skills: "/skills",
  account: "/acc",
};

const MCP_SUBTABS = [
  { id: "discover", label: "Directory" },
  { id: "my", label: "My MCPs" },
  { id: "custom", label: "+ Custom" },
];

function pathToTab(pathname) {
  const clean = String(pathname || "").toLowerCase().replace(/\/+$/, "");
  if (clean === "/skills") return "skills";
  if (clean === "/acc" || clean === "/account") return "account";
  if (clean === "/mcp" || clean === "" || clean === "/") return "mcp";
  return null;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

function AccountStatusPanel({ onNavigate, serverCount = 0 }) {
  const { lang, setLang } = useDriveLang();
  const [session, setSession] = useState(null);
  const [mcp, setMcp] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [copiedGateway, setCopiedGateway] = useState(false);
  const [gatewayUrl, setGatewayUrl] = useState("https://drive-mcp-five.vercel.app/api/mcp");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setGatewayUrl(`${window.location.origin}/api/mcp`);
    }
  }, []);

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
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/mcp")}`,
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
      window.dispatchEvent(new Event("drive:auth-changed"));
    } catch (e) {
      setError(e?.message || "Failed to sign out.");
    } finally {
      setAuthBusy(false);
    }
  }

  function copyGateway() {
    navigator.clipboard?.writeText(gatewayUrl).catch(() => {});
    setCopiedGateway(true);
    window.setTimeout(() => setCopiedGateway(false), 1500);
  }

  return (
    <section className="account-status-page" id="account">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            <span className="pulse" /> ACCOUNT
          </div>
          <h1>Account &amp; Workspace</h1>
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
                <small>Signed in to DRIVE · MCPs &amp; Skills synced across sessions</small>
              </>
            ) : (
              <>
                <strong>Not signed in</strong>
                <small>Sign in with Google to sync MCP connections &amp; installed Skills</small>
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
        <article
          className="account-active-card is-interactive"
          onClick={() => onNavigate("mcp", "my")}
        >
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

        <article
          className="account-active-card is-interactive"
          onClick={() => onNavigate("skills", "discover")}
        >
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

      <article className="account-glass-panel">
        <div className="account-panel-head">
          <div className="account-panel-title">
            <span className="account-mini-icon">
              <Link2 size={15} />
            </span>
            <div>
              <h3>DRIVE Universal MCP Gateway</h3>
              <small>Use one endpoint to connect all your active MCPs &amp; Skills to any AI client</small>
            </div>
          </div>
          <button type="button" className="glass-chip-btn" onClick={copyGateway}>
            {copiedGateway ? <Check size={12} /> : <Copy size={12} />}
            {copiedGateway ? "Copied" : "Copy URL"}
          </button>
        </div>
        <div className="account-gateway-box">
          <code>{gatewayUrl}</code>
        </div>
        <div className="custom-policy-pills" style={{ marginTop: 10 }}>
          <span>Claude</span>
          <span>ChatGPT</span>
          <span>Cursor</span>
          <span>Windsurf</span>
          <span>Gemini CLI</span>
        </div>
      </article>

      <article className="account-glass-panel">
        <div className="account-panel-head" style={{ marginBottom: 10 }}>
          <div className="account-panel-title">
            <span className="account-mini-icon">
              <ShieldCheck size={15} />
            </span>
            <div>
              <h3>Preferences &amp; Security</h3>
              <small>Language applies to MCP &amp; Skill explanations only</small>
            </div>
          </div>
        </div>

        <div className="ios-settings-list">
          <div className="ios-settings-row">
            <div>
              <strong>Explanation Language</strong>
              <small>Translate MCP &amp; Skill descriptions (ID / EN)</small>
            </div>
            <div className="lang-toggle-group" role="group" aria-label="Explanation language">
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
          </div>

          <div className="ios-settings-row">
            <div>
              <strong>OAuth 2.1 &amp; Token Vault</strong>
              <small>PKCE S256, CIMD &amp; DCR with HttpOnly cookies</small>
            </div>
            <span className="status is-enabled">Protected</span>
          </div>

          <div className="ios-settings-row">
            <div>
              <strong>Multi-Registry Index</strong>
              <small>Official Registry, Glama, npm, PulseMCP &amp; skills.sh</small>
            </div>
            <span className="version-pill">
              <Layers size={10} /> {serverCount ? `${serverCount.toLocaleString()} MCPs` : "13,000+"}
            </span>
          </div>
        </div>
      </article>

      <div className="account-quick-grid">
        <button
          type="button"
          className="account-quick-tile"
          onClick={() => onNavigate("mcp", "discover")}
        >
          <Compass size={16} />
          <span>MCP Directory</span>
        </button>
        <button
          type="button"
          className="account-quick-tile"
          onClick={() => onNavigate("mcp", "my")}
        >
          <Cable size={16} />
          <span>My MCPs</span>
        </button>
        <button
          type="button"
          className="account-quick-tile"
          onClick={() => onNavigate("skills", "discover")}
        >
          <BookOpen size={16} />
          <span>Skills Library</span>
        </button>
        <button
          type="button"
          className="account-quick-tile"
          onClick={() => onNavigate("mcp", "custom")}
        >
          <Plus size={16} />
          <span>Add Custom MCP</span>
        </button>
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

  // Instant 0ms SPA tab switch + clean URL sync (/mcp, /skills, /acc)
  const selectTab = useCallback((nextTab, pushUrl = true) => {
    setActive((prev) => {
      if (prev !== nextTab) {
        setIsAnimatingLens(true);
        if (glideTimerRef.current) window.clearTimeout(glideTimerRef.current);
        glideTimerRef.current = window.setTimeout(() => setIsAnimatingLens(false), 260);
      }
      return nextTab;
    });
    if (pushUrl && typeof window !== "undefined") {
      const targetPath = TAB_TO_PATH[nextTab] || "/mcp";
      const search = nextTab === "mcp" ? window.location.search : "";
      const nextUrl = `${targetPath}${search}`;
      if (window.location.pathname !== targetPath) {
        try {
          window.history.pushState({ tab: nextTab }, "", nextUrl);
        } catch {}
      }
    }
  }, []);

  const handleAccountNavigate = useCallback(
    (tab, sub) => {
      selectTab(tab, true);
      if (tab === "mcp" && sub) setMcpView(sub);
    },
    [selectTab]
  );

  useEffect(() => {
    const syncFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mcp_auth")) {
        setActive("mcp");
        setMcpView("my");
        return;
      }
      const mapped = pathToTab(window.location.pathname);
      if (mapped) {
        setActive(mapped);
      }
      if (window.location.pathname === "/" && !window.location.search) {
        try {
          window.history.replaceState({ tab: "mcp" }, "", "/mcp");
        } catch {}
      }
    };

    const timer = window.setTimeout(syncFromLocation, 0);
    window.addEventListener("popstate", syncFromLocation);

    const onOpenAuth = () => {
      selectTab("mcp", true);
      setMcpView("my");
    };
    window.addEventListener("drive:open-mcp-auth", onOpenAuth);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("popstate", syncFromLocation);
      window.removeEventListener("drive:open-mcp-auth", onOpenAuth);
      if (glideTimerRef.current) window.clearTimeout(glideTimerRef.current);
    };
  }, [selectTab]);

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
    const idx = getPointerTabIndex(event.clientX);
    setDragIndex(idx);
    const target = NAV_ITEMS[idx];
    if (target && target.id !== active) {
      setActive(target.id);
    }
  }

  function handlePointerMove(event) {
    if (!isDragging) return;
    const idx = getPointerTabIndex(event.clientX);
    setDragIndex(idx);
    const target = NAV_ITEMS[idx];
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
    const target = NAV_ITEMS[Math.min(NAV_ITEMS.length - 1, Math.max(0, finalIdx))];
    if (target) selectTab(target.id, true);
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectTab(NAV_ITEMS[(activeIndex + 1) % NAV_ITEMS.length].id, true);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectTab(NAV_ITEMS[(activeIndex - 1 + NAV_ITEMS.length) % NAV_ITEMS.length].id, true);
    }
  }

  const currentLensIndex = isDragging && dragIndex !== null ? dragIndex : activeIndex;

  return (
    <main className="drive-app">
      {/* Neutral Silver-Pearl Studio Ambient Orbs for True Optical Glassmorphism */}
      <div className="ios-ambient-orbs" aria-hidden="true">
        <span className="ios-orb orb-1" />
        <span className="ios-orb orb-2" />
        <span className="ios-orb orb-3" />
      </div>

      {/* Clean Apple Liquid Glass Topbar */}
      <header className="app-topbar">
        <button
          type="button"
          className="app-brand"
          aria-label="DRIVE home"
          onClick={() => {
            selectTab("mcp", true);
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
                selectTab("mcp", true);
                setMcpView("discover");
              }
            }}
            title="Browse MCP Directory"
          >
            <Compass size={13} />
            <span>
              {active === "mcp" && mcpView === "discover"
                ? serverCount
                  ? `${serverCount.toLocaleString()} MCPs`
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
                selectTab("mcp", true);
                setMcpView("discover");
              } else {
                selectTab("mcp", true);
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

      {/* Persistent SPA Panels (/mcp, /skills, /acc) */}
      <section className="app-content" aria-live="polite">
        <div className="app-panel" hidden={active !== "mcp"}>
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
          <AccountStatusPanel
            onNavigate={handleAccountNavigate}
            serverCount={serverCount}
          />
        </div>
      </section>

      {/* Floating Pure Liquid Glass 3-Tab Dock */}
      <div className="bottom-dock-stage">
        <nav
          ref={dockRef}
          className={`liquid-navbar-3 ${isDragging ? "is-dragging" : ""} ${
            isAnimatingLens ? "is-gliding" : ""
          }`}
          aria-label="Primary navigation"
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
                onClick={() => selectTab(id, true)}
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
