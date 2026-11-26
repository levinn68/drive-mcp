"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createBrowserClient } from "@supabase/ssr";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileArchive,
  FileCode2,
  FileText,
  Folder,
  FolderTree,
  Globe,
  Layers,
  LoaderCircle,
  Plus,
  Power,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useDriveLang } from "./lang-context";

const SKILL_CATEGORIES = [
  { id: "", idLabel: "Semua", enLabel: "All" },
  { id: "frontend", idLabel: "Frontend & UI", enLabel: "Frontend & UI" },
  { id: "backend", idLabel: "Backend & API", enLabel: "Backend & API" },
  { id: "ai", idLabel: "AI & Agent", enLabel: "AI & Agents" },
  { id: "devops", idLabel: "DevOps & Cloud", enLabel: "DevOps & Cloud" },
  { id: "database", idLabel: "Database & SQL", enLabel: "Database & SQL" },
  { id: "security", idLabel: "Keamanan", enLabel: "Security & Audit" },
  { id: "testing", idLabel: "Testing & QA", enLabel: "Testing & QA" },
  { id: "design", idLabel: "Desain & UX", enLabel: "Design & UX" },
  { id: "media", idLabel: "Video & 3D", enLabel: "Video & 3D" },
  { id: "data", idLabel: "Data & Analitik", enLabel: "Data & Analytics" },
  { id: "mobile", idLabel: "Mobile Native", enLabel: "Mobile & Native" },
  { id: "docs", idLabel: "Docs & Tulis", enLabel: "Docs & Writing" },
  { id: "productivity", idLabel: "Produktivitas", enLabel: "Productivity" },
  { id: "marketing", idLabel: "Marketing & SEO", enLabel: "Marketing & SEO" },
  { id: "web3", idLabel: "Web3 & Crypto", enLabel: "Web3 & Crypto" },
  { id: "automation", idLabel: "Otomatisasi", enLabel: "Automation" },
];

const COLLAPSED_SKILL_CATS = 8;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

function normalizeSkillKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\/+$/, "");
}

