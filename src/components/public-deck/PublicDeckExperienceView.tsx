"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Eye,
  GitFork,
  LoaderCircle,
} from "lucide-react";
import { Flashcard } from "@/components/flashcard/Flashcard";
import AppShell from "@/components/layout/AppShell";
import { usePublicDeck } from "@/hooks/use-public-deck";
import { resolveBlobVariant } from "@/lib/flashcard-variant";
import { useToast } from "@/lib/toast";

type Answer = {
  questionId: string;
  selectedIndex: number;
  timeTakenMs: number;
};

type QuizResult = {
  score: number;
  total: number;
  review: Array<{
    questionId: string;
    correctIndex: number;
    selectedIndex: number | null;
    isCorrect: boolean;
    explanation: string | null;
  }>;
};

export default function PublicDeckExperienceView({ slug }: { slug: string }) {
  const router = useRouter();
  const toast = useToast();
  const deckQuery = usePublicDeck(slug);
  const data = deckQuery.data;
  const error =
    deckQuery.error instanceof Error ? deckQuery.error.message : "";
  const [tab, setTab] = useState<"cards" | "quiz">("cards");
  const [card, setCard] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [question, setQuestion] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function answer(index: number) {
    if (!data) return;
    const currentQuestion = data.questions[question];
    const next = [
      ...answers,
      {
        questionId: currentQuestion.id,
        selectedIndex: index,
        timeTakenMs: 0,
      },
    ];
    setAnswers(next);
    if (question < data.questions.length - 1) {
      setQuestion(question + 1);
      return;
    }

    setBusy(true);
    try {
      const response = await fetch(
        `/api/public-decks/${data.deck.id}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers: next, durationMs: 0 }),
        },
      );
      const body = await response.json();
      if (response.status === 401) {
        router.push(`/login?redirectTo=${encodeURIComponent(`/d/${slug}`)}`);
        return;
      }
      if (!response.ok) throw new Error(body.error);
      setResult(body as QuizResult);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Quiz gagal dinilai.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function fork() {
    if (!data) return;
    setBusy(true);
    const toastId = toast.loading("Menyalin deck ke Your Desk…");
    try {
      const response = await fetch(`/api/public-decks/${data.deck.id}/fork`, {
        method: "POST",
      });
      const body = await response.json();
      if (response.status === 401) {
        toast.dismiss(toastId);
        router.push(`/login?callbackURL=${encodeURIComponent(`/d/${slug}`)}`);
        return;
      }
      if (!response.ok) throw new Error(body.error);
      toast.success("Deck berhasil ditambahkan ke Your Desk.", {
        id: toastId,
      });
      router.push(`/desk/${body.deckId}`);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : "Fork gagal.",
        { id: toastId },
      );
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <AppShell>
        <main className="flex min-h-screen items-center justify-center bg-[#F5F6F3]">
          <div className="rounded-2xl border border-[#D8DCD3] bg-white p-10 text-center shadow-[0_8px_24px_rgba(22,36,29,0.05)]">
            <p className="font-serif text-3xl">Deck tidak ditemukan</p>
            <Link
              href="/explore"
              className="mt-5 inline-block text-[#164C3D]"
            >
              Kembali ke Jelajah
            </Link>
          </div>
        </main>
      </AppShell>
    );
  }

  if (!data) return <PublicDeckSkeleton />;

  const current = data.cards[card];
  const currentQuestion = data.questions[question];

  return (
    <AppShell>
      <main className="min-h-screen bg-[#F5F6F3] px-4 py-8 text-[#16241D] sm:px-8">
        <div className="mx-auto max-w-5xl">
          <header className="rounded-2xl border border-[#D8DCD3] bg-[#FAFBF8] p-6 shadow-[0_8px_24px_rgba(22,36,29,0.04)] sm:p-9">
            <div className="font-mono text-xs text-[#5B6B62]">
              DECK PUBLIK · V{data.deck.version}
            </div>
            <h1 className="mt-3 font-serif text-4xl font-semibold">
              {data.deck.title}
            </h1>
            <Link
              href={`/u/${data.deck.owner.username}`}
              className="mt-2 inline-block text-sm text-[#164C3D]"
            >
              oleh @{data.deck.owner.username}
            </Link>
            <p className="mt-4 max-w-3xl text-[#5B6B62]">
              {data.deck.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.deck.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#D8DCD3] bg-white px-2.5 py-1 font-mono text-xs"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <div className="mt-7 flex flex-wrap items-center gap-5 border-t border-[#D8DCD3] pt-5 font-mono text-xs text-[#5B6B62]">
              <span className="flex gap-1">
                <Eye className="h-4 w-4" /> {data.deck.viewCount}
              </span>
              <span className="flex gap-1">
                <GitFork className="h-4 w-4" /> {data.deck.forkCount}
              </span>
              <span>{data.stats.completions} penyelesai</span>
              <span>
                {data.stats.averageScore === null
                  ? "Rata-rata tampil setelah 5 attempt"
                  : `Rata-rata ${data.stats.averageScore}%`}
              </span>
              <button
                type="button"
                onClick={fork}
                disabled={busy}
                className="ml-auto flex items-center gap-2 rounded-xl bg-[#164C3D] px-4 py-2.5 font-sans font-semibold text-white transition hover:bg-[#244E3D] disabled:opacity-50"
              >
                <Copy className="h-4 w-4" /> Fork ke Your Desk
              </button>
            </div>
          </header>

          <section className="mt-7 overflow-hidden rounded-2xl border border-[#D8DCD3] bg-white shadow-[0_8px_24px_rgba(22,36,29,0.04)]">
            <div className="flex border-b border-[#D8DCD3]">
              <button
                type="button"
                onClick={() => setTab("cards")}
                className={`flex-1 p-4 font-semibold transition hover:bg-[#F7F8F5] ${
                  tab === "cards"
                    ? "border-b-2 border-[#164C3D]"
                    : "text-[#5B6B62]"
                }`}
              >
                Flashcard ({data.cards.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("quiz")}
                className={`flex-1 p-4 font-semibold transition hover:bg-[#F7F8F5] ${
                  tab === "quiz"
                    ? "border-b-2 border-[#164C3D]"
                    : "text-[#5B6B62]"
                }`}
              >
                Quiz ({data.questions.length})
              </button>
            </div>

            {tab === "cards" ? (
              <div className="p-6 sm:p-10">
                {current ? (
                  <>
                    <div className="mx-auto w-full max-w-[420px]">
                      <Flashcard
                        term={current.front}
                        definition={current.back}
                        blobVariant={resolveBlobVariant(
                          current.blobVariant,
                          current.front,
                        )}
                        flipped={flipped}
                        onFlip={setFlipped}
                      />
                    </div>
                    <div className="mx-auto mt-5 flex max-w-[520px] items-center justify-between">
                      <button
                        type="button"
                        aria-label="Kartu sebelumnya"
                        disabled={card === 0}
                        onClick={() => {
                          setCard(card - 1);
                          setFlipped(false);
                        }}
                        className="rounded-full p-2 transition hover:bg-[#EEF5F0] disabled:opacity-35"
                      >
                        <ArrowLeft />
                      </button>
                      <span className="font-mono text-sm">
                        {card + 1} / {data.cards.length}
                      </span>
                      <button
                        type="button"
                        aria-label="Kartu berikutnya"
                        disabled={card === data.cards.length - 1}
                        onClick={() => {
                          setCard(card + 1);
                          setFlipped(false);
                        }}
                        className="rounded-full p-2 transition hover:bg-[#EEF5F0] disabled:opacity-35"
                      >
                        <ArrowRight />
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="py-20 text-center">Belum ada flashcard.</p>
                )}
              </div>
            ) : (
              <div className="p-6 sm:p-10">
                {result ? (
                  <div>
                    <h2 className="font-serif text-3xl">
                      Skor {result.score}/{result.total}
                    </h2>
                    <div className="mt-6 space-y-4">
                      {result.review.map((review, index) => (
                        <div
                          key={review.questionId}
                          className={`border-l-2 p-4 ${
                            review.isCorrect
                              ? "border-emerald-600 bg-emerald-50"
                              : "border-[#C24A3D] bg-red-50"
                          }`}
                        >
                          <p className="font-semibold">
                            {index + 1}. {data.questions[index]?.question}
                          </p>
                          <p className="mt-2 text-sm">
                            Jawaban benar:{" "}
                            {
                              data.questions[index]?.options[
                                review.correctIndex
                              ]
                            }
                          </p>
                          {review.explanation && (
                            <p className="mt-2 text-sm text-[#5B6B62]">
                              {review.explanation}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : currentQuestion ? (
                  <div>
                    <div className="font-mono text-xs text-[#5B6B62]">
                      SOAL {question + 1}/{data.questions.length} ·{" "}
                      {currentQuestion.difficulty}
                    </div>
                    <h2 className="mt-4 font-serif text-2xl">
                      {currentQuestion.question}
                    </h2>
                    <div className="mt-7 grid gap-3">
                      {currentQuestion.options.map((option, index) => (
                        <button
                          key={option}
                          type="button"
                          disabled={busy}
                          onClick={() => void answer(index)}
                          className="rounded-xl border border-[#D8DCD3] p-4 text-left transition hover:border-[#164C3D] hover:bg-[#EEF5F0]"
                        >
                          {String.fromCharCode(65 + index)}. {option}
                        </button>
                      ))}
                    </div>
                    {busy && (
                      <LoaderCircle className="mx-auto mt-5 animate-spin" />
                    )}
                  </div>
                ) : (
                  <p className="py-20 text-center">Belum ada quiz.</p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

function PublicDeckSkeleton() {
  return (
    <AppShell>
      <main className="min-h-screen animate-pulse bg-[#F5F6F3] p-8">
        <div className="mx-auto max-w-5xl">
          <div className="h-72 rounded-2xl border border-[#D8DCD3] bg-white" />
          <div className="mt-7 h-96 rounded-2xl border border-[#D8DCD3] bg-white" />
        </div>
      </main>
    </AppShell>
  );
}
