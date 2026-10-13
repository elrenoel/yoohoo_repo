"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, ArrowRight, CheckCheck, FileText, Loader2, Search, Sparkles, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import {
  deckKeywordsResponseSchema,
  generateFlashcardsRequestSchema,
  type DeckKeyword as KeywordEntry,
  type DeckKeywordGroup as KeywordGroup,
  type DeckKeywordsResponse,
  type GenerateFlashcardsErrorCode,
  type GenerateFlashcardsErrorResponse,
} from "@/types/deck-keywords";

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

type GenerateResponse = {
  success: boolean;
  jobId: string;
  keywordCount: number;
  documentCount: number;
  error?: string;
};

const ERROR_MESSAGES: Partial<Record<GenerateFlashcardsErrorCode, string>> = {
  INVALID_REQUEST: "Permintaan tidak valid. Periksa kembali data yang dipilih.",
  INVALID_SELECTION: "Pilihan materi atau keyword tidak valid.",
  DUPLICATE_REQUEST: "Permintaan ini sudah pernah dikirim.",
  QUOTA_EXCEEDED: "Kuota generate hari ini sudah habis.",
  DECK_NOT_FOUND: "Deck tidak ditemukan atau tidak dapat diakses.",
  MATERIAL_NOT_FOUND: "Salah satu materi tidak ditemukan di deck ini.",
  MATERIAL_NOT_READY: "Salah satu materi belum selesai diproses.",
  ACTIVE_JOB_EXISTS: "Masih ada proses generate aktif untuk deck ini.",
};

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const apiError = body as Partial<GenerateFlashcardsErrorResponse>;
    throw Object.assign(new Error(apiError.error || fallback), { code: apiError.code });
  }
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
  /** toastId: toast loading yang sama diteruskan agar status tetap satu toast. */
  onStarted: (jobId: string, toastId: string | number) => void;
}) {
  const toast = useToast();
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
  const [groupName, setGroupName] = useState("");
  const [suggestedGroupName, setSuggestedGroupName] = useState("Cards 1");
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
      .then(response => readJson<{ documents: DeckDocument[]; suggestedGroupName?: string }>(response, "Materials could not be loaded."))
      .then(body => {
        if (cancelled) return;
        setDocuments(body.documents ?? []);
        setSuggestedGroupName(body.suggestedGroupName || "Cards 1");
        setError("");
      })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Materials could not be loaded."); })
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
      const rawBody = await readJson<DeckKeywordsResponse>(
        await fetch(`/api/decks/${deckId}/keywords?${params}`, { cache: "no-store" }),
        "Keywords could not be loaded."
      );
      const body = deckKeywordsResponseSchema.parse(rawBody);
      const groups = mergeTwins(body.documents ?? []);
      setKeywordGroups(groups);
      // Buang keyword yang materinya tidak lagi dipilih.
      const validIds = new Set(groups.flatMap(group => group.keywords.map(keyword => keyword.id)));
      setSelectedIds(previous => new Set([...previous].filter(id => validIds.has(id))));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Keywords could not be loaded.");
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
    return [...new Set(entries.map(entry => entry.id))];
  }, [keywordById]);

  const toggleKeyword = useCallback((keyword: KeywordEntry) => {
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
  const selections = useMemo(() => keywordGroups.flatMap(group => {
    const keywordIds = group.keywords.filter(keyword => selectedIds.has(keyword.id)).map(keyword => keyword.id);
    return group.documentId && keywordIds.length ? [{ document_id: group.documentId, keyword_ids: keywordIds }] : [];
  }), [keywordGroups, selectedIds]);
  const selectionIsValid = selections.length > 0
    && selections.every(selection => Boolean(selection.document_id) && selection.keyword_ids.length > 0);
  const canGenerate = keywordCount > 0 && !overLimit && selectionIsValid;

  const submit = useCallback(async () => {
    if (busyRef.current || !canGenerate) return;
    busyRef.current = true;
    setSubmitting(true);
    setError("");
    const toastId = toast.loading("Starting flashcard generation...");
    try {
      const requestBody = generateFlashcardsRequestSchema.parse({
        groupName: groupName.trim() || undefined,
        selections,
        idempotencyKey,
      });
      const body = await readJson<GenerateResponse>(
        await fetch(`/api/decks/${deckId}/flashcards/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        }),
        "Could not start generation."
      );
      onStarted(body.jobId, toastId);
      onClose();
    } catch (cause) {
      const response = cause as Error & { code?: GenerateFlashcardsErrorCode };
      const message = response.code && ERROR_MESSAGES[response.code]
        ? ERROR_MESSAGES[response.code]!
        : cause instanceof Error ? cause.message : "Flashcard tidak dapat dibuat.";
      setError(message);
      toast.error(message, { id: toastId });
      setSubmitting(false);
      busyRef.current = false;
    }
  }, [canGenerate, deckId, groupName, idempotencyKey, onClose, onStarted, selections, toast]);

  const stepIndex = step === "documents" ? 1 : step === "keywords" ? 2 : 3;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay px-4 py-8 backdrop-blur-sm" role="presentation" onClick={() => { if (!submitting) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={flashcardTitle}
        className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-border bg-bg shadow-none"
        onClick={event => event.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-border bg-surface px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-text-secondary"><Sparkles className="h-4 w-4" /><p className="font-mono text-[10px] uppercase tracking-[0.2em]">{flashcardTitle}</p></div>
            <h2 className="mt-1.5 truncate font-serif text-2xl font-semibold tracking-tight text-text">
              {step === "documents" ? "1. Choose materials" : step === "keywords" ? "2. Choose keywords" : "3. Confirm"}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {step === "documents" ? "Choose one or more materials that have finished processing."
                : step === "keywords" ? "Choose keywords from the selected materials. Duplicate terms are merged automatically."
                : "Review the summary before starting."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-border bg-surface px-2.5 py-1 font-mono text-[10px] text-text-secondary">{stepIndex}/3</span>
            <button type="button" onClick={onClose} disabled={submitting} aria-label="Close"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text transition hover:bg-surface-subtle disabled:opacity-50">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-6 py-5">
          {loading && step !== "confirm" ? (
            <div className="space-y-2.5" role="status">
              <span className="sr-only">Loading...</span>
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-14 rounded-2xl border border-border bg-surface animate-pulse" />
              ))}
            </div>
          ) : error && step !== "confirm" ? (
            <div className="flex items-start gap-3 rounded-2xl border border-danger-border bg-danger-subtle p-4">
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-danger-text" />
              <p className="text-sm text-danger-text">{error}</p>
            </div>
          ) : step === "documents" ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-text">
                  <input type="checkbox" checked={allReadySelected} onChange={toggleAllDocuments}
                    disabled={!readyDocuments.length}
                    className="h-4 w-4 rounded border-border accent-accent" />
                  Select all ({readyDocuments.length} ready)
                </label>
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-secondary">{selectedDocIds.size} SELECTED</span>
              </div>
              <div className="space-y-2">
                {documents.map(document => {
                  const checked = selectedDocIds.has(document.id);
                  return (
                    <label key={document.id}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 transition ${!document.ready ? "cursor-not-allowed border-border bg-surface-subtle opacity-70" : checked ? "border-accent bg-surface" : "border-border bg-surface-raised hover:border-border-strong"}`}>
                      <input type="checkbox" checked={checked} disabled={!document.ready}
                        onChange={() => toggleDocument(document.id)}
                        className="h-4 w-4 rounded border-border accent-accent" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-text">{document.title}</span>
                        <span className="mt-0.5 block text-[11px] text-text-secondary">
                          {document.keywordCount} keywords â€¢ {document.keywordWithFlashcard} already have cards
                        </span>
                      </span>
                      {document.ready
                        ? <span className="rounded-full bg-surface-subtle px-2.5 py-1 font-mono text-[10px] text-text-secondary">SIAP</span>
                        : <span className="rounded-full border border-border bg-surface-subtle px-2.5 py-1 font-mono text-[10px] text-text-secondary">
                            {document.status === "failed" ? "FAILED" : document.status === "uploaded" || document.status === "chunking" || document.status === "indexing" ? "PROCESSING" : document.status}
                          </span>}
                    </label>
                  );
                })}
                {!documents.length && (
                  <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-surface-raised px-6 text-center text-sm text-text-secondary">
                    No materials in this deck yet.
                  </div>
                )}
              </div>
            </>
          ) : step === "keywords" ? (
            <>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative min-w-52 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input value={search} onChange={event => setSearch(event.target.value)}
                    placeholder="Search keywords..." aria-label="Search keywords"
                    className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none" />
                </div>
                <button type="button" onClick={() => setStep("documents")}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-medium text-text transition hover:bg-surface-subtle">
                  <ArrowLeft className="h-3.5 w-3.5" />Change materials
                </button>
                <span className={`rounded-full px-3 py-1.5 font-mono text-[10px] ${overLimit ? "bg-danger-subtle text-danger-text" : "bg-surface-subtle text-text-secondary"}`}>
                  {keywordCount}/{MAX_KEYWORDS} SELECTED
                </span>
              </div>

              {filteredGroups.map(group => (
                <section key={group.documentId} className="rounded-2xl border border-border bg-surface-raised p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2 text-text">
                      <FileText className="h-4 w-4 shrink-0 text-text-secondary" />
                      <h3 className="truncate text-sm font-semibold">{group.title}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] text-text-secondary">{group.keywords.length} KEYWORD</span>
                      <button type="button" onClick={() => toggleDocumentKeywords(group)}
                        className="text-[11px] font-medium text-accent transition hover:underline">
                        {isDocumentFullySelected(group) ? "Clear all" : "Select all"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {group.keywords.map(keyword => {
                      const disabled = false;
                      const ids = eligibleIds(keyword);
                      const checked = ids.length > 0 && ids.every(id => selectedIds.has(id));
                      const twinLabel = keyword.twinIds.length > 0 ? `duplicate in ${keyword.twinIds.length + 1} materials` : null;
                      return (
                        <label key={keyword.id}
                          className={`flex items-start gap-3 rounded-xl border p-3 transition ${disabled ? "cursor-not-allowed border-border bg-surface-subtle/60 opacity-75" : checked ? "border-accent bg-surface" : "border-transparent bg-surface-raised hover:border-border"}`}>
                          <input type="checkbox" checked={checked} disabled={!ids.length}
                            onChange={() => toggleKeyword(keyword)}
                            className="mt-0.5 h-4 w-4 rounded border-border accent-accent" />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold text-text">{keyword.term}</span>
                              {keyword.alreadyHasFlashcard && <span className="rounded-full border border-border bg-surface-subtle px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-text-secondary">used in another group</span>}
                              {!disabled && twinLabel && <span className="rounded-full bg-surface-subtle px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide text-text-secondary">{twinLabel}</span>}
                            </span>
                            {keyword.snippet && <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-text-secondary">{keyword.snippet}</span>}
                          </span>
                        </label>
                      );
                    })}
                    {!group.keywords.length && <p className="px-1 py-2 text-xs text-text-secondary">No matching keywords.</p>}
                  </div>
                </section>
              ))}
              {!filteredGroups.length && (
                <div className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-surface-raised px-6 text-center text-sm text-text-secondary">
                  {search ? "No keywords match your search." : "The selected materials do not have keywords yet."}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-secondary">SUMMARY</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-border bg-bg p-4">
                    <p className="font-serif text-3xl font-semibold text-text">{selectedDocIds.size}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">selected materials</p>
                  </div>
                  <div className="rounded-xl border border-border bg-bg p-4">
                    <p className={`font-serif text-3xl font-semibold ${overLimit ? "text-danger-text" : "text-text"}`}>{keywordCount}</p>
                    <p className="mt-0.5 text-xs text-text-secondary">keywords (max {MAX_KEYWORDS})</p>
                  </div>
                </div>
                <ul className="mt-4 space-y-1.5">
                  {[...selectedDocIds].map(id => {
                    const document = documents.find(item => item.id === id);
                    if (!document) return null;
                    return (
                      <li key={id} className="flex items-center justify-between gap-3 text-sm text-text">
                        <span className="truncate">{document.title}</span>
                        <span className="shrink-0 font-mono text-[10px] text-text-secondary">{document.status === "ready_for_selection" ? "SIAP" : document.status.toUpperCase()}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-text-secondary">Group name</span>
                <input value={groupName} onChange={event => setGroupName(event.target.value)} maxLength={60}
                  placeholder={suggestedGroupName} disabled={submitting}
                  className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-60" />
                <span className="text-[11px] text-text-muted">Kosongkan untuk memakai {suggestedGroupName}.</span>
              </label>
              <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-text-secondary">
                {keywordGroups.flatMap(group => {
                  const count = group.keywords.filter(keyword => selectedIds.has(keyword.id)).length;
                  return count ? [`${group.title}: ${count}`] : [];
                }).join(" · ")} · Total {keywordCount}
              </div>
              {overLimit && (
                <div className="flex items-start gap-3 rounded-2xl border border-danger-border bg-danger-subtle p-4">
                  <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-danger-text" />
                  <p className="text-sm text-danger-text">The keyword count exceeds the {MAX_KEYWORDS} limit. Go back and reduce your selection.</p>
                </div>
              )}
              {!canGenerate && !overLimit && (
                <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
                  <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-text-secondary" />
                  <p className="text-sm text-text-secondary">Select at least one keyword to continue.</p>
                </div>
              )}
            </div>
          )}
          {error && step === "confirm" && (
            <div className="flex items-start gap-3 rounded-2xl border border-danger-border bg-danger-subtle p-4">
              <AlertCircle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-danger-text" />
              <p className="text-sm text-danger-text">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-6 py-4">
          <button type="button"
            onClick={() => step === "documents" ? onClose() : step === "keywords" ? setStep("documents") : setStep("keywords")}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition hover:bg-bg disabled:opacity-50">
            <ArrowLeft className="h-4 w-4" />{step === "documents" ? "Cancel" : "Back"}
          </button>

          {step === "documents" ? (
            <button type="button" onClick={() => void goToKeywords()} disabled={!selectedDocIds.size}
              className="inline-flex items-center gap-1.5 rounded-xl bg-action-primary px-5 py-2.5 text-sm font-semibold text-on-action-primary transition hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
              Choose keywords <ArrowRight className="h-4 w-4" />
            </button>
          ) : step === "keywords" ? (
            <button type="button" onClick={() => setStep("confirm")} disabled={!keywordCount}
              className="inline-flex items-center gap-1.5 rounded-xl bg-action-primary px-5 py-2.5 text-sm font-semibold text-on-action-primary transition hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
              Review <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button type="button" onClick={() => void submit()} disabled={!canGenerate || submitting} aria-busy={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-action-primary px-5 py-2.5 text-sm font-semibold text-on-action-primary transition hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
              {submitting ? "Starting..." : `Generate ${keywordCount} flashcards`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
