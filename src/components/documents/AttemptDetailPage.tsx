"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Minus,
  Trophy,
} from "lucide-react";
import ErrorState from "@/components/ui/ErrorState";
import Card from "@/components/ui/Card";
import { useI18n } from "@/lib/i18n";
import { t as st } from "@/lib/t";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { formatDateTime } from "@/lib/format-date";

const OPTION_LABELS = ["A", "B", "C", "D"];

interface AttemptAnswer {
  questionId: string;
  selectedIndex: number;
  correctIndex: number;
}

interface QuizAttempt {
  id: string;
  score: number;
  total: number;
  createdAt: string;
  answers?: AttemptAnswer[] | null;
  quizSetId?: string | null;
  quizSetLabel?: string | null;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

interface ReviewItem {
  question: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
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

async function fetchAttempts(docId: string): Promise<{ document: { id: string; title: string }; attempts: QuizAttempt[] }> {
  const res = await fetch(`/api/documents/${docId}/attempts`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}

async function fetchQuizQuestions(docId: string, setId: string): Promise<{ quiz: QuizQuestion[] }> {
  const res = await fetch(`/api/documents/${docId}/quiz?setId=${setId}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}

export default function AttemptDetailPage() {
  const params = useParams();
  const { t } = useI18n();
  const docId = (params?.id as string) || "";
  const attemptId = (params?.attemptId as string) || "";

  // ── Step 1: Fetch attempts list to find this attempt ───────────────────────
  const {
    data: attemptsData,
    isLoading: attemptsLoading,
    error: attemptsError,
  } = useQuery({
    queryKey: queryKeys.attempts(docId),
    queryFn: () => fetchAttempts(docId),
    enabled: !!docId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Find the specific attempt
  const attempt = attemptsData?.attempts?.find(
    (a: QuizAttempt) => a.id === attemptId
  );

  // ── Step 2: Fetch quiz questions for this attempt's set (if available) ─────
  const quizSetId = attempt?.quizSetId;

  const { data: quizData } = useQuery({
    queryKey: queryKeys.quiz(docId, quizSetId),
    queryFn: () => fetchQuizQuestions(docId, quizSetId!),
    enabled: !!docId && !!quizSetId,
  });

  const questions: QuizQuestion[] = quizData?.quiz || [];

  if (attemptsLoading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-sm text-text-muted font-mono">{t("attempt.loading")}</p>
      </div>
    );
  }

  if (attemptsError || !attempt) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6">
        <ErrorState
          title={t("attempt.notFoundTitle")}
          message={attemptsError?.message || t("attempt.notFound")}
          actions={[
            { label: t("attempt.backToAttempts"), href: `/desk/${docId}/attempts`, variant: "secondary" },
          ]}
        />
      </div>
    );
  }

  const percentage =
    attempt.total > 0 ? Math.round((attempt.score / attempt.total) * 100) : 0;
  const grade = attemptGrade(percentage);

  // Build review from saved answers + quiz questions
  const answersByQuestion = new Map(
    (attempt.answers || []).map((a) => [a.questionId, a])
  );
  const review: ReviewItem[] = questions
    .map((q) => {
      const answer = answersByQuestion.get(q.id);
      if (!answer) return null;
      const selectedIndex = answer.selectedIndex;
      const correctIndex = answer.correctIndex;
      return {
        question: q.question,
        options: q.options,
        selectedIndex,
        correctIndex,
        isCorrect: selectedIndex === correctIndex,
      };
    })
    .filter((r): r is ReviewItem => r !== null);

  const hasReview = review.length > 0;
  const correctItems = review.filter((r) => r.isCorrect);
  const wrongItems = review.filter((r) => !r.isCorrect && r.selectedIndex !== -1);
  const skippedItems = review.filter((r) => r.selectedIndex === -1);

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between text-text">
      {/*
      <Navbar
        backHref={`/desk/${docId}/attempts`}
        title={documentTitle}
        subtitle={t("attempt.reviewTitle")}
      />
      */}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {/* Summary Card */}
        <Card className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-subtle border border-border text-text mb-4">
            <Trophy className="w-7 h-7" />
          </div>

          <div className="text-5xl font-bold tracking-tight text-text mb-1">
            {percentage}
            <span className="text-2xl text-text-muted font-normal">%</span>
          </div>

          <p className="text-sm text-text-secondary mb-3">
            <strong className="text-text">{attempt.score}</strong> /{" "}
            <strong className="text-text">{attempt.total}</strong>
          </p>

          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${grade.className}`}
          >
            {grade.label}
          </span>

          <p className="text-[11px] text-text-muted font-mono mt-4">
            {attempt.quizSetLabel ? `${attempt.quizSetLabel} · ` : ""}
            {formatDateTime(attempt.createdAt)}
          </p>

          {hasReview && (
            <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border text-xs">
              <div className="text-center">
                <div className="text-2xl font-bold text-success-text">
                  {correctItems.length}
                </div>
                <div className="text-text-muted mt-0.5">{t("attempt.correct")}</div>
              </div>
              <div className="text-center border-x border-border">
                <div className="text-2xl font-bold text-danger-text">
                  {wrongItems.length}
                </div>
                <div className="text-text-muted mt-0.5">{t("attempt.wrong")}</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-text-muted">
                  {skippedItems.length}
                </div>
                <div className="text-text-muted mt-0.5">{t("attempt.skipped")}</div>
              </div>
            </div>
          )}
        </Card>

        {/* Review Section */}
        {hasReview ? (
          <>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text">
                {t("attempt.reviewTitle")}
              </h2>
              <span className="text-xs text-text-muted font-mono">
                {review.length} Questions
              </span>
            </div>

            <div className="space-y-4">
              {review.map((item, idx) => {
                const isSkipped = item.selectedIndex === -1;
                const statusColor = item.isCorrect
                  ? "border-success-border bg-success-subtle"
                  : isSkipped
                  ? "border-border bg-surface-subtle"
                  : "border-danger-border bg-danger-subtle";

                return (
                  <div
                    key={idx}
                    className={`bg-surface rounded-xl border p-5 shadow-2xs shadow-none ${statusColor}`}
                  >
                    <div className="flex items-start gap-3 mb-4">
                      <div
                        className={`mt-0.5 shrink-0 ${
                          item.isCorrect
                            ? "text-success-text"
                            : isSkipped
                            ? "text-text-muted"
                            : "text-danger-text"
                        }`}
                      >
                        {item.isCorrect ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : isSkipped ? (
                          <Minus className="w-5 h-5" />
                        ) : (
                          <XCircle className="w-5 h-5" />
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-mono font-medium text-text-muted uppercase tracking-wider mb-1">
                          Question {idx + 1}
                        </p>
                        <p className="text-sm font-semibold text-text leading-relaxed">
                          {item.question}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 ml-8">
                      {item.options.map((opt, optIdx) => {
                        const isCorrectOption = optIdx === item.correctIndex;
                        const isUserChoice = optIdx === item.selectedIndex;

                        let optClass =
                          "border-border text-text-secondary bg-surface-subtle";
                        let labelClass = "bg-surface-raised text-text-secondary";

                        if (isCorrectOption) {
                          optClass =
                            "border-success-border bg-success-subtle text-success-text";
                          labelClass = "bg-success-subtle text-success-text";
                        }
                        if (isUserChoice && !item.isCorrect) {
                          optClass =
                            "border-danger-border bg-danger-subtle text-danger-text";
                          labelClass = "bg-danger-subtle text-danger-text";
                        }

                        return (
                          <div
                            key={optIdx}
                            className={`flex items-start gap-2.5 p-3 rounded-lg border text-xs ${optClass}`}
                          >
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center font-mono font-bold text-[10px] shrink-0 ${labelClass}`}
                            >
                              {OPTION_LABELS[optIdx]}
                            </div>
                            <span className="leading-relaxed pt-0.5">{opt}</span>
                            {isCorrectOption && (
                              <span className="ml-auto shrink-0 text-[10px] font-semibold text-success-text whitespace-nowrap">
                                ✓ {t("attempt.correctAnswer")}
                              </span>
                            )}
                            {isUserChoice && !item.isCorrect && (
                              <span className="ml-auto shrink-0 text-[10px] font-semibold text-danger-text whitespace-nowrap">
                                ✗ {t("attempt.yourChoice")}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <Card variant="centered" className="p-10">
            <div className="w-10 h-10 rounded-xl bg-surface-subtle flex items-center justify-center mx-auto mb-3 text-text-muted">
              <span className="text-lg">📋</span>
            </div>
            <h3 className="text-sm font-semibold text-text mb-1">
              {t("attempt.noDetailTitle")}
            </h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              {t("attempt.noDetailMessage")}
            </p>
          </Card>
        )}

        {/* Bottom CTA */}
        <div className="mt-10 pt-8 border-t border-border text-center">
          <Link
            href={`/desk/${docId}/attempts`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text underline underline-offset-4 hover:text-text-secondary transition"
          >
            <ArrowLeft className="w-3 h-3" /> {t("attempt.backToAttempts")}
          </Link>
        </div>
      </main>

    </div>
  );
}
