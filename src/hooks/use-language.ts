"use client";

import { useI18n, type Lang, type TranslationKey, type TranslationParams } from "@/lib/i18n";

interface UseLanguageReturn {
  /** Current UI language ("id" or "en"). */
  lang: Lang;
  /** Set the UI language. Persists to localStorage. */
  setLang: (lang: Lang) => void;
  /**
   * Translation function.
   * @example t("nav.login") → "Masuk" or "Login"
   */
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

/**
 * Custom hook wrapping the i18n language context.
 * Provides language state, setter, and translation function.
 */
export function useLanguage(): UseLanguageReturn {
  const { lang, setLang, t } = useI18n();
  return { lang, setLang, t };
}
