"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "drive:lang";

const CATEGORY_ID_MAP = {
  ai: "AI & agent otomatis",
  coding: "coding & pengembangan software",
  github: "GitHub, Git & manajemen repositori",
  database: "database, query SQL & skema data",
  cloud: "cloud, deployment & infrastruktur DevOps",
  search: "pencarian web, dokumentasi & riset",
  browser: "otomasi browser & web scraping",
  design: "desain UI/UX, Figma & sistem visual",
  media: "video, audio, animasi & grafis 3D",
  ecommerce: "e-commerce, toko online & katalog produk",
  productivity: "produktivitas, catatan, dokumen & manajemen tugas",
  messaging: "chat, email, notifikasi & media sosial",
  finance: "pembayaran, faktur & data keuangan",
  web3: "Web3, blockchain & aset kripto",
  crm: "CRM, penjualan & manajemen pelanggan",
  maps: "peta, lokasi, cuaca & perjalanan",
  automation: "otomatisasi alur kerja & integrasi API",
  security: "keamanan aplikasi, autentikasi & audit kode",
  data: "analitik data, metrik & observabilitas",
  frontend: "pengembangan frontend, React & UI modern",
  backend: "pengembangan backend, API & microservices",
  devops: "DevOps, CI/CD & manajemen server",
  testing: "pengujian otomatis, QA & debugging",
  mobile: "aplikasi mobile iOS, Android & React Native",
  docs: "dokumentasi teknis, PDF & penulisan",
  marketing: "SEO, growth & kampanye marketing",
};

function isLikelyIndonesian(text) {
  return /\b(untuk|dengan|yang|dan|dari|mengelola|membantu|otomatis|langsung|tanpa|kamu|aplikasi)\b/i.test(
    String(text || "")
  );
}

/**
 * Formats MCP or Skill description in the selected explanation language (ID or EN).
 * Section headers & UI navigation remain clean English — this toggle ONLY controls
 * MCP & Skill explanations as requested.
 */
export function explainItem(rawDesc, lang, meta = {}) {
  const clean = String(rawDesc || "")
    .replace(/^[>|][-+]?\s*$/g, "")
    .replace(/^[>|][-+]?\s+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (lang !== "id") {
    if (clean.length >= 4) {
      return clean.length > 165 ? `${clean.slice(0, 162).trimEnd()}…` : clean;
    }
    return meta.kind === "mcp"
      ? "MCP server indexed in DRIVE Directory."
      : "Agent Skill ready for 1-click install.";
  }

  // Indonesian explanation mode
  const catKey = String(meta.category || "").toLowerCase();
  const domainId = CATEGORY_ID_MAP[catKey] || (meta.kind === "mcp" ? "integrasi AI & tools" : "alur kerja AI agent");

  if (!clean || clean.length < 4) {
    return meta.kind === "mcp"
      ? `Server MCP untuk ${domainId}, siap disambungkan ke workspace DRIVE.`
      : `Agent Skill untuk ${domainId}, siap dipasang 1-klik ke akun DRIVE.`;
  }

  if (isLikelyIndonesian(clean)) {
    return clean.length > 165 ? `${clean.slice(0, 162).trimEnd()}…` : clean;
  }

  // Convert common boilerplate patterns directly into natural Indonesian
  const popularSkillMatch = clean.match(
    /^Popular Agent Skill from ([^·]+?)(?:\s*·\s*([\d,]+)\s*installs)?\.?$/i
  );
  if (popularSkillMatch) {
    const src = popularSkillMatch[1].trim();
    const installs = popularSkillMatch[2] ? ` (${popularSkillMatch[2]} pemasangan)` : "";
    return `Skill populer untuk ${domainId} dari ${src}${installs}.`;
  }

  const npmMatch = clean.match(/^Published npm (?:MCP server|Agent Skill) package\s*(.*)$/i);
  if (npmMatch) {
    return meta.kind === "mcp"
      ? `Paket MCP server dari npm untuk ${domainId}.`
      : `Paket Agent Skill dari npm untuk ${domainId}.`;
  }

  const snippet = clean.length > 125 ? `${clean.slice(0, 122).trimEnd()}…` : clean;
  const prefix =
    meta.kind === "mcp"
      ? `Fungsi (${domainId}): `
      : `Panduan AI (${domainId}): `;
  return `${prefix}${snippet}`;
}

export function useDriveLang() {
  const [lang, setLangState] = useState("id");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "id") {
        setLangState(saved);
      }
    } catch {}

    const onSync = (ev) => {
      const next = ev?.detail;
      if (next === "en" || next === "id") {
        setLangState(next);
      }
    };
    window.addEventListener("drive:lang-changed", onSync);
    return () => window.removeEventListener("drive:lang-changed", onSync);
  }, []);

  const setLang = useCallback((next) => {
    if (next !== "id" && next !== "en") return;
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    window.dispatchEvent(new CustomEvent("drive:lang-changed", { detail: next }));
  }, []);

  return { lang, setLang };
}
