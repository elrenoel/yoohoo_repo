"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Play,
  Loader2,
} from "lucide-react";
import ErrorState from "@/components/ui/ErrorState";
import { useI18n } from "@/lib/i18n";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { MOCK_DOCUMENT } from "@/lib/mock-data";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Flashcard {
  id: string;
  term: string;
  definition: string;
}

// ─── Loading skeleton ────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="w-full aspect-[4/3] sm:aspect-[16/10] max-h-[380px] rounded-2xl bg-white border border-neutral-200 shadow-xs animate-pulse flex flex-col justify-between p-8">
      <div className="h-3 bg-neutral-100 rounded w-1/4" />
      <div className="space-y-3 text-center py-6">
        <div className="h-8 bg-neutral-100 rounded w-2/3 mx-auto" />
        <div className="h-4 bg-neutral-100 rounded w-1/3 mx-auto" />
      </div>
      <div className="h-3 bg-neutral-100 rounded w-1/3 mx-auto" />
    </div>
  );
}

interface FlashcardsApiResponse {
  flashcards: Flashcard[];
  documentTitle: string;
}

async function fetchFlashcards(docId: string): Promise<FlashcardsApiResponse> {
  const res = await fetch(`/api/documents/${docId}/flashcards`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Server error ${res.status}`);
  }
  const data = await res.json();
  if (!data.flashcards || data.flashcards.length === 0) {
    throw new Error("No flashcards found for this document.");
  }
  return data;
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function FlashcardsPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useI18n();
  const docId = (params?.id as string) || "";

  const isDemo = docId === "demo-os-memory";

  // ── Fetch flashcards with useQuery ─────────────────────────────────────────
  const {
    data: flashcardsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.flashcards(docId),
    queryFn: () => fetchFlashcards(docId),
    enabled: !!docId && !isDemo,
  });

  // Demo mode: use mock data
  const cards: Flashcard[] = isDemo
    ? (MOCK_DOCUMENT.flashcards as Flashcard[])
    : flashcardsData?.flashcards || [];
  const documentTitle = isDemo
    ? MOCK_DOCUMENT.title
    : flashcardsData?.documentTitle || "";

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Reset index when data changes
  useEffect(() => {
    setCurrentIndex(0);
    setIsFlipped(false);
  }, [cards.length]);

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((prev) => !prev);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        if (currentIndex < cards.length - 1) {
          setIsFlipped(false);
          setCurrentIndex((prev) => prev + 1);
        }
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (currentIndex > 0) {
          setIsFlipped(false);
          setCurrentIndex((prev) => prev - 1);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, cards.length]);

  const handleNext = () => {
    if (currentIndex < cards.length - 1) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setIsFlipped(false);
      setCurrentIndex((prev) => prev - 1);
    }
  };

  const handleToggleFlip = () => setIsFlipped((prev) => !prev);

  const currentCard = cards[currentIndex];
  const progressPercent = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;

  const handleRetry = () => {
    refetch();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col justify-between text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar
        backHref="/"
        title={isLoading ? undefined : documentTitle}
        subtitle={
          <>
            Flashcards
            {!isLoading && cards.length > 0 && ` · ${cards.length} ${t("flashcards.konsep")}`}
          </>
        }
        rightContent={
          <Link
            href={`/documents/${docId}/quiz`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition active:scale-[0.98] shadow-xs"
          >
            <span>{t("flashcards.startQuiz")}</span>
            <Play className="w-3.5 h-3.5 fill-current" />
          </Link>
        }
        bottomBar={
          <div className="w-full bg-neutral-100 h-1">
            <div
              className="bg-neutral-900 h-1 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        }
      />

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-6 py-10 flex-1 w-full flex flex-col items-center justify-center">
        {/* Loading state */}
        {isLoading && (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-neutral-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t("flashcards.loading")}</span>
            </div>
            <CardSkeleton />
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <ErrorState
            title={t("flashcards.notFoundTitle")}
            message={t("flashcards.notFoundMessage")}
            actions={[
              { label: t("error.retry"), onClick: handleRetry, variant: "primary" },
              { label: t("error.home"), href: "/", variant: "secondary" },
            ]}
          />
        )}

        {/* Cards */}
        {!isLoading && !error && cards.length > 0 && currentCard && (
          <>
            {/* Counter Badge */}
            <div className="flex items-center justify-between w-full mb-6">
              <div className="flex flex-1 justify-between w-full">
                <span className="text-xs font-mono text-neutral-500 bg-white px-3 py-1 rounded-full border border-neutral-200 shadow-2xs">
                  {t("flashcards.kartu")} {currentIndex + 1} {t("flashcards.of")} {cards.length}
                </span>
                <Link
                  href={`/documents/${docId}/quiz`}
                  className="inline-flex sm:hidden items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition active:scale-[0.98] shadow-xs"
                >
                  <span>{t("flashcards.startQuiz")}</span>
                  <Play className="w-3.5 h-3.5 fill-current" />
                </Link>
              </div>
              

              <span className="text-xs text-neutral-400 font-mono hidden sm:inline sm:flex-2  ">
                {t("flashcards.kbTips")}
              </span>
            </div>

            {/* 3D Flippable Card */}
            <div
              onClick={handleToggleFlip}
              className="w-full aspect-[4/3] sm:aspect-[16/10] max-h-[380px] perspective-1000 cursor-pointer group select-none"
            >
              <div
                className={`w-full h-full relative transform-style-3d transition-transform duration-500 rounded-2xl ${
                  isFlipped ? "rotate-y-180" : ""
                }`}
              >
                {/* FRONT SIDE (Term) */}
                <div className="absolute inset-0 bg-white border border-neutral-200 rounded-2xl p-8 flex flex-col justify-between backface-hidden shadow-xs hover:border-neutral-300 transition">
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="font-mono uppercase tracking-wider text-[10px]">{t("flashcards.termLabel")}</span>
                    <span className="inline-flex items-center gap-1 text-neutral-500 group-hover:text-neutral-900 transition">
                      <RotateCw className="w-3 h-3" /> {t("flashcards.flipCard")}
                    </span>
                  </div>

                  <div className="text-center py-6">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 leading-snug">
                      {currentCard.term}
                    </h2>
                  </div>

                  <div className="text-center text-xs text-neutral-400 font-mono">
                    {t("flashcards.clickToReveal")}
                  </div>
                </div>

                {/* BACK SIDE (Definition) */}
                <div className="absolute inset-0 bg-neutral-900 text-white border border-neutral-900 rounded-2xl p-8 flex flex-col justify-between backface-hidden rotate-y-180 shadow-md">
                  <div className="flex items-center justify-between text-xs text-neutral-400">
                    <span className="font-mono uppercase tracking-wider text-[10px] text-neutral-300">{t("flashcards.definitionLabel")}</span>
                    <span className="inline-flex items-center gap-1 text-neutral-400">
                      <RotateCw className="w-3 h-3" /> {t("flashcards.flipToTerm")}
                    </span>
                  </div>

                  <div className="text-center py-4 px-2">
                    <p className="text-base sm:text-lg text-neutral-100 leading-relaxed font-normal">
                      {currentCard.definition}
                    </p>
                  </div>

                  <div className="text-center text-xs text-neutral-400 font-mono">
                    {currentCard.term}
                  </div>
                </div>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between w-full mt-8 gap-4">
              <Button
                variant="secondary"
                size="lg"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="flex-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>{t("flashcards.previous")}</span>
              </Button>

              <Button
                size="lg"
                onClick={handleToggleFlip}
                className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800"
              >
                <RotateCw className="w-4 h-4" />
                <span className="hidden sm:inline">{t("flashcards.flipButton")}</span>
              </Button>

              <Button
                variant="primary"
                size="lg"
                onClick={handleNext}
                disabled={currentIndex === cards.length - 1}
                className="flex-1"
              >
                <span>{t("flashcards.next")}</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* End of Deck CTA */}
            {currentIndex === cards.length - 1 && (
              <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center w-full">
                <p className="text-xs text-emerald-800 font-medium mb-2">
                  🎉 {t("flashcards.endMessage")}
                </p>
                <Link
                  href={`/documents/${docId}/quiz`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 transition"
                >
                  <span>{t("flashcards.startQuizButton")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </>
        )}
      </main>

    </div>
  );
}
