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

// ─── Types ──────────────────────────────────────────────────────────────────
interface Flashcard {
  id: string;
  term: string;
  definition: string;
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
  const [hoveredRelated, setHoveredRelated] = useState<RelatedTerm | null>(null);
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

  const renderDefinition = (definition: string, related: RelatedTerm[]) => {
    if (!related.length) return definition;
    const terms = [...related].sort((a, b) => b.term.length - a.term.length).filter(item => item.term.trim());
    const pattern = new RegExp(`(${terms.map(item => item.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
    const parts = definition.split(pattern);
    return parts.map((part, index) => {
      const match = terms.find(item => item.term.toLocaleLowerCase() === part.toLocaleLowerCase());
      if (!match) return <span key={index}>{part}</span>;
      return <span key={index} className="relative inline-block" onMouseEnter={() => setHoveredRelated(match)} onMouseLeave={() => setHoveredRelated(null)}>
        <button type="button" onClick={(event) => { event.stopPropagation(); handleRelatedClick(match); }} className="font-semibold text-[#DFF26D] underline decoration-[#DFF26D]/60 decoration-2 underline-offset-4 hover:text-[#F2FA9E]">{part}</button>
        {hoveredRelated?.term === match.term && (
          <span role="tooltip" className="pointer-events-none absolute z-30 bottom-full left-1/2 mb-3 w-64 -translate-x-1/2 rounded-xl border border-[#D8D9D0] bg-white px-3 py-2 text-left text-xs leading-relaxed text-[#183229] shadow-xl">
            <span className="block font-semibold text-[#123F34] mb-1">{match.term}</span>
            {match.type === "suggested" ? "Istilah ini disebut di materi, tetapi belum menjadi flashcard." : (match.definition || "Klik untuk membuka flashcard terkait.")}
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white" />
          </span>
        )}
      </span>;
    });
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
                <div className="absolute inset-0 bg-white border border-[#D8D9D0] rounded-2xl p-8 flex flex-col justify-between backface-hidden shadow-xs hover:border-[#B8C4B8] transition">
                  <div className="flex items-center justify-between text-xs text-[#7B877F]">
                    <span className="font-mono uppercase tracking-wider text-[10px]">{t("flashcards.termLabel")}</span>
                    <span className="inline-flex items-center gap-1 text-[#7B877F] group-hover:text-[#183229] transition">
                      <RotateCw className="w-3 h-3" /> {t("flashcards.flipCard")}
                    </span>
                  </div>

                  <div className="text-center py-6">
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#183229] leading-snug">
                      {currentCard.term}
                    </h2>
                  </div>

                  <div className="text-center text-xs text-[#7B877F] font-mono">
                    {t("flashcards.clickToReveal")}
                  </div>
                </div>

                {/* BACK SIDE (Definition) */}
                <div className="absolute inset-0 bg-[#123F34] text-white border border-[#123F34] rounded-2xl p-8 flex flex-col justify-between backface-hidden rotate-y-180 shadow-md">
                  <div className="flex items-center justify-between text-xs text-[#7B877F]">
                    <span className="font-mono uppercase tracking-wider text-[10px] text-[#AFC4B7]">{t("flashcards.definitionLabel")}</span>
                    <span className="inline-flex items-center gap-1 text-[#AFC4B7]">
                      <RotateCw className="w-3 h-3" /> {t("flashcards.flipToTerm")}
                    </span>
                  </div>

                  <div className="text-center py-4 px-2">
                    <p className="text-base sm:text-lg text-[#F4F9F0] leading-relaxed font-normal">
                      {renderDefinition(currentCard.definition, currentCard.related_terms ?? [])}
                    </p>
                    {activeRelated && (currentCard.related_terms ?? []).some(item => item.term === activeRelated.term) && (
                      <div className="mt-4 rounded-lg border border-[#DFF26D]/40 bg-[#DFF26D]/10 px-3 py-2 text-left text-xs text-[#F4F9D9]">
                        {activeRelated.type === "suggested" ? <>
                          <p>Istilah ini ada di materi, tetapi belum menjadi flashcard.</p>
                          <Button size="sm" className="mt-2" onClick={handleAddSuggested} disabled={addingSuggested}>{addingSuggested ? "Membuat flashcard..." : "Tambahkan flashcard ini"}</Button>
                        </> : <p><strong>{activeRelated.term}</strong>: {activeRelated.definition}</p>}
                        {suggestedError && <p className="mt-2 text-rose-300">{suggestedError}</p>}
                      </div>
                    )}
                  </div>

                  <div className="text-center text-xs text-[#7B877F] font-mono">
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
