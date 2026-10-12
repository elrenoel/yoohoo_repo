"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, Bell, Check, Clock3, FileText, Info, Layers3, Loader2 } from "lucide-react";

type Detail = {
  id: string;
  type: string | null;
  severity: "info" | "success" | "error" | null;
  title: string | null;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
  job: { id: string; kind: string; status: string; errorMessage: string | null; flashcardCount: number; quizCount: number; expectedItems: number; startedAt: string | null; finishedAt: string | null; variant: string | null; quizSetId: string | null; quizSetLabel: string | null } | null;
  deck: { id: string; title: string | null } | null;
  document: { id: string; title: string | null } | null;
};

const icons = { info: Info, success: Check, error: AlertTriangle } as const;
const colors = { info: "bg-accent-subtle text-text-secondary", success: "bg-success-subtle text-success-text", error: "bg-danger-subtle text-danger-text" } as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

export default function NotificationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notifications/${id}`, { cache: "no-store" })
      .then(async response => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error || "The notification could not be loaded.");
        return body.notification as Detail;
      })
      .then(notification => {
        if (cancelled) return;
        setDetail(notification);
        if (!notification.readAt) void fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }) })
          .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
      })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "The notification could not be loaded."); });
    return () => { cancelled = true; };
  }, [id, queryClient]);

  if (!detail && !error) return <main className="flex min-h-screen items-center justify-center bg-bg"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Loading notification...</main>;
  if (error || !detail) return <main className="flex min-h-screen items-center justify-center bg-bg px-5"><div className="rounded-2xl border border-danger-border bg-surface p-8 text-center"><p className="text-sm text-danger-text">{error}</p><Link href="/notifications" className="mt-5 inline-flex rounded-xl bg-action-primary px-4 py-2 text-sm text-on-action-primary">Back</Link></div></main>;

  const severity = detail.severity ?? "info";
  const Icon = icons[severity];
  return (
    <main className="min-h-screen bg-bg px-5 py-8 text-text sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/notifications" className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-accent"><ArrowLeft className="h-4 w-4" />All notifications</Link>
        <article className="mt-5 overflow-hidden rounded-[28px] border border-border bg-surface shadow-none">
          <header className="flex gap-4 border-b border-border p-6 sm:p-8">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${colors[severity]}`}><Icon className="h-5 w-5" /></span>
            <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">{detail.type || "activity"}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{detail.title || "Notification"}</h1><p className="mt-2 text-sm leading-relaxed text-text-secondary">{detail.body || "No additional details."}</p></div>
          </header>

          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            <div className="rounded-2xl bg-bg p-4"><div className="flex items-center gap-2 text-xs font-medium text-text-secondary"><Clock3 className="h-4 w-4" />Activity time</div><p className="mt-2 text-sm">{formatDate(detail.createdAt)}</p></div>
            {detail.deck && <div className="rounded-2xl bg-bg p-4"><div className="flex items-center gap-2 text-xs font-medium text-text-secondary"><Layers3 className="h-4 w-4" />Deck</div><p className="mt-2 text-sm font-medium">{detail.deck.title || detail.deck.id}</p></div>}
            {detail.document && <div className="rounded-2xl bg-bg p-4"><div className="flex items-center gap-2 text-xs font-medium text-text-secondary"><FileText className="h-4 w-4" />Material</div><p className="mt-2 text-sm font-medium">{detail.document.title || detail.document.id}</p></div>}
            {detail.job && <div className="rounded-2xl bg-bg p-4"><div className="flex items-center gap-2 text-xs font-medium text-text-secondary"><Bell className="h-4 w-4" />Task status</div><p className="mt-2 text-sm font-medium capitalize">{detail.job.status}</p><p className="mt-1 text-xs text-text-secondary">{detail.job.flashcardCount} flashcards · {detail.job.quizCount} quiz questions</p></div>}
            {detail.job?.kind === "quiz_generate" && <div className="rounded-2xl bg-bg p-4"><div className="flex items-center gap-2 text-xs font-medium text-text-secondary"><Layers3 className="h-4 w-4" />Quiz set</div><p className="mt-2 text-sm font-medium">{detail.job.quizSetLabel || (detail.job.variant === "harder" ? "Harder" : "Different Questions")}</p><p className="mt-1 text-xs text-text-secondary">{detail.job.variant === "harder" ? "Difficulty increased" : "A different set of questions"}</p></div>}
            {detail.job?.errorMessage && <div className="rounded-2xl border border-danger-border bg-danger-subtle p-4 sm:col-span-2"><p className="text-xs font-medium text-danger-text">Failure details</p><p className="mt-1 text-sm text-danger-text">{detail.job.errorMessage}</p></div>}
          </div>

        </article>
      </div>
    </main>
  );
}
