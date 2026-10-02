"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  FileText,
  Layers3,
  Loader2,
  Network,
  Sparkles,
  Tag,
} from "lucide-react";
import DeckMaterialMap from "@/components/desk/DeckMaterialMap";

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
type ConceptNode = { id: string; documentId: string; term: string; snippet: string | null };
type ConceptEdge = { from: string; to: string; type: string };

type DeckResponse = { deck: { id: string; title: string; updatedAt: string }; documents: DeckDocument[] };
type KeywordResponse = { keywords: Keyword[] };
type ConceptResponse = { nodes: ConceptNode[]; edges: ConceptEdge[] };

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
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [conceptMap, setConceptMap] = useState<ConceptResponse>({ nodes: [], edges: [] });
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [loadedDeckFor, setLoadedDeckFor] = useState<string | null>(null);
  const [loadedKeywordsFor, setLoadedKeywordsFor] = useState<string | null>(null);
  const [loadedConceptFor, setLoadedConceptFor] = useState<string | null>(null);
  const [error, setError] = useState("");
  const loading = loadedDeckFor !== id;
  const keywordsLoading = loadedKeywordsFor !== id;
  const conceptLoading = loadedConceptFor !== id;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/decks/${id}`, { cache: "no-store" })
      .then(response => responseJson<DeckResponse>(response, "Deck tidak dapat dimuat."))
      .then(deckBody => {
        if (cancelled) return;
        setError("");
        setDeck(deckBody.deck);
        setDocuments(deckBody.documents ?? []);
        setActiveDocumentId(deckBody.documents?.[0]?.id ?? null);

        // Load secondary data only after the deck shell is ready. This keeps
        // keyword/concept-map queries from competing with the first paint.
        void fetch(`/api/decks/${id}/keywords`, { cache: "no-store" })
          .then(response => responseJson<KeywordResponse>(response, "Keyword tidak dapat dimuat."))
          .then(keywordBody => { if (!cancelled) setKeywords(keywordBody.keywords ?? []); })
          .catch(() => { if (!cancelled) setKeywords([]); })
          .finally(() => { if (!cancelled) setLoadedKeywordsFor(id); });

        void fetch(`/api/decks/${id}/concept-map`, { cache: "no-store" })
          .then(response => responseJson<ConceptResponse>(response, "Peta konsep tidak dapat dimuat."))
          .then(conceptBody => { if (!cancelled) setConceptMap(conceptBody); })
          .catch(() => { if (!cancelled) setConceptMap({ nodes: [], edges: [] }); })
          .finally(() => { if (!cancelled) setLoadedConceptFor(id); });
      })
      .catch(cause => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Deck tidak dapat dimuat.");
        setLoadedKeywordsFor(id);
        setLoadedConceptFor(id);
      })
      .finally(() => { if (!cancelled) setLoadedDeckFor(id); });

    return () => { cancelled = true; };
  }, [id]);

  const activeDocument = documents.find(document => document.id === activeDocumentId) ?? documents[0] ?? null;
  const activeKeywords = useMemo(
    () => keywords.filter(keyword => keyword.documentId === activeDocument?.id),
    [activeDocument?.id, keywords],
  );
  const totalFlashcards = documents.reduce((total, document) => total + document.flashcardCount, 0);
  const materialsWithFlashcards = documents.filter(document => document.flashcardCount > 0);

  if (loading) {
    return <main className="flex min-h-[75vh] items-center justify-center bg-[#F2F0E8] text-sm text-[#5D6B63]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyiapkan isi deck...</main>;
  }

  if (error || !deck) {
    return <main className="flex min-h-[75vh] items-center justify-center bg-[#F2F0E8] px-5"><div className="max-w-md rounded-[28px] border border-[#D7D8CE] bg-white p-8 text-center"><p className="text-sm text-rose-700">{error || "Deck tidak ditemukan."}</p><Link href="/desk" className="mt-5 inline-flex rounded-xl bg-[#123F34] px-4 py-2.5 text-sm font-medium text-white">Kembali ke Your Desk</Link></div></main>;
  }

  return (
    <main className="min-h-screen bg-[#F2F0E8] px-4 py-6 pb-28 text-[#183229] sm:px-7 lg:px-9">
      <div className="mx-auto max-w-[1440px]">
        <header className="mb-6 overflow-hidden rounded-[30px] bg-[#123F34] px-5 py-6 text-white shadow-[0_18px_50px_rgba(18,63,52,0.16)] sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Link href="/desk" className="inline-flex items-center gap-2 text-xs font-medium text-[#C7D8CC] transition hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Your Desk</Link>
              <div className="mt-5 flex items-start gap-4">
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#DFF26D] text-[#183229] sm:flex"><Layers3 className="h-6 w-6" /></div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#AFC4B7]">Deck belajar</p>
                  <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{deck.title}</h1>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#C7D8CC]">Semua materi, keyword, dan hasil belajar dari deck ini berada dalam satu ruang kerja.</p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs"><FileText className="h-3.5 w-3.5 text-[#DFF26D]" />{documents.length} materi</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs"><Tag className="h-3.5 w-3.5 text-[#DFF26D]" />{keywords.length} keyword</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-xs"><BookOpen className="h-3.5 w-3.5 text-[#DFF26D]" />{totalFlashcards} flashcard</span>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <section className="rounded-[28px] border border-[#D8D9D0] bg-[#FCFBF7] p-5 shadow-[0_8px_30px_rgba(35,52,43,0.05)] sm:p-6 xl:col-span-4 xl:row-span-2">
            <div className="flex items-start justify-between gap-4">
              <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#7B877F]">Isi deck</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Materi kamu</h2></div>
              <span className="rounded-full bg-[#E6EADF] px-2.5 py-1 font-mono text-[10px] text-[#526159]">{documents.length} FILE</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-[#66736B]">Klik satu materi untuk membuka keyword yang berasal dari materi tersebut.</p>

            <div className="mt-5 space-y-2.5">
              {documents.map((document, index) => {
                const active = document.id === activeDocument?.id;
                const keywordCount = keywords.filter(keyword => keyword.documentId === document.id).length;
                return <button key={document.id} type="button" onClick={() => setActiveDocumentId(document.id)} className={`group w-full rounded-2xl border p-3.5 text-left transition ${active ? "border-[#244E3D] bg-[#E7F0DF] shadow-[inset_4px_0_0_#244E3D]" : "border-[#E0E1D9] bg-white hover:-translate-y-0.5 hover:border-[#B8C4B8]"}`}>
                  <div className="flex items-start gap-3">
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-semibold ${active ? "bg-[#244E3D] text-white" : "bg-[#EFF1EB] text-[#526159]"}`}>{String(index + 1).padStart(2, "0")}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{document.title}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-[#66736B]"><span>{document.pageCount ?? "?"} halaman</span><span>•</span><span>{keywordCount} keyword</span><span>•</span><span>{document.flashcardCount} kartu</span></span>
                    </span>
                    <ArrowUpRight className={`h-4 w-4 shrink-0 transition ${active ? "text-[#244E3D]" : "text-[#A4ADA6] group-hover:text-[#244E3D]"}`} />
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-black/5 pt-2.5 text-[10px]"><span className="rounded-full bg-white/70 px-2 py-1 font-medium text-[#466050]">{materialStatus(document.status)}</span><span className="font-mono text-[#7B877F]">{new Date(document.addedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span></div>
                </button>;
              })}
              {!documents.length && <div className="rounded-2xl border border-dashed border-[#C8CDC4] px-5 py-10 text-center text-sm text-[#66736B]">Belum ada materi di deck ini.</div>}
            </div>
          </section>

          <section className="min-h-[430px] rounded-[28px] border border-[#D8D9D0] bg-[#DDE9D4] p-5 shadow-[0_8px_30px_rgba(35,52,43,0.05)] sm:p-6 xl:col-span-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#516757]"><Tag className="h-4 w-4" /><p className="font-mono text-[10px] uppercase tracking-[0.2em]">Keyword materi</p></div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{activeDocument?.title ?? "Pilih materi"}</h2>
                <p className="mt-2 text-sm text-[#5E6D63]">Keyword hanya ditampilkan dari materi yang sedang aktif.</p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#123F34] px-3 py-1.5 font-mono text-[10px] text-white">{keywordsLoading && <Loader2 className="h-3 w-3 animate-spin" />}{keywordsLoading ? "MEMUAT" : `${activeKeywords.length} KEYWORD`}</span>
            </div>

            <div className="mt-6 grid max-h-[310px] gap-2.5 overflow-y-auto pr-1 sm:grid-cols-2">
              {activeKeywords.map((keyword, index) => <article key={keyword.id} className="rounded-2xl border border-[#C5D2BE] bg-white/75 p-3.5 backdrop-blur-sm">
                <div className="flex items-start gap-3"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#123F34] font-mono text-[9px] text-white">{String(index + 1).padStart(2, "0")}</span><div className="min-w-0"><h3 className="text-sm font-semibold text-[#183229]">{keyword.term}</h3><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[#67736B]">{keyword.snippet || "Cuplikan untuk keyword ini belum tersedia."}</p></div></div>
              </article>)}
              {activeDocument && !activeKeywords.length && <div className="col-span-full flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-[#AEBEAA] bg-white/35 px-6 text-center text-sm text-[#5E6D63]">{keywordsLoading ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Memuat keyword materi...</span> : "Keyword untuk materi ini belum tersedia atau masih diproses."}</div>}
            </div>
          </section>

          <section className="rounded-[28px] border border-[#D8D9D0] bg-[#F9DCCB] p-5 shadow-[0_8px_30px_rgba(35,52,43,0.05)] sm:p-6 xl:col-span-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="flex items-center gap-2 text-[#805A47]"><BookOpen className="h-4 w-4" /><p className="font-mono text-[10px] uppercase tracking-[0.2em]">Koleksi belajar</p></div><h2 className="mt-2 text-2xl font-semibold tracking-tight">Flashcard yang pernah dibuat</h2><p className="mt-2 text-sm text-[#765F52]">Setiap koleksi tetap terhubung ke materi sumbernya.</p></div>
              <span className="w-fit rounded-full bg-white/65 px-3 py-1.5 font-mono text-[10px] text-[#765F52]">{totalFlashcards} KARTU</span>
            </div>

            {materialsWithFlashcards.length ? <div className="mt-5 grid gap-3 md:grid-cols-2">
              {materialsWithFlashcards.map(document => <article key={document.id} className="rounded-2xl border border-[#E2BEA9] bg-[#FFF9F4] p-4">
                <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{document.title}</h3><p className="mt-1 text-[11px] text-[#806A5D]">{document.flashcardCount} flashcard tersimpan</p></div><Link href={`/documents/${document.id}/flashcards`} aria-label={`Buka flashcard ${document.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#183229] text-white transition hover:bg-[#2C5948]"><ArrowUpRight className="h-4 w-4" /></Link></div>
                <div className="mt-3 flex flex-wrap gap-1.5">{document.flashcardPreview.map(card => <span key={card.id} title={card.definition} className="max-w-full truncate rounded-lg border border-[#EDD4C6] bg-white px-2.5 py-1.5 text-[11px] text-[#604C41]">{card.term}</span>)}</div>
              </article>)}
            </div> : <div className="mt-5 flex min-h-36 items-center justify-center rounded-2xl border border-dashed border-[#D6B7A6] bg-white/30 px-6 text-center"><div><Sparkles className="mx-auto h-5 w-5 text-[#8A6654]" /><p className="mt-2 text-sm font-medium">Belum ada flashcard di deck ini</p><p className="mt-1 text-xs text-[#806A5D]">Flashcard yang dibuat dari materi akan muncul otomatis di sini.</p></div></div>}
          </section>

          <section className="rounded-[28px] border border-[#D8D9D0] bg-[#FCFBF7] p-5 shadow-[0_8px_30px_rgba(35,52,43,0.05)] sm:p-6 xl:col-span-12">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div><div className="flex items-center gap-2 text-[#5B6C62]"><Network className="h-4 w-4" /><p className="font-mono text-[10px] uppercase tracking-[0.2em]">Peta deck</p></div><h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Hubungan antar materi</h2><p className="mt-2 text-sm text-[#66736B]">Klik node materi untuk langsung melihat kumpulan keyword-nya di atas.</p></div>
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#D9DDD5] bg-white px-3 py-1.5 text-[11px] text-[#66736B]">{conceptLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarDays className="h-3.5 w-3.5" />}{conceptLoading ? "Memuat hubungan" : `Diperbarui ${new Date(deck.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`}</span>
            </div>
            <DeckMaterialMap deckTitle={deck.title} materials={documents} keywordNodes={conceptMap.nodes} keywordEdges={conceptMap.edges} activeMaterialId={activeDocument?.id ?? null} onSelectMaterial={setActiveDocumentId} />
          </section>
        </div>
      </div>
    </main>
  );
}
