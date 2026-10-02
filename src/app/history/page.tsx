"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  FileText,
  Clock,
  ArrowRight,
  Plus,
  BookOpen,
  Loader2,
  Pencil,
  Check,
  X,
  ClipboardCheck,
  User as UserIcon,
  FolderOpen,
  Trash2,
  Star,
  MoreVertical,
} from "lucide-react";
import { formatDateTime } from "@/lib/format-date";
import { useDocuments } from "@/hooks/use-documents";
import { useLanguage } from "@/hooks/use-language";
import { useSession } from "@/lib/session-provider";
import AppShell from "@/components/layout/AppShell";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorState from "@/components/ui/ErrorState";
import Card from "@/components/ui/Card";

export default function HistoryPage() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<"all" | "starred">(searchParams.get("filter") === "starred" ? "starred" : "all");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { data: session, isPending: isSessionPending } = useSession();
  const {
    documentsList,
    isLoading,
    error,
    editingId,
    editingTitle,
    setEditingTitle,
    renameError,
    startRename,
    cancelRename,
    handleRenameSubmit,
    isRenaming,
    deleteTargetId,
    deleteTargetTitle,
    requestDelete,
    cancelDelete,
    confirmDelete,
    handleRetry,
    toggleStar,
  } = useDocuments();

  const isLoggedIn = !isSessionPending && !!session?.user;
  const showLoginState = !isSessionPending && !isLoggedIn;
  const visibleDocuments = filter === "starred" ? documentsList.filter(doc => doc.isStarred) : documentsList;
  const showEmptyState = isLoggedIn && !isLoading && !error && visibleDocuments.length === 0;

  return (
    <AppShell>
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12 pb-24 lg:pb-12 flex-1 w-full lg:pl-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 mb-1">
              {t("history.pageTitle")}
            </h1>
            <p className="text-xs sm:text-sm text-neutral-500">
              {t("history.pageDesc")}
            </p>
          </div>

          <Link
            href="/desk"
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition shadow-xs self-start sm:self-auto"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t("history.uploadNew")}</span>
          </Link>
        </div>

        {/* State 1: Not logged in */}
        {showLoginState && (
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
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Card>
        )}

        {/* State 2: Loading Skeleton */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                variant="compact"
                className="animate-pulse flex items-center justify-between"
              >
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-neutral-100 rounded w-1/2" />
                  <div className="h-3 bg-neutral-100 rounded w-1/4" />
                </div>
                <div className="w-6 h-6 bg-neutral-100 rounded-lg" />
              </Card>
            ))}
          </div>
        )}

        {/* State 3: Error Message */}
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

        {!isLoading && documentsList.length > 0 && (
          <div className="mb-5 flex items-center gap-2">
            <button type="button" onClick={() => setFilter("all")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === "all" ? "bg-neutral-900 text-white" : "bg-white text-neutral-500 border border-neutral-200 hover:text-neutral-900"}`}>Semua</button>
            <button type="button" onClick={() => setFilter("starred")} className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filter === "starred" ? "bg-neutral-900 text-white" : "bg-white text-neutral-500 border border-neutral-200 hover:text-neutral-900"}`}>Ditandai</button>
          </div>
        )}

        {/* State 4: Document List */}
        {!isLoading && visibleDocuments.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {visibleDocuments.map((doc) => {
              const flashcardHref = `/desk/${doc.id}/${doc.isRagDocument && !doc.hasFlashcards ? "keywords" : "flashcards"}`;
              return (
              <article
                key={doc.id}
                className="group relative bg-white border border-neutral-200 hover:border-neutral-300 rounded-xl p-5 shadow-2xs transition flex flex-col gap-4 min-w-0"
              >
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white flex items-center justify-center text-neutral-700 shrink-0 transition">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {editingId === doc.id ? (
                      <form
                        onSubmit={handleRenameSubmit}
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-2"
                      >
                        <input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") cancelRename();
                          }}
                          autoFocus
                          maxLength={200}
                          placeholder={t("history.renamePlaceholder")}
                          disabled={isRenaming}
                          className="w-full min-w-0 px-2.5 py-1.5 rounded-lg border border-neutral-300 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 disabled:opacity-50"
                        />
                        <button
                          type="submit"
                          disabled={isRenaming || !editingTitle.trim()}
                          title={t("history.renameSave")}
                          className="shrink-0 w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center hover:bg-emerald-800 disabled:opacity-50 transition cursor-pointer"
                        >
                          {isRenaming ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            cancelRename();
                          }}
                          disabled={isRenaming}
                          title={t("history.renameCancel")}
                          className="shrink-0 w-7 h-7 rounded-lg bg-neutral-100 text-neutral-600 flex items-center justify-center hover:bg-neutral-200 disabled:opacity-50 transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <h2 className="text-sm font-semibold text-neutral-900 tracking-tight truncate group-hover:text-neutral-900">
                          {doc.title}
                        </h2>
                      </div>
                    )}

                    {renameError && editingId === doc.id && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-600 bg-neutral-50 border border-neutral-200 px-2 py-1 rounded-md">
                        <span>{renameError}</span>
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1 font-mono">
                      <Clock className="w-3 h-3" />
                      <span>{formatDateTime(doc.createdAt)}</span>
                    </div>

                    <div className="mt-1 flex items-center gap-2 text-xs">
                      {doc.lastAttempt ? (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <ClipboardCheck className="w-3 h-3" />
                          {t("history.lastScore", { score: doc.lastAttempt.score, total: doc.lastAttempt.total })}
                        </span>
                      ) : (
                        <span className="text-neutral-400">{t("history.noExam")}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggleStar(doc);
                    }}
                    title={doc.isStarred ? "Hapus tanda" : "Tandai untuk dipelajari lagi"}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer shrink-0 ${doc.isStarred ? "bg-amber-50 text-amber-500 hover:bg-amber-100" : "bg-neutral-50 text-neutral-400 hover:bg-amber-50 hover:text-amber-500"}`}
                  >
                    <Star className="w-3.5 h-3.5" fill={doc.isStarred ? "currentColor" : "none"} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpenMenuId(current => current === doc.id ? null : doc.id);
                    }}
                    title="Menu dokumen"
                    className="w-8 h-8 rounded-lg bg-neutral-50 hover:bg-neutral-100 flex items-center justify-center text-neutral-400 hover:text-neutral-900 transition cursor-pointer shrink-0"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>
                  {openMenuId === doc.id && (
                    <div className="absolute right-5 top-14 z-20 w-44 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg" onClick={(e) => e.stopPropagation()}>
                      <button type="button" onClick={() => { setOpenMenuId(null); startRename(doc); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-neutral-700 hover:bg-neutral-50 transition">
                        <Pencil className="w-3.5 h-3.5 text-neutral-500" />
                        <span>Ubah nama</span>
                      </button>
                      <button type="button" onClick={() => { setOpenMenuId(null); requestDelete(doc); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Hapus dokumen</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-neutral-100 pt-4">
                  <Link
                    href={flashcardHref}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-medium text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>{doc.hasFlashcards ? t("history.viewFlashcards") : t("history.chooseKeywords")}</span>
                  </Link>
                  <Link
                    href={`/desk/${doc.id}/quiz`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-3 py-2 text-xs font-medium text-white hover:bg-neutral-800 transition"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>{t("history.viewQuiz")}</span>
                  </Link>
                </div>
              </article>
              );
            })}
          </div>
        )}

        {/* State 5: Empty State */}
        {showEmptyState && (
          <Card variant="centered" className="p-12">
            <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center mx-auto mb-4 text-neutral-500">
              <FolderOpen className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-neutral-900 mb-1">
              {t("history.emptyTitle")}
            </h2>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto mb-6">
              {t("history.emptyDesc")}
            </p>
            <Link
              href="/desk"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-medium hover:bg-neutral-800 transition shadow-2xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t("history.emptyButton")}</span>
            </Link>
          </Card>
        )}
      </main>

      {/* Delete Confirm Dialog */}
      {deleteTargetId && (
        <ConfirmDialog
          title={t("history.deleteConfirmTitle")}
          message={t("history.deleteConfirmMessage", { title: deleteTargetTitle })}
          confirmLabel={t("history.delete")}
          onCancel={cancelDelete}
          onConfirm={confirmDelete}
        />
      )}
    </div>
    </AppShell>
  );
}
