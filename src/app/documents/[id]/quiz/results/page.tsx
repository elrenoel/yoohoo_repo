"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  Home,
  ArrowRight,
  Trophy,
  Minus,
} from "lucide-react";
import Card from "@/components/ui/Card";
import { formatDateTime } from "@/lib/format-date";

interface ReviewItem {
  questionId: string;
  question: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
}

interface QuizResult {
  attemptId?: string;
  quizId?: string | null;
  score: number;
  total: number;
  percentage: number;
  documentTitle: string;
  review: ReviewItem[];
  createdAt?: string;
}

interface QuizSummary {
  accuracy: number;
  avg_time_per_question: number | null;
  timeout_or_skip_rate: number;
  breakdown_by_difficulty: Record<string, { correct: number; total: number; accuracy: number }>;
  suggestion: { type: "level_up" | "review_or_continue" | "review_material"; message: string };
  wrong_answers?: Array<{ question_id: string; question: string; options: string[]; selected_index: number; correct_index: number; explanation: string | null; status: string }>;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

/**
 * Session storage can contain results written by an older quiz response shape.
 * Normalize it at the boundary so the results page never assumes that an
 * options array (or any other review field) is present.
 */
function normalizeReview(raw: unknown): ReviewItem[] {
  if (!Array.isArray(raw)) return [];

  return raw.map((value, index) => {
    const item = (value && typeof value === "object" ? value : {}) as Partial<ReviewItem>;
    const options = Array.isArray(item.options)
      ? item.options.filter((option): option is string => typeof option === "string")
      : [];
    const selectedCandidate = Number(item.selectedIndex);
    const correctCandidate = Number(item.correctIndex);
    const selectedIndex = Number.isInteger(selectedCandidate) ? selectedCandidate : -1;
    const correctIndex = Number.isInteger(correctCandidate) ? correctCandidate : -1;

    return {
      questionId: typeof item.questionId === "string" ? item.questionId : `legacy-${index}`,
      question:
        typeof item.question === "string" && item.question.trim()
          ? item.question
          : "Pertanyaan tidak tersedia",
      options,
      selectedIndex,
      correctIndex,
      isCorrect:
        typeof item.isCorrect === "boolean"
          ? item.isCorrect
          : selectedIndex >= 0 && selectedIndex === correctIndex,
    };
  });
}

function ScoreGrade({ percentage }: { percentage: number }) {
  if (percentage >= 85) {
    return (
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
        Sangat Baik 🎉
      </span>
    );
  }
  if (percentage >= 70) {
    return (
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
        Baik
      </span>
    );
  }
  if (percentage >= 50) {
    return (
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
        Perlu Berlatih Lagi
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
      Pelajari Lagi Materi
    </span>
  );
}

export default function QuizResultsPage() {
  const params = useParams();
  const router = useRouter();
  const docId = (params?.id as string) || "demo-os-memory";

  const [result, setResult] = useState<QuizResult | null>(null);
  const [summary, setSummary] = useState<QuizSummary | null>(null);
  const [levelingUp, setLevelingUp] = useState(false);
  const [levelUpError, setLevelUpError] = useState("");
  const [levelUpLimitReached, setLevelUpLimitReached] = useState(false);
  const [starSaving, setStarSaving] = useState(false);
  const [starredFromResult, setStarredFromResult] = useState(false);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [suggestionHidden, setSuggestionHidden] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(`quiz_result_${docId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<QuizResult>;
          const review = normalizeReview(parsed.review);
          const normalized: QuizResult = {
            attemptId: typeof parsed.attemptId === "string" ? parsed.attemptId : undefined,
            quizId: typeof parsed.quizId === "string" ? parsed.quizId : null,
            score: Number.isFinite(Number(parsed.score)) ? Number(parsed.score) : 0,
            total: Number.isFinite(Number(parsed.total)) ? Number(parsed.total) : review.length,
            percentage: Number.isFinite(Number(parsed.percentage)) ? Number(parsed.percentage) : 0,
            documentTitle:
              typeof parsed.documentTitle === "string" && parsed.documentTitle.trim()
                ? parsed.documentTitle
                : "Hasil Kuis",
            review,
            createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : undefined,
          };

          setResult(normalized);
          const hasIncompleteReview = review.some(
            item => item.question === "Pertanyaan tidak tersedia" || item.options.length === 0,
          );
          if (hasIncompleteReview) {
            fetch(`/api/documents/${docId}/quiz`, { cache: "no-store" })
              .then(async response => response.ok ? response.json() as Promise<{
                success?: boolean;
                quizSetId?: string | null;
                quiz?: Array<{ id?: string; question?: string; options?: unknown }>;
              }> : null)
              .then(data => {
                if (!data?.success || !Array.isArray(data.quiz)) return;
                const byId = new Map(data.quiz.map((question, index) => [
                  typeof question.id === "string" ? question.id : `index-${index}`,
                  question,
                ]));
                const hydratedReview = normalized.review.map((item, index) => {
                  const source = byId.get(item.questionId) ?? data.quiz?.[index];
                  if (!source) return item;
                  const options = Array.isArray(source.options)
                    ? source.options.filter((option): option is string => typeof option === "string")
                    : item.options;
                  return {
                    ...item,
                    question:
                      typeof source.question === "string" && source.question.trim()
                        ? source.question
                        : item.question,
                    options,
                    // Legacy results did not persist correctIndex. For an
                    // answer already known to be correct, the selected index
                    // is necessarily the correct one and can be highlighted.
                    correctIndex:
                      item.correctIndex >= 0
                        ? item.correctIndex
                        : item.isCorrect && item.selectedIndex >= 0
                        ? item.selectedIndex
                        : -1,
                  };
                });
                setResult(current => current ? {
                  ...current,
                  quizId: current.quizId ?? data.quizSetId ?? null,
                  review: hydratedReview,
                } : current);
              })
              .catch(() => undefined);
          }
          if (normalized.attemptId) {
            fetch(`/api/quiz/attempts/${normalized.attemptId}/summary`, { cache: "no-store" })
              .then(async response => response.ok ? response.json() as Promise<{ success: boolean } & QuizSummary> : null)
              .then(data => { if (data?.success) setSummary(data); })
              .catch(() => undefined);
          }
        } catch {
          router.replace("/");
        }
      } else {
        router.replace(`/desk/${docId}/quiz`);
      }
    }
  }, [docId, router]);

  if (!result) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <p className="text-sm text-neutral-500 font-mono">Memuat hasil kuis...</p>
      </div>
    );
  }

  const correctItems = result.review.filter((r) => r.isCorrect);
  const wrongItems = result.review.filter((r) => !r.isCorrect);
  const skippedItems = result.review.filter((r) => r.selectedIndex === -1);

  async function handleLevelUp() {
    const currentResult = result;
    if (!currentResult?.quizId || levelingUp || levelUpLimitReached) return;
    setLevelingUp(true); setLevelUpError("");
    try {
      const storageKey = `yoohoo:quiz-level-up:${currentResult.quizId}`;
      const idempotencyKey = sessionStorage.getItem(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, idempotencyKey);
      const response = await fetch(`/api/quiz/${currentResult.quizId}/level-up`, { method: "POST", headers: { "Idempotency-Key": idempotencyKey } });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { if (response.status === 429 || body.limitReached) setLevelUpLimitReached(true); throw new Error(body.error || "Level up gagal."); }
      sessionStorage.removeItem(storageKey);
      router.push(`/desk/${docId}/quiz?setId=${body.quizSet.id}`);
    } catch (error) {
      setLevelUpError(error instanceof Error ? error.message : "Level up gagal.");
      setLevelingUp(false);
    }
  }

  async function handleStarMaterial() {
    if (starSaving || starredFromResult) return;
    setStarSaving(true);
    try {
      const response = await fetch(`/api/documents/${docId}/star`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_starred: true }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Gagal menandai materi.");
      setStarredFromResult(true);
    } catch (error) { setLevelUpError(error instanceof Error ? error.message : "Gagal menandai materi."); }
    finally { setStarSaving(false); }
  }

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      {/*
      <Navbar
        backHref="/"
        title={result.documentTitle}
        subtitle="Hasil Kuis"
      />
      */}

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-6 py-10 flex-1 w-full">
        {/* Score Hero Card */}
        <Card className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-neutral-100 border border-neutral-200 text-neutral-800 mb-4">
            <Trophy className="w-8 h-8" />
          </div>

          <div className="text-6xl font-bold tracking-tight text-neutral-900 mb-1">
            {result.percentage}
            <span className="text-2xl text-neutral-500 font-normal">%</span>
          </div>

          <p className="text-sm text-neutral-600 mb-3">
            <strong className="text-neutral-900">{result.score}</strong> dari{" "}
            <strong className="text-neutral-900">{result.total}</strong> soal benar
          </p>

          <ScoreGrade percentage={result.percentage} />

          {result.createdAt && (
            <p className="text-[11px] text-neutral-400 font-mono mt-3">
              Dikerjakan pada {formatDateTime(result.createdAt)}
            </p>
          )}

          {/* Mini Stats Row */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-neutral-100 text-xs">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-700">{correctItems.length}</div>
              <div className="text-neutral-500 mt-0.5">Benar</div>
            </div>
            <div className="text-center border-x border-neutral-100">
              <div className="text-2xl font-bold text-rose-600">{wrongItems.length}</div>
              <div className="text-neutral-500 mt-0.5">Salah</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-neutral-400">{skippedItems.length}</div>
              <div className="text-neutral-500 mt-0.5">Dilewati</div>
            </div>
          </div>
        </Card>

        {summary && !suggestionHidden && (
          <Card className="mb-6">
            <h2 className="text-sm font-semibold text-neutral-900">Analisis performa</h2>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-xl bg-neutral-50 p-3"><div className="text-lg font-bold">{Math.round(summary.accuracy * 100)}%</div><div className="text-[11px] text-neutral-500">Akurasi</div></div>
              <div className="rounded-xl bg-neutral-50 p-3"><div className="text-lg font-bold">{summary.avg_time_per_question === null ? "-" : `${Math.round(summary.avg_time_per_question / 1000)}s`}</div><div className="text-[11px] text-neutral-500">Rata-rata waktu</div></div>
              <div className="rounded-xl bg-neutral-50 p-3"><div className="text-lg font-bold">{Math.round(summary.timeout_or_skip_rate * 100)}%</div><div className="text-[11px] text-neutral-500">Skip/timeout</div></div>
              <div className="rounded-xl bg-neutral-50 p-3"><div className="text-lg font-bold">{Object.keys(summary.breakdown_by_difficulty).length}</div><div className="text-[11px] text-neutral-500">Level dianalisis</div></div>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {["easy", "medium", "hard"].map(level => { const item = summary.breakdown_by_difficulty[level]; return <div key={level} className="flex items-center justify-between rounded-lg border border-neutral-100 px-3 py-2 text-xs"><span className="capitalize text-neutral-600">{level}</span><span className="font-semibold">{item ? `${Math.round(item.accuracy * 100)}% (${item.correct}/${item.total})` : "-"}</span></div>; })}
            </div>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-950">{summary.suggestion.message}</p>
              {summary.suggestion.type === "review_or_continue" && <div className="mt-3 flex gap-2"><button type="button" onClick={() => setReviewExpanded(true)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-medium text-amber-900 hover:bg-amber-100">Ya, review dulu</button><button type="button" onClick={() => setSuggestionHidden(true)} className="rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100">Lanjut aja</button></div>}
              {summary.suggestion.type === "level_up" && <button type="button" onClick={handleLevelUp} disabled={levelingUp || levelUpLimitReached} className="mt-3 rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50">{levelingUp ? "Menyiapkan level..." : levelUpLimitReached ? "Limit harian tercapai" : "Coba level lebih susah"}</button>}
              {summary.suggestion.type === "review_material" && <Link href={`/desk/${docId}/flashcards`} className="mt-3 inline-flex rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white">Kembali ke flashcard</Link>}
              {summary.suggestion.type === "review_material" && <button type="button" onClick={handleStarMaterial} disabled={starSaving || starredFromResult} className="mt-3 ml-2 inline-flex rounded-lg border border-amber-300 bg-white px-4 py-2 text-xs font-medium text-amber-800 disabled:opacity-60">{starredFromResult ? "Materi ditandai" : starSaving ? "Menandai..." : "Tandai untuk dipelajari lagi"}</button>}
              {levelUpError && <p className="mt-2 text-xs text-rose-700">{levelUpError}</p>}
            </div>
          </Card>
        )}

        {reviewExpanded && summary?.suggestion.type === "review_or_continue" && (
          <Card className="mb-6 border-amber-200">
            <div className="flex items-center justify-between mb-4"><h2 className="text-sm font-semibold text-neutral-900">Review jawaban yang salah</h2><button type="button" onClick={() => setReviewExpanded(false)} className="text-xs text-neutral-500 hover:text-neutral-900">Tutup</button></div>
            {(summary.wrong_answers ?? []).length === 0 ? <p className="text-sm text-neutral-500">Belum ada detail jawaban yang tersimpan untuk attempt ini.</p> : <div className="space-y-4">{summary.wrong_answers?.map((item, index) => <div key={item.question_id} className="rounded-xl border border-neutral-200 p-4"><p className="text-xs font-mono text-neutral-400 mb-1">SOAL {index + 1}</p><p className="text-sm font-semibold text-neutral-900">{item.question}</p><div className="mt-3 space-y-2">{item.options.map((option, optionIndex) => <div key={optionIndex} className={`rounded-lg border px-3 py-2 text-xs ${optionIndex === item.correct_index ? "border-emerald-300 bg-emerald-50 text-emerald-900" : optionIndex === item.selected_index ? "border-rose-300 bg-rose-50 text-rose-900" : "border-neutral-100 bg-neutral-50 text-neutral-600"}`}><span className="mr-2 font-semibold">{OPTION_LABELS[optionIndex]}</span>{option}{optionIndex === item.correct_index && <span className="ml-2 text-emerald-700">✓ Jawaban benar</span>}{optionIndex === item.selected_index && optionIndex !== item.correct_index && <span className="ml-2 text-rose-700">✕ Pilihan kamu</span>}</div>)}</div>{item.explanation && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-xs leading-relaxed text-blue-900"><strong>Penjelasan:</strong> {item.explanation}</p>}</div>)}</div>}
          </Card>
        )}

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <Link
            href={`/desk/${docId}/quiz`}
            className="flex-1 py-3 px-4 text-sm font-medium rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition text-center flex items-center justify-center gap-2 shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Ulangi Kuis</span>
          </Link>
          <Link
            href={`/desk/${docId}/flashcards`}
            className="flex-1 py-3 px-4 text-sm font-medium rounded-xl bg-white border border-neutral-200 text-neutral-800 hover:bg-neutral-50 transition text-center flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Pelajari Flashcard Lagi</span>
          </Link>
          <Link
            href="/desk"
            className="flex-1 py-3 px-4 text-sm font-medium rounded-xl bg-white border border-neutral-200 text-neutral-800 hover:bg-neutral-50 transition text-center flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Upload Materi Baru</span>
          </Link>
        </div>

        {/* Review Section */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Pembahasan Jawaban</h2>
          <span className="text-xs text-neutral-500 font-mono">
            {result.total} soal
          </span>
        </div>

        <div className="space-y-4">
          {result.review.map((item, idx) => {
            const isSkipped = item.selectedIndex === -1;
            const statusColor = item.isCorrect
              ? "border-emerald-200 bg-emerald-50/40"
              : isSkipped
              ? "border-neutral-200 bg-neutral-50"
              : "border-rose-200 bg-rose-50/40";

            return (
              <div
                key={item.questionId}
                className={`bg-white rounded-xl border p-5 shadow-2xs ${statusColor}`}
              >
                {/* Question Header */}
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className={`mt-0.5 shrink-0 ${
                      item.isCorrect
                        ? "text-emerald-600"
                        : isSkipped
                        ? "text-neutral-400"
                        : "text-rose-600"
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
                    <p className="text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-wider mb-1">
                      Soal {idx + 1}
                    </p>
                    <p className="text-sm font-semibold text-neutral-900 leading-relaxed">
                      {item.question}
                    </p>
                  </div>
                </div>

                {/* Options */}
                <div className="space-y-2 ml-8">
                  {item.options.length > 0 ? item.options.map((opt, optIdx) => {
                    const isCorrectOption = optIdx === item.correctIndex;
                    const isUserChoice = optIdx === item.selectedIndex;

                    let optClass = "border-neutral-200 text-neutral-600 bg-neutral-50";
                    let labelClass = "bg-neutral-100 text-neutral-600";

                    if (isCorrectOption) {
                      optClass = "border-emerald-300 bg-emerald-50 text-emerald-900";
                      labelClass = "bg-emerald-200 text-emerald-900";
                    }
                    if (isUserChoice && !item.isCorrect) {
                      optClass = "border-rose-300 bg-rose-50 text-rose-800";
                      labelClass = "bg-rose-200 text-rose-800";
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
                          <span className="ml-auto shrink-0 text-[10px] font-semibold text-emerald-700 whitespace-nowrap">
                            ✓ Jawaban benar
                          </span>
                        )}
                        {isUserChoice && !item.isCorrect && (
                          <span className="ml-auto shrink-0 text-[10px] font-semibold text-rose-600 whitespace-nowrap">
                            ✗ Pilihan Anda
                          </span>
                        )}
                      </div>
                    );
                  }) : (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Opsi jawaban tidak tersedia untuk riwayat quiz lama.
                    </p>
                  )}
                  {item.options.length > 0 && item.correctIndex < 0 && !item.isCorrect && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Jawaban benar belum tersimpan pada riwayat quiz lama. Ulangi kuis untuk melihat penandanya.
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 pt-8 border-t border-neutral-200 text-center">
          <p className="text-xs text-neutral-500 mb-3">
            Ingin belajar materi yang berbeda?
          </p>
          <Link
            href="/desk"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600 transition"
          >
            Upload PDF baru <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </main>

    </div>
  );
}
