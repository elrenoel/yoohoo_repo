"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCheck, FileText, Loader2, Search, Sparkles, X } from "lucide-react";

const MAX_KEYWORDS = 50;

type Step = "documents" | "keywords" | "confirm";

type DeckDocument = {
  id: string;
  title: string;
  status: string;
  ready: boolean;
  keywordCount: number;
  keywordWithFlashcard: number;
};

type KeywordEntry = {
  id: string;
  documentId: string;
  term: string;
  snippet: string | null;
  normalizedTerm: string;
  alreadyHasFlashcard: boolean;
  twinIds: string[];
};

type KeywordGroup = {
  documentId: string;
  title: string;
  keywords: KeywordEntry[];
};

type GenerateResponse = {
  success: boolean;
  jobId: string;
  keywordCount: number;
  documentCount: number;
  error?: string;
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error((body as { error?: string }).error || fallback);
  return body as T;
}

/** Gabungkan istilah kembar: satu baris representan per istilah ternormalisasi.
 *  Representan diprioritaskan ke keyword yang belum punya flashcard. */
function mergeTwins(groups: KeywordGroup[]): KeywordGroup[] {
  const chosen = new Map<string, KeywordEntry>();
  for (const group of groups) {
    for (const keyword of group.keywords) {
      const current = chosen.get(keyword.normalizedTerm);
      if (!current) chosen.set(keyword.normalizedTerm, keyword);
      else if (current.alreadyHasFlashcard && !keyword.alreadyHasFlashcard) chosen.set(keyword.normalizedTerm, keyword);
    }
  }
  const chosenIds = new Set([...chosen.values()].map(keyword => keyword.id));
  return groups.map(group => ({
    ...group,
    keywords: group.keywords.filter(keyword => chosenIds.has(keyword.id)),
  }));
}

