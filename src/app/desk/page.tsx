"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, RefreshCw, User as UserIcon } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DeckCard, { type DeskSummary } from "@/components/desk/DeckCard";
import DeckCardSkeleton from "@/components/desk/DeckCardSkeleton";
import UploadMaterialDialog from "@/components/desk/UploadMaterialDialog";
import PublishDeckDialog from "@/components/desk/PublishDeckDialog";
import { useSession } from "@/lib/session-provider";
import { useToast } from "@/lib/toast";

// Mirrors the API order: priority first, then newest created_at.
function sortDesks(list: DeskSummary[]) {
  return [...list].sort((a, b) => Number(b.isPriority) - Number(a.isPriority) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

const SKELETON_COUNT = 6;
const UNDO_WINDOW_MS = 5000;

type PendingDelete = { fadeTimer: number; deleteTimer: number; toastId: string | number };

export default function YourDeskLanding() {
  const router = useRouter();
  const toast = useToast();
  const t = toast.t;
  const { data: session, isPending: sessionPending } = useSession();
  const [desks, setDesks] = useState<DeskSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [confirmDeck, setConfirmDeck] = useState<DeskSummary | null>(null);
  const [publishDeck, setPublishDeck] = useState<DeskSummary | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const mountedRef = useRef(true);
  const pendingDeletes = useRef<Map<string, PendingDelete>>(new Map());
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const prevRects = useRef<Record<string, DOMRect>>({});
  const reduceMotion = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    reduceMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Confirmed deletions keep running after unmount; only UI updates stop.
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (sessionPending || !session?.user) return;
    let cancelled = false;
    fetch("/api/decks", { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Meja kerja tidak dapat dimuat."); return body.decks as DeskSummary[]; })
      .then(list => { if (!cancelled) { setDesks(sortDesks(list)); setError(""); } })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Meja kerja tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, sessionPending, reloadKey]);

  function retryLoad() {
    setError("");
    setLoading(true);
    setReloadKey(key => key + 1);
  }

  // FLIP: record previous positions, then slide cards from their old spot to the new one.
  const setCardRef = useCallback((id: string, element: HTMLDivElement | null) => { cardRefs.current[id] = element; }, []);

  useEffect(() => {
    const next: Record<string, DOMRect> = {};
    for (const [id, el] of Object.entries(cardRefs.current)) if (el) next[id] = el.getBoundingClientRect();
    if (!reduceMotion.current) {
      for (const [id, el] of Object.entries(cardRefs.current)) {
        const previous = prevRects.current[id];
        const current = next[id];
        if (!el || !previous || !current) continue;
        const deltaY = previous.top - current.top;
        if (Math.abs(deltaY) < 1) continue;
        el.style.transition = "none";
        el.style.transform = `translateY(${deltaY}px)`;
        window.requestAnimationFrame(() => {
          el.style.transition = "transform 320ms cubic-bezier(0.22,1,0.36,1)";
          el.style.transform = "";
        });
        el.addEventListener("transitionend", function clear() {
          el.style.transition = "";
          el.style.transform = "";
          el.removeEventListener("transitionend", clear);
        }, { once: true });
      }
    }
    prevRects.current = next;
  }, [desks]);

  async function togglePriority(desk: DeskSummary) {
    if (busyIds.has(desk.id)) return;
    const next = !desk.isPriority;
    setBusyIds(current => new Set(current).add(desk.id));
    setDesks(current => sortDesks(current.map(item => item.id === desk.id ? { ...item, isPriority: next } : item)));
    try {
      const response = await fetch(`/api/decks/${desk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_priority: next }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t("toast.deck.updateFailed"));
      }
      toast.success(next ? t("toast.deck.toggleOn") : t("toast.deck.toggleOff"));
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : t("toast.deck.updateFailed");
      setDesks(current => sortDesks(current.map(item => item.id === desk.id ? { ...item, isPriority: desk.isPriority } : item)));
      toast.error(message, { action: { label: t("toast.retry"), onClick: () => void togglePriority(desk) } });
    } finally {
      setBusyIds(current => { const next2 = new Set(current); next2.delete(desk.id); return next2; });
    }
  }

  function startDelete(desk: DeskSummary) {
    setRemovingIds(current => new Set(current).add(desk.id));
    const fadeTimer = window.setTimeout(() => {
      if (!mountedRef.current) return;
      setDesks(current => current.filter(item => item.id !== desk.id));
      setRemovingIds(current => { const next = new Set(current); next.delete(desk.id); return next; });
    }, 200);
    const toastId = toast.info(t("toast.deck.deleted"), {
      duration: UNDO_WINDOW_MS,
      action: { label: t("toast.undo"), onClick: () => undoDelete(desk) },
    });
    const deleteTimer = window.setTimeout(() => { void finalizeDelete(desk); }, UNDO_WINDOW_MS);
    pendingDeletes.current.set(desk.id, { fadeTimer, deleteTimer, toastId });
  }

  function undoDelete(desk: DeskSummary) {
    const entry = pendingDeletes.current.get(desk.id);
    if (entry) {
      window.clearTimeout(entry.fadeTimer);
      window.clearTimeout(entry.deleteTimer);
      toast.dismiss(entry.toastId);
      pendingDeletes.current.delete(desk.id);
    }
    setRemovingIds(current => { const next = new Set(current); next.delete(desk.id); return next; });
    setDesks(current => current.some(item => item.id === desk.id) ? current : sortDesks([...current, desk]));
  }

  async function finalizeDelete(desk: DeskSummary) {
    const entry = pendingDeletes.current.get(desk.id);
    pendingDeletes.current.delete(desk.id);
    try {
      // Soft delete: the API sets decks.deleted_at so the deck waits in Trash.
      const response = await fetch(`/api/decks/${desk.id}`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t("toast.deck.deleteFailed"));
      }
      if (entry) toast.dismiss(entry.toastId);
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : t("toast.deck.deleteFailed");
      if (mountedRef.current) setDesks(current => current.some(item => item.id === desk.id) ? current : sortDesks([...current, desk]));
      toast.error(message, { action: { label: t("toast.retry"), onClick: () => startDelete(desk) } });
    }
  }

  function openNewDesk() {
    setUploadOpen(true);
  }

  function reloadDesks() { setLoading(true); setReloadKey(key => key + 1); }
  async function refreshSnapshot(deck: DeskSummary) {
    if (!deck.publicDeck) return;
    setBusyIds(current=>new Set(current).add(deck.id)); const id=toast.loading("Memperbarui snapshot…");
    try { const response=await fetch(`/api/public-decks/${deck.publicDeck.id}/refresh`,{method:"POST"}); const body=await response.json(); if(!response.ok)throw new Error(body.error||"Snapshot gagal diperbarui."); toast.success(`Snapshot versi ${body.publicDeck.version} siap.`,{id}); reloadDesks(); }
    catch(error){toast.error(error instanceof Error?error.message:"Snapshot gagal diperbarui.",{id});} finally{setBusyIds(current=>{const next=new Set(current);next.delete(deck.id);return next})}
  }
  async function unpublish(deck: DeskSummary) {
    if (!deck.publicDeck) return;
    setBusyIds(current=>new Set(current).add(deck.id)); const id=toast.loading("Membatalkan publikasi…");
    try { const response=await fetch(`/api/public-decks/${deck.publicDeck.id}/unpublish`,{method:"POST"}); const body=await response.json(); if(!response.ok)throw new Error(body.error||"Publikasi gagal dibatalkan."); toast.success("Deck tidak lagi tampil publik.",{id}); reloadDesks(); }
    catch(error){toast.error(error instanceof Error?error.message:"Publikasi gagal dibatalkan.",{id});} finally{setBusyIds(current=>{const next=new Set(current);next.delete(deck.id);return next})}
  }
  function handlePublish(deck:DeskSummary){if(deck.publicDeck?.status==="published")router.push(`/d/${deck.publicDeck.slug}`);else if(deck.publicDeck)void refreshSnapshot(deck);else setPublishDeck(deck)}

  const skeletonGrid = (
    <div role="status" aria-busy="true" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      <span className="sr-only">{t("toast.desk.loading")}</span>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => <DeckCardSkeleton key={index} />)}
    </div>
  );

  const emptyState = (
    <Card variant="centered">
      <p className="font-serif text-xl font-semibold">Belum ada meja kerja — buat yang pertama</p>
      <button type="button" onClick={openNewDesk} className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#013528] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#07543F]"><Plus className="h-4 w-4" />Meja baru</button>
    </Card>
  );

  return (
    <AppShell>
      <main className="min-h-screen bg-[#F5F6F3] px-5 py-10 pb-28 text-[#16241D] sm:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-center justify-between gap-4">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5B6B62]">WORKSPACE</p><h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Your Desk</h1></div>
            <button type="button" onClick={openNewDesk} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#013528] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#07543F]"><Plus className="h-4 w-4" />Meja baru</button>
          </header>

          {!sessionPending && !session?.user ? <Card variant="centered"><UserIcon className="mx-auto mb-3 h-6 w-6 text-[#5B6B62]" /><h2 className="font-semibold">Masuk untuk melihat meja kerja</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-[#013528] px-4 py-2 text-sm font-medium text-white">Masuk sekarang</Link></Card>
            : loading ? skeletonGrid
            : error ? <Card variant="centered"><p className="text-sm text-red-600">{error}</p><button type="button" onClick={retryLoad} className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#013528] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#07543F]"><RefreshCw className="h-4 w-4" />{t("toast.retry")}</button></Card>
            : desks.length === 0 ? emptyState
            : <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{desks.map(desk => <DeckCard key={desk.id} deck={desk} busy={busyIds.has(desk.id)} removing={removingIds.has(desk.id)} onTogglePriority={togglePriority} onRequestDelete={setConfirmDeck} onPublish={handlePublish} onRefreshSnapshot={refreshSnapshot} onUnpublish={unpublish} setCardRef={setCardRef} />)}</div>}
        </div>
      </main>

      {uploadOpen && <UploadMaterialDialog
        onClose={() => setUploadOpen(false)}
        onUploaded={({ deckId }) => { setUploadOpen(false); router.push(`/desk/${deckId}`); }}
      />}
      {publishDeck && <PublishDeckDialog deck={publishDeck} onClose={()=>setPublishDeck(null)} onDone={reloadDesks}/>} 

      {confirmDeck && <ConfirmDialog
        title="Pindahkan deck ke Trash?"
        message={`Deck "${confirmDeck.title}" akan dihapus dari daftar dan pindah ke Trash. Masih bisa dipulihkan selama 30 hari dari halaman Trash.`}
        confirmLabel="Hapus deck"
        onCancel={() => setConfirmDeck(null)}
        onConfirm={() => { const desk = confirmDeck; setConfirmDeck(null); startDelete(desk); }}
      />}
    </AppShell>
  );
}
