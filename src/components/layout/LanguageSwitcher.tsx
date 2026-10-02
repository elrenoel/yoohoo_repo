"use client";

import { Languages } from "lucide-react";
import { useLanguage } from "@/hooks/use-language";
import type { Lang } from "@/lib/i18n";

export default function LanguageSwitcher({ mobile = false, compact = false }: { mobile?: boolean; compact?: boolean }) {
  const { lang, setLang } = useLanguage();

  return (
    <label
      className={`inline-flex items-center gap-2 rounded-lg bg-[#FDF7EB] px-3 py-2 text-xs font-medium text-[#041914] ${mobile ? "w-full" : ""}`}
      title="Bahasa / Language"
    >
      <Languages className="h-4 w-4 shrink-0" />
      <select
        value={lang}
        onChange={(event) => setLang(event.target.value as Lang)}
        aria-label="Bahasa / Language"
        className="min-w-0 flex-1 cursor-pointer bg-transparent text-xs font-medium text-[#041914] focus:outline-none"
      >
        <option value="id" className="bg-[#FDF7EB] text-[#041914]">{compact ? "ID" : "Bahasa Indonesia"}</option>
        <option value="en" className="bg-[#FDF7EB] text-[#041914]">{compact ? "EN" : "English"}</option>
      </select>
    </label>
  );
}