function sanitizeCardDesc(raw, fallback) {
  const txt = String(raw || "")
    .replace(/^[>|][-+]?\s*$/g, "")
    .replace(/^[>|][-+]?\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (txt.length < 4) return fallback;
  return txt.length > 155 ? `${txt.slice(0, 152).trimEnd()}…` : txt;
}

export default function SkillLibrary() {
  const { lang, setLang, t } = useDriveLang();
  const [subTab, setSubTab] = useState("discover");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [showAllCats, setShowAllCats] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [totalRawSkills, setTotalRawSkills] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(36);
  const [mySkills, setMySkills] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingMy, setLoadingMy] = useState(false);
  const [installingId, setInstallingId] = useState("");
  const [toast, setToast] = useState({ type: "", message: "" });

  // Skill Detail & Structure Inspector modal state (rendered via Portal)
  const [inspectTarget, setInspectTarget] = useState(null);
  const [inspectData, setInspectData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Custom Skill Upload state
  const [uploadFiles, setUploadFiles] = useState([]);
  const [customName, setCustomName] = useState("");
  const [customContent, setCustomContent] = useState("");
  const [uploading, setUploading] = useState(false);

  // Lock page scroll & support Escape when modal is open
  useEffect(() => {
    if (!inspectTarget) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev) => {
      if (ev.key === "Escape") setInspectTarget(null);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [inspectTarget]);

  const installedKeys = useMemo(() => {
    const set = new Set();
    for (const s of mySkills) {
      const repo = normalizeSkillKey(s.source_repo);
      const name = normalizeSkillKey(s.name);
      const pathSlug = normalizeSkillKey(
        String(s.skill_path || "")
          .replace(/\/SKILL\.md$/i, "")
          .split("/")
          .pop()
      );
      if (repo) set.add(repo);
      if (name) set.add(name);
      if (repo && pathSlug) set.add(`${repo}/${pathSlug}`);
      if (repo && name) set.add(`${repo}/${name}`);
    }
    return set;
  }, [mySkills]);

  const loadMySkills = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    setLoadingMy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setMySkills([]);
        return;
      }
      const { data, error } = await supabase
        .from("user_skills")
        .select("id,name,description,source_repo,skill_path,skill_md,status,updated_at")
        .order("updated_at", { ascending: false });
      if (!error && Array.isArray(data)) {
        setMySkills(data);
      }
    } finally {
      setLoadingMy(false);
    }
  }, []);

  const loadCatalog = useCallback(async (searchText = "") => {
    setLoadingCatalog(true);
    setVisibleLimit(36);
    try {
      const params = new URLSearchParams();
      if (searchText.trim()) params.set("q", searchText.trim());
      const res = await fetch(`/api/catalog/skills?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      if (items.length > 0) {
        setCatalog(items);
        setTotalRawSkills(Number(data.totalRawSkills || items.length));
      } else {
        const fb = await fetch(`/api/skills/discover?${params.toString()}`, {
          cache: "no-store",
        });
        const fbData = await fb.json();
        const repos = Array.isArray(fbData.repositories) ? fbData.repositories : [];
        setCatalog(
          repos.map((repo) => ({
            id: repo.full_name,
            name: repo.full_name.split("/")[1] || repo.full_name,
            slug: repo.full_name.split("/")[1] || repo.full_name,
            source: repo.full_name,
            description: repo.description || "GitHub Agent Skill repository",
            category: "backend",
            stars: Number(repo.stars || 0),
            verified: false,
            skillCount: 1,
            installUrl: repo.html_url,
          }))
        );
        setTotalRawSkills(repos.length);
      }
    } catch {
      setCatalog([]);
    } finally {
      setLoadingCatalog(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCatalog("");
      loadMySkills();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadCatalog, loadMySkills]);

  const filteredCatalog = useMemo(() => {
    const cat = category.trim().toLowerCase();
    const q = query.trim().toLowerCase();

    return catalog.filter((item) => {
      const itemId = normalizeSkillKey(item.id);
      const itemSource = normalizeSkillKey(item.source);
      const itemName = normalizeSkillKey(item.name);
      const itemSlug = normalizeSkillKey(item.slug);
      const isAlreadyInstalled =
        (itemId && installedKeys.has(itemId)) ||
        (itemSource && installedKeys.has(itemSource)) ||
        (itemSource && itemSlug && installedKeys.has(`${itemSource}/${itemSlug}`)) ||
        (itemName && installedKeys.has(itemName));

      if (isAlreadyInstalled) {
        return false;
      }

      const itemCat = String(item.category || "").toLowerCase();
      if (cat && itemCat !== cat && !itemCat.includes(cat)) return false;

      if (!q) return true;
      const hay = [
        item.name,
        item.description,
        item.source,
        item.category,
        item.slug,
        item.author,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [catalog, installedKeys, category, query]);

  const visibleCatalog = useMemo(
    () => filteredCatalog.slice(0, visibleLimit),
    [filteredCatalog, visibleLimit]
  );

  const displayedCategories = useMemo(() => {
    if (showAllCats) return SKILL_CATEGORIES;
    const base = SKILL_CATEGORIES.slice(0, COLLAPSED_SKILL_CATS);
    if (category && !base.some((c) => c.id === category)) {
      const activeObj = SKILL_CATEGORIES.find((c) => c.id === category);
      if (activeObj) return [...base.slice(0, COLLAPSED_SKILL_CATS - 1), activeObj];
    }
    return base;
  }, [showAllCats, category]);

  const remainingCatCount = SKILL_CATEGORIES.length - COLLAPSED_SKILL_CATS;

  async function openSkillInspector(item) {
    setInspectTarget(item);
    setInspectData(null);
    setInspectLoading(true);
    try {
      const res = await fetch("/api/skills/inspect-tree", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repository: item.source || item.source_repo || "",
          skillPath: item.skill_path || "",
          slug: item.slug || "",
          name: item.name || "",
          description: item.description || "",
          category: item.category || "",
          skillMd: item.skill_md || "",
        }),
      });
      const data = await res.json();
      setInspectData(data);
    } catch {
      setInspectData({
        name: item.name,
        entries: [],
        summary: {
          id: "Gagal memuat struktur folder & file dari GitHub saat ini.",
          en: "Could not load repository folder & file structure right now.",
        },
      });
    } finally {
      setInspectLoading(false);
    }
  }

  async function quickInstall(item) {
    const key = item.id || item.source || item.name;
    setInstallingId(key);
    setToast({ type: "", message: "" });
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error(t("Autentikasi belum dikonfigurasi.", "Authentication not configured."));
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`,
          },
        });
        return;
      }

      const rawRepo = item.source || item.installUrl || "";
      const repo = rawRepo
        .replace(/^https?:\/\/github\.com\//i, "")
        .split("/blob/")[0]
        .replace(/^\/+|\/+$/g, "");

      const res = await fetch("/api/skills/quick-install", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          repository: repo,
          slug: item.slug || item.name,
          name: item.name,
          description: item.description,
          installAll: Number(item.skillCount || 1) > 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          [data.error, data.detail].filter(Boolean).join(": ") ||
            t("Gagal memasang Skill.", "Failed to install Skill.")
        );
      }
      const installedCount = Number(data.count || 1);
      setToast({
        type: "success",
        message:
          installedCount > 1
            ? t(
                `${item.name} (${installedCount} skills) terpasang & dipindahkan ke Skill Saya!`,
                `${item.name} (${installedCount} skills) installed & moved to My Skills!`
              )
            : t(
                `${item.name} terpasang & dipindahkan ke Skill Saya!`,
                `${item.name} installed & moved to My Skills!`
              ),
      });
      await loadMySkills();
    } catch (err) {
      setToast({
        type: "error",
        message: err?.message || t("Gagal memasang Skill.", "Failed to install Skill."),
      });
    } finally {
      setInstallingId("");
    }
  }

  async function handleCustomUpload(event) {
    event.preventDefault();
    setUploading(true);
    setToast({ type: "", message: "" });
    try {
      const supabase = getSupabase();
      if (!supabase) throw new Error(t("Autentikasi belum dikonfigurasi.", "Authentication not configured."));
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/")}`,
          },
        });
        return;
      }

      const formData = new FormData();
      if (uploadFiles.length > 0) {
        for (const f of uploadFiles) {
          formData.append("files", f, f.webkitRelativePath || f.name);
        }
      } else if (customContent.trim()) {
        formData.append("name", customName.trim() || "Custom Skill");
        formData.append("content", customContent.trim());
      } else {
        throw new Error(
          t(
            "Pilih file .md / .zip / folder dulu, atau tempel isi SKILL.md.",
            "Choose a .md / .zip / folder first, or paste SKILL.md content."
          )
        );
      }

      const res = await fetch("/api/skills/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("Gagal mengunggah custom skill.", "Upload failed."));

      setToast({
        type: "success",
        message: t(
          `${data.count || 1} custom skill berhasil diunggah & langsung aktif!`,
          `${data.count || 1} custom skill(s) uploaded & active!`
        ),
      });
      setUploadFiles([]);
      setCustomName("");
      setCustomContent("");
      await loadMySkills();
      setSubTab("my");
    } catch (err) {
      setToast({
        type: "error",
        message: err?.message || t("Gagal mengunggah custom skill.", "Upload failed."),
      });
    } finally {
      setUploading(false);
    }
  }

  async function toggleSkill(skill) {
    const supabase = getSupabase();
    if (!supabase) return;
    const prevStatus = skill.status;
    const nextStatus = prevStatus === "enabled" ? "saved" : "enabled";
    setMySkills((prev) =>
      prev.map((item) => (item.id === skill.id ? { ...item, status: nextStatus } : item))
    );
    const { error } = await supabase
      .from("user_skills")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", skill.id);
    if (error) {
      setMySkills((prev) =>
        prev.map((item) => (item.id === skill.id ? { ...item, status: prevStatus } : item))
      );
      setToast({
        type: "error",
        message: error.message || t("Gagal mengubah status Skill.", "Could not update Skill status."),
      });
    }
  }

  async function removeSkill(skill) {
    const supabase = getSupabase();
    if (!supabase) return;
    const snapshot = mySkills;
    setMySkills((prev) => prev.filter((item) => item.id !== skill.id));
    const { error } = await supabase.from("user_skills").delete().eq("id", skill.id);
    if (error) {
      setMySkills(snapshot);
      setToast({
        type: "error",
        message: error.message || t("Gagal menghapus Skill.", "Could not remove Skill."),
      });
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadCatalog(query);
  }

  const skillSubtabs = [
    { id: "discover", label: t("Direktori", "Directory") },
    { id: "my", label: `${t("Skill Saya", "My Skills")} (${mySkills.length})` },
    { id: "custom", label: t("+ Kustom", "+ Custom") },
  ];

  const subIndex = Math.max(
    0,
    skillSubtabs.findIndex((item) => item.id === subTab)
  );

  const inspectorModal =
    inspectTarget && typeof document !== "undefined"
      ? createPortal(
          <div
            className="skill-inspector-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={`Detail Skill ${inspectTarget.name}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) setInspectTarget(null);
            }}
          >
            <div className="skill-inspector-modal">
              <div className="skill-inspector-head">
                <div style={{ minWidth: 0 }}>
                  <div className="eyebrow" style={{ marginBottom: 4 }}>
                    {t("INSPEKTOR SKILL", "SKILL INSPECTOR")}
                  </div>
                  <h3>{inspectData?.name || inspectTarget.name}</h3>
                  {(inspectTarget.source || inspectTarget.source_repo) && (
                    <small>{inspectTarget.source || inspectTarget.source_repo}</small>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flex: "none" }}>
                  <div className="lang-toggle-group" role="group" aria-label="Language">
                    <button
                      type="button"
                      className={lang === "id" ? "is-active" : ""}
                      onClick={() => setLang("id")}
                    >
                      <Globe size={11} /> ID
                    </button>
                    <button
                      type="button"
                      className={lang === "en" ? "is-active" : ""}
                      onClick={() => setLang("en")}
                    >
                      EN
                    </button>
                  </div>
                  <button
                    type="button"
                    className="oauth-return-dismiss"
                    aria-label={t("Tutup inspektor", "Close inspector")}
                    onClick={() => setInspectTarget(null)}
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              <div className="skill-inspector-scroll">
                {inspectLoading ? (
                  <div className="empty-state" style={{ padding: "28px 12px" }}>
                    <LoaderCircle size={22} className="spin" />
                    <p>
                      {t(
                        "Membaca struktur folder, file, dan fungsi Skill...",
                        "Reading folder structure, files, and Skill purpose..."
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="skill-inspector-body">
                    <div className="skill-inspector-section">
                      <h4>{t("Fungsi & Kegunaan", "Purpose & Capabilities")}</h4>
                      <p>{lang === "en" ? inspectData?.summary?.en : inspectData?.summary?.id}</p>
                    </div>

                    {inspectData?.headings?.length > 0 && (
                      <div className="skill-inspector-section">
                        <h4>{t("Bagian Utama", "Key Sections")}</h4>
                        <div className="custom-policy-pills">
                          {inspectData.headings.map((h) => (
                            <span key={h}>{h}</span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="skill-inspector-section">
                      <h4>
                        <FolderTree size={13} />{" "}
                        {t(
                          `Struktur Folder & File (${inspectData?.entries?.length || 0})`,
                          `Folder & File Structure (${inspectData?.entries?.length || 0})`
                        )}
                      </h4>
                      {inspectData?.entries?.length > 0 ? (
                        <div className="skill-tree-list">
                          {inspectData.entries.map((entry) => (
                            <div key={entry.fullPath || entry.path} className="skill-tree-row">
                              <span className="skill-tree-name">
                                {entry.type === "folder" ? (
                                  <Folder size={13} className="is-folder" />
                                ) : (
                                  <FileCode2 size={13} className="is-file" />
                                )}
                                <code>{entry.path}</code>
                              </span>
                              {entry.type === "file" && entry.size > 0 && (
                                <small>{(entry.size / 1024).toFixed(1)} KB</small>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p style={{ margin: 0 }}>
                          {t(
                            "Skill ini berbentuk file instruksi tunggal (SKILL.md).",
                            "This skill is stored as a single instruction file (SKILL.md)."
                          )}
                        </p>
                      )}
                    </div>

                    {inspectData?.preview && (
                      <details className="skill-preview-details">
                        <summary>{t("Lihat isi SKILL.md", "Preview SKILL.md")}</summary>
                        <pre>{inspectData.preview}</pre>
                      </details>
                    )}

                    {inspectData?.repoUrl && (
                      <a
                        href={inspectData.repoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="glass-chip-btn"
                        style={{ width: "fit-content", textDecoration: "none" }}
                      >
                        <ExternalLink size={12} />{" "}
                        {t("Buka Repositori GitHub", "Open GitHub Repository")}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="drive-mcp-workspace">
      <div className="drive-subtabs-wrap">
        <div
          className="drive-subtabs"
          role="tablist"
          aria-label={t("Bagian Skills", "Skills sections")}
          style={{ "--sub-index": subIndex }}
        >
          <span className="drive-subtabs-pill" aria-hidden="true" />
          {skillSubtabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={subTab === tab.id}
              className={`drive-subtab-btn ${subTab === tab.id ? "is-active" : ""}`}
              onClick={() => setSubTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {toast.message && (
        <div
          className={`custom-form-alert ${toast.type === "error" ? "is-error" : "is-success"}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <span>{toast.message}</span>
        </div>
      )}

      {inspectorModal}

      {/* Persistent sub-tabs for 0ms instant switching */}
      <section className="catalog-section" id="skills-directory" hidden={subTab !== "discover"}>
        <form className="catalog-search" onSubmit={handleSearchSubmit}>
          <Search size={15} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              "Cari 8.000+ Skills (react, supabase, audit, nextjs...)",
              "Search 8,000+ Skills (react, supabase, audit, nextjs...)"
            )}
            aria-label={t("Cari Agent Skills", "Search Agent Skills")}
          />
          <button type="submit">{t("Cari", "Search")}</button>
        </form>

        <div
          className="mcp-category-filter"
          aria-label={t("Kategori Skill", "Skill categories")}
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
            <strong>{filteredCatalog.length.toLocaleString()}</strong>{" "}
            {t("skills tersedia", "skills available")}
            {totalRawSkills > filteredCatalog.length && (
              <span>
                {" "}
                ({totalRawSkills.toLocaleString()} {t("terindeks", "indexed")})
              </span>
            )}
            <span className="registry-live">
              <i /> {t("Pasang 1-Klik", "1-Click Install")}
            </span>
          </div>
        </div>

        {loadingCatalog ? (
          <div className="empty-state">
            <LoaderCircle size={22} className="spin" />
            <h3>{t("Memuat Skills...", "Loading Skills...")}</h3>
          </div>
        ) : visibleCatalog.length === 0 ? (
          <div className="empty-state">
            <Search size={22} />
            <h3>{t("Tidak ada Skill yang cocok", "No matching Skills")}</h3>
            <p>
              {t(
                "Coba kata kunci atau kategori berbeda.",
                "Try a different keyword or category."
              )}
            </p>
          </div>
        ) : (
          <>
            <div className="integration-grid">
              {visibleCatalog.map((item, idx) => {
                const key = item.id || item.source || `${item.name}-${idx}`;
                const isBusy = installingId === key;
                const repoUrl =
                  item.installUrl || (item.source ? `https://github.com/${item.source}` : "");
                const count = Number(item.skillCount || 1);
                return (
                  <article key={key} className="integration-card server-card">
                    <div className="card-top">
                      <div className="integration-icon">
                        {count > 1 ? <Layers size={15} /> : <BookOpen size={15} />}
                      </div>
                      <span className={`status ${item.verified ? "is-enabled" : ""}`}>
                        {count > 1 ? (
                          `${count} skills`
                        ) : item.verified ? (
                          <>
                            <ShieldCheck size={10} /> {t("Terverifikasi", "Verified")}
                          </>
                        ) : (
                          item.category || "Skill"
                        )}
                      </span>
                    </div>

                    <div className="server-meta">
                      {item.stars > 0 && (
                        <span className="version-pill is-star-pill">
                          <Star size={10} /> {Number(item.stars).toLocaleString()}
                        </span>
                      )}
                      {item.category && <span className="transport-pill">{item.category}</span>}
                    </div>

                    <h3>{item.name || item.source}</h3>
                    <p>
                      {sanitizeCardDesc(
                        item.description,
                        t(
                          "Agent Skill siap dipasang 1-klik ke akun DRIVE.",
                          "Agent Skill ready for 1-click install to your DRIVE account."
                        )
                      )}
                    </p>

                    <div className="card-bottom">
                      <div className="server-actions">
                        <button
                          type="button"
                          className="glass-chip-btn"
                          onClick={() => openSkillInspector(item)}
                        >
                          <FolderTree size={11} /> {t("Struktur", "Structure")}
                        </button>
                        {repoUrl ? (
                          <a href={repoUrl} target="_blank" rel="noreferrer">
                            {t("Sumber", "Source")} <ExternalLink size={11} />
                          </a>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={isBusy}
                        className="skill-install-btn"
                        onClick={() => quickInstall(item)}
                      >
                        {isBusy ? (
                          <LoaderCircle size={13} className="spin" />
                        ) : (
                          <Plus size={13} />
                        )}
                        {isBusy
                          ? t("Memasang...", "Installing...")
                          : count > 1
                          ? `${t("Pasang Paket", "Install Pack")} (${count})`
                          : t("Pasang", "Install")}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {visibleLimit < filteredCatalog.length && (
              <div className="load-more-row" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="load-more-button"
                  onClick={() => setVisibleLimit((prev) => prev + 48)}
                >
                  {t(
                    `Muat lagi (${(filteredCatalog.length - visibleLimit).toLocaleString()} tersisa)`,
                    `Load more (${(filteredCatalog.length - visibleLimit).toLocaleString()} remaining)`
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      <section className="catalog-section" id="my-skills" hidden={subTab !== "my"}>
        {loadingMy ? (
          <div className="empty-state">
            <LoaderCircle size={22} className="spin" />
            <h3>{t("Memuat Skill Saya...", "Loading My Skills...")}</h3>
          </div>
        ) : mySkills.length === 0 ? (
          <div className="empty-state">
            <BookOpen size={22} />
            <h3>{t("Belum ada Skill terpasang", "No Skills installed yet")}</h3>
            <p>
              {t(
                "Buka tab Direktori lalu klik Pasang di kartu Skill mana saja, atau unggah di + Kustom.",
                "Open Directory and tap Install on any Skill card, or upload your own in + Custom."
              )}
            </p>
          </div>
        ) : (
          <div className="integration-grid">
            {mySkills.map((skill) => {
              const enabled = skill.status === "enabled";
              return (
                <article key={skill.id} className="integration-card server-card">
                  <div className="card-top">
                    <div className="integration-icon">
                      <BookOpen size={15} />
                    </div>
                    <span className={`status ${enabled ? "is-enabled" : ""}`}>
                      {enabled ? t("Aktif", "Active") : t("Nonaktif", "Paused")}
                    </span>
                  </div>
                  <h3>{skill.name}</h3>
                  <p>
                    {sanitizeCardDesc(
                      skill.description,
                      skill.source_repo
                        ? t(
                            `Skill terpasang dari ${skill.source_repo}.`,
                            `Installed from ${skill.source_repo}.`
                          )
                        : t("Skill DRIVE terpasang.", "Installed DRIVE Skill.")
                    )}
                  </p>
                  <div className="card-bottom">
                    <button
                      type="button"
                      className="glass-chip-btn"
                      style={{ width: "100%", justifyContent: "center" }}
                      onClick={() => openSkillInspector(skill)}
                    >
                      <FolderTree size={11} /> {t("Detail & Struktur", "Details & Structure")}
                    </button>
                    <div className="server-actions">
                      <button
                        type="button"
                        onClick={() => toggleSkill(skill)}
                        className="glass-chip-btn"
                      >
                        <Power size={11} />{" "}
                        {enabled ? t("Matikan", "Turn Off") : t("Aktifkan", "Turn On")}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="glass-chip-btn is-danger"
                        aria-label={`Remove ${skill.name}`}
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="catalog-section" id="custom-skill" hidden={subTab !== "custom"}>
        <form className="custom-form-clean" onSubmit={handleCustomUpload}>
          <div className="custom-fields">
            <div className="custom-upload-drop">
              <Upload size={20} />
              <strong>
                {t("Unggah Skill (.md, .zip, atau Folder)", "Upload Skill (.md, .zip, or Folder)")}
              </strong>
              <small>
                {t(
                  "Mendukung file SKILL.md tunggal, arsip .zip berisi banyak skill, atau pilih folder skill langsung.",
                  "Supports single SKILL.md files, multi-skill .zip archives, or direct folder uploads."
                )}
              </small>
              <div className="custom-upload-pickers">
                <label className="glass-chip-btn" style={{ cursor: "pointer" }}>
                  <FileArchive size={13} /> {t("Pilih .md / .zip", "Choose .md / .zip")}
                  <input
                    type="file"
                    accept=".md,.markdown,.txt,.zip"
                    multiple
                    hidden
                    onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                  />
                </label>
                <label className="glass-chip-btn" style={{ cursor: "pointer" }}>
                  <Folder size={13} /> {t("Pilih Folder", "Choose Folder")}
                  <input
                    type="file"
                    webkitdirectory=""
                    directory=""
                    multiple
                    hidden
                    onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                  />
                </label>
              </div>
              {uploadFiles.length > 0 && (
                <div className="custom-upload-selected">
                  <FileText size={13} /> {uploadFiles.length}{" "}
                  {t("file dipilih", "file(s) selected")}:{" "}
                  {uploadFiles
                    .slice(0, 3)
                    .map((f) => f.name)
                    .join(", ")}
                  {uploadFiles.length > 3 ? ` +${uploadFiles.length - 3}` : ""}
                </div>
              )}
            </div>

            <label className="custom-field-label">
              <span>{t("ATAU NAMA SKILL MANUAL (OPSIONAL)", "OR MANUAL SKILL NAME (OPTIONAL)")}</span>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={t("cth. Frontend Design Guard", "e.g. Frontend Design Guard")}
              />
            </label>

            <label className="custom-field-label">
              <span>{t("TEMPEL ISI SKILL.MD (OPSIONAL)", "PASTE SKILL.MD CONTENT (OPTIONAL)")}</span>
              <textarea
                rows={5}
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                placeholder={"---\nname: my-skill\ndescription: Custom workflow\n---\n# Instructions..."}
                className="custom-skill-textarea"
              />
            </label>

            <button type="submit" className="custom-submit-btn" disabled={uploading}>
              {uploading ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}
              {uploading
                ? t("Mengunggah...", "Uploading...")
                : t("Unggah & Aktifkan Skill", "Upload & Activate Skill")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
