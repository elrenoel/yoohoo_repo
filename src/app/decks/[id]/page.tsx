"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Check,
  FileText,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  X,
} from "lucide-react";
import UploadMaterialDialog from "@/components/desk/UploadMaterialDialog";
import GenerateFlashcardsDialog from "@/components/desk/GenerateFlashcardsDialog";
import { useToast } from "@/lib/toast";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";

type FlashcardPreview = { id: string; term: string; definition: string };
type DeckDocument = {
  id: string;
  title: string;
  status: string;
  pageCount: number | null;
  createdAt: string;
  addedAt: string;
  flashcardCount: number;
  flashcardPreview: FlashcardPreview[];
};
type Keyword = { id: string; documentId: string; term: string; snippet: string | null; isSelected: boolean };

type DeckResponse = { deck: { id: string; title: string; updatedAt: string }; documents: DeckDocument[] };
type JobStatusResponse = {
  job: { id: string; status: string; errorMessage: string | null; flashcardCount: number; quizCount: number };
};
type DocumentKeywordsResponse = {
  document: { id: string; title: string; status: string; pageCount: number | null; errorMessage: string | null };
  keywords: Keyword[];
};

async function responseJson<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || fallback);
  return body as T;
}

function materialStatus(status: string) {
  if (["ready", "completed", "ready_for_selection"].includes(status)) return "Siap dipelajari";
  if (status === "failed") return "Perlu diperiksa";
  return "Sedang diproses";
}

