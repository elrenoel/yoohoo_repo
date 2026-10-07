"use client";

import { useEffect, useRef, useState } from "react";
import { CalendarDays, FileText, MoreVertical, RotateCcw, Trash2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export type TrashDeckSummary = {
  id: string;
  title: string;
  materialCount: number;
  /** timestamptz ISO string — when the deck was moved to trash. */
  deletedAt: string;
  /** Whole days left before automatic purge, computed server-side. */
  purgeInDays: number;
};

type TrashDeckCardProps = {
  deck: TrashDeckSummary;
  onRequestRestore: (deck: TrashDeckSummary) => void;
  onRequestPermanentDelete: (deck: TrashDeckSummary) => void;
  /** A restore/permanent-delete request for this card is in flight. */
  busy?: boolean;
  /** The card was optimistically removed and is fading out. */
  removing?: boolean;
};

// Same pinned formatter as DeckCard so dates never drift with the viewer's timezone.
const DATE_FORMATTER = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "Asia/Jakarta" });

export default function TrashDeckCard({ deck, onRequestRestore, onRequestPermanentDelete, busy = false, removing = false }: TrashDeckCardProps) {
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const deletedDate = new Date(deck.deletedAt);
  const purgeInDays = Math.max(0, deck.purgeInDays);
  const purgeLabel = purgeInDays < 1 ? t("trash.purgeToday") : t("trash.purgeIn", { days: String(purgeInDays) });

  return (
    <div
      className={`group relative rounded-2xl border border-[#D8DCD3] bg-white transition duration-300 ease-out hover:-translate-y-0.5 hover:border-[#AAB7AB] hover:shadow-[0_5px_14px_rgba(22,36,29,0.12)] ${menuOpen ? "z-40" : "z-0"} ${removing ? "pointer-events-none scale-[0.98] opacity-0" : "opacity-100"}`}
    >
      <div className="relative z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-[#013528]" />
              <h2 className="truncate font-serif text-lg font-semibold">{deck.title}</h2>
            </div>
            <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#7A8780]">Deck dihapus dari Your Desk. Pulihkan untuk melanjutkan belajar.</p>
          </div>

          <div className="flex shrink-0 items-center gap-0.5">
            <div ref={menuRef} className="relative">
              <button
                type="button"
                aria-label="Menu deck di trash"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-busy={busy}
                disabled={busy}
                onClick={() => setMenuOpen(open => !open)}
                className={`rounded-lg p-1.5 transition hover:bg-[#F1F3EE] disabled:cursor-not-allowed disabled:opacity-60 ${menuOpen ? "text-[#16241D]" : "text-[#5B6B62]"}`}
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {menuOpen && (
                <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-44 overflow-hidden rounded-xl border border-[#D8DCD3] bg-white py-1 text-sm shadow-[0_10px_28px_rgba(22,36,29,0.16)]">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => { setMenuOpen(false); onRequestRestore(deck); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#16241D] transition hover:bg-[#F1F3EE] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <RotateCcw className="h-4 w-4 text-[#2F7651]" />
                    Pulihkan deck
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={() => { setMenuOpen(false); onRequestPermanentDelete(deck); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left font-medium text-[#C24A3D] transition hover:bg-[#FBEDEB] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus permanen
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <span className="rounded-md bg-[#F5F6F3] px-2 py-1 text-[11px] font-medium text-[#7A8780]">Di trash</span>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-[#F0F1EC] px-4 py-3 font-mono text-[11px] text-[#7A8780]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><FileText className="h-3.5 w-3.5" />{deck.materialCount} materi</span>
          <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{DATE_FORMATTER.format(deletedDate)}</span>
        </div>
        <span className="inline-flex items-center gap-1 text-[#C24A3D]">{purgeLabel}</span>
      </div>
    </div>
  );
}
