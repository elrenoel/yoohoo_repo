"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";

function backHref(pathname: string, id: string) {
  if (pathname.endsWith("/generate-flashcards")) return `/desk/${id}/keywords`;
  if (pathname.endsWith("/quiz")) return `/desk/${id}/flashcards`;
  if (pathname.includes("/attempts/")) return `/desk/${id}/attempts`;
  return `/desk/${id}`;
}

function section(pathname: string) {
  if (pathname.endsWith("/generate-flashcards")) return "Membuat materi";
  if (pathname.endsWith("/flashcards")) return "Flashcards";
  if (pathname.endsWith("/quiz/results")) return "Hasil kuis";
  if (pathname.endsWith("/quiz")) return "Quiz";
  if (pathname.includes("/attempts/")) return "Pembahasan jawaban";
  if (pathname.endsWith("/attempts")) return "Riwayat quiz";
  return "Materi";
}

export default function DeskWorkspaceNav({ deckId }: { deckId: string }) {
  const pathname = usePathname();
  const [title, setTitle] = useState("Your Desk");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/decks/${deckId}`, { cache: "no-store" })
      .then(response => response.json())
      .then(body => { if (!cancelled && body.deck?.title) setTitle(body.deck.title); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [deckId]);

  return <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 pb-2 pt-5 sm:px-6"><Link href={backHref(pathname, deckId)} aria-label="Kembali" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D8DCD3] bg-white text-[#013528] transition hover:bg-[#EAF2E8]"><ChevronLeft className="h-4 w-4" /></Link><div className="min-w-0"><p className="truncate text-sm font-semibold text-[#16241D] sm:text-base">{title}</p><p className="truncate text-[11px] text-[#5B6B62] sm:text-xs">{section(pathname)}</p></div></div>;
}
