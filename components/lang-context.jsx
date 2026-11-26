"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "drive:lang";

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

  const t = useCallback(
    (idText, enText) => (lang === "en" ? enText : idText),
    [lang]
  );

  return { lang, setLang, t };
}
