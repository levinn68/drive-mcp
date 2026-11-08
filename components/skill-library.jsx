"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { BookOpen, CheckCircle2, ChevronDown, Code2, ExternalLink, FileSearch, LoaderCircle, Plus, RefreshCw, ShieldAlert, Trash2 } from "lucide-react";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createBrowserClient(url, key) : null;
}

export default function SkillLibrary() {
  const [skills, setSkills] = useState([]);
  const [url, setUrl] = useState("");
  const [inspected, setInspected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [expanded, setExpanded] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const supabase = getSupabase();
    if (!supabase) { setError("Supabase is not configured."); setLoading(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    setSignedIn(Boolean(session));
    if (!session) { setSkills([]); setLoading(false); return; }
    const { data, error: loadError } = await supabase.from("user_skills")
      .select("id,name,description,source_repo,skill_path,version,license,status,skill_md,created_at")
      .order("updated_at", { ascending: false });
    if (loadError) setError(loadError.message);
    else setSkills(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function inspect() {
    setBusy("inspect"); setError(""); setNotice(""); setInspected(null);
    try {
      const response = await fetch("/api/skills/inspect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Inspection failed");
      setInspected(data);
    } catch (e) { setError(e.message || "Could not inspect Skill"); }
    finally { setBusy(""); }
  }

  async function importSkill() {
    if (!inspected) return;
    setBusy("import"); setError(""); setNotice("");
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Sign in before saving a Skill."); setBusy(""); return; }
    const { error: saveError } = await supabase.from("user_skills").upsert({
      user_id: session.user.id,
      name: inspected.name,
      description: inspected.description,
      source_repo: inspected.source_repo,
      skill_path: inspected.skill_path,
      skill_md: inspected.skill_md,
      version: inspected.version,
      license: inspected.license,
      status: "review_required",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,source_repo,skill_path" });
    if (saveError) setError(saveError.message);
    else { setNotice("Skill saved to your library. It remains disabled pending your review."); setInspected(null); setUrl(""); await load(); }
    setBusy("");
  }

  async function setStatus(skill, status) {
    const supabase = getSupabase();
    setBusy(skill.id); setError("");
    const { error: updateError } = await supabase.from("user_skills")
      .update({ status, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", skill.id);
    if (updateError) setError(updateError.message);
    else await load();
    setBusy("");
  }

  async function remove(skill) {
    const supabase = getSupabase();
    setBusy(skill.id); setError("");
    const { error: deleteError } = await supabase.from("user_skills").delete().eq("id", skill.id);
    if (deleteError) setError(deleteError.message);
    else await load();
    setBusy("");
  }

  return (
    <section className="skill-library-section glass-surface" id="skills">
      <div className="section-head">
        <div>
          <div className="eyebrow"><span className="pulse" /> AGENT WORKFLOW LIBRARY</div>
          <h1>Skills, on your terms.</h1>
          <p>Find a Skill repository manually, inspect its SKILL.md, then save it to your private library. Nothing is auto-installed or executed.</p>
        </div>
      </div>

      <div className="skill-import-panel">
        <div className="skill-import-title">
          <span className="benefit-icon"><FileSearch size={18} /></span>
          <div><strong>Inspect a GitHub Skill</strong><small>Paste the raw URL to a SKILL.md file</small></div>
        </div>
        <div className="skill-url-row">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://raw.githubusercontent.com/owner/repo/main/path/SKILL.md" aria-label="Raw GitHub SKILL.md URL" />
          <button type="button" className="glass-add-button" onClick={inspect} disabled={busy === "inspect" || !url.trim()}>
            {busy === "inspect" ? <LoaderCircle className="spin" size={14} /> : <FileSearch size={14} />}
            <span>Inspect</span>
          </button>
        </div>
        <p className="availability-note">Manual source selection · GitHub raw files only · Maximum 250 KB · Agent Skills frontmatter required</p>
      </div>

      {error && <div className="skill-alert is-error"><ShieldAlert size={16} />{error}</div>}
      {notice && <div className="skill-alert is-success"><CheckCircle2 size={16} />{notice}</div>}

      {inspected && (
        <article className="skill-preview-card">
          <div className="skill-card-heading">
            <span className="highlight-icon"><BookOpen size={18} /></span>
            <div><small>INSPECTION RESULT</small><h3>{inspected.name}</h3></div>
            <span className="status is-remote">Valid metadata</span>
          </div>
          <p>{inspected.description}</p>
          <div className="skill-check-grid">
            <span><CheckCircle2 size={13} /> YAML frontmatter</span>
            <span><Code2 size={13} /> {inspected.checks.size_bytes.toLocaleString()} bytes</span>
            <span><ExternalLink size={13} /> {inspected.checks.external_urls} URLs</span>
            <span className={inspected.checks.scripts_detected ? "is-warning" : ""}><ShieldAlert size={13} /> {inspected.checks.scripts_detected ? "Possible command references" : "No obvious command references"}</span>
          </div>
          <div className="skill-preview-actions">
            <button type="button" className="glass-add-button" onClick={importSkill} disabled={busy === "import"}>{busy === "import" ? "Saving…" : "Save disabled"}</button>
            <button type="button" className="glass-chip-btn" onClick={() => setInspected(null)}>Cancel</button>
          </div>
          <details><summary>Review full SKILL.md</summary><pre className="skill-markdown-preview">{inspected.skill_md}</pre></details>
        </article>
      )}

      <div className="skill-library-heading">
        <div><div className="eyebrow"><span className="pulse" /> PRIVATE COLLECTION</div><h2>My Skills <span className="heading-period">.</span></h2></div>
        <button type="button" className="glass-icon-button" onClick={load} aria-label="Refresh Skills" disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={16}/></button>
      </div>
      {!signedIn ? (
        <div className="connection-empty"><div className="empty-orb"><BookOpen size={22}/></div><h3>Sign in to build your Skill Library</h3><p>Your imported Skills are private to your account.</p></div>
      ) : loading ? (
        <div className="connection-empty"><LoaderCircle className="spin" size={22}/><p>Loading your Skills…</p></div>
      ) : skills.length === 0 ? (
        <div className="connection-empty"><div className="empty-orb"><BookOpen size={22}/></div><h3>No Skills saved yet</h3><p>Search GitHub manually, inspect a SKILL.md, and save it here for review.</p></div>
      ) : (
        <div className="skill-list">
          {skills.map((skill) => (
            <article className="skill-saved-card" key={skill.id}>
              <div className="skill-saved-top">
                <span className="highlight-icon"><BookOpen size={17}/></span>
                <div className="skill-saved-copy"><h3>{skill.name}</h3><p>{skill.description}</p></div>
                <span className={`status ${skill.status === "enabled" ? "is-remote" : "is-promoted"}`}>{skill.status === "enabled" ? "Approved" : skill.status === "rejected" ? "Rejected" : "Review required"}</span>
              </div>
              <div className="skill-source-line"><a href={skill.source_repo} target="_blank" rel="noreferrer">{skill.source_repo.replace("https://github.com/","")} <ExternalLink size={11}/></a><span>{skill.license || "License not declared"}</span></div>
              <button type="button" className="skill-expand-button" onClick={() => setExpanded(expanded === skill.id ? "" : skill.id)}><span>Inspect contents</span><ChevronDown size={14}/></button>
              {expanded === skill.id && <pre className="skill-markdown-preview">{skill.skill_md}</pre>}
              <div className="skill-card-actions">
                {skill.status !== "enabled" && <button type="button" className="glass-add-button" onClick={() => setStatus(skill,"enabled")} disabled={busy === skill.id}><CheckCircle2 size={13}/><span>Approve Skill</span></button>}
                {skill.status === "enabled" && <button type="button" className="glass-chip-btn" onClick={() => setStatus(skill,"review_required")} disabled={busy === skill.id}>Disable approval</button>}
                <button type="button" className="glass-chip-btn" onClick={() => remove(skill)} disabled={busy === skill.id}><Trash2 size={13}/>Remove</button>
              </div>
              <small className="availability-note">Approval only. DRIVE does not execute scripts or load this Skill into an agent runtime yet.</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
