import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export const runtime = "nodejs";

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function authUser(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return { error: json({ error: "Authentication is not configured" }, 503) };
  if (!token) return { error: json({ error: "Sign in is required" }, 401) };
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error || !user ? { error: json({ error: "Invalid session" }, 401) } : { supabase, user };
}

async function audit(supabase, userId, entry) {
  const { error } = await supabase.from("skill_tool_audit_logs").insert({
    user_id: userId,
    binding_id: entry.binding_id || null,
    approval_id: entry.approval_id || null,
    tool_name: entry.tool_name,
    action: entry.action,
    outcome: entry.outcome,
    details: entry.details || {},
  });
  return error;
}

export async function GET(request) {
  const auth = await authUser(request);
  if (auth.error) return auth.error;
  const { data, error } = await auth.supabase.from("skill_execution_approvals")
    .select("id,binding_id,tool_name,arguments,status,requested_at,expires_at,reviewed_at,executed_at,result_summary")
    .eq("user_id", auth.user.id)
    .order("requested_at", { ascending: false })
    .limit(100);
  if (error) return json({ error: "Could not load approval queue" }, 400);
  const { data: logs, error: logError } = await auth.supabase.from("skill_tool_audit_logs")
    .select("id,binding_id,approval_id,tool_name,action,outcome,details,created_at")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  if (logError) return json({ error: "Could not load Skill audit log" }, 400);
  return json({ approvals: data || [], auditLogs: logs || [] });
}

export async function POST(request) {
  const auth = await authUser(request);
  if (auth.error) return auth.error;
  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }

  if (body.action === "request") {
    const { bindingId, toolName, arguments: args = {} } = body;
    if (typeof bindingId !== "string" || typeof toolName !== "string" || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(toolName)) {
      return json({ error: "Valid bindingId and toolName are required" }, 400);
    }
    if (!args || typeof args !== "object" || Array.isArray(args) || JSON.stringify(args).length > 20000) {
      return json({ error: "Tool arguments must be a JSON object under 20 KB" }, 400);
    }
    const { data: binding, error: bindingError } = await auth.supabase.from("mcp_skill_bindings")
      .select("id,skill_id,connection_id,allowed_tools,enabled,requires_approval")
      .eq("id", bindingId).eq("user_id", auth.user.id).maybeSingle();
    if (bindingError || !binding) return json({ error: "Skill binding not found" }, 404);
    if (!binding.enabled) {
      await audit(auth.supabase, auth.user.id, { binding_id: binding.id, tool_name: toolName, action: "blocked", outcome: "blocked", details: { reason: "binding_disabled" } });
      return json({ error: "This Skill binding is disabled" }, 403);
    }
    if (!(binding.allowed_tools || []).includes(toolName)) {
      await audit(auth.supabase, auth.user.id, { binding_id: binding.id, tool_name: toolName, action: "blocked", outcome: "blocked", details: { reason: "tool_not_allowlisted" } });
      return json({ error: "This tool is not in the Skill allowlist" }, 403);
    }
    const { data: skill } = await auth.supabase.from("user_skills").select("id,status,security_scan_status,security_scan_hash,skill_md")
      .eq("id", binding.skill_id).eq("user_id", auth.user.id).maybeSingle();
    if (!skill || skill.status !== "enabled") return json({ error: "Skill must be reviewed and enabled first" }, 403);
    const currentHash = createHash("sha256").update(skill.skill_md || "").digest("hex");
    if (skill.security_scan_status !== "safe" || !skill.security_scan_hash || currentHash !== skill.security_scan_hash) {
      return json({ error: "Skill security scan is missing, stale, or not SAFE. Re-scan before requesting tools." }, 403);
    }

    const { data: approval, error } = await auth.supabase.from("skill_execution_approvals").insert({
      user_id: auth.user.id,
      binding_id: binding.id,
      tool_name: toolName,
      arguments: args,
      status: "pending",
      expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    }).select("id,binding_id,tool_name,status,requested_at,expires_at").single();
    if (error) return json({ error: "Could not create approval request" }, 400);
    await audit(auth.supabase, auth.user.id, { binding_id: binding.id, approval_id: approval.id, tool_name: toolName, action: "request", outcome: "pending", details: { approval_expires_at: approval.expires_at } });
    return json({ approval }, 201);
  }

  if (body.action === "review") {
    const { approvalId, decision } = body;
    if (typeof approvalId !== "string" || !["approved", "denied"].includes(decision)) {
      return json({ error: "approvalId and approved/denied decision are required" }, 400);
    }
    const { data: approval, error: loadError } = await auth.supabase.from("skill_execution_approvals")
      .select("id,binding_id,tool_name,status,expires_at")
      .eq("id", approvalId).eq("user_id", auth.user.id).maybeSingle();
    if (loadError || !approval) return json({ error: "Approval request not found" }, 404);
    if (approval.status !== "pending") return json({ error: "This approval request has already been reviewed" }, 409);
    if (new Date(approval.expires_at).getTime() <= Date.now()) {
      await auth.supabase.from("skill_execution_approvals").update({ status: "expired", reviewed_at: new Date().toISOString() }).eq("id", approval.id).eq("status", "pending");
      await audit(auth.supabase, auth.user.id, { binding_id: approval.binding_id, approval_id: approval.id, tool_name: approval.tool_name, action: "expire", outcome: "denied", details: { reason: "approval_timeout" } });
      return json({ error: "Approval request expired. Create a new request." }, 410);
    }
    const { data: updated, error } = await auth.supabase.from("skill_execution_approvals")
      .update({ status: decision, reviewed_at: new Date().toISOString() })
      .eq("id", approval.id).eq("user_id", auth.user.id).eq("status", "pending")
      .select("id,status,reviewed_at").maybeSingle();
    if (error || !updated) return json({ error: "Approval state changed. Refresh the queue." }, 409);
    await audit(auth.supabase, auth.user.id, { binding_id: approval.binding_id, approval_id: approval.id, tool_name: approval.tool_name, action: decision === "approved" ? "approve" : "deny", outcome: decision === "approved" ? "allowed" : "denied" });
    return json({ approval: updated });
  }

  return json({ error: "Unsupported action" }, 400);
}
