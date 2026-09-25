/**
 * Standalone translation helper for components that cannot use React hooks
 * (e.g. class-based ErrorBoundary). Reads language from localStorage.
 *
 * For functional components, prefer useI18n() from @/lib/i18n instead.
 */
import idDict from "@/locales/id.json";
import enDict from "@/locales/en.json";

type TranslationKey = keyof typeof idDict;
type TranslationParams = Record<string, string | number>;

const ID_DICT = idDict as Record<TranslationKey, string>;
const EN_DICT = enDict as Record<TranslationKey, string>;

function getLang(): "id" | "en" {
  try {
    const saved = window.localStorage.getItem("yoohoo_lang");
    if (saved === "en" || saved === "id") return saved;
  } catch {
    // localStorage unavailable
  }
  return "id";
}

export function t(key: TranslationKey, params?: TranslationParams): string {
  const dict = getLang() === "en" ? EN_DICT : ID_DICT;
  let text: string = dict[key] ?? ID_DICT[key] ?? String(key);
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}
