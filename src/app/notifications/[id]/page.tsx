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
const colors = { info: "bg-[#DDE9D4] text-[#516757]", success: "bg-[#EEF5F0] text-[#2F7651]", error: "bg-[#FBEDEB] text-[#C24A3D]" } as const;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "long", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
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
        if (!response.ok) throw new Error(body.error || "Notifikasi tidak dapat dimuat.");
        return body.notification as Detail;
      })
      .then(notification => {
        if (cancelled) return;
        setDetail(notification);
        if (!notification.readAt) void fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }) })
          .then(() => queryClient.invalidateQueries({ queryKey: ["notifications"] }));
      })
      .catch(cause => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Notifikasi tidak dapat dimuat."); });
    return () => { cancelled = true; };
  }, [id, queryClient]);

  if (!detail && !error) return <main className="flex min-h-screen items-center justify-center bg-[#F5F6F3]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memuat notifikasi...</main>;
  if (error || !detail) return <main className="flex min-h-screen items-center justify-center bg-[#F5F6F3] px-5"><div className="rounded-2xl border border-rose-200 bg-white p-8 text-center"><p className="text-sm text-rose-700">{error}</p><Link href="/notifications" className="mt-5 inline-flex rounded-xl bg-[#123F34] px-4 py-2 text-sm text-white">Kembali</Link></div></main>;

  const severity = detail.severity ?? "info";
  const Icon = icons[severity];
  return (
    <main className="min-h-screen bg-[#F5F6F3] px-5 py-8 text-[#16241D] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/notifications" className="inline-flex items-center gap-2 text-sm font-medium text-[#516757] hover:text-[#123F34]"><ArrowLeft className="h-4 w-4" />Semua notifikasi</Link>
        <article className="mt-5 overflow-hidden rounded-[28px] border border-[#D8DCD3] bg-white shadow-[0_12px_36px_rgba(22,36,29,0.08)]">
          <header className="flex gap-4 border-b border-[#E4E6DE] p-6 sm:p-8">
            <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${colors[severity]}`}><Icon className="h-5 w-5" /></span>
            <div><p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#7A8780]">{detail.type || "aktivitas"}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{detail.title || "Notifikasi"}</h1><p className="mt-2 text-sm leading-relaxed text-[#5B6B62]">{detail.body || "Tidak ada keterangan tambahan."}</p></div>
          </header>

          <div className="grid gap-4 p-6 sm:grid-cols-2 sm:p-8">
            <div className="rounded-2xl bg-[#F5F6F3] p-4"><div className="flex items-center gap-2 text-xs font-medium text-[#516757]"><Clock3 className="h-4 w-4" />Waktu aktivitas</div><p className="mt-2 text-sm">{formatDate(detail.createdAt)}</p></div>
            {detail.deck && <div className="rounded-2xl bg-[#F5F6F3] p-4"><div className="flex items-center gap-2 text-xs font-medium text-[#516757]"><Layers3 className="h-4 w-4" />Deck</div><p className="mt-2 text-sm font-medium">{detail.deck.title || detail.deck.id}</p></div>}
            {detail.document && <div className="rounded-2xl bg-[#F5F6F3] p-4"><div className="flex items-center gap-2 text-xs font-medium text-[#516757]"><FileText className="h-4 w-4" />Materi</div><p className="mt-2 text-sm font-medium">{detail.document.title || detail.document.id}</p></div>}
            {detail.job && <div className="rounded-2xl bg-[#F5F6F3] p-4"><div className="flex items-center gap-2 text-xs font-medium text-[#516757]"><Bell className="h-4 w-4" />Status task</div><p className="mt-2 text-sm font-medium capitalize">{detail.job.status}</p><p className="mt-1 text-xs text-[#6A776F]">{detail.job.flashcardCount} flashcard · {detail.job.quizCount} soal quiz</p></div>}
            {detail.job?.kind === "quiz_generate" && <div className="rounded-2xl bg-[#F5F6F3] p-4"><div className="flex items-center gap-2 text-xs font-medium text-[#516757]"><Layers3 className="h-4 w-4" />Set quiz</div><p className="mt-2 text-sm font-medium">{detail.job.quizSetLabel || (detail.job.variant === "harder" ? "Lebih Sulit" : "Soal Berbeda")}</p><p className="mt-1 text-xs text-[#6A776F]">{detail.job.variant === "harder" ? "Tingkat kesulitan dinaikkan" : "Pertanyaan baru yang berbeda"}</p></div>}
            {detail.job?.errorMessage && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 sm:col-span-2"><p className="text-xs font-medium text-rose-700">Detail kegagalan</p><p className="mt-1 text-sm text-rose-700">{detail.job.errorMessage}</p></div>}
          </div>

        </article>
      </div>
    </main>
  );
}
