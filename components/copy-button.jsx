"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyButton({ value, label = "Copy", className = "" }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return <button type="button" className={`copy-button ${className}`} onClick={copy} aria-label={copied ? "Copied" : label} title={copied ? "Copied" : label}>
    {copied ? <Check size={13}/> : <Copy size={13}/>}<span>{copied ? "Copied" : label}</span>
  </button>;
}
