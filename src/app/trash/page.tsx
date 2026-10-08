"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { RefreshCw, Trash2, User as UserIcon } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import DeckCardSkeleton from "@/components/desk/DeckCardSkeleton";
import TrashDeckCard, { type TrashDeckSummary } from "@/components/desk/TrashDeckCard";
import { useSession } from "@/lib/session-provider";
import { useToast } from "@/lib/toast";

const SKELETON_COUNT = 6;

export default function DeckTrashPage() {
  const toast = useToast();
  const t = toast.t;
  const { data: session, isPending: sessionPending } = useSession();
  const [decks, setDecks] = useState<TrashDeckSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [confirmDeck, setConfirmDeck] = useState<TrashDeckSummary | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const mountedRef = useRef(true);
  const actionInProgressRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (sessionPending || !session?.user) return;
    let cancelled = false;
    fetch("/api/decks/trash", { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Trash tidak dapat dimuat."); return body.decks as TrashDeckSummary[]; })
      .then(list => { if (!cancelled) { setDecks(list); setError(""); } })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Trash tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [session, sessionPending, reloadKey]);

  function retryLoad() {
    setError("");
    setLoading(true);
    setReloadKey(key => key + 1);
  }

  function markBusy(id: string, on: boolean) {
    setBusyIds(current => {
      const next = new Set(current);
      if (on) next.add(id); else next.delete(id);
      return next;
    });
  }

  // Optimistic removal: card fades out immediately, rolls back on failure.
  function removeOptimistically(id: string) {
    setRemovingIds(current => new Set(current).add(id));
    window.setTimeout(() => {
      if (!mountedRef.current) return;
      setDecks(current => current.filter(item => item.id !== id));
      setRemovingIds(current => { const next = new Set(current); next.delete(id); return next; });
    }, 200);
  }

  // Rollback: put the card back if the request failed.
  function rollback(deck: TrashDeckSummary) {
    if (!mountedRef.current) return;
    setRemovingIds(current => { const next = new Set(current); next.delete(deck.id); return next; });
    setDecks(current => current.some(item => item.id === deck.id) ? current : [...current, deck]);
  }

  async function restoreDeck(deck: TrashDeckSummary) {
    if (busyIds.has(deck.id)) return;
    markBusy(deck.id, true);
    const toastId = toast.loading(t("trash.restoring"));
    try {
      const response = await fetch(`/api/decks/${deck.id}/restore`, { method: "POST" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t("trash.restoreError"));
      }
      removeOptimistically(deck.id);
      if (mountedRef.current) {
        toast.success(t("trash.restoreSuccess"), { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : t("trash.restoreError");
      if (mountedRef.current) {
        rollback(deck);
        toast.error(message, { id: toastId, action: { label: t("toast.retry"), onClick: () => void restoreDeck(deck) } });
      } else {
        toast.dismiss(toastId);
      }
    } finally {
      markBusy(deck.id, false);
    }
  }

  async function deletePermanently(deck: TrashDeckSummary) {
    if (busyIds.has(deck.id)) return;
    markBusy(deck.id, true);
    actionInProgressRef.current = true;
    setActionInProgress(true);
    const toastId = toast.loading(t("trash.deletingPermanent"));
    try {
      const response = await fetch(`/api/decks/${deck.id}/permanent`, { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t("trash.permanentDeleteError"));
      }
      removeOptimistically(deck.id);
      if (mountedRef.current) {
        toast.success(t("trash.permanentDeleteSuccess"), { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : t("trash.permanentDeleteError");
      if (mountedRef.current) {
        rollback(deck);
        toast.error(message, { id: toastId, action: { label: t("toast.retry"), onClick: () => void deletePermanently(deck) } });
      } else {
        toast.dismiss(toastId);
      }
    } finally {
      actionInProgressRef.current = false;
      setActionInProgress(false);
      markBusy(deck.id, false);
    }
  }

  async function emptyTrash() {
    if (actionInProgressRef.current) return;
    actionInProgressRef.current = true;
    setActionInProgress(true);
    const snapshot = decks;
    const toastId = toast.loading(t("trash.emptying"));
    try {
      const response = await fetch("/api/decks/trash", { method: "DELETE" });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || t("trash.emptyTrashError"));
      }
      if (mountedRef.current) {
        setDecks([]);
        toast.success(t("trash.emptyTrashSuccess"), { id: toastId });
      } else {
        toast.dismiss(toastId);
      }
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : t("trash.emptyTrashError");
      if (mountedRef.current) {
        setDecks(snapshot);
        toast.error(message, { id: toastId, action: { label: t("toast.retry"), onClick: () => void emptyTrash() } });
      } else {
        toast.dismiss(toastId);
      }
    } finally {
      actionInProgressRef.current = false;
      setActionInProgress(false);
    }
  }

  const skeletonGrid = (
    <div role="status" aria-busy="true" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      <span className="sr-only">{t("toast.desk.loading")}</span>
      {Array.from({ length: SKELETON_COUNT }, (_, index) => <DeckCardSkeleton key={index} />)}
    </div>
  );

  const emptyState = (
    <Card variant="centered" className="rotate-[-1deg]">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-subtle">
        <Trash2 className="h-6 w-6 text-text-muted" />
      </div>
      <p className="font-serif text-xl font-semibold">Trash kosong</p>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-muted">{t("trash.emptyDesc")}</p>
      <Link href="/desk" className="mt-5 inline-flex rounded-xl bg-action-primary px-4 py-2.5 text-sm font-medium text-on-action-primary transition hover:bg-action-primary-hover">Kembali ke Your Desk</Link>
    </Card>
  );

  return (
    <AppShell>
      <main className="min-h-screen bg-bg px-5 py-10 pb-28 text-text sm:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary">TRASH</p>
              <h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">{t("trash.pageTitle")}</h1>
              <p className="mt-1 text-sm text-text-secondary">{t("trash.pageDesc")}</p>
            </div>
            {decks.length > 0 && session?.user && (
              <button
                type="button"
                onClick={() => setConfirmEmpty(true)}
                disabled={actionInProgress}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-control-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" />
                {t("trash.emptyTrash")}
              </button>
            )}
          </header>

          {!sessionPending && !session?.user
            ? <Card variant="centered"><UserIcon className="mx-auto mb-3 h-6 w-6 text-text-secondary" /><h2 className="font-semibold">Masuk untuk melihat trash</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-action-primary px-4 py-2 text-sm font-medium text-on-action-primary">Masuk sekarang</Link></Card>
            : loading ? skeletonGrid
            : error ? <Card variant="centered"><p className="text-sm text-danger-text">{error}</p><button type="button" onClick={retryLoad} className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-action-primary px-4 py-2.5 text-sm font-medium text-on-action-primary transition hover:bg-action-primary-hover"><RefreshCw className="h-4 w-4" />{t("toast.retry")}</button></Card>
            : decks.length === 0 ? emptyState
            : <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{decks.map(deck => <TrashDeckCard key={deck.id} deck={deck} busy={busyIds.has(deck.id)} removing={removingIds.has(deck.id)} onRequestRestore={restoreDeck} onRequestPermanentDelete={setConfirmDeck} />)}</div>}
        </div>
      </main>

      {confirmDeck && <ConfirmDialog
        title={t("trash.permanentDeleteTitle")}
        message={t("trash.permanentDeleteConfirm", { title: confirmDeck.title })}
        confirmLabel={t("trash.permanentDelete")}
        loading={actionInProgress}
        onCancel={() => { if (!actionInProgress) setConfirmDeck(null); }}
        onConfirm={() => { const deck = confirmDeck; setConfirmDeck(null); void deletePermanently(deck); }}
      />}

      {confirmEmpty && <ConfirmDialog
        title={t("trash.emptyTrashTitle")}
        message={t("trash.emptyTrashConfirm")}
        confirmLabel={t("trash.emptyTrash")}
        loading={actionInProgress}
        onCancel={() => { if (!actionInProgress) setConfirmEmpty(false); }}
        onConfirm={() => { setConfirmEmpty(false); void emptyTrash(); }}
      />}
    </AppShell>
  );
}
