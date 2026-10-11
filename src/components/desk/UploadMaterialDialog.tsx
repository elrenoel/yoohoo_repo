"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Loader2, Plus, RefreshCw, Upload, X } from "lucide-react";
import { MAX_PDF_BYTES, UUID } from "@/lib/rag/core";
import { useToast } from "@/lib/toast";

type UploadPhase = "form" | "uploading" | "processing" | "failed";

export type UploadedMaterial = { documentId: string; deckId: string };

type UploadMaterialDialogProps = {
  /** Attach the PDF to this deck. Omit to create a brand-new deck from the upload. */
  deckId?: string | null;
  /** Deck name shown under the title while attaching to an existing deck. */
  deckTitle?: string;
  /** Header overrides (eyebrow title / subtitle) so the same overlay fits both flows. */
  title?: string;
  subtitle?: string;
  onClose: () => void;
  /** Fired as soon as the server accepts the upload and the deck is known. */
  onUploaded?: (material: UploadedMaterial) => void;
  /** Fired when the pipeline finishes processing the PDF. */
  onReady?: (material: UploadedMaterial) => void;
};

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 5 * 60_000;
const READY_STATUSES = ["ready_for_selection", "ready", "completed"];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function putWithProgress(uploadUrl: string, headers: Record<string, string>, file: File, onProgress: (value: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    for (const [name, value] of Object.entries(headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = event => {
      const total = event.lengthComputable && event.total > 0 ? event.total : file.size;
      onProgress(Math.min(100, Math.round((event.loaded / total) * 100)));
    };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? (onProgress(100), resolve())
      : reject(new Error(`S3 responded with status ${xhr.status}.`));
    xhr.onerror = () => reject(new Error("The storage connection was interrupted."));
    xhr.send(file);
  });
}

/**
 * Polls the pipeline until the PDF is ready. Lives outside the component
 * lifecycle so the status toast keeps updating even after the overlay closes.
 */
async function waitForDocumentReady(documentId: string) {
  const beganAt = Date.now();
  for (;;) {
    await new Promise(resolve => window.setTimeout(resolve, POLL_INTERVAL_MS));
    if (Date.now() - beganAt > POLL_TIMEOUT_MS) throw new Error("__TIMEOUT__");
    let snapshot: { status?: string; errorMessage?: string | null };
    try {
      const response = await fetch(`/api/documents/${documentId}/status`, { cache: "no-store" });
      if (!response.ok) continue;
      snapshot = await response.json().catch(() => ({}));
    } catch {
      continue; // transient network hiccup â€” keep polling
    }
    if (READY_STATUSES.includes(snapshot.status ?? "")) return;
    if (snapshot.status === "failed") throw new Error(snapshot.errorMessage || "");
  }
}

/**
 * Shared material-upload overlay. Mounted only while open so every open starts
 * from a clean form. Used by the deck workbench (attach) and Your Desk (new deck).
 */
export default function UploadMaterialDialog({ deckId = null, deckTitle, title, subtitle, onClose, onUploaded, onReady }: UploadMaterialDialogProps) {
  const toast = useToast();
  const t = toast.t;
  const attaching = Boolean(deckId);
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [lang, setLang] = useState("en");
  const [phase, setPhase] = useState<UploadPhase>("form");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  // Keep parent callbacks stable inside effects without re-subscribing on every render.
  const onCloseRef = useRef(onClose);
  const onReadyRef = useRef(onReady);
  useEffect(() => { onCloseRef.current = onClose; onReadyRef.current = onReady; }, [onClose, onReady]);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const heading = title ?? (attaching ? "Upload a PDF to this deck" : "Upload a PDF for a new desk");
  const sub = subtitle ?? (attaching ? deckTitle ?? "" : "A new deck will be created automatically from this material.");
  const eyebrow = attaching ? "Add material" : "New desk";

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (busyRef.current) return; // file still being sent
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Block closing while the file is still being sent; allow it once the server
  // has it (processing) â€” the toast keeps reporting status either way.
  function requestClose() {
    if (phase === "uploading" || busyRef.current) return;
    onCloseRef.current();
  }

  function pickFile(nextFile: File | null) {
    setError("");
    if (!nextFile) { setFile(null); return; }
    if (nextFile.type !== "application/pdf" || !nextFile.name.toLowerCase().endsWith(".pdf")) { setFile(null); setError("The file must be a PDF."); return; }
    if (nextFile.size <= 0) { setFile(null); setError("The PDF is empty and cannot be uploaded."); return; }
    if (nextFile.size > MAX_PDF_BYTES) { setFile(null); setError(`The maximum PDF size is ${formatBytes(MAX_PDF_BYTES)}. This file is ${formatBytes(nextFile.size)}.`); return; }
    setFile(nextFile);
    if (!name.trim()) setName(nextFile.name.replace(/\.pdf$/i, "").slice(0, 200));
  }

  function retryFromForm() {
    if (!mountedRef.current) return;
    setPhase("form");
    setError("");
  }

  async function submit() {
    // Double-submit guard that also covers the window before React re-renders.
    if (!file || busyRef.current || phase === "uploading" || phase === "processing") return;
    busyRef.current = true;
    setError("");
    setProgress(0);
    setPhase("uploading");
    const toastId = toast.loading(t("toast.upload.uploading"));
    const fail = (cause: unknown) => {
      const raw = cause instanceof Error ? cause.message : "";
      const fallback = raw === "__TIMEOUT__"
        ? "Processing is taking longer than usual. Your material is still being processedâ€”check the material list again shortly."
        : raw || "Upload failed. Please try again.";
      if (mountedRef.current) { setPhase("failed"); setError(fallback); }
      const options: { id: string | number; action?: { label: string; onClick: () => void } } = { id: toastId };
      // Only offer retry while the overlay is still around to restart the form.
      if (mountedRef.current) options.action = { label: t("toast.retry"), onClick: retryFromForm };
      toast.error(fallback, options);
    };
    try {
      setMessage("Preparing upload...");
      const presignResponse = await fetch("/api/documents/presign", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, fileSize: file.size }) });
      const presignBody = await presignResponse.json().catch(() => ({}));
      if (!presignResponse.ok) throw new Error((presignBody as { error?: string }).error || "Could not prepare the upload.");
      const signed = presignBody as { documentId?: unknown; uploadUrl?: unknown; headers?: unknown };
      if (typeof signed.documentId !== "string" || !UUID.test(signed.documentId) || typeof signed.uploadUrl !== "string"
        || !signed.headers || typeof signed.headers !== "object") throw new Error("The server response is invalid.");
      setMessage("Uploading PDF to storage...");
      await putWithProgress(signed.uploadUrl, signed.headers as Record<string, string>, file, setProgress);
      toast.loading(attaching ? t("toast.upload.processing") : t("toast.desk.creating"), { id: toastId });
      setMessage("Registering document...");
      const payload: Record<string, unknown> = { documentId: signed.documentId, filename: file.name,
        title: name.trim() || file.name.replace(/\.pdf$/i, "").slice(0, 200), contentLanguage: lang };
      if (deckId) payload.deckId = deckId;
      const confirmResponse = await fetch("/api/documents/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const confirmBody = await confirmResponse.json().catch(() => ({}));
      if (!confirmResponse.ok) throw new Error((confirmBody as { error?: string }).error || "Confirmation was rejected.");
      const confirmedDeckId = typeof (confirmBody as { deckId?: unknown }).deckId === "string" ? (confirmBody as { deckId: string }).deckId : signed.documentId;
      const documentId = signed.documentId;
      setMessage("AI is processing the material...");
      if (mountedRef.current) setPhase("processing");
      onUploaded?.({ documentId, deckId: confirmedDeckId });

      if (!attaching) {
        // New desk: the deck exists now, so finish the toast and let the page redirect.
        toast.success(t("toast.desk.created"), { id: toastId });
        return;
      }

      // Attach flow: keep the same toast alive past this component's lifetime.
      waitForDocumentReady(documentId).then(() => {
        toast.success(t("toast.upload.ready"), { id: toastId });
        onReadyRef.current?.({ documentId, deckId: confirmedDeckId });
      }).catch(fail);
    } catch (cause) {
      fail(cause);
    } finally {
      busyRef.current = false;
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay px-4 py-8 backdrop-blur-sm" onClick={requestClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={heading} className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-border bg-surface shadow-none" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-border bg-surface-raised px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-text-secondary"><Upload className="h-4 w-4" /><p className="font-mono text-[10px] uppercase tracking-[0.2em]">{eyebrow}</p></div>
            <h2 className="mt-1.5 truncate text-2xl font-semibold tracking-tight">{heading}</h2>
            {sub && <p className="mt-1 truncate text-sm text-text-secondary">{sub}</p>}
          </div>
          <button type="button" onClick={requestClose} disabled={phase === "uploading"} aria-label="Close" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-raised text-text-secondary transition hover:bg-surface hover:text-text disabled:cursor-not-allowed disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-6 py-5">
          {phase === "processing" ? <div className="rounded-2xl border border-border-strong bg-surface-raised p-6 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-accent" />
            <p className="mt-3 text-sm font-semibold text-text">AI is processing the material</p>
            <p className="mt-1 text-xs leading-relaxed text-text-secondary">Keywords are extracted automatically from the PDF. You can close this panelâ€”the status will remain in the toast and the material will appear in the list.</p>
            <button type="button" onClick={onClose} className="mt-4 inline-flex rounded-xl bg-action-primary px-4 py-2 text-xs font-medium text-on-action-primary transition hover:bg-action-primary-hover">Close for now</button>
          </div> : phase === "failed" ? <div className="rounded-2xl border border-danger-border bg-danger-subtle p-6 text-center">
            <AlertCircle className="mx-auto h-6 w-6 text-danger-text" />
            <p className="mt-3 text-sm font-semibold text-danger-text">Upload failed</p>
            <p className="mt-1 text-xs leading-relaxed text-danger-text">{error}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => { setPhase("form"); setError(""); }} className="inline-flex items-center gap-1.5 rounded-xl bg-action-primary px-4 py-2 text-xs font-medium text-on-action-primary transition hover:bg-action-primary-hover"><RefreshCw className="h-3.5 w-3.5" />{t("toast.retry")}</button>
              <button type="button" onClick={onClose} className="inline-flex rounded-xl border border-danger-border px-4 py-2 text-xs font-medium text-danger-text transition hover:bg-danger-subtle/60">{t("toast.dismiss")}</button>
            </div>
          </div> : <>
            <div onDragOver={event => { event.preventDefault(); if (!busyRef.current) setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={event => { event.preventDefault(); setDrag(false); if (!busyRef.current) pickFile(event.dataTransfer.files.item(0)); }}
              className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition ${drag ? "border-accent bg-accent-subtle" : file ? "border-border-strong bg-surface-raised" : "border-border bg-surface-subtle hover:border-border-strong"}`}>
              <input type="file" accept="application/pdf,.pdf" disabled={phase === "uploading"} onChange={event => pickFile(event.target.files?.item(0) ?? null)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" aria-label="Choose a PDF file" />
              <div className="pointer-events-none flex flex-col items-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-subtle text-text-secondary"><Upload className="h-5 w-5" /></div>
                {file ? <><p className="mt-2 max-w-full truncate text-sm font-medium text-text">{file.name}</p><p className="mt-0.5 text-[11px] text-text-secondary">{formatBytes(file.size)} â€¢ Choose another PDF to replace it</p></>
                  : <><p className="mt-2 text-sm font-medium text-text">Drag a PDF here, or choose a file</p><p className="mt-0.5 text-[11px] text-text-secondary">Supports lecture slides, ebooks, and PDF notes</p></>}
              </div>
            </div>

            <input value={name} onChange={event => setName(event.target.value)} placeholder="Material name (optional)" maxLength={200} disabled={phase === "uploading"}
              className="w-full rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none disabled:opacity-50" />

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-text-secondary">Material language</span>
              <select value={lang} onChange={event => setLang(event.target.value)} disabled={phase === "uploading"} className="w-full cursor-pointer rounded-xl border border-border bg-surface-raised px-3.5 py-2.5 text-sm focus:border-accent focus:outline-none disabled:opacity-50">
                <option value="auto">Match the source PDF language</option><option value="id">Indonesian</option><option value="en">English</option>
              </select>
            </label>

            {phase === "uploading" && <div className="space-y-1.5" role="status">
              <div className="flex justify-between text-xs text-text-secondary"><span>{message}</span><span className="font-mono">{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-subtle" role="progressbar" aria-valuenow={progress}><div className="h-full rounded-full bg-action-primary-hover transition-[width]" style={{ width: `${progress}%` }} /></div>
            </div>}

            {phase === "form" && error && <p className="text-xs text-danger-text" role="alert">{error}</p>}

            <button type="button" onClick={() => void submit()} disabled={!file || phase === "uploading"} aria-busy={phase === "uploading"}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-action-primary px-5 py-3 text-sm font-semibold text-on-action-primary transition hover:bg-action-primary-hover disabled:cursor-not-allowed disabled:opacity-50">
              {phase === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {phase === "uploading" ? "Uploading..." : attaching ? "Upload & process material" : "Upload & create desk"}
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}
