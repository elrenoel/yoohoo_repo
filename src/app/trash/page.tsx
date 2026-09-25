"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session-provider";
import { formatDateTime } from "@/lib/format-date";
import {
  ArrowLeft,
  Trash2,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Info,
  User as UserIcon,
} from "lucide-react";
import ErrorState from "@/components/ui/ErrorState";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/layout/Navbar";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

interface TrashDocument {
  id: string;
  title: string;
  createdAt: string;
  deletedAt: string;
}

async function fetchTrashDocuments(): Promise<TrashDocument[]> {
  const res = await fetch("/api/documents/trash");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to fetch trash");
  }
  const data = await res.json();
  return data.documents || [];
}

export default function TrashPage() {
  const router = useRouter();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const {
    data: session,
    isPending: isSessionPending,
  } = useSession();

  // ── Confirm dialog state ─────────────────────────────────────────────────
  const [permanentDeleteTarget, setPermanentDeleteTarget] =
    useState<TrashDocument | null>(null);

  // ── Fetch trash documents ────────────────────────────────────────────────
  const { data: trashDocs = [], isLoading, error } = useQuery({
    queryKey: queryKeys.trash,
    queryFn: fetchTrashDocuments,
    enabled: !isSessionPending && !!session?.user,
  });

  // ── Restore mutation ─────────────────────────────────────────────────────
  const restoreMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/restore`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to restore");
      }
      return res.json();
    },
    onSuccess: (_data, docId) => {
      queryClient.setQueryData<TrashDocument[]>(
        queryKeys.trash,
        (old) => old?.filter((d) => d.id !== docId) ?? []
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    },
  });

  // ── Permanent delete mutation ────────────────────────────────────────────
  const permanentDeleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const res = await fetch(`/api/documents/${docId}/permanent`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to permanently delete");
      }
      return res.json();
    },
    onSuccess: (_data, docId) => {
      queryClient.setQueryData<TrashDocument[]>(
        queryKeys.trash,
        (old) => old?.filter((d) => d.id !== docId) ?? []
      );
      setPermanentDeleteTarget(null);
    },
  });

  const handleRetry = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.trash });
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar />

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-12 flex-1 w-full">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-1">
              {t("trash.pageTitle")}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500">
              {t("trash.pageDesc")}
            </p>
          </div>

          <Link
            href="/history"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50 transition shadow-xs self-start sm:self-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t("trash.backToHistory")}</span>
          </Link>
        </div>

        {/* Auto-delete info banner */}
        <div className="mb-6 flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed">
            {t("trash.autoDeleteInfo")}
          </p>
        </div>

        {/* Not logged in */}
        {!isSessionPending && !session?.user && (
          <Card variant="centered">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-600">
              <UserIcon className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-neutral-900 mb-1.5">
              {t("history.loginTitle")}
            </h2>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
              {t("history.loginDesc")}
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition shadow-2xs"
            >
              <span>{t("history.loginButton")}</span>
            </Link>
          </Card>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                variant="compact"
                className="animate-pulse flex items-center justify-between"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-neutral-100 rounded w-1/2" />
                  <div className="h-3 bg-neutral-100 rounded w-1/4" />
                </div>                  <div className="flex gap-2">
                  <div className="w-8 h-8 bg-neutral-100 rounded-lg" />
                  <div className="w-8 h-8 bg-neutral-100 rounded-lg" />
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6">
            <ErrorState
              title={t("history.loadErrorTitle")}
              message={t("history.loadErrorMessage")}
              compact
              actions={[
                {
                  label: t("error.retry"),
                  onClick: handleRetry,
                  variant: "primary",
                },
              ]}
            />
          </div>
        )}

        {/* Trash List */}
        {!isLoading && session?.user && (
          <>
            {trashDocs.length > 0 ? (
              <div className="space-y-3">
                {trashDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="group bg-white border border-neutral-200 rounded-xl p-5 shadow-2xs transition flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-lg bg-rose-50 flex items-center justify-center text-rose-500 shrink-0">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm font-semibold text-neutral-900 tracking-tight truncate">
                          {doc.title}
                        </h2>
                        <p className="text-xs text-neutral-400 mt-1 font-mono">
                          {t("trash.trashedAt", {
                            date: formatDateTime(doc.deletedAt),
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => restoreMutation.mutate(doc.id)}
                        disabled={restoreMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-emerald-50 hover:border-emerald-200 hover:text-emerald-700 transition disabled:opacity-50 cursor-pointer"
                      >
                        {restoreMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span className="hidden sm:inline">{t("trash.restore")}</span>
                      </button>

                      <button
                        onClick={() => setPermanentDeleteTarget(doc)}
                        disabled={permanentDeleteMutation.isPending}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-rose-200 text-xs font-medium text-rose-700 hover:bg-rose-50 transition disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{t("trash.permanentDelete")}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Empty State */
              <Card variant="centered" className="p-12">
                <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-500">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h2 className="text-base font-semibold text-neutral-900 mb-1">
                  {t("trash.emptyTitle")}
                </h2>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
                  {t("trash.emptyDesc")}
                </p>
                <Link
                  href="/history"
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition shadow-2xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{t("trash.backToHistory")}</span>
                </Link>
              </Card>
            )}
          </>
        )}
      </main>

      {/* Permanent Delete Confirmation Dialog */}
      {permanentDeleteTarget && (
        <ConfirmDialog
          title={t("trash.permanentDeleteTitle")}
          message={t("trash.permanentDeleteConfirm", {
            title: permanentDeleteTarget.title,
          })}
          confirmLabel={t("trash.permanentDelete")}
          onCancel={() => setPermanentDeleteTarget(null)}
          onConfirm={() => {
            if (permanentDeleteTarget) {
              permanentDeleteMutation.mutate(permanentDeleteTarget.id);
            }
          }}
        />
      )}
    </div>
  );
}
