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
import Navbar from "@/components/layout/Navbar";
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem(`quiz_result_${docId}`);
      if (stored) {
        try {
          setResult(JSON.parse(stored));
        } catch {
          router.replace("/");
        }
      } else {
        router.replace(`/documents/${docId}/quiz`);
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

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar
        backHref="/"
        title={result.documentTitle}
        subtitle="Hasil Kuis"
      />

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

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <Link
            href={`/documents/${docId}/quiz`}
            className="flex-1 py-3 px-4 text-sm font-medium rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition text-center flex items-center justify-center gap-2 shadow-xs"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Ulangi Kuis</span>
          </Link>
          <Link
            href={`/documents/${docId}/flashcards`}
            className="flex-1 py-3 px-4 text-sm font-medium rounded-xl bg-white border border-neutral-200 text-neutral-800 hover:bg-neutral-50 transition text-center flex items-center justify-center gap-2"
          >
            <BookOpen className="w-4 h-4" />
            <span>Pelajari Flashcard Lagi</span>
          </Link>
          <Link
            href="/app"
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
                  {item.options.map((opt, optIdx) => {
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
                  })}
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
            href="/app"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-900 underline underline-offset-4 hover:text-neutral-600 transition"
          >
            Upload PDF baru <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </main>

    </div>
  );
}
