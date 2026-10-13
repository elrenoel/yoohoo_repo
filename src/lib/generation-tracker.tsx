"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/session-provider";
import { useToast } from "@/lib/toast";

/**
 * Pelacak job generate flashcard tingkat aplikasi. Dipasang sekali di root
 * layout sehingga status (sedang jalan / siap / gagal) tetap tampil sebagai
 * satu toast di tengah bawah walau user pindah halaman, refresh, atau membuka
 * tab lain. Job aktif disimpan di localStorage hanya sebagai kemudahan resume;
 * sumber kebenaran tetap GET /api/jobs/:id.
 */

const STORAGE_KEY = "yoohoo:generation-jobs";
const POLL_MS = 4000;
const MAX_TRACK_MS = 15 * 60_000;
export const GENERATION_FINISHED_EVENT = "yoohoo:generation-finished";

type TrackedJob = { jobId: string; userId: string; deckId: string | null; startedAt: number };
export type GenerationFinishedDetail = { jobId: string; deckId: string | null; status: "succeeded" | "failed" };
type JobStatus = { status: string; errorMessage: string | null; deckId: string | null; flashcardCount: number; quizCount: number; uncoveredCount?: number };

function readStored(): TrackedJob[] {
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return [];
    return raw.filter((item): item is TrackedJob =>
      Boolean(item) && typeof item.jobId === "string" && typeof item.userId === "string" && typeof item.startedAt === "number");
  } catch {
    return [];
  }
}

function writeStored(update: (jobs: TrackedJob[]) => TrackedJob[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(update(readStored())));
  } catch {
    // Storage diblokir (private mode) — pelacakan tetap jalan selama tab terbuka.
  }
}

type GenerationTrackerValue = {
  activeJobs: TrackedJob[];
  trackGeneration: (jobId: string, options: { deckId: string | null; toastId?: string | number }) => void;
};

const GenerationTrackerContext = createContext<GenerationTrackerValue | null>(null);

export function useGenerationTracker() {
  const value = useContext(GenerationTrackerContext);
  if (!value) throw new Error("useGenerationTracker must be used inside GenerationTrackerProvider");
  return value;
}

