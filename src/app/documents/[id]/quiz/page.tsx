"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MOCK_DOCUMENT } from "@/lib/mock-data";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from "lucide-react";
import ErrorState from "@/components/ui/ErrorState";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/layout/Navbar";
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
}

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

// ─── Skeleton ────────────────────────────────────────────────────────────────
function QuestionSkeleton() {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-6 animate-pulse">
      <div className="h-5 bg-neutral-100 rounded w-3/4 mb-4" />
      <div className="h-4 bg-neutral-100 rounded w-1/2 mb-6" />
      <div className="space-y-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-neutral-50 border border-neutral-100 rounded-xl" />
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
          <span className="text-xs font-mono font-medium px-3 py-2 rounded-full bg-neutral-900 text-white shadow-2xs">
          {t("quiz.questionOf", {
            current: currentIndex + 1,
            total: questions.length,
          })}
        </span>
        <span className="flex sm:hidden">
          {questions.length > 0 ? (
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-200">
              <span>{t("quiz.answered")}</span>
              <span className="font-bold text-neutral-900">
                {answeredCount} / {questions.length}
              </span>
            </div>
          ) : undefined}
        </span> 
        </div>
        <span className="text-xs text-neutral-400 font-mono">
          {mode === "time_attack" ? `Time Attack · ${Math.ceil(remainingMs / 1000)}s` : t("quiz.pickOne")}
        </span>
      </div>
      {mode === "time_attack" && <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-neutral-200"><div className={`h-full transition-all ${remainingMs < 5_000 ? "bg-rose-500" : "bg-emerald-600"}`} style={{ width: `${(remainingMs / TIME_ATTACK_QUESTION_MS) * 100}%` }} /></div>}

      {/* Question Card */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 shadow-xs mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-neutral-900 leading-relaxed mb-6">
          {currentQuestion.question}
        </h2>
        {currentQuestion.difficulty && <span className="inline-flex mb-4 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-neutral-600">{currentQuestion.difficulty}</span>}

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
                    ? "border-neutral-900 bg-neutral-900 text-white shadow-xs"
                    : "border-neutral-200 bg-neutral-50/50 hover:bg-neutral-100/70 hover:border-neutral-300 text-neutral-800"
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center font-mono font-bold text-xs shrink-0 transition ${
                    isSelected
                      ? "bg-white text-neutral-900"
                      : "bg-white border border-neutral-200 text-neutral-600"
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
        <div className="bg-neutral-50 border border-neutral-200 p-3 rounded-lg mb-4">
          <p className="text-xs text-neutral-700 font-medium">{submitError}</p>
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
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const docId = (params?.id as string) || "";

  const isDemo = docId === "demo-os-memory";

  const [manualSetId, setManualSetId] = useState<string | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerateMessage, setRegenerateMessage] = useState<string | null>(null);
  const [regenerateLimitReached, setRegenerateLimitReached] = useState(false);
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
  const handleSetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const setId = e.target.value;
    if (!setId || setId === selectedSetId) return;
    setManualSetId(setId);
  };

  // ── Regenerate quiz set ──────────────────────────────────────────────────
  const handleRegenerate = async () => {
    if (regenerateLimitReached) return;
    setIsRegenerating(true);
    setRegenerateError(null);
    setRegenerateMessage(null);
    try {
      const storageKey = `yoohoo:quiz-regenerate:${docId}`;
      const idempotencyKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, idempotencyKey);
      const res = await fetch(`/api/documents/${docId}/quiz/regenerate`, {
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
      sessionStorage.removeItem(`yoohoo:quiz-regenerate:${docId}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.quiz(docId) });
      setRegenerateMessage(data.message || t("quiz.newSetSuccess"));
    } catch (err: unknown) {
      setRegenerateError(
        err instanceof Error ? err.message : t("quiz.newSetError")
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  const { answeredCount, total: totalQuestions, progressPercent } = quizProgress;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar
        backHref={`/documents/${docId}/flashcards`}
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
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-600 bg-neutral-100 px-3 py-1.5 rounded-lg border border-neutral-200">
              <span>{t("quiz.answered")}</span>
              <span className="font-bold text-neutral-900">
                {answeredCount} / {totalQuestions}
              </span>
            </div>
          ) : undefined
        }
        bottomBar={
          <div className="w-full bg-neutral-100 h-1.5">
            <div
              className="bg-neutral-900 h-1.5 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        }
      />

      {/* Main Quiz Container */}
      <main className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full flex flex-col justify-center">
        {/* Loading state */}
        {isLoading && (
          <div className="w-full flex flex-col gap-4">
            <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
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
              <label className="flex items-center gap-2 text-xs text-neutral-600">
                <span className="font-medium">{t("quiz.setLabel")}</span>
                <select
                  value={selectedSetId ?? ""}
                  onChange={handleSetChange}
                  disabled={isLoading || isRegenerating}
                  className="px-3 py-2 rounded-xl border border-neutral-200 bg-white text-xs font-medium text-neutral-800 focus:outline-none focus:ring-2 focus:ring-neutral-900/10 focus:border-neutral-900 disabled:opacity-50 cursor-pointer"
                >
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label} ({s.questionCount} Soal)
                    </option>
                  ))}
                </select>
              </label>

              <button
                onClick={handleRegenerate}
                disabled={isRegenerating || regenerateLimitReached}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
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
              <div className="bg-neutral-50 border border-neutral-200 p-3 rounded-lg">
                <p className="text-xs text-neutral-700 font-medium">
                  {regenerateError}
                </p>
                {!regenerateLimitReached && <button
                  onClick={handleRegenerate}
                  className="mt-2 text-xs text-neutral-900 font-medium underline underline-offset-2 hover:text-neutral-600 transition cursor-pointer"
                >
                  {t("error.retry")}
                </button>}
              </div>
            )}

            {regenerateMessage && (
              <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{regenerateMessage}</span>
              </div>
            )}
          </div>
        )}

        {!isLoading && !error && !isDemo && questions.length > 0 && !started && (
          <div className="rounded-2xl border border-neutral-200 bg-white p-6 sm:p-8 shadow-xs mb-6">
            <h2 className="text-lg font-semibold text-neutral-900">Pilih mode pengerjaan</h2>
            <p className="mt-2 text-sm text-neutral-600">Time Attack memberi waktu {TIME_ATTACK_QUESTION_MS / 1000} detik untuk setiap soal.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(["normal", "time_attack"] as QuizMode[]).map(value => (
                <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-xl border p-4 text-left transition ${mode === value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 bg-neutral-50 hover:border-neutral-400"}`}>
                  <span className="block text-sm font-semibold">{value === "normal" ? "Normal" : "Time Attack"}</span>
                  <span className={`mt-1 block text-xs ${mode === value ? "text-neutral-300" : "text-neutral-500"}`}>{value === "normal" ? "Tanpa batas waktu per soal" : `${TIME_ATTACK_QUESTION_MS / 1000} detik per soal`}</span>
                </button>
              ))}
            </div>
            <Button className="mt-5 w-full" size="lg" variant="success" onClick={() => setStarted(true)}>Mulai Quiz</Button>
          </div>
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
            onSubmitted={() => router.push(`/documents/${docId}/quiz/results`)}
            onProgressChange={setQuizProgress}
          />
        )}
      </main>
    </div>
  );
}
