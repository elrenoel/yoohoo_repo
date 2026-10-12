"use client";

import Link from "next/link";
import { BookmarkX, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOptimisticIntentMutation } from "@/hooks/use-optimistic-intent-mutation";
import { queryKeys } from "@/lib/query-keys";
import { updateSocialCaches, type SocialTargetType } from "@/lib/social-cache";
import { useToast } from "@/lib/toast";

type SavedItem = { id: string; type: SocialTargetType; sourceDeckId?: string | null; slug: string; title: string; summary: string; like_count: number; comment_count: number; bookmarkedByMe: boolean; repostedByMe: boolean };
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
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Could not update the saved item.");
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
    onError: () => toast.error("Something went wrong. Try again."),
  });

  const href=targetType==="post"?`/p/${item.slug}`:`/desk/${item.sourceDeckId||item.slug}?share=1`;
  return <article className="flex items-start justify-between rounded-2xl border border-border bg-surface p-5 shadow-none transition hover:border-border-strong hover:shadow-none"><div><Link href={href} className="font-serif text-2xl font-semibold">{item.title}</Link><p className="mt-2 line-clamp-2 text-sm text-text-secondary">{item.summary}</p><p className="mt-3 font-mono text-[10px]">{item.like_count} likes · {item.comment_count} comments</p></div><button type="button" onClick={() => bookmark.setDesiredState(false)} aria-pressed={bookmark.active} className="ml-4 rounded-full p-2 text-text-secondary transition hover:bg-danger-subtle hover:text-danger-text" title="Remove bookmark"><Trash2 className="h-4 w-4" /></button></article>;
}

export default function SavedItems() {
  const [tab, setTab] = useState<SocialTargetType>("post");
  const saved = useQuery<SavedResponse>({
    queryKey: queryKeys.saved(tab),
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/bookmarks/list?tab=${tab}`, { cache: "no-store", signal });
      const data = (await response.json()) as SavedResponse & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Saved items could not be loaded.");
      return data;
    },
  });

  const items = saved.data?.items ?? [];
  return <><div className="mt-7 inline-flex rounded-xl border border-border bg-surface p-1 shadow-none">{([['post','Post'],['public_deck','Deck']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} className={`rounded-lg px-5 py-2.5 text-sm transition ${tab === value ? "bg-action-primary font-semibold text-on-action-primary" : "text-text-secondary hover:bg-surface-hover hover:text-text"}`}>{label}</button>)}</div>{saved.isPending ? <div className="mt-6 space-y-3" role="status">{[1,2,3,4].map(item=><div key={item} className="h-24 animate-pulse rounded-xl border border-border bg-skeleton"/>)}<span className="sr-only">Loading saved items</span></div> : saved.isError ? <div className="mt-6 rounded-2xl border border-danger-border bg-surface p-5 text-sm text-danger-text shadow-none">{saved.error instanceof Error ? saved.error.message : "Saved items could not be loaded."}</div> : items.length ? <div className="mt-6 space-y-3">{items.map(item => <SavedRow key={item.id} item={item} targetType={tab} />)}</div> : <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface py-16 text-center shadow-none"><BookmarkX className="mx-auto h-8 w-8 text-text-muted" /><p className="mt-3">No saved {tab === "post" ? "posts" : "decks"} yet.</p></div>}</>;
}
