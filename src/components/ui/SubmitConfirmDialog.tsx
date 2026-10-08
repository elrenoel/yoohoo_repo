"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

interface SubmitConfirmDialogProps {
  answeredCount: number;
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SubmitConfirmDialog({
  answeredCount,
  total,
  onCancel,
  onConfirm,
}: SubmitConfirmDialogProps) {
  const { t } = useI18n();
  const unansweredCount = total - answeredCount;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay backdrop-blur-sm px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-confirm-title"
      onClick={onCancel}
    >
      <div
        className="bg-surface-raised border border-border rounded-2xl p-6 sm:p-8 shadow-lg dark:shadow-none w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="submit-confirm-title"
          className="text-lg font-semibold text-text mb-2"
        >
          {t("quiz.confirmTitle")}
        </h3>
        <p className="text-sm text-text-secondary leading-relaxed">
          {t("quiz.confirmMessage", { answered: answeredCount, total })}
        </p>

        {unansweredCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-warning-text bg-warning-subtle border border-warning-border p-3 rounded-lg mt-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t("quiz.unansweredWarning", { count: unansweredCount })}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            autoFocus
            onClick={onCancel}
            className="py-2.5 px-5 rounded-xl bg-surface border border-control-border text-xs sm:text-sm font-medium text-text-secondary hover:bg-surface-hover transition cursor-pointer"
          >
            {t("quiz.checkAgain")}
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 px-5 rounded-xl bg-success hover:bg-success-hover text-on-success text-xs sm:text-sm font-medium transition flex items-center gap-2 cursor-pointer shadow-xs dark:shadow-none active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t("quiz.submit")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
