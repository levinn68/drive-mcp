import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB max upload
const MAX_EXTRACTED_FILES = 25;

function json(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

async function getUserClient(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key) return { error: json({ error: "Authentication is not configured" }, 503) };
  if (!token) return { error: json({ error: "Sign in is required to upload Skills" }, 401) };
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return { error: json({ error: "Invalid or expired session" }, 401) };
  return { supabase, user };
}

function parseFrontmatter(markdown) {
  const match = String(markdown || "").match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && val) meta[key] = val;
  }
  return meta;
}

function isSafeEntryPath(name) {
  if (!name || name.startsWith("/") || name.startsWith("\\")) return false;
  if (name.includes("..") || name.includes("\0")) return false;
  if (name.startsWith("__MACOSX/") || name.endsWith("/")) return false;
  return /\.(md|markdown|txt)$/i.test(name);
}

// Pure-Node ZIP Central Directory extractor (no external dependencies, traversal-safe)
function extractTextFilesFromZip(buffer) {
  const files = [];
  let eocdOffset = -1;
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error("Invalid ZIP archive.");

  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let pos = cdOffset;

  for (let i = 0; i < totalEntries && files.length < MAX_EXTRACTED_FILES; i += 1) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) break;
    const compression = buffer.readUInt16LE(pos + 10);
    const compressedSize = buffer.readUInt32LE(pos + 20);
    const uncompressedSize = buffer.readUInt32LE(pos + 24);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localHeaderOffset = buffer.readUInt32LE(pos + 42);
    const entryName = buffer.toString("utf8", pos + 46, pos + 46 + nameLen);
    pos += 46 + nameLen + extraLen + commentLen;

    if (!isSafeEntryPath(entryName)) continue;
    if (uncompressedSize > 500_000 || compressedSize > 500_000) continue;
    if (localHeaderOffset + 30 > buffer.length) continue;
    if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) continue;

    const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > buffer.length) continue;

    const slice = buffer.subarray(dataStart, dataEnd);
    let contentBuf;
    if (compression === 0) {
      contentBuf = slice;
    } else if (compression === 8) {
      contentBuf = inflateRawSync(slice);
    } else {
      continue;
    }
    const text = contentBuf.toString("utf8").trim();
    if (text) {
      files.push({ path: entryName, content: text.slice(0, 120000) });
    }
  }
  return files;
}

function deriveName(filePath, fmName, fallbackName) {
  if (fmName) return fmName;
  if (fallbackName) return fallbackName;
  const parts = String(filePath || "").split("/").filter(Boolean);
  const last = parts[parts.length - 1] || "Custom Skill";
  if (/^skill\.md$/i.test(last) && parts.length >= 2) {
    return parts[parts.length - 2].replace(/[-_]+/g, " ");
  }
  return last.replace(/\.(md|markdown|txt)$/i, "").replace(/[-_]+/g, " ");
}

function isBlockedContent(text) {
  const blockedPatterns = [
    /curl\s+[^|\n]*\|\s*(ba)?sh/i,
    /wget\s+[^|\n]*\|\s*(ba)?sh/i,
    /rm\s+-rf\s+\/(\s|$)/i,
  ];
  return blockedPatterns.some((rx) => rx.test(text));
}

