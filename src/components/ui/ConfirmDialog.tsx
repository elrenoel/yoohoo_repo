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
      ? "bg-danger hover:bg-danger-hover text-on-danger"
      : "bg-success hover:bg-success-hover text-on-success";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm px-6"
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
    >
      <div
        className="bg-surface-raised border border-border rounded-2xl p-6 sm:p-8 shadow-lg dark:shadow-none w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-text mb-2">
          {title}
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed">{message}</p>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            autoFocus
            onClick={onCancel}
            disabled={loading}
            className="py-2.5 px-5 rounded-xl bg-surface border border-border text-xs sm:text-sm font-medium text-text-secondary hover:bg-surface-hover transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading}
            className={`py-2.5 px-5 rounded-xl ${confirmColorClass} text-xs sm:text-sm font-medium transition flex items-center gap-2 cursor-pointer shadow-xs dark:shadow-none active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon ?? <Trash2 className="w-4 h-4" />}
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
