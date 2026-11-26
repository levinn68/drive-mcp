"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  BookOpen,
  Cable,
  Command,
  Compass,
  LockKeyhole,
  Plus,
  RefreshCw,
  Sparkles,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "mcp", label: "MCP Hub", short: "MCP", hash: "#mcp", icon: Cable },
  { id: "skills", label: "Skills Library", short: "Skills", hash: "#skills", icon: BookOpen },
  { id: "account", label: "Account Status", short: "Account", hash: "#account", icon: LockKeyhole },
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

function AccountStatusPanel() {
  const [mcp, setMcp] = useState([]);
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error("Account status is not configured.");
      const supabase = createBrowserClient(url, key);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setMcp([]);
        setSkills([]);
        return;
      }
      const [connectionResponse, skillResponse] = await Promise.all([
        fetch("/api/connections", {
          headers: { Authorization: `Bearer ${session.access_token}` },
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

  return (
    <section className="account-status-page" id="account">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            <span className="pulse" /> ACCOUNT OVERVIEW
          </div>
          <h1>Workspace status.</h1>
          <p>Ringkasan MCP dan Skills yang sedang aktif di akun ini.</p>
        </div>
        <button type="button" className="glass-chip-btn" onClick={refresh} disabled={loading}>
          <RefreshCw size={14} className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>
      {error && <p className="skill-inline-error">{error}</p>}
      <div className="account-active-grid">
        <article className="account-active-card">
          <span className="account-active-icon">
            <Cable size={20} />
          </span>
          <small>ACTIVE MCPs</small>
          <strong>{loading ? "—" : mcp.length}</strong>
          <span>{mcp.length === 1 ? "server enabled" : "servers enabled"}</span>
          <div className="account-active-list">
            {mcp.slice(0, 5).map((item) => (
              <div key={item.id}>
                <i />
                {item.server?.title ||
                  item.server?.display_name ||
                  item.server?.server_name ||
                  "MCP connection"}
              </div>
            ))}
            {!loading && !mcp.length && <p>No active MCP connections yet.</p>}
            {mcp.length > 5 && <p>+{mcp.length - 5} more active</p>}
          </div>
        </article>
        <article className="account-active-card">
          <span className="account-active-icon">
            <BookOpen size={20} />
          </span>
          <small>ACTIVE SKILLS</small>
          <strong>{loading ? "—" : skills.length}</strong>
          <span>{skills.length === 1 ? "skill enabled" : "skills enabled"}</span>
          <div className="account-active-list">
            {skills.slice(0, 5).map((item) => (
              <div key={item.id}>
                <i />
                {item.name}
              </div>
            ))}
            {!loading && !skills.length && <p>No active Skills yet.</p>}
            {skills.length > 5 && <p>+{skills.length - 5} more active</p>}
          </div>
        </article>
      </div>
      <p className="account-status-footnote">
        Status diambil langsung dari koneksi dan Skill yang aktif. Item yang belum diaktifkan tidak dihitung.
      </p>
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

  const selectTab = useCallback((nextTab, updateHash = true) => {
    setActive((prev) => {
      if (prev !== nextTab) {
        setIsAnimatingLens(true);
        if (glideTimerRef.current) window.clearTimeout(glideTimerRef.current);
        glideTimerRef.current = window.setTimeout(() => setIsAnimatingLens(false), 340);
      }
      return nextTab;
    });
    if (updateHash && typeof window !== "undefined") {
      const target = NAV_ITEMS.find((item) => item.id === nextTab);
      if (target) {
        window.history.replaceState(null, "", target.hash);
      }
    }
  }, []);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.toLowerCase();
      if (!hash) return;
      const mapped = HASH_TO_TAB[hash];
      if (mapped) setActive(mapped);
      if (hash === "#my-mcps" || hash === "#connections") setMcpView("my");
      else if (hash === "#custom" || hash === "#add") setMcpView("custom");
      else if (hash === "#directory" || hash === "#discover") setMcpView("discover");
    };
    const timer = window.setTimeout(syncFromHash, 0);
    window.addEventListener("hashchange", syncFromHash);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", syncFromHash);
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
                  ? `${serverCount} MCPs`
                  : "Directory"
                : active === "skills"
                ? "Skills"
                : "Directory"}
            </span>
          </button>

          <button
            type="button"
            className="top-pill-btn is-accent"
            onClick={() => {
              if (active === "skills") {
                document
                  .getElementById("my-skills")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              } else if (active === "account") {
                selectTab("mcp", true);
                setMcpView("discover");
              } else {
                setMcpView("custom");
              }
            }}
            title={
              active === "skills"
                ? "Jump to My Skills"
                : active === "account"
                ? "Open MCP Directory"
                : "Add Custom MCP"
            }
          >
            {active === "mcp" ? <Plus size={13} /> : <Sparkles size={12} />}
            <span>
              {active === "skills" ? "My Skills" : active === "account" ? "MCPs" : "Connect"}
            </span>
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
