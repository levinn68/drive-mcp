"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  Cable,
  CheckCircle2,
  Command,
  Compass,
  Cpu,
  Eye,
  Gauge,
  Layers,
  LockKeyhole,
  Plus,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";

const NAV_ITEMS = [
  {
    id: "connections",
    label: "Workspace",
    short: "Home",
    hash: "#home",
    icon: Cable,
  },
  {
    id: "discover",
    label: "Directory",
    short: "Discover",
    hash: "#directory",
    icon: Compass,
  },
  {
    id: "add",
    label: "Add MCP",
    short: "Add MCP",
    hash: "#custom",
    icon: Plus,
    isCenterAction: true,
  },
  {
    id: "security",
    label: "Security",
    short: "Security",
    hash: "#security",
    icon: ShieldCheck,
  },
  {
    id: "settings",
    label: "Settings",
    short: "Control",
    hash: "#settings",
    icon: SlidersHorizontal,
  },
];

const HASH_TO_TAB = {
  "#home": "connections",
  "#my-mcps": "connections",
  "#connections": "connections",
  "#directory": "discover",
  "#discover": "discover",
  "#custom": "add",
  "#add": "add",
  "#security": "security",
  "#settings": "settings",
  "#control": "settings",
};

export default function WorkspaceTabs({
  connections,
  discover,
  add,
  security,
  initialTab = "connections",
  serverCount = 0,
  query = "",
}) {
  const [active, setActive] = useState(query ? "discover" : initialTab);
  const [dragIndex, setDragIndex] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnimatingLens, setIsAnimatingLens] = useState(false);
  const [lensGlareX, setLensGlareX] = useState(50);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [glassIntensity, setGlassIntensity] = useState("ultra");
  const [specularHighlights, setSpecularHighlights] = useState(true);
  const dockRef = useRef(null);
  const lensTimeoutRef = useRef(null);

  const activeIndex = Math.max(
    0,
    NAV_ITEMS.findIndex((item) => item.id === active)
  );

  // Load saved UI preferences safely
  useEffect(() => {
    const restorePreferences = window.setTimeout(() => {
      try {
        const savedMotion = window.localStorage.getItem("drive:motion-enabled");
        const savedGlass = window.localStorage.getItem("drive:glass-intensity");
        const savedSpecular = window.localStorage.getItem("drive:specular");
        if (savedMotion !== null) setMotionEnabled(savedMotion === "true");
        if (savedGlass) setGlassIntensity(savedGlass);
        if (savedSpecular !== null) setSpecularHighlights(savedSpecular === "true");
      } catch {}
    }, 0);
    return () => window.clearTimeout(restorePreferences);
  }, []);

  // Sync with URL query/hash or custom navigation events
  const triggerLensPulse = useCallback(() => {
    if (!motionEnabled) return;
    setIsAnimatingLens(true);
    if (lensTimeoutRef.current) window.clearTimeout(lensTimeoutRef.current);
    lensTimeoutRef.current = window.setTimeout(() => {
      setIsAnimatingLens(false);
    }, 440);
  }, [motionEnabled]);

  const selectTab = useCallback(
    (tabId, updateHash = true) => {
      const target = NAV_ITEMS.find((item) => item.id === tabId);
      if (!target) return;
      setActive((prev) => {
        if (prev !== tabId) triggerLensPulse();
        return tabId;
      });
      if (updateHash && typeof window !== "undefined") {
        try {
          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${target.hash}`);
        } catch {}
      }
    },
    [triggerLensPulse]
  );

  useEffect(() => {
    function syncFromHash() {
      const hash = window.location.hash.toLowerCase();
      if (hash && HASH_TO_TAB[hash]) {
        selectTab(HASH_TO_TAB[hash], false);
      }
    }
    function handleNavigateEvent(event) {
      const targetTab = event.detail?.tab;
      if (targetTab) {
        selectTab(targetTab, true);
      }
    }
    function handleClickDelegate(event) {
      const anchor = event.target.closest("a[href^='#']");
      if (!anchor) return;
      const hash = anchor.getAttribute("href")?.toLowerCase();
      if (hash && HASH_TO_TAB[hash]) {
        event.preventDefault();
        selectTab(HASH_TO_TAB[hash], true);
      }
    }
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("drive:navigate", handleNavigateEvent);
    document.addEventListener("click", handleClickDelegate);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("drive:navigate", handleNavigateEvent);
      document.removeEventListener("click", handleClickDelegate);
    };
  }, [selectTab]);

  // Pointer scrubbing along the 5-tab Liquid Glass navbar (matches video gesture)
  function computeIndexFromClientX(clientX) {
    const dock = dockRef.current;
    if (!dock) return null;
    const rect = dock.getBoundingClientRect();
    const pad = 6;
    const innerWidth = Math.max(1, rect.width - pad * 2);
    const relX = Math.min(Math.max(0, clientX - rect.left - pad), innerWidth);
    const rawIndex = (relX / innerWidth) * NAV_ITEMS.length;
    const clampedIndex = Math.min(
      NAV_ITEMS.length - 1,
      Math.max(0, rawIndex - 0.5)
    );
    const glarePercent = Math.round((relX / innerWidth) * 100);
    setLensGlareX(glarePercent);
    return clampedIndex;
  }

  function handlePointerDown(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const idx = computeIndexFromClientX(event.clientX);
    if (idx === null) return;
    setIsDragging(true);
    setDragIndex(idx);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
  }

  function handlePointerMove(event) {
    if (!isDragging) {
      // Subtle specular glare tracking on hover
      const dock = dockRef.current;
      if (dock) {
        const rect = dock.getBoundingClientRect();
        const pct = Math.round(((event.clientX - rect.left) / Math.max(1, rect.width)) * 100);
        setLensGlareX(Math.min(95, Math.max(5, pct)));
      }
      return;
    }
    const idx = computeIndexFromClientX(event.clientX);
    if (idx !== null) {
      setDragIndex(idx);
      const snapped = Math.round(idx);
      const item = NAV_ITEMS[snapped];
      if (item && item.id !== active) {
        setActive(item.id);
      }
    }
  }

  function finishPointerDrag(event) {
    if (!isDragging) return;
    const finalIdx =
      dragIndex !== null
        ? Math.round(dragIndex)
        : Math.round(computeIndexFromClientX(event.clientX) ?? activeIndex);
    const target = NAV_ITEMS[Math.min(NAV_ITEMS.length - 1, Math.max(0, finalIdx))];
    setIsDragging(false);
    setDragIndex(null);
    if (target) {
      selectTab(target.id, true);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      const next = NAV_ITEMS[(activeIndex + 1) % NAV_ITEMS.length];
      selectTab(next.id, true);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prev = NAV_ITEMS[(activeIndex - 1 + NAV_ITEMS.length) % NAV_ITEMS.length];
      selectTab(prev.id, true);
    }
  }

  function updateMotionPref(nextValue) {
    setMotionEnabled(nextValue);
    try {
      window.localStorage.setItem("drive:motion-enabled", String(nextValue));
    } catch {}
  }

  function updateGlassPref(nextValue) {
    setGlassIntensity(nextValue);
    try {
      window.localStorage.setItem("drive:glass-intensity", nextValue);
    } catch {}
  }

  function updateSpecularPref(nextValue) {
    setSpecularHighlights(nextValue);
    try {
      window.localStorage.setItem("drive:specular", String(nextValue));
    } catch {}
  }

  const currentLensIndex = isDragging && dragIndex !== null ? dragIndex : activeIndex;
  const activeMeta = NAV_ITEMS[activeIndex] || NAV_ITEMS[0];

  const settingsPanel = (
    <section className="settings-section glass-surface" id="settings">
      <div className="section-head">
        <div>
          <div className="eyebrow">
            <span className="pulse" /> LIQUID GLASS ENGINE & CONTROL
          </div>
          <h1>Workspace Control.</h1>
          <p>
            Tune Cupertino Liquid Glass refraction, spring physics, and inspect runtime architecture for web and Android WebView APK targets.
          </p>
        </div>
        <div className="settings-QuickActions">
          <button
            type="button"
            className="glass-link is-primary"
            onClick={() => selectTab("add", true)}
          >
            <Plus size={14} />
            <span>Manage Google Auth</span>
          </button>
        </div>
      </div>

      <div className="settings-grid">
        <article className="settings-card">
          <div className="settings-card-top">
            <span className="settings-icon">
              <Sparkles size={18} />
            </span>
            <div>
              <small>OPTICAL SURFACE</small>
              <h3>Liquid Glass Refraction</h3>
            </div>
          </div>
          <p>
            Adjust translucent backdrop blur saturation and curved lens bevel highlights across cards and the 5-tab navigation dock.
          </p>
          <div className="segmented-pills is-full" role="radiogroup" aria-label="Glass blur intensity">
            {[
              { id: "balanced", label: "Balanced (24px)" },
              { id: "ultra", label: "Ultra Glass (40px)" },
              { id: "low-power", label: "Low Power" },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={glassIntensity === opt.id}
                className={`segmented-pill ${glassIntensity === opt.id ? "is-active" : ""}`}
                onClick={() => updateGlassPref(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </article>

        <article className="settings-card">
          <div className="settings-card-top">
            <span className="settings-icon">
              <Gauge size={18} />
            </span>
            <div>
              <small>SMOOTH MOTION ENGINE</small>
              <h3>Elastic Spring Physics</h3>
            </div>
          </div>
          <p>
            Enable compositor-driven spring physics (`translate3d` & `scale`) on the sliding navbar lens droplet and panel transitions.
          </p>
          <div className="settings-toggle-row">
            <div>
              <strong>Spring Droplet & Micro-Motion</strong>
              <span>60–120 Hz compositor-friendly transitions</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={motionEnabled}
              aria-label="Toggle spring motion"
              className={`ios-switch ${motionEnabled ? "checked" : ""}`}
              onClick={() => updateMotionPref(!motionEnabled)}
            >
              <span />
            </button>
          </div>
          <div className="settings-toggle-row">
            <div>
              <strong>Specular Rim Lighting</strong>
              <span>Top-edge curved glass bevel reflections</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={specularHighlights}
              aria-label="Toggle specular rim highlights"
              className={`ios-switch ${specularHighlights ? "checked" : ""}`}
              onClick={() => updateSpecularPref(!specularHighlights)}
            >
              <span />
            </button>
          </div>
        </article>

        <article className="settings-card">
          <div className="settings-card-top">
            <span className="settings-icon">
              <Cpu size={18} />
            </span>
            <div>
              <small>RUNTIME TELEMETRY</small>
              <h3>Gateway & Registry Status</h3>
            </div>
          </div>
          <div className="telemetry-list">
            <div className="telemetry-item">
              <span>Catalog Indexed</span>
              <strong>{serverCount} MCP servers</strong>
            </div>
            <div className="telemetry-item">
              <span>Transport Guard</span>
              <strong className="is-ok">
                <CheckCircle2 size={13} /> HTTPS + DNS SSRF Check
              </strong>
            </div>
            <div className="telemetry-item">
              <span>Navigation Mode</span>
              <strong>5-Tab Liquid Lens Pill</strong>
            </div>
            <div className="telemetry-item">
              <span>Safe-Area Adaptation</span>
              <strong>env(safe-area-inset-*) Active</strong>
            </div>
          </div>
        </article>
      </div>

      <div className="settings-shortcuts">
        <div className="shortcut-strip">
          <div className="shortcut-info">
            <Layers size={18} />
            <div>
              <strong>Quick Workspace Jump</strong>
              <span>Switch directly to any core module or trigger a fresh connection check.</span>
            </div>
          </div>
          <div className="shortcut-buttons">
            {NAV_ITEMS.slice(0, 4).map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className="glass-chip-btn"
                  onClick={() => selectTab(item.id, true)}
                >
                  <Icon size={13} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );

  const panels = {
    connections,
    discover,
    add,
    security,
    settings: settingsPanel,
  };

  return (
    <main
      className={`drive-app glass-mode-${glassIntensity} ${
        !motionEnabled ? "motion-reduced" : ""
      } ${!specularHighlights ? "no-specular" : ""}`}
    >
      {/* Hidden SVG filter for authentic Liquid Glass chromatic & edge refraction */}
      <svg className="sr-only" aria-hidden="true" width="0" height="0">
        <defs>
          <filter id="liquid-lens-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.4" result="soft" />
            <feSpecularLighting
              in="soft"
              surfaceScale="3"
              specularConstant="0.85"
              specularExponent="28"
              lightingColor="#ffffff"
              result="spec"
            >
              <fePointLight x="60" y="-30" z="120" />
            </feSpecularLighting>
            <feComposite in="spec" in2="SourceAlpha" operator="in" result="specMask" />
            <feMerge>
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="specMask" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Top Dynamic Island & Brand Bar */}
      <header className="app-topbar">
        <a
          className="app-brand"
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            selectTab("connections", true);
          }}
          aria-label="DRIVE home"
        >
          <span className="brand-mark">
            <Command size={17} />
          </span>
          <span className="brand-text">DRIVE</span>
          <span className="brand-beta">LIQUID 2.6</span>
        </a>

        {/* Dynamic Island Activity Capsule */}
        <div className="dynamic-island-capsule" role="status" aria-live="polite">
          <span className="context-dot" />
          <span className="island-section">{activeMeta.label.toUpperCase()}</span>
          <span className="context-divider">·</span>
          <span className="island-sub">
            {active === "discover"
              ? `${serverCount} SERVERS`
              : active === "connections"
              ? "PERSONAL HUB"
              : active === "add"
              ? "STREAMABLE HTTP"
              : active === "security"
              ? "ZERO-TRUST GUARD"
              : "LIQUID ENGINE"}
          </span>
        </div>

        <div className="app-top-actions">
          <button
            type="button"
            className="top-pill-btn"
            onClick={() => selectTab("discover", true)}
            title="Search MCP Registry"
          >
            <Compass size={13} />
            <span>{serverCount ? `${serverCount} MCPs` : "Directory"}</span>
          </button>
          <button
            type="button"
            className="top-pill-btn is-accent"
            onClick={() => selectTab("add", true)}
            title="Add Custom MCP"
          >
            <Sparkles size={12} />
            <span>Connect</span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Viewport */}
      <section className="app-content" aria-live="polite">
        {NAV_ITEMS.map((item) => {
          const isCurrent = active === item.id;
          return (
            <div
              key={item.id}
              className={`app-panel ${isCurrent ? "is-active" : ""}`}
              hidden={!isCurrent}
            >
              {panels[item.id]}
            </div>
          );
        })}
      </section>

      {/* 5-Tab iOS 26 Liquid Glass Bottom Navbar (Video Reference Match) */}
      <div className="bottom-dock-stage">
        <nav
          ref={dockRef}
          className={`liquid-navbar-5 ${isDragging ? "is-dragging" : ""} ${
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
            "--glare-x": `${lensGlareX}%`,
          }}
        >
          {/* Ambient track reflection */}
          <div className="liquid-navbar-track-glow" aria-hidden="true" />

          {/* Interactive Sliding Liquid Glass Droplet / Lens Pill */}
          <div className="liquid-lens-pill" aria-hidden="true">
            <div className="liquid-lens-refraction" />
            <div className="liquid-lens-rim" />
            <div className="liquid-lens-shine" />
          </div>

          {/* 5 Navigation Items */}
          {NAV_ITEMS.map(({ id, label, short, icon: Icon, isCenterAction }, index) => {
            const distance = Math.abs(currentLensIndex - index);
            const isSelected = active === id;
            const isUnderLens = distance < 0.55;

            return (
              <button
                key={id}
                type="button"
                className={`liquid-nav-item ${isSelected ? "active" : ""} ${
                  isUnderLens ? "under-lens" : ""
                } ${isCenterAction ? "is-center-plus" : ""}`}
                aria-current={isSelected ? "page" : undefined}
                aria-label={label}
                onClick={() => selectTab(id, true)}
              >
                <span className="liquid-nav-icon-wrap">
                  <Icon
                    size={isCenterAction ? 22 : 20}
                    strokeWidth={isUnderLens || isSelected ? 2.35 : 1.9}
                  />
                  {id === "discover" && serverCount > 0 && (
                    <span className="liquid-nav-badge">{serverCount > 99 ? "99+" : serverCount}</span>
                  )}
                </span>
                <span className="liquid-nav-label">{short}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </main>
  );
}