export default function DeckWorkbenchPage() {
  const { id } = useParams<{ id: string }>();
  const [deck, setDeck] = useState<DeckResponse["deck"] | null>(null);
  const [documents, setDocuments] = useState<DeckDocument[]>([]);
  const [loadedDeckFor, setLoadedDeckFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState("");
  const loading = loadedDeckFor !== id;

  // Keyword viewer (read-only) for the selected material.
  const [openMaterialId, setOpenMaterialId] = useState<string | null>(null);
  const [materialKeywords, setMaterialKeywords] = useState<Keyword[]>([]);
  const [materialKeywordsLoading, setMaterialKeywordsLoading] = useState(false);
  const [materialKeywordsError, setMaterialKeywordsError] = useState("");
  // Floating generate CTA: material chooser.
  const [pickerOpen, setPickerOpen] = useState(false);
  // Floating upload panel: add material without leaving the deck.
  const [uploadOpen, setUploadOpen] = useState(false);

  const fetchDeck = useCallback(async () => {
    return responseJson<DeckResponse>(await fetch(`/api/decks/${id}`, { cache: "no-store" }), "Deck tidak dapat dimuat.");
  }, [id]);

  const applyDeck = useCallback((deckBody: DeckResponse) => {
    setError("");
    setDeck(deckBody.deck);
    setDocuments(deckBody.documents ?? []);
  }, []);

  const toast = useToast();
  const queryClient = useQueryClient();

  // Job dibuat server (202); worker dijalankan via after() di route generate.
  // Di sini: toast + refresh daftar + polling status job + invalidasi badge.
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const handleGenerateStarted = useCallback((jobId: string) => {
    toast.loading("Membuat flashcard dan quiz… Notifikasi muncul saat selesai.");
    setActiveJobId(jobId);
    void fetchDeck().then(applyDeck).catch(() => undefined);
    void queryClient.invalidateQueries({ queryKey: queryKeys.notifications("all") });
  }, [toast, queryClient, fetchDeck, applyDeck]);

  // Polling status job tiap 4 detik sampai selesai/gagal (UI tidak diblokir).
  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const body = await responseJson<JobStatusResponse>(
          await fetch(`/api/jobs/${activeJobId}`, { cache: "no-store" }),
          "Status proses tidak dapat dimuat."
        );
        if (cancelled) return;
        const status = body.job.status;
        if (status === "succeeded" || status === "completed") {
          setActiveJobId(null);
          toast.success(body.job.flashcardCount
            ? `Selesai — ${body.job.flashcardCount} flashcard dan ${body.job.quizCount} soal ditambahkan.`
            : "Selesai — materi belajar diperbarui.");
          void fetchDeck().then(applyDeck).catch(() => undefined);
        } else if (status === "failed" || status === "canceled") {
          setActiveJobId(null);
          toast.error(body.job.errorMessage || "Generate flashcard gagal.");
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.notifications("all") });
      } catch {
        // Koneksi sesaat gagal — biarkan polling berikutnya mencoba lagi.
      }
    };
    void tick();
    const timer = window.setInterval(() => { void tick(); }, 4000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeJobId, fetchDeck, applyDeck, toast, queryClient]);

  useEffect(() => {
    let cancelled = false;
    fetchDeck()
      .then(deckBody => { if (!cancelled) applyDeck(deckBody); })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Deck tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) setLoadedDeckFor(id); });
    return () => { cancelled = true; };
  }, [id, fetchDeck, applyDeck]);

  const openMaterial = useCallback((documentId: string) => {
    setOpenMaterialId(documentId);
    setMaterialKeywords([]);
    setMaterialKeywordsError("");
    setMaterialKeywordsLoading(true);
    fetch(`/api/documents/${documentId}/keywords`, { cache: "no-store" })
      .then(response => responseJson<DocumentKeywordsResponse>(response, "Keyword tidak dapat dimuat."))
      .then(body => {
        setMaterialKeywords(body.keywords ?? []);
        setMaterialKeywordsError("");
      })
      .catch(cause => {
        setMaterialKeywords([]);
        setMaterialKeywordsError(cause instanceof Error ? cause.message : "Keyword tidak dapat dimuat.");
      })
      .finally(() => setMaterialKeywordsLoading(false));
  }, []);

  const closeMaterial = useCallback(() => setOpenMaterialId(null), []);

  function startEditTitle() {
    if (!deck) return;
    setTitleDraft(deck.title);
    setTitleError("");
    setEditingTitle(true);
  }

  async function saveTitle() {
    const title = titleDraft.trim().slice(0, 200);
    if (!title) { setTitleError("Judul deck wajib diisi."); return; }
    if (titleSaving) return;
    setTitleSaving(true);
    try {
      const response = await fetch(`/api/decks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const body = await responseJson<{ deck?: { title?: string }; error?: string }>(response, "Nama deck tidak dapat disimpan.");
      if (!response.ok) throw new Error(body.error || "Nama deck tidak dapat disimpan.");
      setDeck(previous => previous ? { ...previous, title: body.deck?.title ?? title } : previous);
      setEditingTitle(false);
      setTitleError("");
    } catch (cause) {
      setTitleError(cause instanceof Error ? cause.message : "Nama deck tidak dapat disimpan.");
    } finally {
      setTitleSaving(false);
    }
  }

  function openUpload() {
    setUploadOpen(true);
  }

  useEffect(() => {
    if (!openMaterialId && !pickerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      closeMaterial();
      setPickerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [openMaterialId, pickerOpen, closeMaterial]);

  const totalFlashcards = documents.reduce((total, document) => total + document.flashcardCount, 0);
  const materialsWithFlashcards = documents.filter(document => document.flashcardCount > 0);
  const openDocument = openMaterialId ? documents.find(document => document.id === openMaterialId) ?? null : null;

  if (loading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F2F0E8] text-sm text-[#5D6B63]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyiapkan isi deck...</main>;
  }

  if (error || !deck) {
    return <main className="flex min-h-screen items-center justify-center bg-[#F2F0E8] px-5"><div className="max-w-md rounded-[28px] border border-[#D7D8CE] bg-white p-8 text-center"><p className="text-sm text-rose-700">{error || "Deck tidak ditemukan."}</p><Link href="/desk" className="mt-5 inline-flex rounded-xl bg-[#123F34] px-4 py-2.5 text-sm font-medium text-white">Kembali ke Your Desk</Link></div></main>;
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#F2F0E8] px-4 py-6 pb-28 text-[#183229] sm:px-7 lg:px-9">
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
        <header className="mb-6 overflow-hidden rounded-[30px] bg-[#123F34] px-5 py-6 text-white shadow-[0_18px_50px_rgba(18,63,52,0.16)] sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/desk" className="inline-flex items-center gap-2 text-xs font-medium text-[#C7D8CC] transition hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Your Desk</Link>
              <div className="mt-5 flex items-start gap-4">
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DFF26D] text-[#183229] sm:flex"><Layers3 className="h-6 w-6" /></div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#AFC4B7]">Deck belajar</p>
                  {editingTitle ? <>
                    <div className="mt-1 flex flex-wrap items-center gap-2.5">
                      <input value={titleDraft} onChange={event => setTitleDraft(event.target.value)} maxLength={200} autoFocus disabled={titleSaving} aria-label="Nama deck"
                        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void saveTitle(); } if (event.key === "Escape") setEditingTitle(false); }}
                        className="w-full max-w-xl rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xl font-semibold text-white focus:border-[#DFF26D] focus:outline-none disabled:opacity-60 sm:text-2xl" />
                      <button type="button" onClick={() => void saveTitle()} disabled={titleSaving || !titleDraft.trim()} aria-label="Simpan nama deck" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DFF26D] text-[#183229] transition hover:brightness-95 disabled:opacity-50"><Check className="h-4.5 w-4.5" /></button>
                      <button type="button" onClick={() => setEditingTitle(false)} disabled={titleSaving} aria-label="Batalkan edit nama deck" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/25 text-white transition hover:bg-white/10 disabled:opacity-50"><X className="h-4.5 w-4.5" /></button>
                    </div>
                    {titleError && <p className="mt-2 text-sm text-[#FFD3D3]">{titleError}</p>}
                  </> : <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{deck.title}</h1>
                    <button type="button" onClick={startEditTitle} aria-label="Edit nama deck" className="rounded-lg p-1.5 text-[#AFC4B7] transition hover:bg-white/10 hover:text-white"><Pencil className="h-4 w-4" /></button>
                  </div>}
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#C7D8CC]">Semua materi dan hasil belajar dari deck ini berada dalam satu ruang kerja.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs"><FileText className="h-3.5 w-3.5 text-[#DFF26D]" />{documents.length} materi</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs"><BookOpen className="h-3.5 w-3.5 text-[#DFF26D]" />{totalFlashcards} flashcard</span>
            </div>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-12">
          <section className="rounded-[28px] border border-[#D8D9D0] bg-[#FCFBF7] p-5 shadow-[0_8px_30px_rgba(35,52,43,0.05)] sm:p-6 xl:col-span-4">
            <div className="flex items-start justify-between gap-4">
              <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7B877F]">Isi deck</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Materi kamu</h2></div>
              <span className="rounded-full bg-[#E6EADF] px-2.5 py-1 font-mono text-[10px] text-[#526159]">{documents.length} FILE</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#66736B]">Klik satu materi untuk melihat daftar keyword-nya.</p>

            <div className="mt-5 space-y-2.5">
              {documents.map((document, index) => {
                return <button key={document.id} type="button" onClick={() => openMaterial(document.id)} className="group w-full rounded-2xl border border-[#E0E1D9] bg-white p-3.5 text-left transition hover:-translate-y-0.5 hover:border-[#B8C4B8] hover:shadow-[0_5px_14px_rgba(22,36,29,0.1)]">
                  <div className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EFF1EB] font-mono text-xs font-semibold text-[#526159]">{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{document.title}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#66736B]"><span>{document.pageCount ?? "?"} halaman</span><span>•</span><span>{document.flashcardCount} kartu</span></span>
                    </span>
                    <ArrowUpRight className={`h-4 w-4 shrink-0 transition ${openMaterialId === document.id ? "text-[#244E3D]" : "text-[#A4ADA6] group-hover:text-[#244E3D]"}`} />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-2.5 text-[10px]"><span className="rounded-full bg-white/70 px-2 py-1 font-medium text-[#466050]">{materialStatus(document.status)}</span><span className="font-mono text-[#7B877F]">{new Date(document.addedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span></div>
                </button>;
              })}
              {!documents.length && <div className="rounded-2xl border border-dashed border-[#C8CDC4] px-5 py-10 text-center text-sm text-[#66736B]">Belum ada materi di deck ini.</div>}
              <button type="button" onClick={openUpload} className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#B8C4B8] bg-white/50 px-5 py-3.5 text-sm font-medium text-[#244E3D] transition hover:border-[#244E3D] hover:bg-[#E7F0DF]">
                <Plus className="h-4 w-4" />Tambah materi ke deck ini
              </button>
            </div>
          </section>

          <section className="flex flex-col rounded-[28px] border border-[#D8D9D0] bg-[#F9DCCB] p-5 shadow-[0_8px_30px_rgba(35,52,43,0.05)] sm:p-6 xl:col-span-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="flex items-center gap-2 text-[#805A47]"><BookOpen className="h-4 w-4" /><p className="font-mono text-[10px] uppercase tracking-[0.2em]">Koleksi belajar</p></div><h2 className="mt-2 text-2xl font-semibold tracking-tight">Flashcard yang pernah dibuat</h2><p className="mt-2 text-sm text-[#765F52]">Setiap koleksi tetap terhubung ke materi sumbernya.</p></div>
              <span className="w-fit rounded-full bg-white/65 px-3 py-1.5 font-mono text-[10px] text-[#765F52]">{totalFlashcards} KARTU</span>
            </div>

            {materialsWithFlashcards.length ? <div className="mt-5 grid flex-1 content-start gap-3 md:grid-cols-2">
              {materialsWithFlashcards.map(document => <article key={document.id} className="rounded-2xl border border-[#E2BEA9] bg-[#FFF9F4] p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{document.title}</h3><p className="mt-1 text-[11px] text-[#806A5D]">{document.flashcardCount} flashcard tersimpan</p></div><Link href={`/desk/${document.id}/flashcards`} aria-label={`Buka flashcard ${document.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#183229] text-white transition hover:bg-[#2C5948]"><ArrowUpRight className="h-4 w-4" /></Link></div>
                <div className="mt-3 flex flex-wrap gap-1.5">{document.flashcardPreview.map(card => <span key={card.id} title={card.definition} className="max-w-full truncate rounded-lg border border-[#EDD4C6] bg-white px-2.5 py-1.5 text-[11px] text-[#604C41]">{card.term}</span>)}</div>
              </article>)}
            </div> : <div className="mt-5 flex min-h-36 flex-1 items-center justify-center rounded-2xl border border-dashed border-[#D6B7A6] bg-white/30 px-6 py-10 text-center"><div><Sparkles className="mx-auto h-5 w-5 text-[#8A6654]" /><p className="mt-2 text-sm font-medium">Belum ada flashcard di deck ini</p><p className="mt-1 text-xs text-[#806A5D]">Flashcard yang dibuat dari materi akan muncul otomatis di sini.</p></div></div>}
          </section>
        </div>

        {openDocument && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#183229]/45 px-4 py-8 backdrop-blur-sm" onClick={closeMaterial} role="presentation">
          <div role="dialog" aria-modal="true" aria-label={`Keyword ${openDocument.title}`} className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-[#D8D9D0] bg-[#FCFBF7] shadow-[0_24px_70px_rgba(24,50,41,0.35)]" onClick={event => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-[#E4E6DE] bg-[#DDE9D4] px-6 py-5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[#516757]"><Tag className="h-4 w-4" /><p className="font-mono text-[10px] uppercase tracking-[0.2em]">Keyword materi</p></div>
                <h2 className="mt-1.5 truncate text-2xl font-semibold tracking-tight">{openDocument.title}</h2>
                <p className="mt-1 text-sm text-[#5E6D63]">{materialStatus(openDocument.status)}{openDocument.pageCount != null ? ` • ${openDocument.pageCount} halaman` : ""}</p>
              </div>
              <button type="button" onClick={closeMaterial} aria-label="Tutup" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-[#466050] transition hover:bg-white hover:text-[#183229]"><X className="h-4 w-4" /></button>
            </div>

            <div className="grid flex-1 content-start gap-2.5 overflow-y-auto px-6 py-5 sm:grid-cols-2">
              {materialKeywords.map((keyword, index) => <article key={keyword.id} className="rounded-2xl border border-[#C5D2BE] bg-white/75 p-3.5">
                <div className="flex items-start gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#123F34] font-mono text-[9px] text-white">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><h3 className="text-sm font-semibold text-[#183229]">{keyword.term}</h3><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#67736B]">{keyword.snippet || "Cuplikan untuk keyword ini belum tersedia."}</p></div></div>
              </article>)}
              {!materialKeywords.length && <div className="col-span-full flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-[#AEBEAA] bg-white/35 px-6 text-center text-sm text-[#5E6D63]">
                {materialKeywordsLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Memuat keyword materi...</span>
                  : materialKeywordsError ? materialKeywordsError
                  : openDocument.status === "ready_for_selection" ? "Keyword untuk materi ini belum tersedia."
                  : "Keyword muncul otomatis setelah materi selesai diproses."}
              </div>}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#E4E6DE] px-6 py-4">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7B877F]">{materialKeywordsLoading ? "MEMUAT" : `${materialKeywords.length} KEYWORD`}</span>
              {openDocument.flashcardCount > 0 && <Link href={`/desk/${openDocument.id}/flashcards`} className="inline-flex items-center gap-1.5 rounded-xl bg-[#123F34] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#244E3D]">Lihat {openDocument.flashcardCount} flashcard<ArrowUpRight className="h-3.5 w-3.5" /></Link>}
            </div>
          </div>
        </div>}

        {uploadOpen && <UploadMaterialDialog
          deckId={id}
          deckTitle={deck.title}
          onClose={() => setUploadOpen(false)}
          onReady={() => { void fetchDeck().then(applyDeck).catch(() => undefined); setUploadOpen(false); }}
        />}

        {pickerOpen && <GenerateFlashcardsDialog
          deckId={id}
          onClose={() => setPickerOpen(false)}
          onStarted={handleGenerateStarted}
        />}
      </div>

      {activeJobId && <div role="status" className="fixed bottom-24 right-4 z-40 inline-flex max-w-[min(92vw,22rem)] items-center gap-2.5 rounded-2xl border border-[#D8DCD3] bg-[#F5F6F3] px-4 py-3 text-sm text-[#16241D] shadow-[0_14px_40px_rgba(22,36,29,0.18)] sm:right-7">
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#2F7651]" />
        <span className="min-w-0"><span className="block font-medium">Membuat flashcard dan quiz…</span><span className="block text-xs text-[#5B6B62]">Hasilnya muncul di Notifikasi.</span></span>
      </div>}

      <button type="button" onClick={() => setPickerOpen(true)} disabled={Boolean(activeJobId)} className="fixed bottom-6 right-4 z-40 inline-flex items-center gap-2 rounded-2xl bg-[#123F34] px-5 py-3.5 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(18,63,52,0.4)] transition hover:-translate-y-0.5 hover:bg-[#244E3D] disabled:cursor-not-allowed disabled:opacity-60 sm:right-7">
        {activeJobId ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Sparkles className="h-4.5 w-4.5 text-[#DFF26D]" />}
        {activeJobId ? "Sedang membuat…" : "Generate flashcard"}
      </button>
    </main>
  );
}
