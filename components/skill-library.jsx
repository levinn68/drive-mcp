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
  const [catalogPage, setCatalogPage] = useState(0);
  const [connections, setConnections] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [bindingChoice, setBindingChoice] = useState({});
  const [bindingDrafts, setBindingDrafts] = useState({});
  const [discoveredTools, setDiscoveredTools] = useState({});
  const [discoveringConnection, setDiscoveringConnection] = useState("");
  const [approvals, setApprovals] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [runtimeTasks, setRuntimeTasks] = useState({});
  const [runtimeContexts, setRuntimeContexts] = useState({});
  const [runtimeToolArgs, setRuntimeToolArgs] = useState({});

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
    const approvalResponse = await fetch("/api/skills/approvals", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    const approvalData = await approvalResponse.json();
    if (approvalResponse.ok) { setApprovals(approvalData.approvals || []); setAuditLogs(approvalData.auditLogs || []); }
    else setError(approvalData.error || "Could not load approval queue");
    setLoading(false);
  }, []);

  // Initial data loading synchronizes this component with Supabase on mount.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    let active = true;
    (async () => {
      setSearching(true);
      try {
        const response = await fetch("/api/catalog/skills", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Skills catalog unavailable");
        if (!active) return;
        setCatalogPage(0);\n      setCatalogPage(0);\n      setRepositories((data.items || []).map((item) => ({
          id: item.id, full_name: item.source, description: item.description || item.name,
          html_url: item.installUrl || `https://github.com/${item.source}`,
          default_branch: "main", stars: item.installs || 0,
          license: item.duplicate ? "Possible duplicate" : "Catalog entry",
          language: "Agent Skill", catalogSkill: item,
        })));
        setSearchMessage(`Loaded ${data.count || 0} Skills from the public Skills Directory. Select any entry to inspect its bundle.`);
      } catch (e) { if (active) setSearchMessage(e.message || "Skills catalog unavailable"); }
      finally { if (active) setSearching(false); }
    })();
    return () => { active = false; };
  }, []);

  async function searchRepositories() {
    setSearching(true); setSearchMessage(""); setError("");
    try {
      const response = await fetch(`/api/catalog/skills?q=${encodeURIComponent(searchQuery)}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Skills catalog search failed");
      setRepositories((data.items || []).map((item) => ({
        id: item.id, full_name: item.source, description: item.description || item.name,
        html_url: item.installUrl || `https://github.com/${item.source}`,
        default_branch: "main", stars: item.installs || 0,
        license: item.duplicate ? "Possible duplicate" : "Catalog entry",
        language: "Agent Skill", catalogSkill: item,
      })));
      setSearchMessage(`Showing ${data.count || 0} catalog Skills from the public Skills Directory. Select one to inspect its source bundle with NVIDIA SkillSpector.`);
    } catch (e) { setError(e.message || "Repository search failed"); setRepositories([]); }
    finally { setSearching(false); }
  }

  async function inspectRepository(repository) {
    setRepositoryDetails((current) => ({ ...current, [repository.id || repository.full_name]: { loading: true, skills: [] } }));
    setError("");
    try {
      const [owner, repo] = repository.full_name.split("/");
      const response = await fetch(`/api/skills/repository?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(repository.default_branch || "")}&skill=${encodeURIComponent(repository.catalogSkill?.slug || "")}&skillName=${encodeURIComponent(repository.catalogSkill?.name || "")}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not inspect repository");
      setRepositoryDetails((current) => ({ ...current, [repository.id || repository.full_name]: { ...data, loading: false } }));
    } catch (e) {
      setRepositoryDetails((current) => ({ ...current, [repository.id || repository.full_name]: { loading: false, error: e.message, skills: [] } }));
    }
  }

  async function selectSkillFile(skillFile) {
    setUrl(skillFile.raw_url);
    setBusy("inspect"); setError(""); setNotice(""); setInspected(null);
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in before scanning a Skill.");
      const response = await fetch("/api/skills/inspect", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
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
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in before scanning a Skill.");
      const response = await fetch("/api/skills/inspect", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Inspection failed");
      setInspected(data);
    } catch (e) { setError(e.message || "Could not inspect Skill"); }
    finally { setBusy(""); }
  }

  async function importSkill() {
    if (!inspected?.scan?.safe_to_install || !inspected.scan.complete || !inspected.scan.content_sha256 || !inspected.scan.bundle_sha256 || !Array.isArray(inspected.scan.bundle_manifest)) {
      setError("A complete NVIDIA SkillSpector SAFE verdict is required before importing.");
      return;
    }
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
      security_scan: inspected.scan,
      security_scan_hash: inspected.scan.content_sha256,
      security_bundle_hash: inspected.scan.bundle_sha256,
      security_bundle_manifest: inspected.scan.bundle_manifest,
      security_scan_status: "safe",
      security_scanned_at: inspected.scan.scanned_at,
      security_scanner_version: inspected.scan.scanner_version,
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

  async function requestRuntimeToolApproval(bindingId, toolName, skillId, overrideArgs) {
    const key = `${skillId}:${toolName}`;
    const raw = overrideArgs === undefined ? (runtimeToolArgs[key] || "{}") : JSON.stringify(overrideArgs);
    let args;
    try { args = JSON.parse(raw); } catch { setError(`Arguments for ${toolName} must be valid JSON.`); return; }
    if (!args || typeof args !== "object" || Array.isArray(args)) { setError("Tool arguments must be a JSON object."); return; }
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Sign in before requesting approval."); return; }
    setBusy(`request:${key}`); setError(""); setNotice("");
    try {
      const response = await fetch("/api/skills/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "request", bindingId, toolName, arguments: args }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not request tool approval");
      setNotice(`Approval requested for ${toolName}. Review it in Execution approvals.`);
      await load();
    } catch (e) { setError(e.message || "Could not request tool approval"); }
    finally { setBusy(""); }
  }

  async function prepareSkillRuntime(skill) {
    const task = (runtimeTasks[skill.id] || "").trim();
    if (!task) { setError("Describe the task before preparing the Skill runtime."); return; }
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Sign in before preparing the runtime."); return; }
    setBusy(`runtime:${skill.id}`); setError(""); setNotice("");
    try {
      const response = await fetch("/api/skills/runtime", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ skillId: skill.id, task }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not prepare Skill runtime");
      setRuntimeContexts((current) => ({ ...current, [skill.id]: data }));
      setNotice("Skill runtime context prepared. No model has been called and no tool has been executed.");
    } catch (e) { setError(e.message || "Could not prepare Skill runtime"); }
    finally { setBusy(""); }
  }

  async function executeApproval(approvalId) {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Sign in to execute this request."); return; }
    setBusy(`execute:${approvalId}`); setError(""); setNotice("");
    try {
      const response = await fetch("/api/skills/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ approvalId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.error || "Tool execution failed");
      setNotice(data.executed ? "MCP tool executed successfully." : "MCP tool returned an error.");
      await load();
    } catch (e) { setError(e.message || "Tool execution failed"); await load(); }
    finally { setBusy(""); }
  }

  async function reviewApproval(approvalId, decision) {
    const supabase = getSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError("Sign in to review this request."); return; }
    setBusy(`approval:${approvalId}`); setError(""); setNotice("");
    try {
      const response = await fetch("/api/skills/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "review", approvalId, decision }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not review approval");
      setNotice(decision === "approved" ? "Approval recorded. Tool execution is a separate step." : "Request denied.");
      await load();
    } catch (e) { setError(e.message || "Could not review approval"); }
    finally { setBusy(""); }
  }

  async function discoverMcpTools(connectionId) {
    setDiscoveringConnection(connectionId); setError(""); setNotice("");
    try {
      const supabase = getSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sign in before discovering MCP tools.");
      const response = await fetch("/api/skills/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ connectionId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "MCP tool discovery failed");
      setDiscoveredTools((current) => ({ ...current, [connectionId]: data }));
      setNotice(`Discovered ${data.total} MCP tools. Select only the tools this Skill needs.`);
    } catch (e) { setError(e.message || "MCP tool discovery failed"); }
    finally { setDiscoveringConnection(""); }
  }

  function toggleAllowedTool(binding, toolName, checked) {
    const current = bindingDrafts[binding.id] ?? (binding.allowed_tools || []).join("\n");
    const selected = new Set(current.split(/[\n,]/).map((name) => name.trim()).filter(Boolean));
    if (checked) selected.add(toolName); else selected.delete(toolName);
    setBindingDrafts((state) => ({ ...state, [binding.id]: [...selected].join("\n") }));
  }

  async function setBindingEnabled(binding, skill, enabled) {
    const connection = connections.find((item) => item.id === binding.connection_id);
    if (enabled && skill.status !== "enabled") { setError("Approve the Skill before enabling its MCP binding."); return; }
    if (enabled && !connection?.enabled) { setError("Enable this MCP connection in your workspace before enabling the binding."); return; }
    if (enabled && !(binding.allowed_tools || []).length) { setError("Discover and save at least one allowed tool before enabling this binding."); return; }
    const supabase = getSupabase();
    setBusy(`binding-state:${binding.id}`); setError(""); setNotice("");
    const { error: updateError } = await supabase.from("mcp_skill_bindings")
      .update({ enabled, requires_approval: true, updated_at: new Date().toISOString() }).eq("id", binding.id);
    if (updateError) setError(updateError.message);
    else { setNotice(enabled ? "Skill binding enabled. Every tool call still requires approval." : "Skill binding disabled."); await load(); }
    setBusy("");
  }

  async function saveBindingPolicy(binding) {
    const raw = bindingDrafts[binding.id] ?? (binding.allowed_tools || []).join("\n");
    const tools = [...new Set(raw.split(/[\n,]/).map((name) => name.trim()).filter(Boolean))];
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
          <div><strong>Discover Skill repositories</strong><small>Browse 1,000 Agent Skills from the live catalog. Every selected bundle is scanned before import.</small></div>
        </div>
        <form className="skill-url-row" onSubmit={(event) => { event.preventDefault(); searchRepositories(); }}>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search 1,000 Skills by name or topic" aria-label="Search Skills catalog" />
          <button type="submit" className="glass-add-button" disabled={searching || searchQuery.trim().length < 2}>
            {searching ? <LoaderCircle className="spin" size={14} /> : <Search size={14} />}
            <span>Search Skills</span>
          </button>
        </form>
        <p className="availability-note">skills.sh catalog · Install counts are discovery signals, not trust scores · NVIDIA SkillSpector scans selected bundles</p>
        {searchMessage && <p className="availability-note">{searchMessage}</p>}
        {repositories.length > 0 && (
          <div className="skill-repository-list">
            {repositories.slice(catalogPage * 20, (catalogPage + 1) * 20).map((repository) => {
              const detail = repositoryDetails[repository.id || repository.full_name];
              return (
                <article className="skill-repository-card" key={repository.id || repository.full_name}>
                  <div className="skill-repository-main">
                    <div className="skill-repository-copy">
                      <strong>{repository.catalogSkill?.name || repository.full_name}</strong>
                      <p>{repository.catalogSkill ? `Source: ${repository.full_name} · ${repository.catalogSkill?.category || "other"}` : (repository.description || "No repository description provided.")}</p>
                      <small>{repository.stars.toLocaleString()} installs · {repository.license || "License not declared"} · {repository.language || "Language not specified"}</small>
                    </div>
                    <button type="button" className="glass-chip-btn" onClick={() => inspectRepository(repository)} disabled={detail?.loading}>
                      {detail?.loading ? <LoaderCircle className="spin" size={13}/> : <FileSearch size={13}/>}
                      <span>Inspect Skill</span>
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
        {repositories.length > 20 && (
          <div className="load-more-row">
            <button type="button" className="glass-chip-btn" onClick={() => setCatalogPage((page) => Math.max(0, page - 1))} disabled={catalogPage === 0}>Previous</button>
            <span>Page {catalogPage + 1} of {Math.ceil(repositories.length / 20)} · {repositories.length.toLocaleString()} Skills</span>
            <button type="button" className="glass-add-button" onClick={() => setCatalogPage((page) => Math.min(Math.ceil(repositories.length / 20) - 1, page + 1))} disabled={(catalogPage + 1) * 20 >= repositories.length}>Next</button>
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

      {signedIn && (
        <div className="skill-import-panel skill-approval-panel">
          <div className="skill-import-title">
            <span className="benefit-icon"><ShieldAlert size={18}/></span>
            <div><strong>Execution approvals</strong><small>Review requests before any connected tool can run</small></div>
            <span className="skill-approval-count">{approvals.filter((item) => item.status === "pending" && new Date(item.expires_at).getTime() > Date.now()).length} pending</span>
          </div>
          {approvals.filter((item) => item.status === "pending").length === 0 ? <p className="availability-note">No pending approval requests.</p> : approvals.filter((item) => item.status === "pending").map((item) => (
            <div className="skill-approval-row" key={item.id}>
              <div><strong>{item.tool_name}</strong><small>Expires {new Date(item.expires_at).toLocaleString()}</small><pre>{JSON.stringify(item.arguments, null, 2)}</pre></div>
              <div className="skill-approval-actions">
                <button type="button" className="glass-chip-btn" onClick={() => reviewApproval(item.id, "denied")} disabled={busy === `approval:${item.id}`}>Deny</button>
                <button type="button" className="glass-add-button" onClick={() => reviewApproval(item.id, "approved")} disabled={busy === `approval:${item.id}`}>Approve</button>
              </div>
            </div>
          ))}
          {approvals.filter((item) => item.status === "approved").map((item) => (
            <div className="skill-approval-row" key={item.id}>
              <div><strong>{item.tool_name}</strong><small>Approved · expires {new Date(item.expires_at).toLocaleString()}</small><pre>{JSON.stringify(item.arguments, null, 2)}</pre></div>
              <div className="skill-approval-actions">
                <button type="button" className="glass-add-button" onClick={() => executeApproval(item.id)} disabled={busy === `execute:${item.id}`}>{busy === `execute:${item.id}` ? <LoaderCircle className="spin" size={13}/> : <Code2 size={13}/>} Execute once</button>
              </div>
            </div>
          ))}
          <div className="skill-audit-heading"><strong>Recent tool activity</strong><small>Latest 100 events</small></div>
          {auditLogs.length === 0 ? <p className="availability-note">No tool activity recorded yet.</p> : auditLogs.slice(0,12).map((item) => (
            <div className="skill-audit-row" key={item.id}>
              <span><strong>{item.tool_name}</strong><small>{item.action} · {item.outcome}</small></span>
              <time>{new Date(item.created_at).toLocaleString()}</time>
            </div>
          ))}
        </div>
      )}

      {inspected && (
        <article className="skill-preview-card">
          <div className="skill-card-heading">
            <span className="highlight-icon"><BookOpen size={18} /></span>
            <div><small>INSPECTION RESULT</small><h3>{inspected.name}</h3></div>
            <span className="status is-remote">SkillSpector SAFE</span>
          </div>
          <p>{inspected.description}</p>
          <div className="skill-check-grid">
            <span><ShieldAlert size={13}/> NVIDIA SkillSpector {inspected.scan.scanner_version}</span>
            <span><CheckCircle2 size={13}/> Verdict: {inspected.scan.recommendation}</span>
            <span>Risk score: {inspected.scan.risk_score ?? "Not reported"}/100</span>
            <span>Mode: {inspected.scan.scan_mode}</span>
          </div>
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
        <div className="connection-empty"><div className="empty-orb"><BookOpen size={22}/></div><h3>No Skills saved yet</h3><p>Browse the Skills marketplace, inspect a selected bundle, and save it here for review.</p></div>
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
              {skill.status === "enabled" && (
                <div className="skill-runtime-panel">
                  <div className="skill-binding-heading"><strong>Prepare agent runtime</strong><small>Context only · no execution</small></div>
                  <textarea value={runtimeTasks[skill.id] || ""} onChange={(event) => setRuntimeTasks((current) => ({ ...current, [skill.id]: event.target.value }))} rows={2} maxLength={4000} placeholder="Describe the outcome you want this Skill to help with…" aria-label={`Task for ${skill.name}`} />
                  <button type="button" className="glass-add-button" onClick={() => prepareSkillRuntime(skill)} disabled={busy === `runtime:${skill.id}` || !runtimeTasks[skill.id]?.trim()}>
                    {busy === `runtime:${skill.id}` ? <LoaderCircle className="spin" size={13}/> : <Code2 size={13}/>}
                    Prepare runtime context
                  </button>
                  {runtimeContexts[skill.id] && (
                    <div className="skill-runtime-result">
                      <div className="skill-runtime-meta"><strong>Context prepared</strong><span>{runtimeContexts[skill.id].sources.reduce((n, source) => n + (source.tools?.length || 0), 0)} allowed tools available</span></div>
                      {runtimeContexts[skill.id].sources.map((source) => (
                        <div className="skill-runtime-source" key={source.bindingId}>
                          {source.unavailable ? <small>{source.unavailable}</small> : <>
                            <strong>{source.tools.length} tools · approval required</strong>
                            {source.tools.map((tool) => {
                              const key = `${skill.id}:${tool.name}`;
                              return <div className="skill-runtime-tool" key={tool.name}>
                                <div><strong>{tool.name}</strong><small>{tool.description || "No description supplied."}</small></div>
                                <details><summary>Input schema</summary><pre>{JSON.stringify(tool.inputSchema, null, 2)}</pre></details>
                                <textarea rows={2} value={runtimeToolArgs[key] || "{}"} onChange={(event) => setRuntimeToolArgs((current) => ({ ...current, [key]: event.target.value }))} aria-label={`Arguments for ${tool.name}`} placeholder='{"key":"value"}' />
                                <button type="button" className="glass-chip-btn" onClick={() => requestRuntimeToolApproval(source.bindingId, tool.name, skill.id)} disabled={busy === `request:${key}`}>{busy === `request:${key}` ? "Requesting…" : "Request approval"}</button>
                              </div>;
                            })}
                          </>}
                        </div>
                      ))}
                      <details><summary>Inspect prepared Skill instructions and policy</summary><pre>{JSON.stringify({ skill: runtimeContexts[skill.id].skill, task: runtimeContexts[skill.id].task, instructionTrust: runtimeContexts[skill.id].instructionTrust, policy: runtimeContexts[skill.id].policy, skillInstructions: runtimeContexts[skill.id].skillInstructions }, null, 2)}</pre></details>
                    </div>
                  )}
                </div>
              )}
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
                    <div className="skill-binding-controls">
                      <button type="button" className={binding.enabled ? "glass-chip-btn" : "glass-add-button"} onClick={() => setBindingEnabled(binding, skill, !binding.enabled)} disabled={busy === `binding-state:${binding.id}`}>
                        {binding.enabled ? "Disable binding" : "Enable binding"}
                      </button>
                      <button type="button" className="glass-chip-btn" onClick={() => removeBinding(binding)} disabled={busy === `unbind:${binding.id}`}>Unlink</button>
                    </div>
<div className="skill-policy-editor">
                      <div className="skill-policy-discovery-head">
                        <label>Available MCP tools</label>
                        <button type="button" className="glass-chip-btn" onClick={() => discoverMcpTools(binding.connection_id)} disabled={discoveringConnection === binding.connection_id}>
                          {discoveringConnection === binding.connection_id ? <LoaderCircle className="spin" size={12}/> : <Search size={12}/>}
                          {discoveringConnection === binding.connection_id ? "Discovering…" : "Discover tools"}
                        </button>
                      </div>
                      {discoveredTools[binding.connection_id] ? (
                        <div className="skill-tool-picker">
                          <small>{discoveredTools[binding.connection_id].total} tools reported by server{discoveredTools[binding.connection_id].truncated ? " · showing first 200" : ""}</small>
                          {discoveredTools[binding.connection_id].tools.map((tool) => {
                            const selected = (bindingDrafts[binding.id] ?? (binding.allowed_tools || []).join("\n")).split(/[\n,]/).map((name) => name.trim()).includes(tool.name);
                            return <label className="skill-tool-option" key={tool.name}>
                              <input type="checkbox" checked={selected} onChange={(event) => toggleAllowedTool(binding, tool.name, event.target.checked)} />
                              <span><strong>{tool.name}</strong><small>{tool.description || "No description provided by server."}</small></span>
                            </label>;
                          })}
                        </div>
                      ) : <p className="availability-note">Discover tools from this MCP endpoint to choose them from a list.</p>}
                      <label htmlFor={`tools-${binding.id}`}>Allowed tool names, one per line</label>
                      <textarea id={`tools-${binding.id}`} rows={3} value={bindingDrafts[binding.id] ?? (binding.allowed_tools || []).join("\n")} onChange={(event) => setBindingDrafts((current) => ({ ...current, [binding.id]: event.target.value }))} placeholder={"server.tool_name"} />
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
