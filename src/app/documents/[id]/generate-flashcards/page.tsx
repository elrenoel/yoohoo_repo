"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Card from "@/components/ui/Card";

type Job = { id: string; status: "queued" | "processing" | "completed" | "failed"; errorMessage?: string | null; flashcardCount: number; quizCount: number };

export default function GenerateFlashcardsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [takingLong, setTakingLong] = useState(false);
  const started = useRef(false);
  const storageKey = `yoohoo:generation:${id}`;

  const readJob = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/documents/${id}/generate?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Gagal memeriksa proses generate.");
    setJob(body.job);
    if (body.job.status === "failed") {
      setError(body.job.errorMessage || "Pembuatan materi gagal. Silakan coba lagi.");
      return body.job as Job;
    }
    if (body.job.status === "completed") {
      localStorage.removeItem(storageKey);
      router.replace(`/documents/${id}/flashcards`);
    }
    return body.job as Job;
  }, [id, router, storageKey]);

  const start = useCallback(async () => {
    setError(null);
    setTakingLong(false);
    const response = await fetch(`/api/documents/${id}/generate`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Gagal memulai proses generate.");
    localStorage.setItem(storageKey, body.jobId);
    window.history.replaceState(null, "", `/documents/${id}/generate-flashcards?jobId=${body.jobId}`);
    if (body.status === "completed") router.replace(`/documents/${id}/flashcards`);
    else await readJob(body.jobId);
  }, [id, readJob, router, storageKey]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const existing = searchParams.get("jobId") || localStorage.getItem(storageKey);
    window.setTimeout(() => {
      (existing ? readJob(existing) : start()).catch(cause => setError(cause instanceof Error ? cause.message : "Terjadi kesalahan."));
    }, 0);
  }, [readJob, searchParams, start, storageKey]);

  const activeJobId = job?.id;
  const activeJobStatus = job?.status;
  useEffect(() => {
    if (!activeJobId || !activeJobStatus || !["queued", "processing"].includes(activeJobStatus)) return;
    const beganAt = Date.now();
    const timer = window.setInterval(() => {
      if (Date.now() - beganAt > 10 * 60_000) {
        setTakingLong(true);
        window.clearInterval(timer);
        return;
      }
      readJob(activeJobId).catch(cause => setError(cause instanceof Error ? cause.message : "Gagal memeriksa proses."));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeJobId, activeJobStatus, readJob]);

  return <>
    <Navbar backHref={`/documents/${id}/keywords`} title="Membuat materi" />
    <main className="w-full max-w-xl mx-auto px-4 sm:px-6 py-12 flex-1">
      <Card variant="centered">
        {error ? <>
          <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
          <h1 className="mt-4 text-xl font-semibold">Materi belum berhasil dibuat</h1>
          <p className="mt-2 text-sm text-neutral-600">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/documents/${id}/keywords`} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-medium">Ubah pilihan</Link>
            <button onClick={() => start().catch(cause => setError(cause instanceof Error ? cause.message : "Terjadi kesalahan."))} className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white">Coba lagi</button>
          </div>
        </> : <>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            {takingLong ? <RefreshCw className="h-6 w-6" /> : <Sparkles className="h-6 w-6 animate-pulse" />}
          </div>
          <h1 className="mt-4 text-xl font-semibold text-neutral-900">{takingLong ? "Proses lebih lama dari biasanya" : "Menyusun flashcard dan quiz..."}</h1>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">{takingLong
            ? "Proses di belakang layar tetap berjalan. Kamu bisa memeriksa kembali kapan saja."
            : "Gemini sedang membaca konteks asli setiap keyword. Setelah selesai, kamu akan masuk ke flashcard terlebih dahulu."}</p>
          {!takingLong && <div className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Status diperbarui setiap 3 detik</div>}
          {takingLong && job && <button onClick={() => { setTakingLong(false); readJob(job.id).catch(cause => setError(cause instanceof Error ? cause.message : "Terjadi kesalahan.")); }} className="mt-6 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white">Periksa sekarang</button>}
        </>}
      </Card>
    </main>
  </>;
}
