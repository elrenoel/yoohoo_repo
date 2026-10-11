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
type Keyword = {
  id: string;
  documentId: string;
  term: string;
  snippet: string | null;
  isSelected: boolean;
};

type DeckResponse = {
  deck: { id: string; title: string; updatedAt: string };
  documents: DeckDocument[];
};
type JobStatusResponse = {
  job: {
    id: string;
    status: string;
    errorMessage: string | null;
    flashcardCount: number;
    quizCount: number;
  };
};
type DocumentKeywordsResponse = {
  document: {
    id: string;
    title: string;
    status: string;
    pageCount: number | null;
    errorMessage: string | null;
  };
  keywords: Keyword[];
};

async function responseJson<T>(
  response: Response,
  fallback: string,
): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error((body as { error?: string }).error || fallback);
  return body as T;
}

function materialStatus(status: string) {
  if (["ready", "completed", "ready_for_selection"].includes(status))
    return "Ready to study";
  if (status === "failed") return "Needs attention";
  return "Processing";
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
    return responseJson<DeckResponse>(
      await fetch(`/api/decks/${id}`, { cache: "no-store" }),
      "The deck could not be loaded.",
    );
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
  const handleGenerateStarted = useCallback(
    (jobId: string) => {
      toast.loading(
        "Creating flashcards and a quiz... You will be notified when they are ready.",
      );
      setActiveJobId(jobId);
      void fetchDeck()
        .then(applyDeck)
        .catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    [toast, queryClient, fetchDeck, applyDeck],
  );

  // Polling status job tiap 4 detik sampai selesai/gagal (UI tidak diblokir).
  useEffect(() => {
    if (!activeJobId) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const body = await responseJson<JobStatusResponse>(
          await fetch(`/api/jobs/${activeJobId}`, { cache: "no-store" }),
          "The generation status could not be loaded.",
        );
        if (cancelled) return;
        const status = body.job.status;
        if (status === "succeeded" || status === "completed") {
          setActiveJobId(null);
          toast.success(
            body.job.flashcardCount
              ? `Done — ${body.job.flashcardCount} flashcards and ${body.job.quizCount} questions were added.`
              : "Done — your study material was updated.",
          );
          void fetchDeck()
            .then(applyDeck)
            .catch(() => undefined);
        } else if (status === "failed" || status === "canceled") {
          setActiveJobId(null);
          toast.error(body.job.errorMessage || "Flashcard generation failed.");
        }
        void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      } catch {
        // Koneksi sesaat gagal — biarkan polling berikutnya mencoba lagi.
      }
    };
    void tick();
    const timer = window.setInterval(() => {
      void tick();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeJobId, fetchDeck, applyDeck, toast, queryClient]);

  useEffect(() => {
    let cancelled = false;
    fetchDeck()
      .then((deckBody) => {
        if (!cancelled) applyDeck(deckBody);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "The deck could not be loaded.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadedDeckFor(id);
      });
    return () => {
      cancelled = true;
    };
  }, [id, fetchDeck, applyDeck]);

  const openMaterial = useCallback((documentId: string) => {
    setOpenMaterialId(documentId);
    setMaterialKeywords([]);
    setMaterialKeywordsError("");
    setMaterialKeywordsLoading(true);
    fetch(`/api/documents/${documentId}/keywords`, { cache: "no-store" })
      .then((response) =>
        responseJson<DocumentKeywordsResponse>(
          response,
          "Keywords could not be loaded.",
        ),
      )
      .then((body) => {
        setMaterialKeywords(body.keywords ?? []);
        setMaterialKeywordsError("");
      })
      .catch((cause) => {
        setMaterialKeywords([]);
        setMaterialKeywordsError(
          cause instanceof Error
            ? cause.message
            : "Keywords could not be loaded.",
        );
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
    if (!title) {
      setTitleError("A deck title is required.");
      return;
    }
    if (titleSaving) return;
    setTitleSaving(true);
    try {
      const response = await fetch(`/api/decks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const body = await responseJson<{
        deck?: { title?: string };
        error?: string;
      }>(response, "The deck title could not be saved.");
      if (!response.ok)
        throw new Error(body.error || "The deck title could not be saved.");
      setDeck((previous) =>
        previous ? { ...previous, title: body.deck?.title ?? title } : previous,
      );
      setEditingTitle(false);
      setTitleError("");
    } catch (cause) {
      setTitleError(
        cause instanceof Error
          ? cause.message
          : "The deck title could not be saved.",
      );
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

  const totalFlashcards = documents.reduce(
    (total, document) => total + document.flashcardCount,
    0,
  );
  const materialsWithFlashcards = documents.filter(
    (document) => document.flashcardCount > 0,
  );
  const openDocument = openMaterialId
    ? (documents.find((document) => document.id === openMaterialId) ?? null)
    : null;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-sm text-text-secondary">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Preparing your deck...
      </main>
    );
  }

  if (error || !deck) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg px-5">
        <div className="max-w-md rounded-[28px] border border-border bg-surface p-8 text-center">
          <p className="text-sm text-danger-text">
            {error || "Deck not found."}
          </p>
          <Link
            href="/desk"
            className="mt-5 inline-flex rounded-xl bg-action-primary px-4 py-2.5 text-sm font-medium text-on-action-primary"
          >
            Back to Your Desk
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-bg px-4 py-6 pb-28 text-text sm:px-7 lg:px-9">
      <div className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col">
        <Link
          href="/desk"
          className="inline-flex items-center gap-2 text-xl font-medium text-chrome-muted transition hover:text-chrome-text mb-4"
        >
          <ArrowLeft className="h-5 w-5" />
          Your Desk
        </Link>
        <header className="mb-6 overflow-hidden rounded-[30px] border border-chrome-border bg-chrome px-5 py-6 text-chrome-text shadow-none sm:px-8 sm:py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mt-5 flex items-start gap-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-chrome-muted">
                    Study deck
                  </p>
                  {editingTitle ? (
                    <>
                      <div className="mt-1 flex flex-wrap items-center gap-2.5">
                        <input
                          value={titleDraft}
                          onChange={(event) =>
                            setTitleDraft(event.target.value)
                          }
                          maxLength={200}
                          autoFocus
                          disabled={titleSaving}
                          aria-label="Deck title"
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              void saveTitle();
                            }
                            if (event.key === "Escape") setEditingTitle(false);
                          }}
                          className="w-full max-w-xl rounded-xl border border-chrome-border bg-chrome-hover px-3.5 py-2 text-xl font-semibold text-chrome-text focus:border-accent focus:outline-none disabled:opacity-60 sm:text-2xl"
                        />
                        <button
                          type="button"
                          onClick={() => void saveTitle()}
                          disabled={titleSaving || !titleDraft.trim()}
                          aria-label="Save deck title"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-text transition hover:brightness-95 disabled:opacity-50"
                        >
                          <Check className="h-4.5 w-4.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTitle(false)}
                          disabled={titleSaving}
                          aria-label="Cancel editing deck title"
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-chrome-border text-chrome-text transition hover:bg-chrome-hover disabled:opacity-50"
                        >
                          <X className="h-4.5 w-4.5" />
                        </button>
                      </div>
                      {titleError && (
                        <p className="mt-2 text-sm text-danger-text">
                          {titleError}
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <h1 className="text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                        {deck.title}
                      </h1>
                      <button
                        type="button"
                        onClick={startEditTitle}
                        aria-label="Edit deck title"
                        className="rounded-lg p-1.5 text-chrome-muted transition hover:bg-chrome-hover hover:text-chrome-text"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-chrome-muted">
                    All materials and study results from this deck live in one
                    workspace.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-chrome-border bg-chrome-hover px-3.5 py-2 text-xs">
                <FileText className="h-3.5 w-3.5 text-accent" />
                {documents.length} materials
              </span>
              <span className="inline-flex items-center gap-2 rounded-full border border-chrome-border bg-chrome-hover px-3.5 py-2 text-xs">
                <BookOpen className="h-3.5 w-3.5 text-accent" />
                {totalFlashcards} flashcard
              </span>
            </div>
          </div>
        </header>

        <div className="grid flex-1 grid-cols-1 gap-5 xl:grid-cols-12">
          <section className="rounded-[28px] border border-border bg-surface p-5 shadow-none sm:p-6 xl:col-span-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight">
                  Your materials
                </h2>
              </div>
              <span className="rounded-full bg-surface-subtle px-2.5 py-1 font-mono text-[10px] text-text-secondary">
                {documents.length} FILE
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Select a material to view its keyword list.
            </p>

            <div className="mt-5 space-y-2.5">
              {documents.map((document, index) => {
                return (
                  <button
                    key={document.id}
                    type="button"
                    onClick={() => openMaterial(document.id)}
                    className="group w-full rounded-2xl border border-border bg-surface p-3.5 text-left transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-none"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-subtle font-mono text-xs font-semibold text-text-secondary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {document.title}
                        </span>
                        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-text-secondary">
                          <span>{document.pageCount ?? "?"} pages</span>
                          <span>•</span>
                          <span>{document.flashcardCount} cards</span>
                        </span>
                      </span>
                      <ArrowUpRight
                        className={`h-4 w-4 shrink-0 transition ${openMaterialId === document.id ? "text-accent" : "text-text-muted group-hover:text-accent"}`}
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-2.5 text-[10px]">
                      <span className="rounded-full bg-surface/70 px-2 py-1 font-medium text-text-secondary">
                        {materialStatus(document.status)}
                      </span>
                      <span className="font-mono text-text-muted">
                        {new Date(document.addedAt).toLocaleDateString(
                          "en-US",
                          { day: "2-digit", month: "short" },
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
              {!documents.length && (
                <div className="rounded-2xl border border-dashed border-border-strong px-5 py-10 text-center text-sm text-text-secondary">
                  There are no materials in this deck yet.
                </div>
              )}
              <button
                type="button"
                onClick={openUpload}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border-strong bg-surface/50 px-5 py-3.5 text-sm font-medium text-accent transition hover:border-accent hover:bg-accent-subtle"
              >
                <Plus className="h-4 w-4" />
                Add material to this deck
              </button>
            </div>
          </section>

          <section className="flex flex-col rounded-[28px] border border-border bg-warning-subtle p-5 shadow-none sm:p-6 xl:col-span-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                  Generated flashcards
                </h2>
                <p className="mt-2 text-sm text-warning-text">
                  Each collection stays connected to its source material.
                </p>
              </div>
              <span className="w-fit rounded-full bg-surface/65 px-3 py-1.5 font-mono text-[10px] text-warning-text">
                {totalFlashcards} CARDS
              </span>
            </div>

            {materialsWithFlashcards.length ? (
              <div className="mt-5 grid flex-1 content-start gap-3 md:grid-cols-2">
                {materialsWithFlashcards.map((document) => (
                  <article
                    key={document.id}
                    className="rounded-2xl border border-warning-border bg-surface-raised p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold">
                          {document.title}
                        </h3>
                        <p className="mt-1 text-[11px] text-text-secondary">
                          {document.flashcardCount} saved flashcards
                        </p>
                      </div>
                      <Link
                        href={`/desk/${document.id}/flashcards`}
                        aria-label={`Open flashcards for ${document.title}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-action-primary text-on-action-primary transition hover:bg-action-primary-hover"
                      >
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {document.flashcardPreview.map((card) => (
                        <span
                          key={card.id}
                          title={card.definition}
                          className="max-w-full truncate rounded-lg border border-warning-border bg-surface px-2.5 py-1.5 text-[11px] text-text-secondary"
                        >
                          {card.term}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 flex min-h-36 flex-1 items-center justify-center rounded-2xl border border-dashed border-warning-border bg-surface/30 px-6 py-10 text-center">
                <div>
                  <Sparkles className="mx-auto h-5 w-5 text-warning-text" />
                  <p className="mt-2 text-sm font-medium">
                    No flashcards in this deck yet
                  </p>
                  <p className="mt-1 text-xs text-text-secondary">
                    Flashcards generated from your materials will appear here
                    automatically.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        {openDocument && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-action-primary/45 px-4 py-8 backdrop-blur-sm"
            onClick={closeMaterial}
            role="presentation"
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Keywords for ${openDocument.title}`}
              className="flex max-h-full w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-border bg-surface shadow-none"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-border bg-surface-subtle px-6 py-5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-text-secondary">
                    <Tag className="h-4 w-4" />
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em]">
                      Material keywords
                    </p>
                  </div>
                  <h2 className="mt-1.5 truncate text-2xl font-semibold tracking-tight">
                    {openDocument.title}
                  </h2>
                  <p className="mt-1 text-sm text-text-secondary">
                    {materialStatus(openDocument.status)}
                    {openDocument.pageCount != null
                      ? ` • ${openDocument.pageCount} pages`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeMaterial}
                  aria-label="Close"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface/70 text-text-secondary transition hover:bg-surface hover:text-text"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="grid flex-1 content-start gap-2.5 overflow-y-auto px-6 py-5 sm:grid-cols-2">
                {materialKeywords.map((keyword, index) => (
                  <article
                    key={keyword.id}
                    className="rounded-2xl border border-border-strong bg-surface/75 p-3.5"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-action-primary font-mono text-[9px] text-on-action-primary">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-text">
                          {keyword.term}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-secondary">
                          {keyword.snippet ||
                            "No excerpt is available for this keyword yet."}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
                {!materialKeywords.length && (
                  <div className="col-span-full flex min-h-44 items-center justify-center rounded-2xl border border-dashed border-border-strong bg-surface/35 px-6 text-center text-sm text-text-secondary">
                    {materialKeywordsLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading material keywords...
                      </span>
                    ) : materialKeywordsError ? (
                      materialKeywordsError
                    ) : openDocument.status === "ready_for_selection" ? (
                      "Keywords are not available for this material yet."
                    ) : (
                      "Keywords will appear automatically after processing is complete."
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
                  {materialKeywordsLoading
                    ? "LOADING"
                    : `${materialKeywords.length} KEYWORDS`}
                </span>
                {openDocument.flashcardCount > 0 && (
                  <Link
                    href={`/desk/${openDocument.id}/flashcards`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-action-primary px-4 py-2 text-xs font-medium text-on-action-primary transition hover:bg-action-primary-hover"
                  >
                    View {openDocument.flashcardCount} flashcards
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}

        {uploadOpen && (
          <UploadMaterialDialog
            deckId={id}
            deckTitle={deck.title}
            onClose={() => setUploadOpen(false)}
            onReady={() => {
              void fetchDeck()
                .then(applyDeck)
                .catch(() => undefined);
              setUploadOpen(false);
            }}
          />
        )}

        {pickerOpen && (
          <GenerateFlashcardsDialog
            deckId={id}
            onClose={() => setPickerOpen(false)}
            onStarted={handleGenerateStarted}
          />
        )}
      </div>

      {activeJobId && (
        <div
          role="status"
          className="fixed bottom-24 right-4 z-40 inline-flex max-w-[min(92vw,22rem)] items-center gap-2.5 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text shadow-none sm:right-7"
        >
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-success-text" />
          <span className="min-w-0">
            <span className="block font-medium">
              Creating flashcards and a quiz...
            </span>
            <span className="block text-xs text-text-secondary">
              The result will appear in Notifications.
            </span>
          </span>
        </div>
      )}

      <div className="pointer-events-none fixed inset-x-0 bottom-10 z-40 px-4 sm:px-7 lg:left-60 lg:px-9">
        <div className="mx-auto flex w-full max-w-[1440px] justify-end">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={Boolean(activeJobId)}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl bg-action-primary px-5 py-3.5 text-sm font-semibold text-on-action-primary shadow-none transition hover:-translate-y-0.5 hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {activeJobId ? "Generating..." : "Generate flashcards"}
          </button>
        </div>
      </div>
    </main>
  );
}
