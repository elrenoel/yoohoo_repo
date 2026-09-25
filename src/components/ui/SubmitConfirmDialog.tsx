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
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/30 backdrop-blur-sm px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-confirm-title"
      onClick={onCancel}
    >
      <div
        className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-lg w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          id="submit-confirm-title"
          className="text-lg font-semibold text-neutral-900 mb-2"
        >
          {t("quiz.confirmTitle")}
        </h3>
        <p className="text-sm text-neutral-600 leading-relaxed">
          {t("quiz.confirmMessage", { answered: answeredCount, total })}
        </p>

        {unansweredCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 p-3 rounded-lg mt-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t("quiz.unansweredWarning", { count: unansweredCount })}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            autoFocus
            onClick={onCancel}
            className="py-2.5 px-5 rounded-xl bg-white border border-neutral-200 text-xs sm:text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition cursor-pointer"
          >
            {t("quiz.checkAgain")}
          </button>
          <button
            onClick={onConfirm}
            className="py-2.5 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-medium transition flex items-center gap-2 cursor-pointer shadow-xs active:scale-[0.98]"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t("quiz.submit")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
