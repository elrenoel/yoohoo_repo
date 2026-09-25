"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import idDict from "@/locales/id.json";
import enDict from "@/locales/en.json";

export type Lang = "id" | "en";
export type TranslationKey = keyof typeof idDict;
export type TranslationParams = Record<string, string | number>;

// Compile-time check: en.json harus punya SEMUA key yang ada di id.json
const EN_DICT: Record<TranslationKey, string> = enDict;
const ID_DICT = idDict as Record<TranslationKey, string>;

export interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const STORAGE_KEY = "yoohoo_lang";

const I18nContext = createContext<I18nContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("id");

  // Muat preferensi bahasa dari localStorage saat mount
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "id") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- inisialisasi preferensi dari localStorage, hanya sekali saat mount
        setLangState(saved);
      }
    } catch {
      // localStorage tidak tersedia — biarkan default
    }
  }, []);

  // Sinkronkan atribut <html lang> agar aksesibilitas & font sesuai
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage tidak tersedia — abaikan
    }
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: TranslationParams): string => {
      const dict = lang === "en" ? EN_DICT : ID_DICT;
      let text: string = dict[key] ?? ID_DICT[key] ?? String(key);

      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.split(`{${name}}`).join(String(value));
        }
      }

      return text;
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n harus dipanggil di dalam <LanguageProvider>.");
  }
  return ctx;
}
