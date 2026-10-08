"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { MOCK_DOCUMENT } from "@/lib/mock-data";
import Button from "@/components/ui/Button";
import { Flashcard as FlashcardView } from "@/components/flashcard/Flashcard";
import { resolveBlobVariant } from "@/lib/flashcard-variant";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Flashcard {
  id: string;
  term: string;
  definition: string;
  blobVariant?: number | null;
  related_terms?: RelatedTerm[];
}
type RelatedTerm = { term: string; type: "linked" | "suggested"; flashcard_id?: string; source_chunk_id?: string; definition?: string };

// ─── Loading skeleton ────────────────────────────────────────────────────────
function CardSkeleton() {
  return (
    <div className="w-full aspect-[4/3] sm:aspect-[16/10] max-h-[380px] rounded-2xl bg-white border border-[#D8D9D0] shadow-xs animate-pulse flex flex-col justify-between p-8">
      <div className="h-3 bg-[#E6EADF] rounded w-1/4" />
      <div className="space-y-3 text-center py-6">
        <div className="h-8 bg-[#E6EADF] rounded w-2/3 mx-auto" />
        <div className="h-4 bg-[#E6EADF] rounded w-1/3 mx-auto" />
      </div>
      <div className="h-3 bg-[#E6EADF] rounded w-1/3 mx-auto" />
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
  const queryClient = useQueryClient();
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

  const [viewState, setViewState] = useState<{ key: number; index: number; flipped: boolean }>({ key: 0, index: 0, flipped: false });
  const [activeRelated, setActiveRelated] = useState<RelatedTerm | null>(null);
  const [addingSuggested, setAddingSuggested] = useState(false);
  const [suggestedError, setSuggestedError] = useState<string | null>(null);

  // Reset view state during render whenever the card list changes.
  if (viewState.key !== cards.length) {
    setViewState({ key: cards.length, index: 0, flipped: false });
    setActiveRelated(null);
  }
  const currentIndex = Math.min(viewState.index, Math.max(cards.length - 1, 0));
  const isFlipped = viewState.flipped;
  const setCurrentIndex = (updater: number | ((previous: number) => number)) =>
    setViewState(previous => ({ key: cards.length, flipped: false, index: typeof updater === "function" ? updater(Math.min(previous.index, Math.max(cards.length - 1, 0))) : updater }));
  const setIsFlipped = (flipped: boolean | ((previous: boolean) => boolean)) =>
    setViewState(previous => ({ ...previous, flipped: typeof flipped === "function" ? flipped(previous.flipped) : flipped }));

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
  });

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

  const handleRelatedClick = (related: RelatedTerm) => {
    setSuggestedError(null);
    if (related.type === "linked" && related.flashcard_id) {
      const targetIndex = cards.findIndex(card => card.id === related.flashcard_id);
      if (targetIndex >= 0) { setCurrentIndex(targetIndex); setIsFlipped(false); setActiveRelated(null); return; }
    }
    setActiveRelated(related);
  };

  const handleAddSuggested = async () => {
    if (!activeRelated || activeRelated.type !== "suggested" || !activeRelated.source_chunk_id || addingSuggested) return;
    setAddingSuggested(true); setSuggestedError(null);
    try {
      const response = await fetch(`/api/flashcards/${currentCard.id}/add-suggested`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ suggested_term: activeRelated.term, source_chunk_id: activeRelated.source_chunk_id }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Gagal menambahkan flashcard.");
      setActiveRelated({ ...activeRelated, type: "linked", flashcard_id: body.flashcard?.id, definition: body.flashcard?.definition });
      await queryClient.invalidateQueries({ queryKey: queryKeys.flashcards(docId) });
    } catch (error) { setSuggestedError(error instanceof Error ? error.message : "Gagal menambahkan flashcard."); }
    finally { setAddingSuggested(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F2F0E8] flex flex-col justify-between text-[#183229] selection:bg-[#123F34] selection:text-white">
      <>
        <div className="mx-auto w-full max-w-3xl px-4 pt-5 sm:px-6">
          <div className="h-1 w-full overflow-hidden rounded-full bg-[#E6EADF]"><div className="h-full bg-[#123F34] transition-all" style={{ width: `${progressPercent}%` }} /></div>
          <div className="mb-4 mt-3 flex w-full justify-end">
            <Link href={`/desk/${docId}/quiz`} className="inline-flex items-center gap-1.5 rounded-xl bg-[#123F34] px-4 py-2 text-xs font-medium text-white hover:bg-[#244E3D]"><span>{t("flashcards.startQuiz")}</span><ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </>
      {/* Legacy header content removed; workspace layout owns the document header. */}
      {/*
        subtitle={
          <>
            Flashcards
            {!isLoading && cards.length > 0 && ` · ${cards.length} ${t("flashcards.konsep")}`}
          </>
        }
        rightContent={
          <Link
            href={`/desk/${docId}/quiz`}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-[#123F34] text-white hover:bg-[#244E3D] transition active:scale-[0.98] shadow-xs"
          >
            <span>{t("flashcards.startQuiz")}</span>
            <Play className="w-3.5 h-3.5 fill-current" />
          </Link>
        }
        bottomBar={
          <div className="w-full bg-[#E6EADF] h-1">
            <div
              className="bg-[#123F34] h-1 transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        }
      />
      */}

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-6 py-10 flex-1 w-full flex flex-col items-center justify-center">
        {/* Loading state */}
        {isLoading && (
          <div className="w-full flex flex-col items-center gap-6">
            <div className="flex items-center gap-2 text-sm text-[#66736B]">
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
                <span className="text-xs font-mono text-[#526159] bg-[#E6EADF] px-3 py-1 rounded-full border border-[#D8D9D0]">
                  {t("flashcards.kartu")} {currentIndex + 1} {t("flashcards.of")} {cards.length}
                </span>
                <Link
                  href={`/desk/${docId}/quiz`}
                  className="inline-flex sm:hidden items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-[#123F34] text-white hover:bg-[#244E3D] transition active:scale-[0.98] shadow-xs"
                >
                  <span>{t("flashcards.startQuiz")}</span>
                  <Play className="w-3.5 h-3.5 fill-current" />
                </Link>
              </div>
              

              <span className="text-xs text-[#7B877F] font-mono hidden sm:inline sm:flex-2  ">
                {t("flashcards.kbTips")}
              </span>
            </div>

            <div className="mx-auto w-full max-w-[420px]">
              <FlashcardView
                term={currentCard.term}
                definition={currentCard.definition}
                blobVariant={resolveBlobVariant(
                  currentCard.blobVariant,
                  currentCard.term,
                )}
                relatedTerms={currentCard.related_terms}
                onRelatedTermClick={handleRelatedClick}
                flipped={isFlipped}
                onFlip={setIsFlipped}
              />
            </div>

            {activeRelated?.type === "suggested" && (
              <div className="mt-5 w-full rounded-2xl border border-[#D8D9D0] bg-white p-4">
                <p className="text-xs text-[#526159]">
                  <strong>{activeRelated.term}</strong> ada di materi tetapi belum
                  menjadi flashcard.
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={handleAddSuggested}
                  disabled={addingSuggested}
                >
                  {addingSuggested
                    ? "Membuat flashcard..."
                    : "Tambahkan flashcard ini"}
                </Button>
                {suggestedError && (
                  <p className="mt-2 text-xs text-rose-600">{suggestedError}</p>
                )}
              </div>
            )}

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
                className="bg-[#E6EADF] hover:bg-[#DDE9D4] text-[#183229]"
              >
                <RotateCw className="w-4 h-4" />
                <span className="hidden sm:inline">{t("flashcards.flipButton")}</span>
              </Button>

              <Button
                size="lg"
                onClick={handleNext}
                disabled={currentIndex === cards.length - 1}
                className="flex-1 bg-[#123F34] text-white hover:bg-[#244E3D]"
              >
                <span>{t("flashcards.next")}</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            {/* End of Deck CTA */}
            {currentIndex === cards.length - 1 && (
              <div className="mt-8 p-4 bg-[#E7F0DF] border border-[#B8C4B8] rounded-2xl text-center w-full">
                <p className="text-xs text-[#244E3D] font-medium mb-2">
                  🎉 {t("flashcards.endMessage")}
                </p>
                <Link
                  href={`/desk/${docId}/quiz`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#123F34] text-white hover:bg-[#244E3D] transition"
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
