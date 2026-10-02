"use client";

import Link from "next/link";
import { CalendarDays, FileText, FolderKanban, Link2, Loader2, MessageCircle, Plus, Star, User as UserIcon } from "lucide-react";
import { useEffect, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import Card from "@/components/ui/Card";
import { useSession } from "@/lib/session-provider";

type Desk = { id: string; title: string; updatedAt: string; materialCount: number; elementCount: number; processingCount: number; isStarred: boolean };
const ribbonStyles = [
  { bar: "bg-[#F54B50]", label: "PRIORITAS TINGGI" },
  { bar: "bg-[#FF7A18]", label: "PRIORITAS SEDANG" },
  { bar: "bg-[#35B879]", label: "PRIORITAS RENDAH" },
  { bar: "bg-[#42A9E8]", label: "SEDANG DIPROSES" },
];

export default function YourDeskLanding() {
  const { data: session, isPending: sessionPending } = useSession();
  const [desks, setDesks] = useState<Desk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionPending || !session?.user) return;
    fetch("/api/decks", { cache: "no-store" })
      .then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Meja kerja tidak dapat dimuat."); return body.decks as Desk[]; })
      .then(setDesks)
      .catch(cause => setError(cause instanceof Error ? cause.message : "Meja kerja tidak dapat dimuat."))
      .finally(() => setLoading(false));
  }, [session, sessionPending]);

  async function toggleStar(desk: Desk) {
    const next = !desk.isStarred;
    setDesks(current => current.map(item => item.id === desk.id ? { ...item, isStarred: next } : item));
    try {
      const response = await fetch(`/api/decks/${desk.id}/star`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ is_starred: next }) });
      if (!response.ok) throw new Error();
    } catch {
      setDesks(current => current.map(item => item.id === desk.id ? { ...item, isStarred: desk.isStarred } : item));
    }
  }

  return (
    <AppShell>
      <main className="min-h-screen bg-[#F5F6F3] px-5 py-10 pb-28 text-[#16241D] sm:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex items-center justify-between gap-4">
            <div><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#5B6B62]">WORKSPACE</p><h1 className="mt-1 font-serif text-4xl font-semibold tracking-tight">Your Desk</h1></div>
            <Link href="/desk/upload" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#013528] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#07543F]"><Plus className="h-4 w-4" />Meja baru</Link>
          </header>

          {!sessionPending && !session?.user ? <Card variant="centered"><UserIcon className="mx-auto mb-3 h-6 w-6 text-[#5B6B62]" /><h2 className="font-semibold">Masuk untuk melihat meja kerja</h2><Link href="/login" className="mt-5 inline-flex rounded-xl bg-[#013528] px-4 py-2 text-sm font-medium text-white">Masuk sekarang</Link></Card> : loading ? <div className="flex items-center justify-center py-20 text-sm text-[#5B6B62]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memuat meja kerja...</div> : error ? <Card variant="centered"><p className="text-sm text-red-600">{error}</p></Card> : desks.length === 0 ? <Card variant="centered"><p className="font-serif text-xl font-semibold">Belum ada meja kerja — buat yang pertama</p><Link href="/desk/upload" className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-[#013528] px-4 py-2.5 text-sm font-medium text-white"><Plus className="h-4 w-4" />Meja baru</Link></Card> : <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{desks.map((desk, index) => { const style = ribbonStyles[index % ribbonStyles.length]; const status = desk.processingCount > 0 ? "Sedang diproses" : desk.isStarred ? "Ditandai" : "Siap dipelajari"; return <Link key={desk.id} href={`/desk/${desk.id}`} className="group overflow-hidden rounded-2xl border border-[#D8DCD3] bg-white shadow-[0_2px_8px_rgba(22,36,29,0.08)] transition hover:-translate-y-0.5 hover:border-[#AAB7AB] hover:shadow-[0_5px_14px_rgba(22,36,29,0.12)]"><div className={`px-4 py-1.5 text-center font-mono text-[10px] font-semibold tracking-[0.08em] text-white ${style.bar}`}>{style.label}</div><div className="p-3"><div className="rounded-xl border border-dashed border-[#C9D0C8] bg-[#FDFEFC] p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-[#013528]" /><h2 className="truncate font-serif text-lg font-semibold">{desk.title}</h2></div><p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#7A8780]">Ruang belajar untuk mengelola materi, elemen penting, dan alat belajar dari dokumenmu.</p></div><button type="button" aria-label={desk.isStarred ? "Hapus tanda bintang" : "Tandai meja"} onClick={event => { event.preventDefault(); event.stopPropagation(); void toggleStar(desk); }} className={`shrink-0 rounded-lg p-1 transition ${desk.isStarred ? "text-[#2F7651]" : "text-[#A2ADA5] hover:text-[#2F7651]"}`}><Star className="h-5 w-5" fill={desk.isStarred ? "currentColor" : "none"} /></button></div><div className="mt-4 flex justify-end"><span className={`rounded-md px-2 py-1 text-[11px] font-medium ${desk.processingCount > 0 ? "bg-[#FFF1E7] text-[#C86621]" : "bg-[#EEF5F0] text-[#397653]"}`}>{status}</span></div></div><div className="flex items-center justify-between px-1 pt-3 font-mono text-[11px] text-[#7A8780]"><div className="flex items-center gap-3"><span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" />{desk.materialCount}</span><span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />{desk.elementCount}</span><span className="inline-flex items-center gap-1"><FolderKanban className="h-3.5 w-3.5" />{desk.materialCount}</span></div><span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{new Date(desk.updatedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</span></div></div></Link>; })}</div>}
        </div>
      </main>
    </AppShell>
  );
}
