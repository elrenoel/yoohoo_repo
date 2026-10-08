"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { MOCK_DOCUMENT } from "@/lib/mock-data";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  History,
  Loader2,
  Shuffle,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";
import ErrorState from "@/components/ui/ErrorState";
import { useI18n } from "@/lib/i18n";
import Button from "@/components/ui/Button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getOrCreateSessionId } from "@/lib/session";
import SubmitConfirmDialog from "@/components/ui/SubmitConfirmDialog";

// ─── Types ──────────────────────────────────────────────────────────────────
interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  difficulty?: "easy" | "medium" | "hard";
}
type QuizMode = "normal" | "time_attack";
const TIME_ATTACK_QUESTION_MS = 25_000;

interface QuizSetOption {
  id: string;
  label: string;
  questionCount: number;
  createdAt: string;
  variant: "original" | "different" | "harder";
  difficultyCounts: { easy: number; medium: number; hard: number };
}

type QuizGenerationVariant = "different" | "harder";

interface QuizApiResponse {
  quiz: QuizQuestion[];
  sets: QuizSetOption[];
  quizSetId: string | null;
  quizSetLabel: string | null;
  documentTitle: string;
}

async function fetchQuiz(docId: string, setId?: string): Promise<QuizApiResponse> {
  const query = setId ? `?setId=${setId}` : "";
  const res = await fetch(`/api/documents/${docId}/quiz${query}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  return res.json();
}

function formatQuizSetDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Tanggal tidak tersedia";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function quizVariantLabel(variant: QuizSetOption["variant"]) {
  if (variant === "harder") return "Lebih sulit";
  if (variant === "different") return "Soal berbeda";
  return "Set awal";
}

// ─── Skeleton ────────────────────────────────────────────────────────────────
function QuestionSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-xs dark:shadow-none mb-6 animate-pulse">
      <div className="skeleton-shimmer h-5 rounded w-3/4 mb-4" />
      <div className="skeleton-shimmer h-4 rounded w-1/2 mb-6" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton-shimmer h-14 border border-border rounded-xl" />
        ))}
      </div>
    </div>
  );
}

// ─── Quiz Content (child – keyed to reset on set change) ────────────────────
function QuizContent({
  questions,
  docId,
  documentTitle,
  isDemo,
  selectedSetId,
  mode,
  onSubmitted,
  onProgressChange,
}: {
  questions: QuizQuestion[];
  docId: string;
  documentTitle: string;
  isDemo: boolean;
  selectedSetId: string | null;
  mode: QuizMode;
  onSubmitted: () => void;
  onProgressChange: (p: { answeredCount: number; total: number; progressPercent: number }) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [answerMeta, setAnswerMeta] = useState<Record<string, { selectedIndex: number | null; status: "answered" | "skipped" | "timeout"; timeTakenMs: number }>>({});
  const [questionStartedAt, setQuestionStartedAt] = useState(() => Date.now());
  const [remainingMs, setRemainingMs] = useState(TIME_ATTACK_QUESTION_MS);

  const { t } = useI18n();
  const queryClient = useQueryClient();
  const router = useRouter();

  const optionLabels = ["A", "B", "C", "D"];

  const currentQuestion = questions[currentIndex];
  const progressPercent =
    questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = Object.keys(selectedAnswers).length;
  const currentSelection = currentQuestion
    ? selectedAnswers[currentQuestion.id]
    : undefined;

  useEffect(() => {
    setQuestionStartedAt(Date.now());
    setRemainingMs(TIME_ATTACK_QUESTION_MS);
  }, [currentIndex, currentQuestion?.id]);

  useEffect(() => {
    if (mode !== "time_attack" || !currentQuestion || isSubmitting || answerMeta[currentQuestion.id]) return;
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - questionStartedAt;
      const next = Math.max(0, TIME_ATTACK_QUESTION_MS - elapsed);
      setRemainingMs(next);
      if (next === 0) {
        setAnswerMeta(prev => ({ ...prev, [currentQuestion.id]: { selectedIndex: null, status: "timeout", timeTakenMs: TIME_ATTACK_QUESTION_MS } }));
        if (currentIndex < questions.length - 1) setCurrentIndex(prev => prev + 1);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [mode, currentQuestion, currentIndex, questionStartedAt, answerMeta, isSubmitting]);

  useEffect(() => {
    if (mode === "time_attack" && currentIndex === questions.length - 1 && currentQuestion && answerMeta[currentQuestion.id]?.status === "timeout") {
      void handleSubmitQuiz();
    }
  }, [mode, currentIndex, questions.length, currentQuestion, answerMeta]);

  // Report progress to parent on every change
  useEffect(() => {
    onProgressChange({ answeredCount, total: questions.length, progressPercent });
  }, [answeredCount, questions.length, progressPercent, onProgressChange]);

  const handleSelectOption = (optionIndex: number) => {
    if (!currentQuestion) return;
    setSelectedAnswers((prev) => ({ ...prev, [currentQuestion.id]: optionIndex }));
    setAnswerMeta(prev => ({ ...prev, [currentQuestion.id]: { selectedIndex: optionIndex, status: "answered", timeTakenMs: Math.max(0, Date.now() - questionStartedAt) } }));
  };

  const handleNext = () => {
    if (currentIndex < questions.length - 1) setCurrentIndex((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const handleSubmitQuiz = async () => {
    setIsSubmitting(true);
    setSubmitError(null);

    if (isDemo) {
      const mockQuestions = MOCK_DOCUMENT.quiz as Array<
        QuizQuestion & { correctIndex?: number; correct_index?: number }
      >;
      let correctCount = 0;
      const reviewData = mockQuestions.map((q) => {
        const chosen =
          selectedAnswers[q.id] !== undefined ? selectedAnswers[q.id] : -1;
        const correctIdx = q.correctIndex ?? q.correct_index ?? 0;
        const isCorrect = chosen === correctIdx;
        if (isCorrect) correctCount += 1;
        return {
          questionId: q.id,
          question: q.question,
          options: q.options,
          selectedIndex: chosen,
          correctIndex: correctIdx,
          isCorrect,
        };
      });

      const resultPayload = {
        attemptId: undefined,
        quizId: selectedSetId,
        score: correctCount,
        total: mockQuestions.length,
        percentage: Math.round((correctCount / mockQuestions.length) * 100),
        documentTitle: MOCK_DOCUMENT.title,
        review: reviewData,
        createdAt: new Date().toISOString(),
      };

      sessionStorage.setItem(
        `quiz_result_${docId}`,
        JSON.stringify(resultPayload)
      );
      setIsSubmitting(false);
      onSubmitted();
      return;
    }

    try {
      const sessionId = getOrCreateSessionId();
      if (!selectedSetId) throw new Error("Set quiz tidak ditemukan.");

      const answers = questions.map(question => {
        const meta = answerMeta[question.id];
        return { question_id: question.id, selected_index: meta?.selectedIndex ?? selectedAnswers[question.id] ?? null, status: meta?.status ?? "skipped", time_taken_ms: meta?.timeTakenMs ?? Math.max(0, Date.now() - questionStartedAt) };
      });

      const res = await fetch(`/api/quiz/${selectedSetId}/attempts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, session_id: sessionId, mode }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      const data = await res.json();

      const resultPayload = {
        attemptId: data.attemptId,
        quizId: data.quizId || selectedSetId,
        score: data.score,
        total: data.total,
        percentage: data.percentage ?? (data.total ? Math.round((data.score / data.total) * 100) : 0),
        documentTitle: data.documentTitle || documentTitle,
        review: data.review.map((item: { selectedIndex: number | null }) => ({ ...item, selectedIndex: item.selectedIndex ?? -1 })),
        createdAt: data.createdAt,
      };
      sessionStorage.setItem(
        `quiz_result_${docId}`,
        JSON.stringify(resultPayload)
      );

      queryClient.invalidateQueries({ queryKey: queryKeys.attempts(docId) });

      onSubmitted();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : t("quiz.submitError")
      );
      setIsSubmitting(false);
    }
  };

  if (!currentQuestion) return null;

  return (
    <>
      {/* Question Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between mb-6">
        <div className="flex justify-between w-full">
          <span className="text-xs font-mono font-medium px-3 py-2 rounded-full bg-action-primary text-on-action-primary shadow-2xs dark:shadow-none">
          {t("quiz.questionOf", {
            current: currentIndex + 1,
            total: questions.length,
          })}
        </span>
        <span className="flex sm:hidden">
          {questions.length > 0 ? (
            <div className="flex items-center gap-2 text-xs font-mono text-text-secondary bg-surface-subtle px-3 py-1.5 rounded-lg border border-border">
              <span>{t("quiz.answered")}</span>
              <span className="font-bold text-text">
                {answeredCount} / {questions.length}
              </span>
            </div>
          ) : undefined}
        </span> 
        </div>
        <span className="text-xs text-text-muted font-mono">
          {mode === "time_attack" ? `Time Attack · ${Math.ceil(remainingMs / 1000)}s` : t("quiz.pickOne")}
        </span>
      </div>
      {mode === "time_attack" && <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-border"><div className={`h-full transition-all ${remainingMs < 5_000 ? "bg-danger" : "bg-success"}`} style={{ width: `${(remainingMs / TIME_ATTACK_QUESTION_MS) * 100}%` }} /></div>}

      {/* Question Card */}
      <div className="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-xs dark:shadow-none mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-text leading-relaxed mb-6">
          {currentQuestion.question}
        </h2>
        {currentQuestion.difficulty && <span className="inline-flex mb-4 rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary">{currentQuestion.difficulty}</span>}

        {/* 4 Options */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, optIdx) => {
            const isSelected = currentSelection === optIdx;
            return (
              <button
                key={optIdx}
                type="button"
                onClick={() => handleSelectOption(optIdx)}
                className={`w-full p-4 rounded-xl border text-left transition flex items-start gap-3.5 cursor-pointer text-xs sm:text-sm ${
                  isSelected
                    ? "border-action-primary bg-action-primary text-on-action-primary shadow-xs dark:shadow-none"
                    : "border-control-border bg-surface-subtle hover:bg-surface-hover text-text"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0 transition ${
                    isSelected
                      ? "bg-surface text-text"
                      : "bg-surface border border-border text-text-secondary"
                  }`}
                >
                  {optionLabels[optIdx]}
                </div>
                <span className="leading-relaxed pt-0.5">{option}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="bg-danger-subtle border border-danger-border p-3 rounded-lg mb-4">
          <p className="text-xs text-danger-text font-medium">{submitError}</p>
        </div>
      )}

      {/* Navigation & Submit Controls */}
      <div className="flex items-center justify-between gap-4">
        <Button
          variant="secondary"
          size="lg"
          onClick={handlePrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="w-4 h-4" />
          <span>{t("quiz.previous")}</span>
        </Button>

        {currentIndex === questions.length - 1 ? (
          <Button
            variant="success"
            size="lg"
            onClick={() => setShowConfirmDialog(true)}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t("quiz.calculatingScore")}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{t("quiz.finishAndScore")}</span>
              </>
            )}
          </Button>
        ) : (
          <Button variant="primary" size="lg" onClick={handleNext}>
            <span>{t("quiz.nextQuestion")}</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Submit Confirmation Dialog */}
      {showConfirmDialog && (
        <SubmitConfirmDialog
          answeredCount={answeredCount}
          total={questions.length}
          onCancel={() => setShowConfirmDialog(false)}
          onConfirm={() => {
            setShowConfirmDialog(false);
            handleSubmitQuiz();
          }}
        />
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const docId = (params?.id as string) || "";

  const isDemo = docId === "demo-os-memory";

  const [manualSetId, setManualSetId] = useState<string | null>(() => searchParams.get("setId"));
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerateMessage, setRegenerateMessage] = useState<string | null>(null);
  const [regenerateLimitReached, setRegenerateLimitReached] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generatingVariant, setGeneratingVariant] = useState<QuizGenerationVariant | null>(null);
  const [mode, setMode] = useState<QuizMode>("normal");
  const [started, setStarted] = useState(false);

  const [quizProgress, setQuizProgress] = useState({
    answeredCount: 0,
    total: 0,
    progressPercent: 0,
  });

  // ── Fetch quiz questions ──────────────────────────────────────────────────
  const {
    data: quizData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.quiz(docId, manualSetId),
    queryFn: () => fetchQuiz(docId, manualSetId ?? undefined),
    enabled: !!docId && !isDemo,
  });

  // Derived – no effect needed
  const selectedSetId = manualSetId ?? quizData?.quizSetId ?? null;

  // Demo mode
  const questions: QuizQuestion[] = isDemo
    ? (MOCK_DOCUMENT.quiz as QuizQuestion[])
    : quizData?.quiz || [];
  const sets: QuizSetOption[] = isDemo ? [] : quizData?.sets || [];
  const documentTitle = isDemo
    ? MOCK_DOCUMENT.title
    : quizData?.documentTitle || "";

  const selectedSetLabel = isDemo ? null : quizData?.quizSetLabel || null;

  useEffect(() => { if (isDemo) setStarted(true); }, [isDemo]);

  const handleRetry = () => {
    refetch();
  };

  // ── Switch quiz set ──────────────────────────────────────────────────────
  const selectQuizSet = (setId: string) => {
    if (!setId || setId === selectedSetId) return;
    setManualSetId(setId);
    setStarted(false);
    setRegenerateMessage(null);
    setQuizProgress({ answeredCount: 0, total: 0, progressPercent: 0 });
  };

  const handleSetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    selectQuizSet(e.target.value);
  };

  // ── Regenerate quiz set ──────────────────────────────────────────────────
  const handleGenerateSet = async (variant: QuizGenerationVariant) => {
    if (regenerateLimitReached) return;
    if (variant === "harder" && !selectedSetId) {
      setRegenerateError("Buat set quiz pertama sebelum menaikkan tingkat kesulitan.");
      return;
    }
    setIsRegenerating(true);
    setGeneratingVariant(variant);
    setRegenerateError(null);
    setRegenerateMessage(null);
    try {
      const storageKey = variant === "harder"
        ? `yoohoo:quiz-level-up:${selectedSetId}`
        : `yoohoo:quiz-regenerate:${docId}`;
      const idempotencyKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, idempotencyKey);
      const endpoint = variant === "harder"
        ? `/api/quiz/${selectedSetId}/level-up`
        : `/api/documents/${docId}/quiz/regenerate`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.requireAuth) {
          router.push(
            "/login?message=" +
              encodeURIComponent("Login dulu untuk membuat soal baru")
          );
          return;
        }
        if (res.status === 429 || body.limitReached) { setRegenerateLimitReached(true); throw new Error(body.error || "Limit harian sudah tercapai. Coba lagi besok."); }
        throw new Error(body.error || t("quiz.newSetError"));
      }

      const data = await res.json();

      setManualSetId(data.quizSet?.id || null);
      sessionStorage.removeItem(storageKey);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["quiz", docId] }),
        queryClient.invalidateQueries({ queryKey: ["notifications"] }),
        queryClient.invalidateQueries({ queryKey: ["unreadCount"] }),
      ]);
      setStarted(false);
      setQuizProgress({ answeredCount: 0, total: 0, progressPercent: 0 });
      setShowGenerateDialog(false);
      setRegenerateMessage(data.message || (variant === "harder" ? "Set quiz lebih sulit berhasil dibuat." : t("quiz.newSetSuccess")));
    } catch (err: unknown) {
      setRegenerateError(
        err instanceof Error ? err.message : t("quiz.newSetError")
      );
    } finally {
      setIsRegenerating(false);
      setGeneratingVariant(null);
    }
  };

  const { answeredCount, total: totalQuestions, progressPercent } = quizProgress;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between text-text">
      {/*
      <Navbar
        backHref={`/desk/${docId}/flashcards`}
        title={isLoading ? undefined : documentTitle}
        subtitle={
          <>
            Quiz Pilihan Ganda
            {!isLoading && selectedSetLabel && ` · ${selectedSetLabel}`}
            {!isLoading && totalQuestions > 0 && ` · ${totalQuestions} Soal`}
          </>
        }
        rightContent={
          !isLoading && totalQuestions > 0 ? (
            <div className="flex items-center gap-2 text-xs font-mono text-text-secondary bg-surface-subtle px-3 py-1.5 rounded-lg border border-border">
              <span>{t("quiz.answered")}</span>
              <span className="font-bold text-text">
                {answeredCount} / {totalQuestions}
              </span>
            </div>
          ) : undefined
        }
        bottomBar={
          <div className="w-full bg-surface-subtle h-1.5">
            <div
              className="bg-accent h-1.5 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        }
      />
      */}

      <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-6 pt-6 text-xs text-text-muted">
        <span className="shrink-0 font-mono">{answeredCount} / {totalQuestions} terjawab</span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border"><div className="h-full bg-accent transition-all" style={{ width: `${progressPercent}%` }} /></div>
      </div>

      {/* Main Quiz Container */}
      <main className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full flex flex-col justify-center">
        {/* Loading state */}
        {isLoading && (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-text-muted mb-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("quiz.loading")}</span>
            </div>
            <QuestionSkeleton />
          </div>
        )}

        {/* Error (fetch) state */}
        {!isLoading && error && (
          <ErrorState
            title={t("quiz.notFoundTitle")}
            message={t("quiz.notFoundMessage")}
            actions={[
              { label: t("error.retry"), onClick: handleRetry, variant: "primary" },
              { label: t("error.home"), href: "/", variant: "secondary" },
            ]}
          />
        )}

        {/* Quiz Set Selector & Regenerate */}
        {!isLoading && !error && sets.length > 0 && (
          <div className="mb-6 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-text-secondary">
                <span className="font-medium">{t("quiz.setLabel")}</span>
                <select
                  value={selectedSetId ?? ""}
                  onChange={handleSetChange}
                  disabled={isLoading || isRegenerating}
                  className="px-3 py-2 rounded-xl border border-control-border bg-surface text-xs font-medium text-text disabled:opacity-50 cursor-pointer"
                >
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.questionCount} Soal)
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={() => setShowGenerateDialog(true)}
                disabled={isRegenerating || regenerateLimitReached}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-surface border border-control-border text-xs font-medium text-text-secondary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>
                  {isRegenerating ? t("quiz.creatingSet") : t("quiz.newSet")}
                </span>
              </button>
            </div>

            {regenerateError && (
              <div className="bg-danger-subtle border border-danger-border p-3 rounded-lg">
                <p className="text-xs text-danger-text font-medium">
                  {regenerateError}
                </p>
                {!regenerateLimitReached && <button
                  onClick={() => setShowGenerateDialog(true)}
                  className="mt-2 text-xs text-text font-medium underline underline-offset-2 hover:text-text-secondary transition cursor-pointer"
                >
                  {t("error.retry")}
                </button>}
              </div>
            )}

            {regenerateMessage && (
              <div className="flex items-center gap-2 text-xs text-success-text bg-success-subtle border border-success-border p-3 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{regenerateMessage}</span>
              </div>
            )}
          </div>
        )}

        {!isLoading && !error && !isDemo && questions.length === 0 && (
          <div className="rounded-2xl border border-border bg-surface p-6 text-center shadow-xs dark:shadow-none sm:p-8">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-success-subtle text-success-text">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-text">Quiz belum tersedia</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-muted">
              Buat set quiz dari flashcard materi ini. Prosesnya dapat membutuhkan beberapa saat.
            </p>
            {regenerateError && <p className="mt-4 text-xs font-medium text-danger-text">{regenerateError}</p>}
            <Button
              className="mt-5"
              size="lg"
              variant="success"
              onClick={() => setShowGenerateDialog(true)}
              disabled={isRegenerating || regenerateLimitReached}
            >
              {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isRegenerating ? "Membuat quiz..." : "Buat quiz sekarang"}
            </Button>
          </div>
        )}

        {!isLoading && !error && !isDemo && questions.length > 0 && !started && (
          <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-xs dark:shadow-none mb-6">
            <h2 className="text-lg font-semibold text-text">Pilih mode pengerjaan</h2>
            {selectedSetLabel && <p className="mt-1 text-xs font-medium text-success-text">Set aktif: {selectedSetLabel}</p>}
            <p className="mt-2 text-sm text-text-secondary">Time Attack memberi waktu {TIME_ATTACK_QUESTION_MS / 1000} detik untuk setiap soal.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(["normal", "time_attack"] as QuizMode[]).map(value => (
                <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-xl border p-4 text-left transition ${mode === value ? "border-action-primary bg-action-primary text-on-action-primary" : "border-control-border bg-surface-subtle hover:bg-surface-hover"}`}>
                  <span className="block text-sm font-semibold">{value === "normal" ? "Normal" : "Time Attack"}</span>
                  <span className={`mt-1 block text-xs ${mode === value ? "opacity-75" : "text-text-muted"}`}>{value === "normal" ? "Tanpa batas waktu per soal" : `${TIME_ATTACK_QUESTION_MS / 1000} detik per soal`}</span>
                </button>
              ))}
            </div>
            <Button className="mt-5 w-full" size="lg" variant="success" onClick={() => setStarted(true)}>Mulai Quiz</Button>
          </div>
        )}

        {!isLoading && !error && !isDemo && sets.length > 0 && !started && (
          <section className="rounded-2xl border border-border bg-surface p-5 shadow-xs dark:shadow-none sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-text">
                  <History className="h-4 w-4" />
                  <h2 className="text-base font-semibold">Riwayat set soal</h2>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  Semua set yang pernah dibuat tetap tersimpan. Pilih satu untuk dilihat dan dikerjakan lagi.
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-subtle px-2.5 py-1 text-[11px] font-medium text-text-secondary">
                {sets.length} set
              </span>
            </div>

            <div className="mt-4 space-y-3">
              {[...sets].reverse().map((set) => {
                const isActive = set.id === selectedSetId;
                return (
                  <article key={set.id} className={`rounded-xl border p-4 transition ${isActive ? "border-success-border bg-success-subtle" : "border-border bg-surface-subtle"}`}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-text">{set.label}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${set.variant === "harder" ? "bg-warning-subtle text-warning-text" : set.variant === "different" ? "bg-accent-subtle text-accent" : "bg-surface-raised text-text-secondary"}`}>
                            {quizVariantLabel(set.variant)}
                          </span>
                          {isActive && <span className="rounded-full bg-success px-2 py-0.5 text-[10px] font-semibold text-on-success">Aktif</span>}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />{formatQuizSetDate(set.createdAt)}</span>
                          <span>{set.questionCount} soal</span>
                          <span>Mudah {set.difficultyCounts.easy}</span>
                          <span>Sedang {set.difficultyCounts.medium}</span>
                          <span>Sulit {set.difficultyCounts.hard}</span>
                        </div>
                      </div>
                      <Button type="button" size="sm" variant={isActive ? "secondary" : "primary"} disabled={isActive || isRegenerating} onClick={() => selectQuizSet(set.id)}>
                        {isActive ? "Sedang dibuka" : "Lihat set"}
                      </Button>
                    </div>
                    {isActive && questions.length > 0 && (
                      <div className="mt-4 border-t border-success-border pt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Daftar soal dalam set ini</p>
                        <ol className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-2">
                          {questions.map((question, index) => (
                            <li key={question.id} className="flex gap-2 text-xs leading-relaxed text-text-secondary">
                              <span className="font-mono text-text-muted">{String(index + 1).padStart(2, "0")}</span>
                              <span>{question.question}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {/* Quiz – keyed so child state resets when set or question count changes */}
        {!isLoading && !error && questions.length > 0 && (isDemo || started) && (
          <QuizContent
            key={`${selectedSetId}-${questions.length}`}
            questions={questions}
            docId={docId}
            documentTitle={documentTitle}
            isDemo={isDemo}
            selectedSetId={selectedSetId}
            mode={mode}
            onSubmitted={() => router.push(`/desk/${docId}/quiz/results`)}
            onProgressChange={setQuizProgress}
          />
        )}
      </main>

      {showGenerateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4 backdrop-blur-[2px]" role="presentation" onMouseDown={() => !isRegenerating && setShowGenerateDialog(false)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface-raised p-5 shadow-2xl dark:shadow-none sm:p-6" role="dialog" aria-modal="true" aria-labelledby="generate-quiz-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Generate quiz</p>
                <h2 id="generate-quiz-title" className="mt-1 text-xl font-semibold text-text">Pilih set berikutnya</h2>
                <p className="mt-2 text-sm leading-relaxed text-text-muted">Set sebelumnya tidak dihapus dan tetap bisa dibuka dari riwayat.</p>
              </div>
              <button type="button" aria-label="Tutup" disabled={isRegenerating} onClick={() => setShowGenerateDialog(false)} className="rounded-lg p-2 text-text-muted transition hover:bg-surface-hover disabled:opacity-40">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={isRegenerating || regenerateLimitReached} onClick={() => handleGenerateSet("different")} className="group rounded-2xl border border-control-border bg-surface-subtle p-4 text-left transition hover:border-accent hover:bg-accent-subtle disabled:cursor-not-allowed disabled:opacity-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-subtle text-accent"><Shuffle className="h-4 w-4" /></span>
                <span className="mt-4 block text-sm font-semibold text-text">Soal berbeda</span>
                <span className="mt-1 block text-xs leading-relaxed text-text-muted">Buat variasi pertanyaan baru tanpa mengulang soal yang pernah dibuat.</span>
                {generatingVariant === "different" && <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-accent"><Loader2 className="h-3.5 w-3.5 animate-spin" />Membuat set...</span>}
              </button>

              <button type="button" disabled={isRegenerating || regenerateLimitReached || !selectedSetId} onClick={() => handleGenerateSet("harder")} className="group rounded-2xl border border-control-border bg-surface-subtle p-4 text-left transition hover:border-warning hover:bg-warning-subtle disabled:cursor-not-allowed disabled:opacity-50">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-warning-subtle text-warning-text"><TrendingUp className="h-4 w-4" /></span>
                <span className="mt-4 block text-sm font-semibold text-text">Lebih sulit</span>
                <span className="mt-1 block text-xs leading-relaxed text-text-muted">Buat set hard baru berbasis analisis kasus dan gabungan beberapa konsep.</span>
                {generatingVariant === "harder" && <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-warning-text"><Loader2 className="h-3.5 w-3.5 animate-spin" />Menaikkan level...</span>}
              </button>
            </div>

            {!selectedSetId && <p className="mt-3 text-xs text-text-muted">Opsi lebih sulit tersedia setelah set quiz pertama dibuat.</p>}
            {regenerateError && <p className="mt-4 rounded-xl border border-danger-border bg-danger-subtle p-3 text-xs font-medium text-danger-text">{regenerateError}</p>}
            {regenerateLimitReached && <p className="mt-4 text-xs font-medium text-warning-text">Limit generate harian sudah tercapai. Coba lagi besok.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