export async function POST(request) {
  const auth = await getUserClient(request);
  if (auth.error) return auth.error;

  const contentType = request.headers.get("content-type") || "";
  const candidates = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const customName = String(formData.get("name") || "").trim();
    const customDesc = String(formData.get("description") || "").trim();
    const uploadedFiles = formData.getAll("files");

    if (!uploadedFiles.length) {
      return json({ error: "Pilih minimal 1 file (.zip, .md, atau .txt)." }, 400);
    }

    for (const file of uploadedFiles) {
      if (!file || typeof file.arrayBuffer !== "function") continue;
      if (file.size > MAX_FILE_BYTES) {
        return json({ error: `File ${file.name} terlalu besar (maks 5 MB).` }, 400);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const fileName = String(file.name || "custom-skill.md");

      if (/\.zip$/i.test(fileName)) {
        let extracted;
        try {
          extracted = extractTextFilesFromZip(buf);
        } catch (err) {
          return json({ error: err?.message || "Gagal mengekstrak file ZIP." }, 400);
        }
        if (!extracted.length) {
          return json({ error: `Tidak ditemukan file .md atau .txt di dalam ${fileName}.` }, 400);
        }
        // Prefer SKILL.md files if present inside the zip, otherwise import all extracted .md/.txt
        const skillMdOnly = extracted.filter((e) => /(^|\/)SKILL\.md$/i.test(e.path));
        const chosen = skillMdOnly.length ? skillMdOnly : extracted;
        for (const item of chosen) {
          candidates.push({
            sourceRepo: `custom-zip/${fileName.replace(/\.zip$/i, "")}`,
            skillPath: item.path,
            content: item.content,
            fallbackName: chosen.length === 1 ? customName : "",
            fallbackDesc: customDesc,
          });
        }
      } else if (/\.(md|markdown|txt)$/i.test(fileName)) {
        const text = buf.toString("utf8").trim();
        if (!text) continue;
        candidates.push({
          sourceRepo: "custom-upload",
          skillPath: fileName,
          content: text.slice(0, 120000),
          fallbackName: customName,
          fallbackDesc: customDesc,
        });
      } else {
        return json({ error: `Format ${fileName} tidak didukung. Gunakan .zip, .md, atau .txt.` }, 400);
      }
    }
  } else {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid request payload." }, 400);
    }
    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const content = String(body.content || "").trim();
    if (!name || !content) {
      return json({ error: "Nama Skill dan isi instruksi wajib diisi." }, 400);
    }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom";
    candidates.push({
      sourceRepo: "custom-manual",
      skillPath: `${slug}/SKILL.md`,
      content: content.slice(0, 120000),
      fallbackName: name,
      fallbackDesc: description,
    });
  }

  if (!candidates.length) {
    return json({ error: "Tidak ada konten Skill yang valid untuk disimpan." }, 400);
  }

  const now = new Date().toISOString();
  const saved = [];
  let blockedCount = 0;

  for (const item of candidates) {
    if (isBlockedContent(item.content)) {
      blockedCount += 1;
      continue;
    }
    const fm = parseFrontmatter(item.content);
    const finalName = deriveName(item.skillPath, fm.name, item.fallbackName).slice(0, 140);
    const finalDesc = String(fm.description || item.fallbackDesc || "Custom uploaded Agent Skill").slice(
      0,
      1000
    );
    const hash = createHash("sha256").update(item.content).digest("hex");

    const { data: existing } = await auth.supabase
      .from("user_skills")
      .select("id")
      .eq("user_id", auth.user.id)
      .eq("source_repo", item.sourceRepo)
      .eq("skill_path", item.skillPath)
      .maybeSingle();

    const row = {
      user_id: auth.user.id,
      name: finalName,
      description: finalDesc,
      source_repo: item.sourceRepo,
      skill_path: item.skillPath,
      skill_md: item.content,
      version: "custom",
      license: null,
      status: "enabled",
      reviewed_at: now,
      security_scan: { mode: "builtin-static-check", flagged: false },
      security_scan_hash: hash,
      security_scan_status: "safe",
      security_scanned_at: now,
      security_scanner_version: "drive-builtin-1.0",
      security_bundle_hash: hash,
      updated_at: now,
    };

    if (existing?.id) {
      const { data } = await auth.supabase
        .from("user_skills")
        .update(row)
        .eq("id", existing.id)
        .eq("user_id", auth.user.id)
        .select("id,name,status")
        .single();
      if (data) saved.push(data);
    } else {
      const { data } = await auth.supabase
        .from("user_skills")
        .insert(row)
        .select("id,name,status")
        .single();
      if (data) saved.push(data);
    }
  }

  if (!saved.length) {
    return json(
      {
        error:
          blockedCount > 0
            ? "Skill diblokir pemindai keamanan karena pola perintah berbahaya."
            : "Gagal menyimpan custom Skill.",
      },
      422
    );
  }

  return json({ installedCount: saved.length, skills: saved, blockedCount }, 201);
}
