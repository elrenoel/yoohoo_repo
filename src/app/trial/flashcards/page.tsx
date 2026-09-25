"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Play,
  ArrowRight,
  LogIn,
  UserPlus,
} from "lucide-react";
import ErrorState from "@/components/ui/ErrorState";
import { useI18n } from "@/lib/i18n";
import Navbar from "@/components/layout/Navbar";
import Button from "@/components/ui/Button";

interface Flashcard {
  term: string;
  definition: string;
}

interface TrialData {
  title: string;
  raw_text: string;
  flashcards: Flashcard[];
  quiz: { question: string; options: string[]; correct_index: number }[];
}

export default function TrialFlashcardsPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [trialData, setTrialData] = useState<TrialData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("yoohoo_trial_data");
    if (!raw) {
      setNotFound(true);
      return;
    }
    try {
      const data = JSON.parse(raw) as TrialData;
      if (!data.flashcards || data.flashcards.length === 0) {
        setNotFound(true);
        return;
      }
      setTrialData(data);
    } catch {
      setNotFound(true);
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!trialData) return;
      if (e.code === "Space") {
        e.preventDefault();
        setIsFlipped((p) => !p);
      } else if (e.code === "ArrowRight" && currentIndex < trialData.flashcards.length - 1) {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex((p) => p + 1);
      } else if (e.code === "ArrowLeft" && currentIndex > 0) {
        e.preventDefault();
        setIsFlipped(false);
        setCurrentIndex((p) => p - 1);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, trialData]);

  const handleNext = useCallback(() => {
    if (!trialData || currentIndex >= trialData.flashcards.length - 1) return;
    setIsFlipped(false);
    setCurrentIndex((p) => p + 1);
  }, [currentIndex, trialData]);

  const handlePrev = useCallback(() => {
    if (currentIndex <= 0) return;
    setIsFlipped(false);
    setCurrentIndex((p) => p - 1);
  }, [currentIndex]);

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex flex-col items-center justify-center px-6">
        <ErrorState
          title={t("trial.notFoundTitle")}
          message={t("trial.notFoundMessage")}
          actions={[
            { label: t("trial.uploadNew"), href: "/", variant: "primary" },
          ]}
        />
      </div>
    );
  }

  if (!trialData) return null;

  const cards = trialData.flashcards;
  const currentCard = cards[currentIndex];
  const progressPercent = ((currentIndex + 1) / cards.length) * 100;

  return (
    <div className="min-h-screen bg-[#fafafa] flex flex-col text-neutral-900 selection:bg-neutral-900 selection:text-white">
      <Navbar
        backHref="/"
        title={trialData.title}
        subtitle={
          <>
            {t("trial.flashcardsTitle")} · {cards.length} {t("trial.konsep")}
          </>
        }
        rightContent={
          <button
            onClick={() => router.push("/trial/quiz")}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition active:scale-[0.98] shadow-xs"
          >
            <span>{t("flashcards.startQuiz")}</span>
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
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

      {/* Trial Notice Banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
          <p className="text-xs text-amber-800 font-medium leading-relaxed">
            {t("trial.trialBanner")}
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
      <main className="max-w-xl mx-auto px-6 py-10 flex-1 w-full flex flex-col items-center justify-center">
        {/* Counter */}
        <div className="flex items-center justify-between w-full mb-6">
          <span className="text-xs font-mono text-neutral-500 bg-white px-3 py-1 rounded-full border border-neutral-200 shadow-2xs">
            {t("trial.kartu")} {currentIndex + 1} {t("trial.of")} {cards.length}
          </span>
          <span className="text-xs text-neutral-400 font-mono hidden sm:inline">
            {t("trial.kbTips")}
          </span>
        </div>

        {/* Flip Card */}
        <div
          onClick={() => setIsFlipped((p) => !p)}
          className="w-full aspect-[4/3] sm:aspect-[16/10] max-h-[380px] perspective-1000 cursor-pointer group select-none"
        >
          <div
            className={`w-full h-full relative transform-style-3d transition-transform duration-500 rounded-2xl ${
              isFlipped ? "rotate-y-180" : ""
            }`}
          >
            {/* Front */}
            <div className="absolute inset-0 bg-white border border-neutral-200 rounded-2xl p-8 flex flex-col justify-between backface-hidden shadow-xs hover:border-neutral-300 transition">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="font-mono uppercase tracking-wider text-[10px]">{t("trial.termLabel")}</span>
                <span className="inline-flex items-center gap-1 text-neutral-500 group-hover:text-neutral-900 transition">
                  <RotateCw className="w-3 h-3" /> {t("trial.flipCard")}
                </span>
              </div>
              <div className="text-center py-6">
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900 leading-snug">
                  {currentCard.term}
                </h2>
              </div>
              <div className="text-center text-xs text-neutral-400 font-mono">
                {t("trial.clickToReveal")}
              </div>
            </div>

            {/* Back */}
            <div className="absolute inset-0 bg-neutral-900 text-white border border-neutral-900 rounded-2xl p-8 flex flex-col justify-between backface-hidden rotate-y-180 shadow-md">
              <div className="flex items-center justify-between text-xs text-neutral-400">
                <span className="font-mono uppercase tracking-wider text-[10px] text-neutral-300">{t("trial.definitionLabel")}</span>
                <span className="inline-flex items-center gap-1 text-neutral-400">
                  <RotateCw className="w-3 h-3" /> {t("trial.flipToTerm")}
                </span>
              </div>
              <div className="text-center py-4 px-2">
                <p className="text-base sm:text-lg text-neutral-100 leading-relaxed font-normal">
                  {currentCard.definition}
                </p>
              </div>
              <div className="text-center text-xs text-neutral-400 font-mono">{currentCard.term}</div>
            </div>
          </div>
        </div>

        {/* Nav Controls */}
        <div className="flex items-center justify-between w-full mt-8 gap-4">
          <Button
            variant="secondary"
            size="lg"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>{t("trial.previous")}</span>
          </Button>

          <Button
            size="lg"
            onClick={() => setIsFlipped((p) => !p)}
            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800"
          >
            <RotateCw className="w-4 h-4" />
            <span className="hidden sm:inline">{t("trial.flipButton")}</span>
          </Button>

          <Button
            variant="primary"
            size="lg"
            onClick={handleNext}
            disabled={currentIndex === cards.length - 1}
            className="flex-1"
          >
            <span>{t("trial.next")}</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* End of Deck CTA */}
        {currentIndex === cards.length - 1 && (
          <div className="mt-8 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center w-full">
            <p className="text-xs text-emerald-800 font-medium mb-2">
              🎉 {t("trial.endMessage")}
            </p>
            <Button
              variant="success"
              size="md"
              onClick={() => router.push("/trial/quiz")}
            >
              <span>{t("trial.startQuizButton")}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </main>

    </div>
  );
}
