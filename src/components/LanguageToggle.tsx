"use client";

import { Languages } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";

/**
 * Dropdown kecil untuk mengganti bahasa UI (Indonesia / English).
 * Preferensi disimpan ke localStorage oleh LanguageProvider.
 */
export default function LanguageToggle() {
  const { lang, setLang } = useI18n();

  return (
    <div
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-subtle border border-border text-xs font-medium text-text-secondary hover:bg-skeleton-highlight transition"
      title="Bahasa / Language"
    >
      <Languages className="w-3.5 h-3.5 text-text-muted shrink-0" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label="Bahasa / Language"
        className="bg-transparent text-xs font-medium text-text-secondary focus:outline-none cursor-pointer"
      >
        <option value="id">ID</option>
        <option value="en">EN</option>
      </select>
    </div>
  );
}
