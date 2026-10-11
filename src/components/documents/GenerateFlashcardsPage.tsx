"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Card from "@/components/ui/Card";

type Job = { id: string; status: "queued" | "processing" | "completed" | "failed"; errorMessage?: string | null; flashcardCount: number; quizCount: number };

export default function GenerateFlashcardsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [limitReached, setLimitReached] = useState(false);
  const [takingLong, setTakingLong] = useState(false);
  const started = useRef(false);
  const storageKey = `yoohoo:generation:${id}`;

  const readJob = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/documents/${id}/generate?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || "Could not check the generation status.");
    setJob(body.job);
    if (body.job.status === "failed") {
      // Jangan resume job yang sudah final gagal setelah refresh. User bisa
      // menekan "Coba lagi" untuk membuat generation job baru.
      localStorage.removeItem(storageKey);
      setError(body.job.errorMessage || "The study material could not be created. Please try again.");
      return body.job as Job;
    }
    if (body.job.status === "completed") {
      localStorage.removeItem(storageKey);
      router.replace(`/desk/${id}/flashcards`);
    }
    return body.job as Job;
  }, [id, router, storageKey]);

  const start = useCallback(async () => {
    setError(null);
    setLimitReached(false);
    setTakingLong(false);
    const response = await fetch(`/api/documents/${id}/generate`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 429 || body.limitReached === true) setLimitReached(true);
      throw new Error(body.error || "Could not start generation.");
    }
    localStorage.setItem(storageKey, body.jobId);
    window.history.replaceState(null, "", `/desk/${id}/generate-flashcards?jobId=${body.jobId}`);
    if (body.status === "completed") router.replace(`/desk/${id}/flashcards`);
    else await readJob(body.jobId);
  }, [id, readJob, router, storageKey]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const existing = searchParams.get("jobId") || localStorage.getItem(storageKey);
    window.setTimeout(() => {
      (existing ? readJob(existing) : start()).catch(cause => setError(cause instanceof Error ? cause.message : "Something went wrong."));
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
      readJob(activeJobId).catch(cause => setError(cause instanceof Error ? cause.message : "Could not check the process."));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeJobId, activeJobStatus, readJob]);

  return <main className="min-h-screen w-full bg-bg px-4 py-12 pb-28 text-text sm:px-6">
      <div className="mx-auto w-full max-w-xl">
      <Card variant="centered" className="border-border bg-surface shadow-none">
        {error ? <>
          <AlertCircle className="mx-auto h-10 w-10 text-danger-text" />
          <h1 className="mt-4 text-xl font-semibold">The study material is not ready yet</h1>
          <p className="mt-2 text-sm text-text-secondary">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href={`/desk/${id}/keywords`} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium">Change selection</Link>
            {!limitReached ? (
              <button onClick={() => start().catch(cause => setError(cause instanceof Error ? cause.message : "Something went wrong."))} className="rounded-xl bg-action-primary px-4 py-2.5 text-sm font-medium text-on-action-primary">Try again</button>
            ) : (
              <Link href="/desk" className="rounded-xl bg-action-primary px-4 py-2.5 text-sm font-medium text-on-action-primary">Back</Link>
            )}
          </div>
        </> : <>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
            {takingLong ? <RefreshCw className="h-6 w-6" /> : <Sparkles className="h-6 w-6 animate-pulse" />}
          </div>
          <h1 className="mt-4 text-xl font-semibold text-text">{takingLong ? "This is taking longer than usual" : "Creating flashcards and a quiz..."}</h1>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">{takingLong
            ? "The process is still running in the background. You can check again at any time."
            : "Gemini is reading the original context for each keyword. You will start with the flashcards when it is ready."}</p>
          {!takingLong && <div className="mt-6 flex items-center justify-center gap-2 text-xs text-text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Status diperbarui setiap 3 detik</div>}
          {takingLong && job && <button onClick={() => { setTakingLong(false); readJob(job.id).catch(cause => setError(cause instanceof Error ? cause.message : "Something went wrong.")); }} className="mt-6 rounded-xl bg-action-primary px-4 py-2.5 text-sm font-medium text-on-action-primary">Check now</button>}
        </>}
      </Card>
      </div>
    </main>;
}
