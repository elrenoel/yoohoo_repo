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
      : reject(new Error(`S3 merespons dengan status ${xhr.status}.`));
    xhr.onerror = () => reject(new Error("Koneksi ke penyimpanan terputus."));
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
      continue; // transient network hiccup — keep polling
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
  const [lang, setLang] = useState("auto");
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

  const heading = title ?? (attaching ? "Upload PDF ke deck ini" : "Upload PDF untuk meja baru");
  const sub = subtitle ?? (attaching ? deckTitle ?? "" : "Deck baru dibuat otomatis dari materi ini.");
  const eyebrow = attaching ? "Tambah materi" : "Meja baru";

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
  // has it (processing) — the toast keeps reporting status either way.
  function requestClose() {
    if (phase === "uploading" || busyRef.current) return;
    onCloseRef.current();
  }

  function pickFile(nextFile: File | null) {
    setError("");
    if (!nextFile) { setFile(null); return; }
    if (nextFile.type !== "application/pdf" || !nextFile.name.toLowerCase().endsWith(".pdf")) { setFile(null); setError("File harus berupa PDF."); return; }
    if (nextFile.size <= 0) { setFile(null); setError("PDF kosong dan tidak dapat diupload."); return; }
    if (nextFile.size > MAX_PDF_BYTES) { setFile(null); setError(`Ukuran PDF maksimal ${formatBytes(MAX_PDF_BYTES)}. File ini berukuran ${formatBytes(nextFile.size)}.`); return; }
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
        ? "Proses lebih lama dari biasanya. Materi tetap diproses di server — cek daftar materi beberapa saat lagi."
        : raw || "Upload gagal. Silakan coba lagi.";
      if (mountedRef.current) { setPhase("failed"); setError(fallback); }
      const options: { id: string | number; action?: { label: string; onClick: () => void } } = { id: toastId };
      // Only offer retry while the overlay is still around to restart the form.
      if (mountedRef.current) options.action = { label: t("toast.retry"), onClick: retryFromForm };
      toast.error(fallback, options);
    };
    try {
      setMessage("Menyiapkan upload...");
      const presignResponse = await fetch("/api/documents/presign", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, contentType: file.type, fileSize: file.size }) });
      const presignBody = await presignResponse.json().catch(() => ({}));
      if (!presignResponse.ok) throw new Error((presignBody as { error?: string }).error || "Gagal menyiapkan upload.");
      const signed = presignBody as { documentId?: unknown; uploadUrl?: unknown; headers?: unknown };
      if (typeof signed.documentId !== "string" || !UUID.test(signed.documentId) || typeof signed.uploadUrl !== "string"
        || !signed.headers || typeof signed.headers !== "object") throw new Error("Respons server tidak valid.");
      setMessage("Mengunggah PDF ke penyimpanan...");
      await putWithProgress(signed.uploadUrl, signed.headers as Record<string, string>, file, setProgress);
      toast.loading(attaching ? t("toast.upload.processing") : t("toast.desk.creating"), { id: toastId });
      setMessage("Mendaftarkan dokumen...");
      const payload: Record<string, unknown> = { documentId: signed.documentId, filename: file.name,
        title: name.trim() || file.name.replace(/\.pdf$/i, "").slice(0, 200), contentLanguage: lang };
      if (deckId) payload.deckId = deckId;
      const confirmResponse = await fetch("/api/documents/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const confirmBody = await confirmResponse.json().catch(() => ({}));
      if (!confirmResponse.ok) throw new Error((confirmBody as { error?: string }).error || "Konfirmasi ditolak.");
      const confirmedDeckId = typeof (confirmBody as { deckId?: unknown }).deckId === "string" ? (confirmBody as { deckId: string }).deckId : signed.documentId;
      const documentId = signed.documentId;
      setMessage("Materi sedang diproses AI...");
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#183229]/45 px-4 py-8 backdrop-blur-sm" onClick={requestClose} role="presentation">
      <div role="dialog" aria-modal="true" aria-label={heading} className="flex max-h-full w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-[#D8D9D0] bg-[#FBFBF7] shadow-[0_24px_70px_rgba(24,50,41,0.35)]" onClick={event => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-[#E4E6DE] bg-[#DDE9D4] px-6 py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[#516757]"><Upload className="h-4 w-4" /><p className="font-mono text-[10px] uppercase tracking-[0.2em]">{eyebrow}</p></div>
            <h2 className="mt-1.5 truncate text-2xl font-semibold tracking-tight">{heading}</h2>
            {sub && <p className="mt-1 truncate text-sm text-[#5E6D63]">{sub}</p>}
          </div>
          <button type="button" onClick={requestClose} disabled={phase === "uploading"} aria-label="Tutup" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/70 text-[#466050] transition hover:bg-white hover:text-[#183229] disabled:cursor-not-allowed disabled:opacity-50"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid flex-1 content-start gap-4 overflow-y-auto px-6 py-5">
          {phase === "processing" ? <div className="rounded-2xl border border-[#C5D2BE] bg-white/75 p-6 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#244E3D]" />
            <p className="mt-3 text-sm font-semibold text-[#183229]">Materi sedang diproses AI</p>
            <p className="mt-1 text-xs leading-relaxed text-[#66736B]">Keyword diekstrak otomatis dari PDF. Panel ini bisa ditutup — statusnya tetap muncul di toast dan materi akan masuk ke daftar.</p>
            <button type="button" onClick={onClose} className="mt-4 inline-flex rounded-xl bg-[#123F34] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#244E3D]">Tutup sementara</button>
          </div> : phase === "failed" ? <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-6 text-center">
            <AlertCircle className="mx-auto h-6 w-6 text-rose-600" />
            <p className="mt-3 text-sm font-semibold text-rose-700">Upload gagal</p>
            <p className="mt-1 text-xs leading-relaxed text-rose-600">{error}</p>
            <div className="mt-4 flex justify-center gap-2">
              <button type="button" onClick={() => { setPhase("form"); setError(""); }} className="inline-flex items-center gap-1.5 rounded-xl bg-[#123F34] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#244E3D]"><RefreshCw className="h-3.5 w-3.5" />{t("toast.retry")}</button>
              <button type="button" onClick={onClose} className="inline-flex rounded-xl border border-rose-200 px-4 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100/60">{t("toast.dismiss")}</button>
            </div>
          </div> : <>
            <div onDragOver={event => { event.preventDefault(); if (!busyRef.current) setDrag(true); }} onDragLeave={() => setDrag(false)}
              onDrop={event => { event.preventDefault(); setDrag(false); if (!busyRef.current) pickFile(event.dataTransfer.files.item(0)); }}
              className={`relative rounded-2xl border-2 border-dashed p-6 text-center transition ${drag ? "border-[#244E3D] bg-[#E7F0DF]" : file ? "border-[#B8C4B8] bg-white/70" : "border-[#C8CDC4] bg-white/40 hover:border-[#B8C4B8]"}`}>
              <input type="file" accept="application/pdf,.pdf" disabled={phase === "uploading"} onChange={event => pickFile(event.target.files?.item(0) ?? null)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" aria-label="Pilih file PDF" />
              <div className="pointer-events-none flex flex-col items-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#EFF1EB] text-[#526159]"><Upload className="h-5 w-5" /></div>
                {file ? <><p className="mt-2 max-w-full truncate text-sm font-medium text-[#183229]">{file.name}</p><p className="mt-0.5 text-[11px] text-[#66736B]">{formatBytes(file.size)} • Pilih PDF lain untuk mengganti</p></>
                  : <><p className="mt-2 text-sm font-medium text-[#183229]">Tarik file PDF ke sini, atau pilih file</p><p className="mt-0.5 text-[11px] text-[#66736B]">Mendukung slide kuliah, ebook, dan catatan PDF</p></>}
              </div>
            </div>

            <input value={name} onChange={event => setName(event.target.value)} placeholder="Nama materi (opsional)" maxLength={200} disabled={phase === "uploading"}
              className="w-full rounded-xl border border-[#D8D9D0] bg-white/70 px-3.5 py-2.5 text-sm focus:border-[#244E3D] focus:outline-none disabled:opacity-50" />

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-[#526159]">Bahasa materi</span>
              <select value={lang} onChange={event => setLang(event.target.value)} disabled={phase === "uploading"} className="w-full cursor-pointer rounded-xl border border-[#D8D9D0] bg-white/70 px-3.5 py-2.5 text-sm focus:border-[#244E3D] focus:outline-none disabled:opacity-50">
                <option value="auto">Sesuai bahasa PDF sumber</option><option value="id">Bahasa Indonesia</option><option value="en">English</option>
              </select>
            </label>

            {phase === "uploading" && <div className="space-y-1.5" role="status">
              <div className="flex justify-between text-xs text-[#526159]"><span>{message}</span><span className="font-mono">{progress}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-[#E6EADF]" role="progressbar" aria-valuenow={progress}><div className="h-full rounded-full bg-[#244E3D] transition-[width]" style={{ width: `${progress}%` }} /></div>
            </div>}

            {phase === "form" && error && <p className="text-xs text-rose-600" role="alert">{error}</p>}

            <button type="button" onClick={() => void submit()} disabled={!file || phase === "uploading"} aria-busy={phase === "uploading"}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#123F34] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#244E3D] disabled:cursor-not-allowed disabled:opacity-50">
              {phase === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {phase === "uploading" ? "Sedang mengunggah..." : attaching ? "Upload & proses materi" : "Upload & buat meja"}
            </button>
          </>}
        </div>
      </div>
    </div>
  );
}
