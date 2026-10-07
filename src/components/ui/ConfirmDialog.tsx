"use client";

import { useEffect, type ReactNode } from "react";
import { Loader2, Trash2 } from "lucide-react";

interface ConfirmDialogProps {
  /** Dialog title text. */
  title: string;
  /** Dialog message/body text. */
  message: string;
  /** Label for the confirm button. */
  confirmLabel: string;
  /** Visual variant of the confirm button. */
  confirmVariant?: "danger" | "success";
  /** Shows a spinner on the confirm button and blocks double submits. */
  loading?: boolean;
  /** Called when the user clicks cancel or the backdrop. */
  onCancel: () => void;
  /** Called when the user clicks the confirm button. */
  onConfirm: () => void;
  /** Optional icon to show next to the confirm button label. Defaults to Trash2. */
  icon?: ReactNode;
}

/**
 * Generalized confirmation dialog.
 *
 * Used for:
 * - Delete document (history page)
 * - Permanent delete (trash page)
 * - Delete deck (Your Desk)
 *
 * Closes on Escape key and backdrop click.
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel,
  confirmVariant = "danger",
  loading = false,
  onCancel,
  onConfirm,
  icon,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const confirmColorClass =
    confirmVariant === "danger"
      ? "bg-rose-600 hover:bg-rose-700"
      : "bg-emerald-700 hover:bg-emerald-800";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 backdrop-blur-sm px-6"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-lg w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-neutral-900 mb-2">
          {title}
        </h3>
        <p className="text-sm text-neutral-600 leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            autoFocus
            onClick={onCancel}
            disabled={loading}
            className="py-2.5 px-5 rounded-xl bg-white border border-neutral-200 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
            className={`py-2.5 px-5 rounded-xl ${confirmColorClass} text-white text-xs sm:text-sm font-medium transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon ?? <Trash2 className="w-4 h-4" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
