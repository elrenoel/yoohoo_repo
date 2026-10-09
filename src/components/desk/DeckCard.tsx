"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  Lock,
  MoreHorizontal,
  RefreshCw,
  Share2,
  Star,
  Trash2,
  Undo2,
} from "lucide-react";

export type DeskSummary = {
  id: string;
  title: string;
  createdAt: string;
  isPriority: boolean;
  materialCount: number;
  elementCount: number;
  processingCount: number;
  visibility: "private" | "unlisted" | "public";
  slug: string | null;
  sharedAt?: string | null;
  publicDeck?: {
    id: string;
    slug: string;
    status: "published" | "unpublished";
    version: number;
  } | null;
};

type DeckCardProps = {
  deck: DeskSummary;
  onTogglePriority: (deck: DeskSummary) => void;
  onRequestDelete: (deck: DeskSummary) => void;
  onPublish: (deck: DeskSummary) => void;
  onRefreshSnapshot: (deck: DeskSummary) => void;
  onUnpublish: (deck: DeskSummary) => void;
  setCardRef?: (id: string, element: HTMLDivElement | null) => void;
  /** A priority toggle for this card is in flight. */
  busy?: boolean;
  /** The card was optimistically deleted and is fading out. */
  removing?: boolean;
};

// created_at is the deck's real creation moment; pin it to Jakarta time so the
// date never drifts with the viewer's machine timezone or a later updated_at.
const DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: "Asia/Jakarta",
});

export default function DeckCard({
  deck,
  onTogglePriority,
  onRequestDelete,
  onPublish,
  onRefreshSnapshot,
  onUnpublish,
  setCardRef,
  busy = false,
  removing = false,
}: DeckCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node))
        setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const status =
    deck.processingCount > 0
      ? "Processing"
      : deck.isPriority
        ? "High priority"
        : "Ready to study";

  return (
    <div
      ref={(element) => {
        setCardRef?.(deck.id, element);
      }}
      className={`group relative rounded-2xl border ${deck.isPriority ? "border-danger" : "border-border"} bg-surface transition duration-300 ease-out hover:-translate-y-0.5 hover:border-border-strong hover:shadow-none ${menuOpen ? "z-40" : "z-0"} ${removing ? "pointer-events-none scale-[0.98] opacity-0" : "opacity-100"}`}
    >
      <Link
        href={`/desk/${deck.id}`}
        aria-label={`Open deck ${deck.title}`}
        className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
      />

      {deck.isPriority && (
        <div className="pointer-events-none relative z-10 rounded-t-2xl bg-danger px-4 py-1.5 text-center font-mono text-[10px] font-semibold tracking-[0.08em] text-on-danger">
          HIGH PRIORITY
        </div>
      )}

      <div className="pointer-events-none relative z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-accent" />
              <h2 className="truncate font-serif text-lg font-semibold">
                {deck.title}
              </h2>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-text-muted">
              A study workspace for managing materials, key concepts, and
              learning tools.
            </p>
          </div>

          <div className="pointer-events-auto flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={
                deck.isPriority ? "Remove priority" : "Mark deck as priority"
              }
              aria-pressed={deck.isPriority}
              aria-busy={busy}
              disabled={busy}
              onClick={() => onTogglePriority(deck)}
              className={`rounded-lg p-1.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${deck.isPriority ? "text-danger-text" : "text-text-muted hover:text-danger-text"}`}
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Star
                  className="h-5 w-5"
                  fill={deck.isPriority ? "currentColor" : "none"}
                />
              )}
            </button>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label="Deck menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                disabled={busy}
                onClick={() => setMenuOpen((open) => !open)}
                className={`rounded-lg p-1.5 transition hover:bg-surface-hover ${menuOpen ? "text-text" : "text-text-secondary"}`}
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 text-sm shadow-none"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onPublish(deck);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-text hover:bg-surface-hover"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                  {deck.publicDeck?.status === "published" && (
                    <>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onRefreshSnapshot(deck);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh snapshot
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuOpen(false);
                          onUnpublish(deck);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-danger-subtle"
                      >
                        <Undo2 className="h-4 w-4" />
                        Unpublish
                      </button>
                    </>
                  )}
                  {deck.publicDeck?.status === "published" && (
                    <Link
                      href={`/desk/${deck.id}?share=1`}
                      role="menuitem"
                      className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open page
                    </Link>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onTogglePriority(deck);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-text transition hover:bg-surface-hover"
                  >
                    <Star
                      className="h-4 w-4 text-danger-text"
                      fill={deck.isPriority ? "currentColor" : "none"}
                    />
                    {deck.isPriority ? "Remove priority" : "Mark as priority"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onRequestDelete(deck);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-danger-text transition hover:bg-danger-subtle"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete deck
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-mono text-[10px] text-text-secondary">
            {deck.visibility === "private" ? (
              <Lock className="h-3 w-3" />
            ) : (
              <Globe2 className="h-3 w-3" />
            )}
            {deck.visibility === "private"
              ? "PRIVATE"
              : deck.visibility === "public"
                ? "PUBLIC"
                : "LINK"}
          </span>
          <span
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${deck.processingCount > 0 ? "bg-warning-subtle text-warning-text" : deck.isPriority ? "bg-danger-subtle text-danger-text" : "bg-success-subtle text-success-text"}`}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 flex items-center justify-between border-t border-border px-4 py-3 font-mono text-[11px] text-text-muted">
        <div className="flex items-center gap-3"></div>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {DATE_FORMATTER.format(new Date(deck.createdAt))}
        </span>
      </div>
    </div>
  );
}
