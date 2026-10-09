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
  backHref?: string;
};

function getBackHref(pathname: string, documentId: string) {
  if (pathname.endsWith("/keywords")) return "/desk";
  if (pathname.endsWith("/generate-flashcards")) return `/desk/${documentId}/keywords`;
  if (pathname.endsWith("/quiz")) return `/desk/${documentId}/flashcards`;
  if (pathname.includes("/attempts/")) return `/desk/${documentId}/attempts`;
  return "/desk";
}

function getSectionLabel(pathname: string) {
  if (pathname.endsWith("/keywords")) return "Pilih keyword";
  if (pathname.endsWith("/generate-flashcards")) return "Creating materials";
  if (pathname.endsWith("/flashcards")) return "Flashcards";
  if (pathname.endsWith("/quiz/results")) return "Quiz results";
  if (pathname.endsWith("/quiz")) return "Quiz";
  if (pathname.includes("/attempts/")) return "Answer review";
  if (pathname.endsWith("/attempts")) return "Quiz history";
  return "Materials";
}

export default function DocumentWorkspaceHeader({ documentId, title, pageCount, backHref: backHrefOverride }: Props) {
  const pathname = usePathname();
  const { session, handleLogout, isLoggingOut } = useAccountActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const backHref = backHrefOverride ?? getBackHref(pathname, documentId);
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
    <header className="sticky top-0 z-20 border-b border-chrome-border bg-chrome text-chrome-text shadow-sm">
      <div className="flex min-h-16 items-center gap-3 px-4 py-2 sm:px-6">
        <Link
          href={backHref}
          aria-label="Back"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-chrome-text text-accent transition hover:bg-surface-hover"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold sm:text-base">{title}</p>
          <p className="truncate text-[11px] text-chrome-text/70 sm:text-xs">
            {sectionLabel}{pageCount ? ` Â· ${pageCount} halaman` : ""}
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
                className="inline-flex max-w-48 items-center gap-2 rounded-lg bg-chrome-text px-2.5 py-2 text-xs font-medium text-on-accent"
              >
                <User className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{session.user.name || session.user.email}</span>
                <EllipsisVertical className="h-3.5 w-3.5 shrink-0" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-border bg-surface p-1.5 text-text shadow-xl" role="menu">
                  <Link href="/profile" onClick={() => setMenuOpen(false)} className="block rounded-lg px-3 py-2 text-sm hover:bg-surface-subtle">Profile</Link>
                  <button type="button" role="menuitem" disabled={isLoggingOut} onClick={() => { setMenuOpen(false); void handleLogout(); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-subtle disabled:opacity-50">
                    <LogOut className="h-4 w-4" /> {isLoggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 sm:hidden">
          <LanguageSwitcher compact />
          {session?.user && (
            <Link href="/profile" aria-label="Profile" className="flex h-9 w-9 items-center justify-center rounded-xl bg-chrome-text text-accent"><User className="h-4 w-4" /></Link>
          )}
        </div>
      </div>
    </header>
  );
}
