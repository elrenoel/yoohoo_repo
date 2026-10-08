"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  FileText,
  FolderKanban,
  Globe2,
  Link2,
  Loader2,
  Lock,
  MessageCircle,
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
      className={`group relative rounded-2xl border ${deck.isPriority ? "border-[#C24A3D]" : "border-[#D8DCD3]"} bg-white transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[#AAB7AB] hover:shadow-[0_5px_14px_rgba(22,36,29,0.12)] ${menuOpen ? "z-40" : "z-0"} ${removing ? "pointer-events-none scale-[0.98] opacity-0" : "opacity-100"}`}
    >
      <Link
        href={`/desk/${deck.id}`}
        aria-label={`Open deck ${deck.title}`}
        className="absolute inset-0 z-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#013528]"
      />

      {deck.isPriority && (
        <div className="pointer-events-none relative z-10 rounded-t-2xl bg-[#C24A3D] px-4 py-1.5 text-center font-mono text-[10px] font-semibold tracking-[0.08em] text-white">
          HIGH PRIORITY
        </div>
      )}

      <div className="pointer-events-none relative z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-[#013528]" />
              <h2 className="truncate font-serif text-lg font-semibold">
                {deck.title}
              </h2>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#7A8780]">
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
              className={`rounded-lg p-1.5 transition disabled:cursor-not-allowed disabled:opacity-60 ${deck.isPriority ? "text-[#C24A3D]" : "text-[#A2ADA5] hover:text-[#C24A3D]"}`}
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
                className={`rounded-lg p-1.5 transition hover:bg-[#F1F3EE] ${menuOpen ? "text-[#16241D]" : "text-[#5B6B62]"}`}
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-[#D8DCD3] bg-white py-1 text-sm shadow-[0_10px_28px_rgba(22,36,29,0.16)]"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onPublish(deck);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#16241D] hover:bg-[#F1F3EE]"
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
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#F1F3EE]"
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
                        className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#FBEDEB]"
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
                      className="flex items-center gap-2 px-3 py-2 hover:bg-[#F1F3EE]"
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#16241D] transition hover:bg-[#F1F3EE]"
                  >
                    <Star
                      className="h-4 w-4 text-[#C24A3D]"
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
                    className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-[#C24A3D] transition hover:bg-[#FBEDEB]"
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
          <span className="inline-flex items-center gap-1 rounded-md border border-[#D8DCD3] px-2 py-1 font-mono text-[10px] text-[#5B6B62]">
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
            className={`rounded-md px-2 py-1 text-[11px] font-medium ${deck.processingCount > 0 ? "bg-[#FFF1E7] text-[#C86621]" : deck.isPriority ? "bg-[#FBEDEB] text-[#C24A3D]" : "bg-[#EEF5F0] text-[#397653]"}`}
          >
            {status}
          </span>
        </div>
      </div>

      <div className="pointer-events-none relative z-10 flex items-center justify-between border-t border-[#F0F1EC] px-4 py-3 font-mono text-[11px] text-[#7A8780]">
        <div className="flex items-center gap-3"></div>
        <span className="inline-flex items-center gap-1">
          <CalendarDays className="h-3.5 w-3.5" />
          {DATE_FORMATTER.format(new Date(deck.createdAt))}
        </span>
      </div>
    </div>
  );
}
