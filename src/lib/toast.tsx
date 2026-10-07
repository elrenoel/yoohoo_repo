"use client";

import { useMemo, type CSSProperties } from "react";
import { Toaster, toast } from "sonner";
import { useI18n } from "@/lib/i18n";

/**
 * Single app-wide toast surface. Mount once (root layout) and never add a
 * second toast library — `useToast()` is the only entry point for call sites.
 */

// Sonner reads these CSS variables, so the toasts inherit the app's tokens.
const TOAST_VARS = {
  "--normal-bg": "#F5F6F3",
  "--normal-text": "#16241D",
  "--normal-border": "#D8DCD3",
  "--success-bg": "#EEF5F0",
  "--success-text": "#2F7651",
  "--success-border": "#BFD6C4",
  "--error-bg": "#FBEDEB",
  "--error-text": "#C24A3D",
  "--error-border": "#F0C4BE",
  "--border-radius": "12px",
  "--width": "min(92vw, 360px)",
} as CSSProperties;

type ToastOptions = Parameters<typeof toast.loading>[1];

/** Bottom-centre so it never covers the deck page's bottom-right CTA. */
export function AppToaster() {
  return <Toaster position="bottom-center" gap={10} offset={16} duration={3500} visibleToasts={3} richColors style={TOAST_VARS} />;
}

/**
 * Toast helpers bound to the active UI language. Every message passed in should
 * already be translated with `t(...)` so it follows the language setting.
 */
export function useToast() {
  const { t, lang } = useI18n();
  return useMemo(() => ({
    t,
    lang,
    loading: (message: string, options?: ToastOptions) => toast.loading(message, options),
    success: (message: string, options?: ToastOptions) => toast.success(message, options),
    error: (message: string, options?: ToastOptions) => toast.error(message, options),
    info: (message: string, options?: ToastOptions) => toast(message, options),
    dismiss: (id?: string | number) => toast.dismiss(id),
  }), [t, lang]);
}
