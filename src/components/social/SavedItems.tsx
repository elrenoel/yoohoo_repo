"use client";

import Link from "next/link";
import { BookmarkX, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticIntentMutation } from "@/hooks/use-optimistic-intent-mutation";
import { queryKeys } from "@/lib/query-keys";
import { updateSocialCaches, type SocialTargetType } from "@/lib/social-cache";
import { useToast } from "@/lib/toast";

type SavedItem = { id: string; type: SocialTargetType; slug: string; title: string; summary: string; like_count: number; comment_count: number; bookmarkedByMe: boolean; repostedByMe: boolean };
type SavedResponse = { items: SavedItem[] };

function SavedRow({ item, targetType }: { item: SavedItem; targetType: SocialTargetType }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const bookmark = useOptimisticIntentMutation({
    entityKey: `bookmark:${targetType}:${item.id}`,
    initialState: { active: true },
    request: async desired => {
      const response = await fetch("/api/bookmarks", { method: desired ? "PUT" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId: item.id }) });
      const data = (await response.json()) as Record<string, unknown>;
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Gagal memperbarui simpanan.");
      return { active: typeof data.bookmarked === "boolean" ? data.bookmarked : desired };
    },
    updateCache: state => {
      updateSocialCaches(queryClient, targetType, item.id, "bookmark", state);
      queryClient.setQueryData<SavedResponse>(queryKeys.saved(targetType), current => {
        if (!current) return current;
        if (!state.active) return { ...current, items: current.items.filter(savedItem => savedItem.id !== item.id) };
        return current.items.some(savedItem => savedItem.id === item.id) ? current : { ...current, items: [item, ...current.items] };
      });
    },
    onError: () => toast.error("Gagal, coba lagi"),
  });

  return <article className="flex items-start justify-between rounded-2xl border border-[#D8DCD3] bg-white p-5 shadow-[0_8px_24px_rgba(22,36,29,0.04)] transition hover:border-[#B8C4B8] hover:shadow-[0_10px_28px_rgba(22,36,29,0.07)]"><div><Link href={`/${targetType === "post" ? "p" : "d"}/${item.slug}`} className="font-serif text-2xl font-semibold">{item.title}</Link><p className="mt-2 line-clamp-2 text-sm text-[#5B6B62]">{item.summary}</p><p className="mt-3 font-mono text-[10px]">{item.like_count} suka · {item.comment_count} komentar</p></div><button type="button" onClick={() => bookmark.setDesiredState(false)} aria-pressed={bookmark.active} className="ml-4 rounded-full p-2 text-[#5B6B62] transition hover:bg-[#FBEDEB] hover:text-[#C24A3D]" title="Hapus bookmark"><Trash2 className="h-4 w-4" /></button></article>;
}

export default function SavedItems() {
  const [tab, setTab] = useState<SocialTargetType>("post");
  const saved = useQuery<SavedResponse>({
    queryKey: queryKeys.saved(tab),
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/bookmarks/list?tab=${tab}`, { cache: "no-store", signal });
      const data = (await response.json()) as SavedResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Simpanan gagal dimuat.");
      return data;
    },
  });

  const items = saved.data?.items ?? [];
  return <><div className="mt-7 inline-flex rounded-xl border border-[#D8DCD3] bg-white p-1 shadow-[0_6px_18px_rgba(22,36,29,0.04)]">{([['post','Post'],['public_deck','Deck']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-lg px-5 py-2.5 text-sm transition ${tab === value ? "bg-[#164C3D] font-semibold text-white" : "text-[#5B6B62] hover:bg-[#F7F8F5] hover:text-[#16241D]"}`}>{label}</button>)}</div>{saved.isPending ? <div className="mt-6 rounded-2xl border border-[#D8DCD3] bg-white py-20 shadow-[0_8px_24px_rgba(22,36,29,0.04)]" role="status"><LoaderCircle className="mx-auto animate-spin text-[#164C3D]" /><span className="sr-only">Memuat simpanan</span></div> : saved.isError ? <div className="mt-6 rounded-2xl border border-rose-200 bg-white p-5 text-sm text-rose-700 shadow-[0_8px_24px_rgba(22,36,29,0.04)]">{saved.error instanceof Error ? saved.error.message : "Simpanan gagal dimuat."}</div> : items.length ? <div className="mt-6 space-y-3">{items.map(item => <SavedRow key={item.id} item={item} targetType={tab} />)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-[#D8DCD3] bg-white py-16 text-center shadow-[0_8px_24px_rgba(22,36,29,0.04)]"><BookmarkX className="mx-auto h-8 w-8 text-[#97A79D]" /><p className="mt-3">Belum ada {tab === "post" ? "post" : "deck"} tersimpan.</p></div>}</>;
}
