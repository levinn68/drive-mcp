"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { BookOpen, CheckCircle2, ChevronDown, Code2, ExternalLink, FileSearch, LoaderCircle, RefreshCw, Search, ShieldAlert, ChevronRight, Trash2 } from "lucide-react";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [repositories, setRepositories] = useState([]);
  const [repositoryDetails, setRepositoryDetails] = useState({});
  const [searching, setSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState("");
  const [connections, setConnections] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [bindingChoice, setBindingChoice] = useState({});
  const [bindingDrafts, setBindingDrafts] = useState({});

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
    const { data: bindingRows, error: bindingError } = await supabase.from("mcp_skill_bindings")
      .select("id,skill_id,connection_id,allowed_tools,enabled,requires_approval");
    if (bindingError) setError(bindingError.message);
    else setBindings(bindingRows || []);
    const token = session.access_token;
    const connectionResponse = await fetch("/api/connections", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const connectionData = await connectionResponse.json();
    if (connectionResponse.ok) setConnections(connectionData.connections || []);
    else setError(connectionData.error || "Could not load MCP connections");
    setLoading(false);
  }, []);

  // Initial data loading synchronizes this component with Supabase on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  async function searchRepositories() {
    setSearching(true); setSearchMessage(""); setError("");
    try {
      const response = await fetch(`/api/skills/discover?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Repository search failed");
      setRepositories(data.items || []);
      setSearchMessage(data.total_count ? `Showing ${data.items.length} repositories from ${data.total_count.toLocaleString()} matches. Choose one to inspect its Skill files.` : "No repositories matched this search.");
    } catch (e) { setError(e.message || "Repository search failed"); setRepositories([]); }
    finally { setSearching(false); }
  }

  async function inspectRepository(repository) {
    setRepositoryDetails((current) => ({ ...current, [repository.full_name]: { loading: true, skills: [] } }));
    setError("");
    try {
      const [owner, repo] = repository.full_name.split("/");
      const response = await fetch(`/api/skills/repository?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(repository.default_branch || "")}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not inspect repository");
      setRepositoryDetails((current) => ({ ...current, [repository.full_name]: { ...data, loading: false } }));
    } catch (e) {
      setRepositoryDetails((current) => ({ ...current, [repository.full_name]: { loading: false, error: e.message, skills: [] } }));
    }
  }

  async function selectSkillFile(skillFile) {
    setUrl(skillFile.raw_url);
    setBusy("inspect"); setError(""); setNotice(""); setInspected(null);
    try {
      const response = await fetch("/api/skills/inspect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: skillFile.raw_url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Skill inspection failed");
      setInspected(data);
    } catch (e) { setError(e.message || "Could not inspect selected Skill"); }
    finally { setBusy(""); }
  }

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

  async function attachConnection(skill) {
    const connectionId = bindingChoice[skill.id];
    if (!connectionId) { setError("Choose an MCP connection first."); return; }
    if (skill.status !== "enabled") { setError("Approve this Skill after reviewing it before creating a binding."); return; }
    setBusy(`bind:${skill.id}`); setError(""); setNotice("");
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Sign in before creating a binding."); setBusy(""); return; }
    const { error: saveError } = await supabase.from("mcp_skill_bindings").upsert({
      user_id: session.user.id,
      skill_id: skill.id,
      connection_id: connectionId,
      allowed_tools: [],
      enabled: false,
      requires_approval: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,skill_id,connection_id" });
    if (saveError) setError(saveError.message);
    else { setNotice("MCP linked to this Skill. Binding remains disabled until tool permissions are configured."); await load(); }
    setBusy("");
  }

  async function saveBindingPolicy(binding) {
    const raw = bindingDrafts[binding.id] ?? (binding.allowed_tools || []).join("\\n");
    const tools = [...new Set(raw.split(/[\\n,]/).map((name) => name.trim()).filter(Boolean))];
    if (tools.some((name) => !/^[a-zA-Z0-9_.:-]{1,128}$/.test(name))) {
      setError("Tool names may only contain letters, numbers, underscore, dot, colon, and hyphen.");
      return;
    }
    if (tools.length > 100) { setError("A binding can contain at most 100 allowed tool names."); return; }
    const supabase = getSupabase();
    setBusy(`policy:${binding.id}`); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("mcp_skill_bindings")
      .update({ allowed_tools: tools, enabled: false, requires_approval: true, updated_at: new Date().toISOString() })
      .eq("id", binding.id);
    if (updateError) setError(updateError.message);
    else { setNotice("Tool allowlist saved as a staged policy. Runtime execution remains disabled."); await load(); }
    setBusy("");
  }

  async function removeBinding(binding) {
    const supabase = getSupabase();
    setBusy(`unbind:${binding.id}`); setError("");
    const { error: deleteError } = await supabase.from("mcp_skill_bindings").delete().eq("id", binding.id);
    if (deleteError) setError(deleteError.message);
    else await load();
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
          <span className="benefit-icon"><Search size={18} /></span>
          <div><strong>Discover Skill repositories</strong><small>Search GitHub manually. You choose every repository and Skill.</small></div>
        </div>
        <form className="skill-url-row" onSubmit={(event) => { event.preventDefault(); searchRepositories(); }}>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="e.g. browser automation agent skills" aria-label="Search GitHub Skill repositories" />
          <button type="submit" className="glass-add-button" disabled={searching || searchQuery.trim().length < 2}>
            {searching ? <LoaderCircle className="spin" size={14} /> : <Search size={14} />}
            <span>Search GitHub</span>
          </button>
        </form>
        <p className="availability-note">Public GitHub repository search · Results are candidates, not endorsements · No auto-import</p>
        {searchMessage && <p className="availability-note">{searchMessage}</p>}
        {repositories.length > 0 && (
          <div className="skill-repository-list">
            {repositories.map((repository) => {
              const detail = repositoryDetails[repository.full_name];
              return (
                <article className="skill-repository-card" key={repository.full_name}>
                  <div className="skill-repository-main">
                    <div className="skill-repository-copy">
                      <strong>{repository.full_name}</strong>
                      <p>{repository.description || "No repository description provided."}</p>
                      <small>{repository.stars.toLocaleString()} stars · {repository.license || "License not declared"} · {repository.language || "Language not specified"}</small>
                    </div>
                    <button type="button" className="glass-chip-btn" onClick={() => inspectRepository(repository)} disabled={detail?.loading}>
                      {detail?.loading ? <LoaderCircle className="spin" size={13}/> : <FileSearch size={13}/>}
                      <span>Inspect</span>
                    </button>
                  </div>
                  {detail?.error && <p className="skill-inline-error">{detail.error}</p>}
                  {detail && !detail.loading && !detail.error && (
                    <div className="skill-repository-files">
                      <div className="skill-repository-meta">{detail.skills.length} SKILL.md file{detail.skills.length === 1 ? "" : "s"} found · branch {detail.branch}{detail.truncated ? " · tree truncated" : ""}</div>
                      {detail.skills.length === 0 ? <p className="availability-note">No SKILL.md files found in this repository tree.</p> : detail.skills.map((file) => (
                        <button type="button" className="skill-file-row" key={file.path} onClick={() => selectSkillFile(file)} disabled={busy === "inspect"}>
                          <span><BookOpen size={14}/>{file.path}<small>{file.size.toLocaleString()} bytes</small></span>
                          <ChevronRight size={15}/>
                        </button>
                      ))}
                      <a className="skill-repo-link" href={detail.html_url} target="_blank" rel="noreferrer">Open repository <ExternalLink size={11}/></a>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className="skill-import-panel">
        <div className="skill-import-title">
          <span className="benefit-icon"><FileSearch size={18} /></span>
          <div><strong>Inspect a direct SKILL.md URL</strong><small>Or paste a raw GitHub URL manually</small></div>
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
          <div className={`skill-risk-banner risk-${inspected.checks.risk_level}`}>
            <ShieldAlert size={16}/>
            <span><strong>{inspected.checks.risk_level === "high" ? "High-risk patterns found" : inspected.checks.risk_level === "review" ? "Manual review recommended" : "No obvious patterns detected"}</strong><small>{inspected.disclaimer}</small></span>
          </div>
          <div className="skill-check-grid">
            <span><CheckCircle2 size={13} /> YAML frontmatter</span>
            <span><Code2 size={13} /> {inspected.checks.size_bytes.toLocaleString()} bytes</span>
            <span><ExternalLink size={13} /> {inspected.checks.external_urls} URLs · {inspected.checks.external_hosts.length} hosts</span>
            <span className={inspected.checks.scripts_detected ? "is-warning" : ""}><ShieldAlert size={13} /> {inspected.checks.scripts_detected ? "Script execution patterns" : "No shell patterns detected"}</span>
          </div>
          {inspected.checks.findings.length > 0 && (
            <div className="skill-findings-list">
              <strong>Findings to review</strong>
              {inspected.checks.findings.map((finding) => <div key={finding.id}><span>{finding.label}</span><small>{finding.severity}</small></div>)}
            </div>
          )}
          {inspected.checks.external_hosts.length > 0 && <p className="availability-note">External hosts: {inspected.checks.external_hosts.join(", ")}</p>}
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
              <div className="skill-binding-panel">
                <div className="skill-binding-heading"><strong>Connect an MCP</strong><small>{bindings.filter((binding) => binding.skill_id === skill.id).length} linked</small></div>
                {connections.length === 0 ? <p className="availability-note">Add a remote MCP connection in the Add tab before linking it here.</p> : (
                  <div className="skill-binding-row">
                    <select aria-label={`Select MCP for ${skill.name}`} value={bindingChoice[skill.id] || ""} onChange={(event) => setBindingChoice((current) => ({ ...current, [skill.id]: event.target.value }))}>
                      <option value="">Choose your MCP connection…</option>
                      {connections.map((connection) => <option key={connection.id} value={connection.id}>{connection.server?.title || connection.server?.display_name || connection.server?.server_name || connection.server?.endpoint_url || "MCP connection"}{connection.enabled ? " · Active" : " · Off"}</option>)}
                    </select>
                    <button type="button" className="glass-chip-btn" onClick={() => attachConnection(skill)} disabled={busy === `bind:${skill.id}` || skill.status !== "enabled"}>Link</button>
                  </div>
                )}
                {bindings.filter((binding) => binding.skill_id === skill.id).map((binding) => {
                  const connection = connections.find((item) => item.id === binding.connection_id);
                  return <div className="skill-binding-existing" key={binding.id}>
                    <span><strong>{connection?.server?.title || connection?.server?.display_name || connection?.server?.server_name || "Connected MCP"}</strong><small>{binding.enabled ? "Enabled" : "Linked · Disabled"} · {binding.allowed_tools?.length || 0} tools allowed · Approval required</small></span>
                    <button type="button" className="glass-chip-btn" onClick={() => removeBinding(binding)} disabled={busy === `unbind:${binding.id}`}>Unlink</button>
                    <div className="skill-policy-editor">
                      <label htmlFor={`tools-${binding.id}`}>Allowed tool names, one per line</label>
                      <textarea id={`tools-${binding.id}`} rows={3} value={bindingDrafts[binding.id] ?? (binding.allowed_tools || []).join("\\n")} onChange={(event) => setBindingDrafts((current) => ({ ...current, [binding.id]: event.target.value }))} placeholder={"github.search_repositories\\ngithub.get_file"} />
                      <div className="skill-policy-actions">
                        <small>Allowlist metadata only · execution disabled · approval required</small>
                        <button type="button" className="glass-chip-btn" onClick={() => saveBindingPolicy(binding)} disabled={busy === `policy:${binding.id}`}>Save allowlist</button>
                      </div>
                    </div>
                  </div>;
                })}
              </div>
              <small className="availability-note">Approval does not execute the Skill. New bindings are always disabled and have no allowed tools until a permission manager is configured.</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
