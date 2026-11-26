"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  BookOpen,
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

const SKILL_CATEGORIES = [
  { id: "", label: "All" },
  { id: "frontend", label: "Frontend & UI" },
  { id: "backend", label: "Backend & API" },
  { id: "ai", label: "AI & Agents" },
  { id: "devops", label: "DevOps & Cloud" },
  { id: "database", label: "Database & SQL" },
  { id: "security", label: "Security & Audit" },
  { id: "testing", label: "Testing & QA" },
  { id: "design", label: "Design & UX" },
  { id: "data", label: "Data & Analytics" },
  { id: "mobile", label: "Mobile & Native" },
  { id: "docs", label: "Docs & Writing" },
  { id: "productivity", label: "Productivity" },
  { id: "marketing", label: "Marketing & SEO" },
  { id: "automation", label: "Automation" },
];

const SKILL_SUBTABS = [
  { id: "discover", label: "Directory" },
  { id: "my", label: "My Skills" },
  { id: "custom", label: "+ Custom" },
];

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
  const [subTab, setSubTab] = useState("discover");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [catalog, setCatalog] = useState([]);
  const [totalRawSkills, setTotalRawSkills] = useState(0);
  const [visibleLimit, setVisibleLimit] = useState(40);
  const [mySkills, setMySkills] = useState([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [loadingMy, setLoadingMy] = useState(false);
  const [installingId, setInstallingId] = useState("");
  const [toast, setToast] = useState({ type: "", message: "" });

  // Skill Detail & Structure Inspector modal state
  const [inspectLang, setInspectLang] = useState("id");
  const [inspectTarget, setInspectTarget] = useState(null);
  const [inspectData, setInspectData] = useState(null);
  const [inspectLoading, setInspectLoading] = useState(false);

  // Custom Skill Upload state
  const [uploadFiles, setUploadFiles] = useState([]);
  const [customName, setCustomName] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [customContent, setCustomContent] = useState("");
  const [uploading, setUploading] = useState(false);

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
    setVisibleLimit(40);
    try {
      const trimmed = searchText.trim();
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      const res = await fetch(`/api/catalog/skills${params.toString() ? `?${params}` : ""}`, {
        cache: "no-store",
      });
      const data = await res.json();
      let items = Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.skills)
        ? data.skills
        : [];
      setTotalRawSkills(Number(data.totalRawSkills || items.length || 0));

      if (items.length === 0 && trimmed.length >= 2) {
        const ghRes = await fetch(`/api/skills/discover?q=${encodeURIComponent(trimmed)}`, {
          cache: "no-store",
        });
        if (ghRes.ok) {
          const ghData = await ghRes.json();
          items = (ghData.items || []).map((repo) => ({
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
          }));
          setTotalRawSkills(items.length);
        }
      }
      setCatalog(items);
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
        ...(Array.isArray(item.includedSkills) ? item.includedSkills : []),
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
      if (!supabase) throw new Error("Authentication belum dikonfigurasi.");
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
          [data.error, data.detail].filter(Boolean).join(": ") || "Gagal memasang Skill."
        );
      }
      const installedCount = Number(data.installedCount || 1);
      setToast({
        type: "success",
        message:
          installedCount > 1
            ? `${item.name} (${installedCount} skills) terpasang & dipindahkan ke My Skills!`
            : `${item.name} terpasang & dipindahkan ke My Skills!`,
      });
      await loadMySkills();
    } catch (err) {
      setToast({
        type: "error",
        message: err?.message || "Gagal memasang Skill.",
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
      if (!supabase) throw new Error("Authentication belum dikonfigurasi.");
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

      let res;
      if (uploadFiles.length > 0) {
        const fd = new FormData();
        if (customName.trim()) fd.append("name", customName.trim());
        if (customDesc.trim()) fd.append("description", customDesc.trim());
        for (const f of uploadFiles) fd.append("files", f);
        res = await fetch("/api/skills/upload", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: fd,
        });
      } else {
        res = await fetch("/api/skills/upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            name: customName.trim(),
            description: customDesc.trim(),
            content: customContent.trim(),
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal upload Custom Skill.");

      const count = Number(data.installedCount || 1);
      setToast({
        type: "success",
        message:
          count > 1
            ? `${count} custom skills dari arsip berhasil diekstrak & langsung aktif!`
            : `Custom skill "${data.skills?.[0]?.name || customName}" berhasil dipasang & aktif!`,
      });
      setUploadFiles([]);
      setCustomName("");
      setCustomDesc("");
      setCustomContent("");
      await loadMySkills();
      setSubTab("my");
    } catch (err) {
      setToast({ type: "error", message: err?.message || "Gagal upload Custom Skill." });
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
      setToast({ type: "error", message: error.message || "Gagal mengubah status Skill." });
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
      setToast({ type: "error", message: error.message || "Gagal menghapus Skill." });
    }
  }

  function handleSearchSubmit(event) {
    event.preventDefault();
    loadCatalog(query);
  }

  const subIndex = Math.max(
    0,
    SKILL_SUBTABS.findIndex((t) => t.id === subTab)
  );

  return (
    <div className="drive-mcp-workspace">
      <div className="drive-subtabs-wrap">
        <div
          className="drive-subtabs"
          role="tablist"
          aria-label="Skills sections"
          style={{ "--sub-index": subIndex }}
        >
          <span className="drive-subtabs-pill" aria-hidden="true" />
          {SKILL_SUBTABS.map((tab) => {
            const isActive = subTab === tab.id;
            const label = tab.id === "my" ? `My Skills (${mySkills.length})` : tab.label;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={`drive-subtab-btn ${isActive ? "is-active" : ""}`}
                onClick={() => setSubTab(tab.id)}
              >
                {label}
              </button>
            );
          })}
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

      {inspectTarget && (
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
              <div>
                <div className="eyebrow" style={{ marginBottom: 4 }}>
                  SKILL INSPECTOR
                </div>
                <h3>{inspectData?.name || inspectTarget.name}</h3>
                {(inspectTarget.source || inspectTarget.source_repo) && (
                  <small>{inspectTarget.source || inspectTarget.source_repo}</small>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div className="lang-toggle-group" role="group" aria-label="Language">
                  <button
                    type="button"
                    className={inspectLang === "id" ? "is-active" : ""}
                    onClick={() => setInspectLang("id")}
                  >
                    <Globe size={11} /> ID
                  </button>
                  <button
                    type="button"
                    className={inspectLang === "en" ? "is-active" : ""}
                    onClick={() => setInspectLang("en")}
                  >
                    EN
                  </button>
                </div>
                <button
                  type="button"
                  className="oauth-return-dismiss"
                  aria-label="Close inspector"
                  onClick={() => setInspectTarget(null)}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {inspectLoading ? (
              <div className="empty-state" style={{ padding: "28px 12px" }}>
                <LoaderCircle size={22} className="spin" />
                <p>
                  {inspectLang === "id"
                    ? "Membaca struktur folder, file, dan fungsi Skill..."
                    : "Reading folder structure, files, and Skill purpose..."}
                </p>
              </div>
            ) : (
              <div className="skill-inspector-body">
                <div className="skill-inspector-section">
                  <h4>
                    {inspectLang === "id" ? "Fungsi & Kegunaan" : "Purpose & Capabilities"}
                  </h4>
                  <p>
                    {inspectLang === "id"
                      ? inspectData?.summary?.id
                      : inspectData?.summary?.en}
                  </p>
                </div>

                {inspectData?.headings?.length > 0 && (
                  <div className="skill-inspector-section">
                    <h4>{inspectLang === "id" ? "Bagian Utama" : "Key Sections"}</h4>
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
                    {inspectLang === "id"
                      ? `Struktur Folder & File (${inspectData?.entries?.length || 0})`
                      : `Folder & File Structure (${inspectData?.entries?.length || 0})`}
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
                      {inspectLang === "id"
                        ? "Skill ini berbentuk file instruksi tunggal (SKILL.md)."
                        : "This skill is stored as a single instruction file (SKILL.md)."}
                    </p>
                  )}
                </div>

                {inspectData?.preview && (
                  <details className="skill-preview-details">
                    <summary>
                      {inspectLang === "id" ? "Lihat isi SKILL.md" : "Preview SKILL.md"}
                    </summary>
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
                    {inspectLang === "id" ? "Buka Repositori GitHub" : "Open GitHub Repository"}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === "discover" ? (
        <section className="catalog-section" id="skills-directory">
          <form className="catalog-search" onSubmit={handleSearchSubmit}>
            <Search size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search 5,000+ Skills (react, supabase, audit, nextjs...)"
              aria-label="Search Agent Skills"
            />
            <button type="submit">Search</button>
          </form>

          <div className="mcp-category-filter" aria-label="Skill categories">
            {SKILL_CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                className={`category-chip ${category === cat.id ? "is-active" : ""}`}
                onClick={() => {
                  setCategory(cat.id);
                  setVisibleLimit(40);
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="directory-toolbar">
            <div className="directory-stats">
              <strong>{filteredCatalog.length.toLocaleString()}</strong> skills available
              {totalRawSkills > filteredCatalog.length && (
                <span> ({totalRawSkills.toLocaleString()} indexed)</span>
              )}
              <span className="registry-live">
                <i /> 1-Click Install
              </span>
            </div>
          </div>

          {loadingCatalog ? (
            <div className="empty-state">
              <LoaderCircle size={22} className="spin" />
              <h3>Loading Skills...</h3>
            </div>
          ) : visibleCatalog.length === 0 ? (
            <div className="empty-state">
              <Search size={22} />
              <h3>No matching Skills</h3>
              <p>Try a different keyword or category.</p>
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
                              <ShieldCheck size={10} /> Verified
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
                          "Agent Skill siap dipasang 1-klik ke akun DRIVE."
                        )}
                      </p>

                      <div className="card-bottom">
                        <div className="server-actions">
                          <button
                            type="button"
                            className="glass-chip-btn"
                            onClick={() => openSkillInspector(item)}
                          >
                            <FolderTree size={11} /> Struktur
                          </button>
                          {repoUrl ? (
                            <a href={repoUrl} target="_blank" rel="noreferrer">
                              Source <ExternalLink size={11} />
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
                            ? "Installing..."
                            : count > 1
                            ? `Install Pack (${count})`
                            : "Install"}
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
                    Load more ({(filteredCatalog.length - visibleLimit).toLocaleString()} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      ) : subTab === "my" ? (
        <section className="catalog-section" id="my-skills">
          {loadingMy ? (
            <div className="empty-state">
              <LoaderCircle size={22} className="spin" />
              <h3>Loading My Skills...</h3>
            </div>
          ) : mySkills.length === 0 ? (
            <div className="empty-state">
              <BookOpen size={22} />
              <h3>Belum ada Skill terpasang</h3>
              <p>Buka tab Directory atau + Custom untuk memasang Skill pertama kamu.</p>
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
                        {enabled ? "Active" : "Paused"}
                      </span>
                    </div>
                    <h3>{skill.name}</h3>
                    <p>
                      {sanitizeCardDesc(
                        skill.description,
                        skill.source_repo
                          ? `Skill terpasang dari ${skill.source_repo}.`
                          : "Installed DRIVE Skill."
                      )}
                    </p>
                    <div className="card-bottom">
                      <button
                        type="button"
                        className="glass-chip-btn"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => openSkillInspector(skill)}
                      >
                        <FolderTree size={11} /> Detail & Struktur (ID/EN)
                      </button>
                      <div className="server-actions">
                        <button
                          type="button"
                          onClick={() => toggleSkill(skill)}
                          className="glass-chip-btn"
                        >
                          <Power size={11} /> {enabled ? "Turn Off" : "Turn On"}
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
      ) : (
        <section className="platform-section" id="custom-skill">
          <div className="section-head">
            <div>
              <div className="eyebrow">CUSTOM SKILL</div>
              <h1>Upload or Write Skill</h1>
              <p className="section-intro">
                Upload file <strong>.zip</strong> (ekstrak otomatis), <strong>.md</strong>,{" "}
                <strong>.txt</strong>, atau tulis instruksi Skill langsung di sini.
              </p>
            </div>
          </div>

          <form className="custom-form-clean" onSubmit={handleCustomUpload}>
            <div className="custom-fields">
              <label className="custom-field-label">
                <span>
                  <FileArchive size={13} /> UPLOAD FILE (.ZIP, .MD, .TXT)
                </span>
                <input
                  type="file"
                  accept=".zip,.md,.markdown,.txt"
                  multiple
                  onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                  style={{ padding: "10px" }}
                />
              </label>

              {uploadFiles.length > 0 && (
                <div className="custom-policy-pills">
                  {uploadFiles.map((f) => (
                    <span key={f.name}>
                      <FileText size={11} /> {f.name}
                    </span>
                  ))}
                </div>
              )}

              <label className="custom-field-label">
                <span>
                  <BookOpen size={13} /> SKILL NAME {uploadFiles.length ? "(OPTIONAL)" : ""}
                </span>
                <input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="e.g. No Slop Frontend Architect"
                  required={uploadFiles.length === 0}
                />
              </label>

              <label className="custom-field-label">
                <span>SHORT DESCRIPTION (OPTIONAL)</span>
                <input
                  value={customDesc}
                  onChange={(e) => setCustomDesc(e.target.value)}
                  placeholder="Kapan AI harus memakai skill ini..."
                />
              </label>

              {uploadFiles.length === 0 && (
                <label className="custom-field-label">
                  <span>
                    <FileText size={13} /> SKILL INSTRUCTIONS (MARKDOWN / TEXT)
                  </span>
                  <textarea
                    value={customContent}
                    onChange={(e) => setCustomContent(e.target.value)}
                    placeholder="# Instructions&#10;Tulis aturan, workflow, atau format output yang harus diikuti AI..."
                    rows={6}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 13px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(6,11,20,0.62)",
                      color: "#f4f8ff",
                      fontSize: 13,
                      fontFamily: "inherit",
                    }}
                  />
                </label>
              )}

              <button type="submit" className="custom-submit-btn" disabled={uploading}>
                {uploading ? <LoaderCircle size={15} className="spin" /> : <Upload size={15} />}
                {uploading
                  ? "Extracting & Saving..."
                  : uploadFiles.length
                  ? `Upload & Install (${uploadFiles.length} file)`
                  : "Save & Activate Skill"}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}
