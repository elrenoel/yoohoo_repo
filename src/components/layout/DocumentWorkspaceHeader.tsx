"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, EllipsisVertical, LogOut, User } from "lucide-react";
import LanguageSwitcher from "@/components/layout/LanguageSwitcher";
import { useAccountActions } from "@/hooks/use-account-actions";

type Props = {
  documentId: string;
  title: string;
  pageCount: number | null;
};

function getBackHref(pathname: string, documentId: string) {
  if (pathname.endsWith("/keywords")) return "/history";
  if (pathname.endsWith("/generate-flashcards")) return `/desk/${documentId}/keywords`;
  if (pathname.endsWith("/quiz")) return `/desk/${documentId}/flashcards`;
  if (pathname.includes("/attempts/")) return `/desk/${documentId}/attempts`;
  return "/history";
}

function getSectionLabel(pathname: string) {
  if (pathname.endsWith("/keywords")) return "Pilih keyword";
  if (pathname.endsWith("/generate-flashcards")) return "Membuat materi";
  if (pathname.endsWith("/flashcards")) return "Flashcards";
  if (pathname.endsWith("/quiz/results")) return "Hasil Kuis";
  if (pathname.endsWith("/quiz")) return "Quiz";
  if (pathname.includes("/attempts/")) return "Pembahasan jawaban";
  if (pathname.endsWith("/attempts")) return "Riwayat quiz";
  return "Materi";
}

export default function DocumentWorkspaceHeader({ documentId, title, pageCount }: Props) {
  const pathname = usePathname();
  const { session, handleLogout, isLoggingOut } = useAccountActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const backHref = getBackHref(pathname, documentId);
  const sectionLabel = getSectionLabel(pathname);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-20 border-b border-[#0b4b3c] bg-[#013528] text-[#FDF7EB] shadow-sm">
      <div className="flex min-h-16 items-center gap-3 px-4 py-2 sm:px-6">
        <Link
          href={backHref}
          aria-label="Kembali"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FDF7EB] text-[#013528] transition hover:bg-white"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
          <p className="truncate text-[11px] text-[#FDF7EB]/70 sm:text-xs">
            {sectionLabel}{pageCount ? ` · ${pageCount} halaman` : ""}
          </p>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <LanguageSwitcher compact />
          {session?.user && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                className="inline-flex max-w-48 items-center gap-2 rounded-lg bg-[#FDF7EB] px-2.5 py-2 text-xs font-medium text-[#041914]"
              >
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{session.user.name || session.user.email}</span>
                <EllipsisVertical className="h-3.5 w-3.5 shrink-0" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-neutral-200 bg-white p-1.5 text-neutral-800 shadow-xl" role="menu">
                  <Link href="/profile" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-neutral-100">Profil</Link>
                  <button type="button" role="menuitem" disabled={isLoggingOut} onClick={() => { setMenuOpen(false); void handleLogout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-neutral-100 disabled:opacity-50">
                    <LogOut className="h-4 w-4" /> {isLoggingOut ? "Keluar..." : "Keluar"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <LanguageSwitcher compact />
          {session?.user && (
            <Link href="/profile" aria-label="Profil" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FDF7EB] text-[#013528]"><User className="h-4 w-4" /></Link>
          )}
        </div>
      </div>
    </header>
  );
}
