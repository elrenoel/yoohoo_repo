"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, BookOpen, CheckCircle2, FileText, Loader2, RefreshCw, Upload } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AppShell from "@/components/layout/AppShell";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { useI18n } from "@/lib/i18n";
import { queryKeys } from "@/lib/query-keys";
import { MAX_PDF_BYTES, UUID } from "@/lib/rag/core";
import { useSession } from "@/lib/session-provider";

const PENDING_UPLOAD_KEY = "yoohoo_rag_pending_document";
const POLL_INTERVAL_MS = 3_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

type DocumentStatus = "uploaded" | "chunking" | "indexing" | "ready_for_selection" | "failed";
type PendingDocument = { documentId: string; startedAt: number };
type StatusResponse = { documentId: string; status: DocumentStatus; errorMessage: string | null };

const statusLabels: Record<Exclude<DocumentStatus, "failed">, string> = {
  uploaded: "Menyiapkan dokumen...",
  chunking: "Reading and splitting the material...",
  indexing: "Analyzing content and finding keywords...",
  ready_for_selection: "Preparing the keyword list...",
};

const steps = [
  { title: "steps.1Title" as const, description: "steps.1Desc" as const },
  { title: "steps.2Title" as const, description: "steps.2Desc" as const },
  { title: "steps.3Title" as const, description: "steps.3Desc" as const },
];

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function responseMessage(body: unknown, fallback: string) {
  return body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : fallback;
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function putPdf(uploadUrl: string, headers: Record<string, string>, file: File, onProgress: (value: number) => void) {
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
      : reject(new Error(`S3 merespons dengan status ${xhr.status}.`));
    xhr.onerror = () => reject(new Error("Koneksi ke penyimpanan terputus."));
    xhr.onabort = () => reject(new Error("Upload dibatalkan."));
    xhr.send(file);
  });
}

function loadPendingDocument(): PendingDocument | null {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PENDING_UPLOAD_KEY) ?? "null");
    if (value && typeof value === "object" && "documentId" in value && "startedAt" in value
      && typeof value.documentId === "string" && UUID.test(value.documentId) && typeof value.startedAt === "number") {
      return { documentId: value.documentId, startedAt: value.startedAt };
    }
  } catch {
    // Invalid browser storage is treated as no pending document.
  }
  return null;
}