export default function GenerateFlashcardsDialog({
  deckId,
  onClose,
  onStarted,
}: {
  deckId: string;
  onClose: () => void;
  onStarted: (jobId: string) => void;
}) {
  // IdempotencyKey dibuat SEKALI saat dialog dibuka (bukan saat klik tombol),
  // sehingga klik ganda tidak pernah membuat job kedua.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
  );

  const [step, setStep] = useState<Step>("documents");
  const [documents, setDocuments] = useState<DeckDocument[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
  const [keywordGroups, setKeywordGroups] = useState<KeywordGroup[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const busyRef = useRef(false);

  const flashcardTitle = "Generate flashcard";

  // Muat daftar materi saat dialog dibuka (loading=true sudah state awal,
  // jadi tidak perlu setState sinkron di dalam effect).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/decks/${deckId}/documents`, { cache: "no-store" })
      .then(response => readJson<{ documents: DeckDocument[] }>(response, "Materi tidak dapat dimuat."))
      .then(body => {
        if (cancelled) return;
        setDocuments(body.documents ?? []);
        setError("");
      })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Materi tidak dapat dimuat."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deckId]);

  const toggleDocument = useCallback((documentId: string) => {
    setSelectedDocIds(previous => {
      const next = new Set(previous);
      if (next.has(documentId)) next.delete(documentId); else next.add(documentId);
      return next;
    });
  }, []);

  const readyDocuments = useMemo(() => documents.filter(document => document.ready), [documents]);
  const allReadySelected = readyDocuments.length > 0 && readyDocuments.every(document => selectedDocIds.has(document.id));

  const toggleAllDocuments = useCallback(() => {
    setSelectedDocIds(allReadySelected ? new Set() : new Set(readyDocuments.map(document => document.id)));
  }, [allReadySelected, readyDocuments]);

  // Step 1 -> 2: muat keyword untuk materi terpilih (fetch per klik, bukan per render).
  const goToKeywords = useCallback(async () => {
    if (!selectedDocIds.size) return;
    setStep("keywords");
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ documentIds: [...selectedDocIds].join(",") });
      const body = await readJson<{ documents: KeywordGroup[] }>(
        await fetch(`/api/decks/${deckId}/keywords?${params}`, { cache: "no-store" }),
        "Keyword tidak dapat dimuat."
      );
      const groups = mergeTwins(body.documents ?? []);
      setKeywordGroups(groups);
      // Buang keyword yang materinya tidak lagi dipilih.
      const validIds = new Set(groups.flatMap(group => group.keywords.map(keyword => keyword.id)));
      setSelectedIds(previous => new Set([...previous].filter(id => validIds.has(id))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Keyword tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [deckId, selectedDocIds]);

  // Lookup global semua keyword terpilih (untuk menggabungkan pilihan kembar
  // yang barisnya berada di materi lain).
  const keywordById = useMemo(() => {
    const map = new Map<string, KeywordEntry>();
    for (const group of keywordGroups) for (const keyword of group.keywords) map.set(keyword.id, keyword);
    return map;
  }, [keywordGroups]);

  /** Id yang ikut terpilih saat sebuah keyword (atau kembarannya) dicentang. */
  const eligibleIds = useCallback((keyword: KeywordEntry) => {
    const entries = [keyword, ...keyword.twinIds
      .map(id => keywordById.get(id))
      .filter((entry): entry is KeywordEntry => Boolean(entry))];
    return [...new Set(entries.filter(entry => !entry.alreadyHasFlashcard).map(entry => entry.id))];
  }, [keywordById]);

  const toggleKeyword = useCallback((keyword: KeywordEntry) => {
    if (keyword.alreadyHasFlashcard) return;
    const ids = eligibleIds(keyword);
    if (!ids.length) return;
    setSelectedIds(previous => {
      const next = new Set(previous);
      const allSelected = ids.every(id => next.has(id));
      for (const id of ids) {
        if (allSelected) next.delete(id); else next.add(id);
      }
      return next;
    });
  }, [eligibleIds]);

  const toggleDocumentKeywords = useCallback((group: KeywordGroup) => {
    const unique = [...new Set(group.keywords.flatMap(keyword => eligibleIds(keyword)))];
    if (!unique.length) return;
    setSelectedIds(previous => {
      const next = new Set(previous);
      const allSelected = unique.every(id => next.has(id));
      for (const id of unique) {
        if (allSelected) next.delete(id); else next.add(id);
      }
      return next;
    });
  }, [eligibleIds]);

  const isDocumentFullySelected = useCallback((group: KeywordGroup) => {
    const unique = [...new Set(group.keywords.flatMap(keyword => eligibleIds(keyword)))];
    return unique.length > 0 && unique.every(id => selectedIds.has(id));
  }, [eligibleIds, selectedIds]);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return keywordGroups;
    return keywordGroups
      .map(group => ({ ...group, keywords: group.keywords.filter(keyword =>
        keyword.term.toLowerCase().includes(query) || (keyword.snippet ?? "").toLowerCase().includes(query)) }))
      .filter(group => group.keywords.length > 0);
  }, [keywordGroups, search]);

  const keywordCount = selectedIds.size;
  const overLimit = keywordCount > MAX_KEYWORDS;
  const canGenerate = keywordCount > 0 && !overLimit;

  const submit = useCallback(async () => {
    if (busyRef.current || !canGenerate) return;
    busyRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const body = await readJson<GenerateResponse>(
        await fetch(`/api/decks/${deckId}/flashcards/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            documentIds: [...selectedDocIds],
            keywordIds: [...selectedIds],
            idempotencyKey,
          }),
        }),
        "Gagal memulai proses generate."
      );
      onStarted(body.jobId);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal memulai proses generate.");
      setSubmitting(false);
      busyRef.current = false;
    }
  }, [canGenerate, deckId, idempotencyKey, onClose, onStarted, selectedDocIds, selectedIds]);

  const stepIndex = step === "documents" ? 1 : step === "keywords" ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#16241D]/45 px-4 py-8 backdrop-blur-sm" role="presentation" onClick={() => { if (!submitting) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={flashcardTitle}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-[#D8DCD3] bg-[#F5F6F3] shadow-[0_24px_70px_rgba(22,36,29,0.35)]"
        onClick={event => event.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#D8DCD3] bg-white px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[#5B6B62]"><Sparkles className="h-4 w-4" /><p className="font-mono text-[10px] uppercase tracking-[0.2em]">{flashcardTitle}</p></div>
            <h2 className="mt-1.5 truncate font-serif text-2xl font-semibold tracking-tight text-[#16241D]">
              {step === "documents" ? "1. Pilih materi" : step === "keywords" ? "2. Pilih keyword" : "3. Konfirmasi"}
            </h2>
            <p className="mt-1 text-sm text-[#5B6B62]">
              {step === "documents" ? "Pilih satu atau lebih materi yang sudah selesai diproses."
                : step === "keywords" ? "Keyword dipilih dari materi terpilih. Istilah kembar otomatis digabung."
                : "Periksa ringkasan sebelum memulai proses."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[#D8DCD3] bg-white px-2.5 py-1 font-mono text-[10px] text-[#5B6B62]">{stepIndex}/3</span>
            <button type="button" onClick={onClose} disabled={submitting} aria-label="Tutup"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D8DCD3] bg-white text-[#16241D] transition hover:bg-[#EFF1EB] disabled:opacity-50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-6 py-5">
          {loading && step !== "confirm" ? (
            <div className="space-y-2.5" role="status">
              <span className="sr-only">Memuat…</span>
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-14 rounded-2xl border border-[#D8DCD3] bg-white animate-pulse" />
              ))}
            </div>
          ) : error && step !== "confirm" ? (
            <div className="flex items-start gap-3 rounded-2xl border border-[#F0C4BE] bg-[#FBEDEB] p-4">
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#C24A3D]" />
              <p className="text-sm text-[#C24A3D]">{error}</p>
            </div>
          ) : step === "documents" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-[#16241D]">
                  <input type="checkbox" checked={allReadySelected} onChange={toggleAllDocuments}
                    disabled={!readyDocuments.length}
                    className="h-4 w-4 rounded border-[#D8DCD3] accent-[#123F34]" />
                  Pilih semua ({readyDocuments.length} siap)
                </label>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#5B6B62]">{selectedDocIds.size} DIPILIH</span>
              </div>
              <div className="space-y-2">
                {documents.map(document => {
                  const checked = selectedDocIds.has(document.id);
                  return (
                    <label key={document.id}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 transition ${!document.ready ? "cursor-not-allowed border-[#E3E5DE] bg-white/40 opacity-70" : checked ? "border-[#123F34] bg-white" : "border-[#D8DCD3] bg-white/70 hover:border-[#AAB7AB]"}`}>
                      <input type="checkbox" checked={checked} disabled={!document.ready}
                        onChange={() => toggleDocument(document.id)}
                        className="h-4 w-4 rounded border-[#D8DCD3] accent-[#123F34]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-[#16241D]">{document.title}</span>
                        <span className="mt-0.5 block text-[11px] text-[#5B6B62]">
                          {document.keywordCount} keyword • {document.keywordWithFlashcard} sudah punya kartu
                        </span>
                      </span>
                      {document.ready
                        ? <span className="rounded-full bg-[#E6EADF] px-2.5 py-1 font-mono text-[10px] text-[#526159]">SIAP</span>
                        : <span className="rounded-full border border-[#D8DCD3] bg-[#EFF1EB] px-2.5 py-1 font-mono text-[10px] text-[#5B6B62]">
                            {document.status === "failed" ? "GAGAL" : document.status === "uploaded" || document.status === "chunking" || document.status === "indexing" ? "DIPROSES" : document.status}
                          </span>}
                    </label>
                  );
                })}
                {!documents.length && (
                  <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-[#D8DCD3] bg-white/50 px-6 text-center text-sm text-[#5B6B62]">
                    Belum ada materi di deck ini.
                  </div>
                )}
              </div>
            </>
          ) : step === "keywords" ? (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-52 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7A8780]" />
                  <input value={search} onChange={event => setSearch(event.target.value)}
                    placeholder="Cari keyword…" aria-label="Cari keyword"
                    className="w-full rounded-xl border border-[#D8DCD3] bg-white py-2.5 pl-9 pr-3 text-sm text-[#16241D] placeholder:text-[#9AA69E] focus:border-[#123F34] focus:outline-none" />
                </div>
                <button type="button" onClick={() => setStep("documents")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8DCD3] bg-white px-3 py-2.5 text-xs font-medium text-[#16241D] transition hover:bg-[#EFF1EB]">
                  <ArrowLeft className="h-3.5 w-3.5" />Ganti materi
                </button>
                <span className={`rounded-full px-3 py-1.5 font-mono text-[10px] ${overLimit ? "bg-[#FBEDEB] text-[#C24A3D]" : "bg-[#E6EADF] text-[#526159]"}`}>
                  {keywordCount}/{MAX_KEYWORDS} DIPILIH
                </span>
              </div>

              {filteredGroups.map(group => (
                <section key={group.documentId} className="rounded-2xl border border-[#D8DCD3] bg-white/70 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-[#16241D]">
                      <FileText className="h-4 w-4 shrink-0 text-[#5B6B62]" />
                      <h3 className="truncate text-sm font-semibold">{group.title}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-[#5B6B62]">{group.keywords.length} KEYWORD</span>
                      <button type="button" onClick={() => toggleDocumentKeywords(group)}
                        className="text-[11px] font-medium text-[#244E3D] transition hover:underline">
                        {isDocumentFullySelected(group) ? "Hapus semua" : "Pilih semua"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {group.keywords.map(keyword => {
                      const disabled = keyword.alreadyHasFlashcard;
                      const ids = eligibleIds(keyword);
                      const checked = ids.length > 0 && ids.every(id => selectedIds.has(id));
                      const twinLabel = keyword.twinIds.length > 0 ? `kembar di ${keyword.twinIds.length + 1} materi` : null;
                      return (
                        <label key={keyword.id}
                          className={`flex items-start gap-3 rounded-xl border p-3 transition ${disabled ? "cursor-not-allowed border-[#E3E5DE] bg-[#EFF1EB]/60 opacity-75" : checked ? "border-[#123F34] bg-white" : "border-transparent bg-white/60 hover:border-[#D8DCD3]"}`}>
                          <input type="checkbox" checked={checked} disabled={disabled || !ids.length}
                            onChange={() => toggleKeyword(keyword)}
                            className="mt-0.5 h-4 w-4 rounded border-[#D8DCD3] accent-[#123F34]" />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-[#16241D]">{keyword.term}</span>
                              {disabled && <span className="rounded-full border border-[#D8DCD3] bg-[#EFF1EB] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[#5B6B62]">sudah ada</span>}
                              {!disabled && twinLabel && <span className="rounded-full bg-[#E6EADF] px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[#526159]">{twinLabel}</span>}
                            </span>
                            {keyword.snippet && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-[#66736B]">{keyword.snippet}</span>}
                          </span>
                        </label>
                      );
                    })}
                    {!group.keywords.length && <p className="px-1 py-2 text-xs text-[#5B6B62]">Tidak ada keyword yang cocok.</p>}
                  </div>
                </section>
              ))}
              {!filteredGroups.length && (
                <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-[#D8DCD3] bg-white/50 px-6 text-center text-sm text-[#5B6B62]">
                  {search ? "Tidak ada keyword yang cocok dengan pencarian." : "Belum ada keyword pada materi terpilih."}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[#D8DCD3] bg-white p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5B6B62]">RINGKASAN</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#D8DCD3] bg-[#F5F6F3] p-4">
                    <p className="font-serif text-3xl font-semibold text-[#16241D]">{selectedDocIds.size}</p>
                    <p className="mt-0.5 text-xs text-[#5B6B62]">materi terpilih</p>
                  </div>
                  <div className="rounded-xl border border-[#D8DCD3] bg-[#F5F6F3] p-4">
                    <p className={`font-serif text-3xl font-semibold ${overLimit ? "text-[#C24A3D]" : "text-[#16241D]"}`}>{keywordCount}</p>
                    <p className="mt-0.5 text-xs text-[#5B6B62]">keyword (maks {MAX_KEYWORDS})</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {[...selectedDocIds].map(id => {
                    const document = documents.find(item => item.id === id);
                    if (!document) return null;
                    return (
                      <li key={id} className="flex items-center justify-between gap-3 text-sm text-[#16241D]">
                        <span className="truncate">{document.title}</span>
                        <span className="shrink-0 font-mono text-[10px] text-[#5B6B62]">{document.status === "ready_for_selection" ? "SIAP" : document.status.toUpperCase()}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              {overLimit && (
                <div className="flex items-start gap-3 rounded-2xl border border-[#F0C4BE] bg-[#FBEDEB] p-4">
                  <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#C24A3D]" />
                  <p className="text-sm text-[#C24A3D]">Jumlah keyword melebihi batas {MAX_KEYWORDS}. Kembali dan kurangi pilihan.</p>
                </div>
              )}
              {!canGenerate && !overLimit && (
                <div className="flex items-start gap-3 rounded-2xl border border-[#D8DCD3] bg-white p-4">
                  <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#5B6B62]" />
                  <p className="text-sm text-[#5B6B62]">Pilih setidaknya satu keyword untuk melanjutkan.</p>
                </div>
              )}
            </div>
          )}
          {error && step === "confirm" && (
            <div className="flex items-start gap-3 rounded-2xl border border-[#F0C4BE] bg-[#FBEDEB] p-4">
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[#C24A3D]" />
              <p className="text-sm text-[#C24A3D]">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[#D8DCD3] bg-white px-6 py-4">
          <button type="button"
            onClick={() => step === "documents" ? onClose() : step === "keywords" ? setStep("documents") : setStep("keywords")}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#D8DCD3] bg-white px-4 py-2.5 text-sm font-medium text-[#16241D] transition hover:bg-[#F5F6F3] disabled:opacity-50">
            <ArrowLeft className="h-4 w-4" />{step === "documents" ? "Batal" : "Kembali"}
          </button>

          {step === "documents" ? (
            <button type="button" onClick={() => void goToKeywords()} disabled={!selectedDocIds.size}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#123F34] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#244E3D] disabled:cursor-not-allowed disabled:opacity-50">
              Pilih keyword <ArrowRight className="h-4 w-4" />
            </button>
          ) : step === "keywords" ? (
            <button type="button" onClick={() => setStep("confirm")} disabled={!keywordCount}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#123F34] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#244E3D] disabled:cursor-not-allowed disabled:opacity-50">
              Tinjau <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => void submit()} disabled={!canGenerate || submitting} aria-busy={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-[#123F34] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#244E3D] disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              {submitting ? "Memulai…" : `Generate ${keywordCount} flashcard`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
