"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import type { Lang } from "@/lib/i18n";

export default function LanguageSwitcher({ mobile = false, compact = false }: { mobile?: boolean; compact?: boolean }) {
  const { lang, setLang } = useLanguage();

  return (
    <label
      className={`inline-flex items-center gap-2 rounded-lg bg-control-subtle px-3 py-2 text-xs font-medium text-control-text ${mobile ? "w-full" : ""}`}
      title="Language"
    >
      <Languages className="h-4 w-4 shrink-0" />
      <select
        value={lang}
        onChange={(event) => setLang(event.target.value as Lang)}
        aria-label="Language"
        className="min-w-0 flex-1 cursor-pointer bg-transparent text-xs font-medium text-control-text focus:outline-none"
      >
        <option value="id" className="bg-control-subtle text-control-text">{compact ? "ID" : "Indonesian"}</option>
        <option value="en" className="bg-control-subtle text-control-text">{compact ? "EN" : "English"}</option>
      </select>
    </label>
  );
}