export default function RagUploadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { t } = useI18n();
  const { data: session } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [documentName, setDocumentName] = useState("");
  const [contentLanguage, setContentLanguage] = useState("en");
  const [isDragging, setIsDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadedId, setUploadedId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingDocument | null>(null);
  const [documentStatus, setDocumentStatus] = useState<DocumentStatus | null>(null);
  const [processingMessage, setProcessingMessage] = useState("");
  const [pollTimedOut, setPollTimedOut] = useState(false);
  const [pollAttempt, setPollAttempt] = useState(0);

  const { data: quotaInfo = null } = useQuery<{
    remainingToday: number;
    usedToday: number;
    dailyLimit: number;
  } | null>({
    queryKey: queryKeys.quota,
    queryFn: async () => {
      const response = await fetch("/api/documents/generate");
      const body = await response.json();
      return typeof body.remainingToday === "number"
        ? { remainingToday: body.remainingToday, usedToday: body.usedToday ?? 0, dailyLimit: body.dailyLimit ?? 5 }
        : null;
    },
    enabled: Boolean(session?.user),
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    const urlId = new URLSearchParams(window.location.search).get("documentId");
    const stored = loadPendingDocument();
    const restored = urlId && UUID.test(urlId)
      ? stored?.documentId === urlId ? stored : { documentId: urlId, startedAt: Date.now() }
      : stored;
    if (!restored) return;
    localStorage.setItem(PENDING_UPLOAD_KEY, JSON.stringify(restored));
    if (urlId !== restored.documentId) window.history.replaceState(null, "", `/desk/upload?documentId=${restored.documentId}`);
    const frame = window.requestAnimationFrame(() => {
      setPending(restored);
      setProcessingMessage("Memeriksa status dokumen...");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!pending || pollTimedOut) return;
    const current = pending;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    async function poll() {
      if (Date.now() - current.startedAt >= POLL_TIMEOUT_MS) {
        if (!cancelled) setPollTimedOut(true);
        return;
      }
      controller = new AbortController();
      try {
        const response = await fetch(`/api/documents/${current.documentId}/status`, { cache: "no-store", signal: controller.signal });
        const body = await readJson(response);
        if (!response.ok) throw new Error(responseMessage(body, "The document status could not be checked yet."));
        const snapshot = body as StatusResponse;
        if (!snapshot || typeof snapshot.status !== "string") throw new Error("Respons status dokumen tidak valid.");
        if (cancelled) return;
        setError("");
        setDocumentStatus(snapshot.status);
        if (snapshot.status === "ready_for_selection") {
          localStorage.removeItem(PENDING_UPLOAD_KEY);
          router.replace(`/desk/${current.documentId}/keywords`);
          return;
        }
        if (snapshot.status === "failed") {
          localStorage.removeItem(PENDING_UPLOAD_KEY);
          setProcessingMessage(snapshot.errorMessage || "The document could not be processed. Please upload it again.");
          return;
        }
        setProcessingMessage(statusLabels[snapshot.status]);
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : "Could not check the document status.");
        timer = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
    void poll();
    return () => { cancelled = true; controller?.abort(); if (timer) clearTimeout(timer); };
  }, [pending, pollAttempt, pollTimedOut, router]);

  function selectFile(nextFile: File | null) {
    setUploadedId(null);
    setUploadMessage("");
    setProgress(0);
    setError("");
    if (!nextFile) return setFile(null);
    if (nextFile.type !== "application/pdf" || !nextFile.name.toLowerCase().endsWith(".pdf")) {
      setFile(null); setError("File harus berupa PDF."); return;
    }
    if (nextFile.size <= 0) { setFile(null); setError("PDF kosong dan tidak dapat diupload."); return; }
    if (nextFile.size > MAX_PDF_BYTES) {
      setFile(null); setError(`Ukuran PDF maksimal ${formatBytes(MAX_PDF_BYTES)}. File ini berukuran ${formatBytes(nextFile.size)}.`); return;
    }
    setFile(nextFile);
    if (!documentName.trim()) setDocumentName(nextFile.name.replace(/\.pdf$/i, "").slice(0, 200));
  }

  async function upload() {
    if (!file || busy) return;
    setBusy(true);
    setError("");
    try {
      let id = uploadedId;
      if (!id) {
        setUploadMessage("Menyiapkan upload...");
        let response: Response;
        try {
          response = await fetch("/api/documents/presign", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: file.name, contentType: file.type, fileSize: file.size }) });
        } catch { throw new Error("Could not prepare the upload: the server is unreachable."); }
        const body = await readJson(response);
        if (!response.ok) throw new Error(`Could not prepare the upload: ${responseMessage(body, "the presign request was rejected.")}`);
        const signed = body as { documentId?: unknown; uploadUrl?: unknown; headers?: unknown };
        if (typeof signed.documentId !== "string" || !UUID.test(signed.documentId) || typeof signed.uploadUrl !== "string"
          || !signed.headers || typeof signed.headers !== "object") throw new Error("Could not prepare the upload: the server response is invalid.");
        setUploadMessage("Mengunggah PDF ke penyimpanan...");
        try { await putPdf(signed.uploadUrl, signed.headers as Record<string, string>, file, setProgress); }
        catch (cause) { throw new Error(`Could not upload the PDF to storage: ${cause instanceof Error ? cause.message : "connection interrupted."}`); }
        id = signed.documentId;
        setUploadedId(id);
      }
      setUploadMessage("Mendaftarkan dokumen...");
      let response: Response;
      try {
        response = await fetch("/api/documents/confirm", { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: id, filename: file.name,
            title: documentName.trim() || file.name.replace(/\.pdf$/i, "").slice(0, 200), contentLanguage }) });
      } catch { throw new Error("The file was uploaded but could not be registered: the server is unreachable."); }
      const body = await readJson(response);
      if (!response.ok) throw new Error(`The file was uploaded but could not be registered: ${responseMessage(body, "confirmation was rejected.")}`);
      const nextPending = { documentId: id, startedAt: Date.now() };
      localStorage.setItem(PENDING_UPLOAD_KEY, JSON.stringify(nextPending));
      setPending(nextPending);
      setDocumentStatus("uploaded");
      setProcessingMessage(statusLabels.uploaded);
      setPollTimedOut(false);
      setUploadMessage("");
      router.replace(`/desk/upload?documentId=${id}`, { scroll: false });
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed. Please try again.");
      setUploadMessage("");
    } finally { setBusy(false); }
  }

  function resetUpload() {
    localStorage.removeItem(PENDING_UPLOAD_KEY);
    window.history.replaceState(null, "", "/desk/upload");
    setPending(null); setDocumentStatus(null); setProcessingMessage(""); setPollTimedOut(false);
    setUploadedId(null); setProgress(0); setError(""); inputRef.current?.focus();
  }

  function resumePolling() {
    if (!pending) return;
    const restarted = { ...pending, startedAt: Date.now() };
    localStorage.setItem(PENDING_UPLOAD_KEY, JSON.stringify(restarted));
    setPending(restarted); setPollTimedOut(false); setError(""); setPollAttempt(value => value + 1);
  }

  const isProcessing = Boolean(pending);
  const processingFailed = documentStatus === "failed";

  return (
    <AppShell>
      <div className="min-h-screen bg-bg flex flex-col text-text selection:bg-accent selection:text-on-action-primary">
        <main className="max-w-3xl mx-auto px-6 py-12 pb-24 sm:py-16 flex-1 w-full flex flex-col items-center text-center">
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium bg-surface-subtle text-text-secondary border border-border">
            <BookOpen className="w-3.5 h-3.5" /><span>{t("upload.badge")}</span>
          </div>
          {quotaInfo && <div className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium border ${quotaInfo.remainingToday > 0 ? "bg-success-subtle text-success-text border-success-border" : "bg-danger-subtle text-danger-text border-danger-border"}`}>
            <span className={`w-2 h-2 rounded-full ${quotaInfo.remainingToday > 0 ? "bg-success-subtle0 animate-pulse" : "bg-danger-subtle0"}`} />
            <span>{t("upload.quotaRemaining", { remaining: quotaInfo.remainingToday, limit: quotaInfo.dailyLimit })}</span>
          </div>}
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-text max-w-2xl mb-4 leading-[1.15]">{t("upload.title")}</h1>
        <p className="text-text-secondary text-base sm:text-lg max-w-xl mb-10 leading-relaxed">{t("upload.subtitle")}</p>

        {isProcessing ? (
          <Card className="w-full max-w-xl text-left space-y-6">
            <div className="flex items-start gap-4">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${processingFailed ? "bg-danger-subtle text-danger-text" : "bg-success-subtle text-success-text"}`}>
                {processingFailed ? <AlertCircle className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
              </div>
              <div className="min-w-0">
                <h2 className="font-semibold">{processingFailed ? "Document processing failed" : "Document is being processed"}</h2>
                <p className={`mt-1 text-sm leading-relaxed ${processingFailed ? "text-danger-text" : "text-text-secondary"}`} role="status">
                  {pollTimedOut ? "Processing is taking longer than usual. It is still running on the server." : processingMessage}
                </p>
                <p className="mt-2 text-[11px] font-mono text-text-muted break-all">ID: {pending?.documentId}</p>
              </div>
            </div>
            {!processingFailed && !pollTimedOut && <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle"><div className="h-full w-1/3 rounded-full bg-success animate-pulse" /></div>}
            {error && !processingFailed && <div className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-subtle p-3 text-sm text-warning-text"><AlertCircle className="w-4 h-4 mt-0.5" />{error} Mencoba lagi otomatis...</div>}
            <div className="flex flex-col sm:flex-row gap-3">
              {pollTimedOut && !processingFailed && <Button onClick={resumePolling} size="lg"><RefreshCw className="w-4 h-4" />Check again</Button>}
              {processingFailed && <Button onClick={resetUpload} size="lg"><RefreshCw className="w-4 h-4" />Try again</Button>}
              <Link href="/desk" className="inline-flex items-center justify-center rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-secondary hover:bg-surface-hover">Back to Your Desk</Link>
            </div>
          </Card>
        ) : (
          <Card className="w-full max-w-xl text-left mb-6">
            <div onDragOver={event => { event.preventDefault(); if (!busy) setIsDragging(true); }} onDragLeave={() => setIsDragging(false)}
              onDrop={event => { event.preventDefault(); setIsDragging(false); if (!busy) selectFile(event.dataTransfer.files.item(0)); }}
              className={`relative rounded-xl border-2 border-dashed p-8 text-center transition ${isDragging ? "border-accent bg-surface-hover" : file ? "border-border-strong bg-surface-raised" : "border-border bg-surface-subtle hover:border-border-strong"}`}>
              <input ref={inputRef} type="file" accept="application/pdf,.pdf" disabled={busy}
                onChange={event => selectFile(event.target.files?.item(0) ?? null)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" aria-label="Choose a PDF file" />
              <div className="pointer-events-none flex flex-col items-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-border bg-surface-subtle text-text-secondary"><Upload className="w-5 h-5" /></div>
                {file ? <><div className="flex max-w-full items-center justify-center gap-2 text-sm font-medium"><FileText className="w-4 h-4 shrink-0 text-text-secondary" /><span className="truncate">{file.name}</span></div><p className="mt-1 text-xs text-text-muted">{formatBytes(file.size)} Â· {t("upload.fileSelected")}</p></>
                  : <><p className="text-sm font-medium">{t("upload.dropTitle")}</p><p className="mt-1 text-xs text-text-muted">{t("upload.dropHint")}</p></>}
              </div>
            </div>

            <input value={documentName} onChange={event => setDocumentName(event.target.value)} placeholder={t("upload.documentName")}
              disabled={busy} maxLength={200} className="mt-4 w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-raised text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring/30 focus:border-accent disabled:opacity-50" />
            <p className="mt-1.5 text-[11px] text-text-muted">{t("upload.documentNameHint")}</p>

            <div className="mt-4">
              <label htmlFor="content-language" className="block text-xs font-medium text-text-secondary mb-1.5">{t("upload.contentLanguage")}</label>
              <select id="content-language" value={contentLanguage} onChange={event => setContentLanguage(event.target.value)} disabled={busy}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-surface-raised text-sm focus:outline-none focus:ring-2 focus:ring-focus-ring/30 focus:border-accent disabled:opacity-50 cursor-pointer">
                <option value="auto">{t("upload.contentLanguageAuto")}</option><option value="id">{t("upload.contentLanguageId")}</option><option value="en">{t("upload.contentLanguageEn")}</option>
              </select>
              <p className="mt-1.5 text-[11px] text-text-muted">{t("upload.contentLanguageHint")}</p>
            </div>

            {busy && <div className="mt-4 space-y-2" role="status"><div className="flex justify-between text-xs text-text-secondary"><span>{uploadMessage}</span><span className="font-mono">{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-surface-subtle" role="progressbar" aria-valuenow={progress}><div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${progress}%` }} /></div></div>}
            {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger-border bg-danger-subtle p-3 text-sm text-danger-text" role="alert"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span></div>}
            {uploadedId && error && <div className="mt-3 flex items-center gap-2 text-xs text-text-muted"><CheckCircle2 className="w-4 h-4 text-success-text" />The PDF is already in S3. You can retry confirmation without uploading it again.</div>}
            <Button onClick={upload} disabled={!file || busy} size="lg" className="mt-6 w-full">
              <span>{busy ? "Processing..." : uploadedId ? "Retry confirmation" : t("upload.submit")}</span>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
            </Button>
          </Card>
        )}

        {!isProcessing && <>
          <div className="flex items-center gap-2 text-xs text-text-muted"><span>{t("upload.demoPrompt")}</span><Link href="/desk/demo" className="font-medium text-text underline underline-offset-4 inline-flex items-center gap-1">{t("upload.demoLink")}<ArrowRight className="w-3 h-3" /></Link></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left w-full border-t border-border pt-12">
            {steps.map((step, index) => <div className="space-y-2" key={step.title}><div className="w-7 h-7 rounded-md bg-surface-subtle border border-border text-xs font-mono font-bold flex items-center justify-center">{index + 1}</div><h3 className="font-semibold text-sm">{t(step.title)}</h3><p className="text-xs text-text-secondary leading-relaxed">{t(step.description)}</p></div>)}
          </div>
        </>}
        </main>
      </div>
    </AppShell>
  );
}
