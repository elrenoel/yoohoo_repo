"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ClipboardList,
  ChevronRight,
} from "lucide-react";
import ErrorState from "@/components/ui/ErrorState";
import { useI18n } from "@/lib/i18n";
import { t as st } from "@/lib/t";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { formatDateTime } from "@/lib/format-date";
import Card from "@/components/ui/Card";

interface QuizAttempt {
  id: string;
  score: number;
  total: number;
  createdAt: string;
  answers?: Array<{
    questionId: string;
    selectedIndex: number;
    correctIndex: number;
  }> | null;
  quizSetId?: string | null;
  quizSetLabel?: string | null;
}

interface AttemptsApiResponse {
  document: { id: string; title: string };
  attempts: QuizAttempt[];
}

function attemptGrade(percentage: number): { label: string; className: string } {
  if (percentage >= 85)
    return { label: st("attempt.grade.great"), className: "bg-success-subtle text-success-text border-success-border" };
  if (percentage >= 70)
    return { label: st("attempt.grade.good"), className: "bg-accent-subtle text-accent border-accent" };
  if (percentage >= 50)
    return { label: st("attempt.grade.practice"), className: "bg-warning-subtle text-warning-text border-warning-border" };
  return { label: st("attempt.grade.study"), className: "bg-danger-subtle text-danger-text border-danger-border" };
}

async function fetchAttempts(docId: string): Promise<AttemptsApiResponse> {
  const res = await fetch(`/api/documents/${docId}/attempts`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}

export default function DocumentAttemptsPage() {
  const params = useParams();
  const { t } = useI18n();
  const docId = (params?.id as string) || "";

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.attempts(docId),
    queryFn: () => fetchAttempts(docId),
    enabled: !!docId,
    staleTime: 5 * 60 * 1000, // 5 minutes — avoid re-fetch when navigating back
  });

  const attempts = data?.attempts || [];

  const handleRetry = () => {
    refetch();
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between text-text">
      {/*
      <Navbar
        backHref="/desk"
        title={isLoading ? undefined : documentTitle}
        subtitle={
          <>
            {t("attempts.pageTitle")}
            {!isLoading && attempts.length > 0 && ` · ${attempts.length} Attempt`}
          </>
        }
      />
      */}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {/* Page Header */}
        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-text mb-1">
            {t("attempts.pageTitle")}
          </h2>
          <p className="text-xs sm:text-sm text-text-muted">
            {t("attempts.pageDesc")}
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card
                key={i}
                variant="compact"
                className="animate-pulse flex items-center justify-between"
              >
                <div className="space-y-2 flex-1">
                  <div className="skeleton-shimmer h-4 rounded w-1/2" />
                  <div className="skeleton-shimmer h-3 rounded w-1/4" />
                </div>
                <div className="skeleton-shimmer w-6 h-6 rounded-lg" />
              </Card>
            ))}
          </div>
        )}

        {/* Error */}
        {!isLoading && error && (
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

        {/* Attempt List */}
        {!isLoading && !error && attempts.length > 0 && (
          <div className="space-y-3">
            {attempts.map((attempt, idx) => {
              const percentage =
                attempt.total > 0
                  ? Math.round((attempt.score / attempt.total) * 100)
                  : 0;
              const grade = attemptGrade(percentage);
              return (
                <Link
                  key={attempt.id}
                  href={`/desk/${docId}/attempts/${attempt.id}`}
                  className="group bg-surface border border-border hover:border-border-strong rounded-xl p-5 shadow-2xs dark:shadow-none transition flex items-center justify-between gap-4 block cursor-pointer"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-10 h-10 rounded-lg bg-surface-subtle group-hover:bg-action-primary group-hover:text-on-action-primary flex items-center justify-center text-text-secondary shrink-0 transition">
                      <ClipboardList className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                        <span className="text-sm font-semibold text-text tracking-tight">
                          {t("attempts.score")} {attempt.score}/{attempt.total}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${grade.className}`}
                        >
                          {percentage}% · {grade.label}
                        </span>
                        {attempt.quizSetLabel && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-subtle text-text-secondary border border-border">
                            {attempt.quizSetLabel}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-text-muted mt-1 font-mono">
                        <span>{formatDateTime(attempt.createdAt)}</span>
                      </div>
                      {idx === 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success-text mt-1">
                          {t("attempts.latestAttempt")}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="w-8 h-8 rounded-lg bg-surface-subtle group-hover:bg-surface-hover flex items-center justify-center text-text-muted group-hover:text-text transition shrink-0">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && attempts.length === 0 && (
          <Card variant="centered" className="p-12">
            <div className="w-12 h-12 rounded-2xl bg-surface-subtle flex items-center justify-center mx-auto mb-4 text-text-muted">
              <ClipboardList className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-text mb-1.5">
              {t("attempts.emptyTitle")}
            </h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto mb-6">
              {t("attempts.emptyMessage")}
            </p>
            <Link
              href={`/desk/${docId}/quiz`}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-action-primary text-on-action-primary text-xs font-medium hover:bg-action-primary-hover transition shadow-2xs dark:shadow-none"
            >
              {t("attempts.startQuiz")}
            </Link>
          </Card>
        )}
      </main>

    </div>
  );
}
