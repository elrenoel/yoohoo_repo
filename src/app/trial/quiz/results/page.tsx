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
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-success-subtle text-success-text border border-success-border">
        {st("attempt.grade.great")} 🎉
      </span>
    );
  }
  if (percentage >= 70) {
    return (
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-accent-subtle text-accent border border-accent">
        {st("attempt.grade.good")}
      </span>
    );
  }
  if (percentage >= 50) {
    return (
      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-warning-subtle text-warning-text border border-warning-border">
        {st("attempt.grade.practice")}
      </span>
    );
  }
  return (
    <span className="text-xs font-semibold px-3 py-1 rounded-full bg-danger-subtle text-danger-text border border-danger-border">
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
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <p className="text-sm text-text-muted font-mono">{t("quiz.loading")}</p>
      </div>
    );
  }

  const correctItems = result.review.filter((r) => r.isCorrect);
  const wrongItems = result.review.filter((r) => !r.isCorrect);

  return (
    <div className="min-h-screen bg-bg flex flex-col justify-between text-text">
      <Navbar
        rightContent={
          <Link
            href="/trial/flashcards"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-text-secondary bg-surface-subtle hover:bg-surface-hover transition"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{t("trial.reviewFlashcard")}</span>
          </Link>
        }
      />

      {/* Trial Notice Banner */}
      <div className="bg-warning-subtle border-b border-warning-border px-6 py-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <p className="text-xs text-warning-text font-medium leading-relaxed">
            {t("trial.promoTitle")}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/login"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface border border-control-border text-warning-text hover:bg-surface-hover transition"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t("trial.login")}</span>
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-warning text-on-warning hover:bg-warning-hover transition"
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
          <div className="w-14 h-14 rounded-2xl bg-surface-subtle border border-border flex items-center justify-center mx-auto mb-4 text-text">
            <Trophy className="w-7 h-7" />
          </div>

          <p className="text-xs font-mono text-text-muted uppercase tracking-wider mb-1">
            {t("trial.scoreTitle")} 00b7 {result.documentTitle}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-text mb-3">
            Skor: {result.score} / {result.total}
          </h1>

          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-2xl font-semibold text-text font-mono">
              {result.percentage}%
            </span>
            <ScoreGrade percentage={result.percentage} />
          </div>

          {result.createdAt && (
            <p className="text-[11px] text-text-muted font-mono mb-6">
              {formatDateTime(result.createdAt)}
            </p>
          )}

          {/* Yoohoo Stat Pill Grid */}
          <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto mb-6">
            <div className="p-3 bg-success-subtle border border-success-border rounded-xl text-center">
              <span className="text-lg font-bold text-success-text font-mono">
                {correctItems.length}
              </span>
              <p className="text-[11px] text-success-text font-medium">{t("trial.correctAnswers")}</p>
            </div>
            <div className="p-3 bg-danger-subtle border border-danger-border rounded-xl text-center">
              <span className="text-lg font-bold text-danger-text font-mono">
                {wrongItems.length}
              </span>
              <p className="text-[11px] text-danger-text font-medium">{t("trial.wrongAnswers")}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => router.push("/trial/quiz")}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-surface-subtle hover:bg-surface-hover text-xs font-medium text-text transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t("trial.repeatQuiz")}</span>
            </button>
            <Link
              href="/trial/flashcards"
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-action-primary hover:bg-action-primary-hover text-xs font-medium text-on-action-primary transition flex items-center justify-center gap-1.5 shadow-2xs dark:shadow-none"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{t("trial.openFlashcards")}</span>
            </Link>
          </div>
        </Card>

        {/* Detailed Question Review List */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-text tracking-tight">
            {t("trial.reviewTitle")} ({result.review.length})
          </h2>

          {result.review.map((item, idx) => (
            <div
              key={idx}
              className={`bg-surface border rounded-xl p-6 shadow-2xs dark:shadow-none transition ${
                item.isCorrect ? "border-border" : "border-danger-border bg-danger-subtle"
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-surface-subtle border border-border text-[10px] font-mono font-bold flex items-center justify-center text-text-secondary">
                    {idx + 1}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-medium ${
                      item.isCorrect ? "text-success-text" : "text-danger-text"
                    }`}
                  >
                    {item.isCorrect ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-success-text" />
                        <span>Benar</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5 text-danger-text" />
                        <span>Salah</span>
                      </>
                    )}
                  </span>
                </div>
              </div>

              <h3 className="text-sm font-medium text-text mb-4 leading-relaxed">
                {item.question}
              </h3>

              <div className="space-y-2">
                {item.options.map((opt, optIdx) => {
                  const isUserSelection = item.selectedIndex === optIdx;
                  const isCorrectAnswer = item.correctIndex === optIdx;

                  let rowStyle = "border-border bg-surface-subtle text-text-secondary";
                  if (isCorrectAnswer) {
                    rowStyle = "border-success-border bg-success-subtle text-success-text font-medium";
                  } else if (isUserSelection && !item.isCorrect) {
                    rowStyle = "border-danger-border bg-danger-subtle text-danger-text font-medium";
                  }

                  return (
                    <div
                      key={optIdx}
                      className={`p-3 rounded-lg border text-xs flex items-center justify-between ${rowStyle}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded bg-surface border border-border text-[10px] font-mono font-bold flex items-center justify-center">
                          {OPTION_LABELS[optIdx]}
                        </span>
                        <span>{opt}</span>
                      </div>
                      <div className="text-[11px] font-mono">
                        {isCorrectAnswer && (
                          <span className="text-success-text font-medium">✓ Jawaban Benar</span>
                        )}
                        {isUserSelection && !isCorrectAnswer && (
                          <span className="text-danger-text font-medium">✕ Pilihan Kamu</span>
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