export function GenerationTrackerProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();
  const userId = session?.user?.id ?? null;
  const toast = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [trackedJobs, setJobs] = useState<TrackedJob[]>([]);
  // Hanya job milik user yang sedang login (aman saat logout / ganti akun).
  const jobs = useMemo(() => userId ? trackedJobs.filter(job => job.userId === userId) : [], [trackedJobs, userId]);
  const toastIds = useRef(new Map<string, string | number>());
  const shownRunning = useRef(new Set<string>());
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  const showRunning = useCallback((jobId: string) => {
    const id = toastIds.current.get(jobId) ?? `generation:${jobId}`;
    toastIds.current.set(jobId, id);
    toast.loading("Creating your flashcards and quiz...", {
      id,
      description: "This usually takes 1–2 minutes. Feel free to keep studying — we'll let you know here when it's done.",
    });
  }, [toast]);

  // Resume job milik user ini dari storage (setelah refresh / dari tab lain).
  useEffect(() => {
    if (!userId) return;
    const sync = () => {
      const now = Date.now();
      const stored = readStored().filter(job => job.userId === userId && now - job.startedAt < MAX_TRACK_MS);
      setJobs(current => {
        const known = new Set(current.map(job => job.jobId));
        const added = stored.filter(job => !known.has(job.jobId));
        return added.length ? [...current, ...added] : current;
      });
    };
    sync();
    const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) sync(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [userId]);

  // Pastikan setiap job aktif punya toast "sedang jalan".
  useEffect(() => {
    for (const job of jobs) {
      if (shownRunning.current.has(job.jobId)) continue;
      shownRunning.current.add(job.jobId);
      showRunning(job.jobId);
    }
  }, [jobs, showRunning]);

  const trackGeneration = useCallback<GenerationTrackerValue["trackGeneration"]>((jobId, { deckId, toastId }) => {
    if (!userId) return;
    if (toastId !== undefined) toastIds.current.set(jobId, toastId);
    const job: TrackedJob = { jobId, userId, deckId, startedAt: Date.now() };
    writeStored(stored => [...stored.filter(item => item.jobId !== jobId), job]);
    setJobs(current => [...current.filter(item => item.jobId !== jobId), job]);
  }, [userId]);

  const finish = useCallback((job: TrackedJob, status: JobStatus | null) => {
    writeStored(stored => stored.filter(item => item.jobId !== job.jobId));
    setJobs(current => current.filter(item => item.jobId !== job.jobId));
    const id = toastIds.current.get(job.jobId) ?? `generation:${job.jobId}`;
    toastIds.current.delete(job.jobId);
    shownRunning.current.delete(job.jobId);
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    void queryClient.invalidateQueries({ queryKey: ["unread-count"] });
    if (!status) {
      toast.dismiss(id);
      return;
    }

    const deckId = status.deckId ?? job.deckId;
    const deckPath = deckId ? `/desk/${deckId}` : null;
    const onDeckPage = deckId !== null && (pathnameRef.current === `/desk/${deckId}` || pathnameRef.current === `/decks/${deckId}`);
    const succeeded = status.status === "succeeded" || status.status === "completed";
    window.dispatchEvent(new CustomEvent<GenerationFinishedDetail>(GENERATION_FINISHED_EVENT, {
      detail: { jobId: job.jobId, deckId, status: succeeded ? "succeeded" : "failed" },
    }));

    if (succeeded) {
      toast.success("Your flashcards are ready!", {
        id,
        description: (status.flashcardCount
          ? `${status.flashcardCount} flashcards and ${status.quizCount} quiz questions were added.`
          : "Your study material was updated.")
          + (status.uncoveredCount
            ? ` ${status.uncoveredCount} keyword${status.uncoveredCount === 1 ? " was" : "s were"} skipped because the material didn't cover ${status.uncoveredCount === 1 ? "it" : "them"}.`
            : ""),
        duration: onDeckPage ? 6000 : 12000,
        ...(deckPath && !onDeckPage ? { action: { label: "Open", onClick: () => router.push(deckPath) } } : {}),
      });
    } else {
      toast.error("Flashcards couldn't be created", {
        id,
        description: status.errorMessage || "Something went wrong. Please try again.",
        duration: 12000,
        ...(deckPath && !onDeckPage ? { action: { label: "Open desk", onClick: () => router.push(deckPath) } } : {}),
      });
    }
  }, [queryClient, router, toast]);

  // Satu loop polling untuk semua job aktif; langsung cek saat tab kembali aktif.
  const jobsRef = useRef(jobs);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  useEffect(() => {
    if (!jobs.length) return;
    let cancelled = false;
    let inFlight = false;
    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await Promise.all(jobsRef.current.map(async job => {
          if (Date.now() - job.startedAt > MAX_TRACK_MS) return finish(job, null);
          let response: Response;
          try {
            response = await fetch(`/api/jobs/${job.jobId}`, { cache: "no-store" });
          } catch {
            return; // Koneksi sesaat gagal — coba lagi di tick berikutnya.
          }
          if (cancelled) return;
          if (response.status === 401 || response.status === 403 || response.status === 404) return finish(job, null);
          if (!response.ok) return;
          const body = await response.json().catch(() => null) as { job?: JobStatus } | null;
          const status = body?.job?.status;
          if (!status || cancelled) return;
          if (status === "succeeded" || status === "completed" || status === "failed" || status === "canceled") finish(job, body.job!);
        }));
      } finally {
        inFlight = false;
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void tick(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [jobs.length, finish]);

  const value = useMemo(() => ({ activeJobs: jobs, trackGeneration }), [jobs, trackGeneration]);
  return <GenerationTrackerContext.Provider value={value}>{children}</GenerationTrackerContext.Provider>;
}
