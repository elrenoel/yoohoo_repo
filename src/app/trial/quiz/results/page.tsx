"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  BookOpen,
  Trophy,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { t as st } from "@/lib/t";
import { formatDateTime } from "@/lib/format-date";
import Navbar from "@/components/layout/Navbar";
import Card from "@/components/ui/Card";

interface ReviewItem {
  question: string;
  options: string[];
  selectedIndex: number;
  correctIndex: number;
  isCorrect: boolean;
}

interface QuizResult {
  score: number;
  total: number;
  percentage: number;
  documentTitle: string;
  review: ReviewItem[];
  createdAt?: string;
}

const OPTION_LABELS = ["A", "B", "C", "D"];

function ScoreGrade({ percentage }: { percentage: number }) {
  if (percentage >= 85) {
    return (
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
        {st("attempt.grade.great")} 🎉
      </span>
    );
  }
  if (percentage >= 70) {
    return (
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
        {st("attempt.grade.good")}
      </span>
    );
  }
  if (percentage >= 50) {
    return (
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
        {st("attempt.grade.practice")}
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
      {st("attempt.grade.study")}
    </span>
  );
}

export default function TrialQuizResultsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [result, setResult] = useState<QuizResult | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("trial_quiz_result");
      if (stored) {
        try {
          setResult(JSON.parse(stored));
        } catch {
          router.replace("/");
        }
      } else {
        router.replace("/trial/quiz");
      }
    }
  }, [router]);

  if (!result) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <p className="text-sm text-neutral-500 font-mono">{t("quiz.loading")}</p>
      </div>
    );
  }

  const correctItems = result.review.filter((r) => r.isCorrect);
  const wrongItems = result.review.filter((r) => !r.isCorrect);

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar
        rightContent={
          <Link
            href="/trial/flashcards"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t("trial.reviewFlashcard")}</span>
          </Link>
        }
      />

      {/* Trial Notice Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <p className="text-xs text-amber-800 font-medium leading-relaxed">
            {t("trial.promoTitle")}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t("trial.login")}</span>
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber-700 text-white hover:bg-amber-800 transition"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t("trial.register")}</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-10 flex-1 w-full">
        {/* Score Hero Summary Card */}
        <Card className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center mx-auto mb-4 text-neutral-800">
            <Trophy className="w-7 h-7" />
          </div>

          <p className="text-xs font-mono text-neutral-500 uppercase tracking-wider mb-1">
            {t("trial.scoreTitle")} 00b7 {result.documentTitle}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 mb-3">
            Skor: {result.score} / {result.total}
          </h1>

          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-2xl font-semibold text-neutral-800 font-mono">
              {result.percentage}%
            </span>
            <ScoreGrade percentage={result.percentage} />
          </div>

          {result.createdAt && (
            <p className="text-[11px] text-neutral-400 font-mono mb-6">
              {formatDateTime(result.createdAt)}
            </p>
          )}

          {/* Yoohoo Stat Pill Grid */}
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-6">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-center">
              <span className="text-lg font-bold text-emerald-800 font-mono">
                {correctItems.length}
              </span>
              <p className="text-[11px] text-emerald-700 font-medium">{t("trial.correctAnswers")}</p>
            </div>
            <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl text-center">
              <span className="text-lg font-bold text-rose-800 font-mono">
                {wrongItems.length}
              </span>
              <p className="text-[11px] text-rose-700 font-medium">{t("trial.wrongAnswers")}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => router.push("/trial/quiz")}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-neutral-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t("trial.repeatQuiz")}</span>
            </button>
            <Link
              href="/trial/flashcards"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-xs font-medium text-white transition flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t("trial.openFlashcards")}</span>
            </Link>
          </div>
        </Card>

        {/* Detailed Question Review List */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900 tracking-tight">
            {t("trial.reviewTitle")} ({result.review.length})
          </h2>

          {result.review.map((item, idx) => (
            <div
              key={idx}
              className={`bg-white border rounded-xl p-6 shadow-2xs transition ${
                item.isCorrect ? "border-neutral-200" : "border-rose-200 bg-rose-50/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-neutral-100 border border-neutral-200 text-[10px] font-mono font-bold flex items-center justify-center text-neutral-700">
                    {idx + 1}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium ${
                      item.isCorrect ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {item.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Benar</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Salah</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              <h3 className="text-sm font-medium text-neutral-900 mb-4 leading-relaxed">
                {item.question}
              </h3>

              <div className="space-y-2">
                {item.options.map((opt, optIdx) => {
                  const isUserSelection = item.selectedIndex === optIdx;
                  const isCorrectAnswer = item.correctIndex === optIdx;

                  let rowStyle = "border-neutral-100 bg-neutral-50/30 text-neutral-600";
                  if (isCorrectAnswer) {
                    rowStyle = "border-emerald-300 bg-emerald-50 text-emerald-900 font-medium";
                  } else if (isUserSelection && !item.isCorrect) {
                    rowStyle = "border-rose-300 bg-rose-50 text-rose-900 font-medium";
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between ${rowStyle}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded bg-white/80 border border-neutral-200 text-[10px] font-mono font-bold flex items-center justify-center">
                          {OPTION_LABELS[optIdx]}
                        </span>
                        <span>{opt}</span>
                      </div>
                      <div className="text-[11px] font-mono">
                        {isCorrectAnswer && (
                          <span className="text-emerald-700 font-medium">✓ Jawaban Benar</span>
                        )}
                        {isUserSelection && !isCorrectAnswer && (
                          <span className="text-rose-700 font-medium">✕ Pilihan Kamu</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>

    </div>
  );
}
