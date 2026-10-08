"use client";

import Link from "next/link";
import { Bookmark, Flag, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useOptimisticIntentMutation, type OptimisticIntentResponse } from "@/hooks/use-optimistic-intent-mutation";
import { updateSocialCaches, type SocialAction, type SocialTargetType } from "@/lib/social-cache";
import { useToast } from "@/lib/toast";

type Props = {
  targetType: SocialTargetType;
  targetId: string;
  slug?: string;
  compact?: boolean;
  commentCount?: number;
  initialLikeCount: number;
  initialLiked: boolean;
  initialBookmarked: boolean;
  initialRepostCount?: number;
  initialReposted?: boolean;
};

type Endpoint = "likes" | "bookmarks" | "reposts";

async function requestSocialIntent(endpoint: Endpoint, desiredState: boolean, targetType: SocialTargetType, targetId: string): Promise<OptimisticIntentResponse> {
  const response = await fetch(`/api/${endpoint}`, { method: desiredState ? "PUT" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId }) });
  const data = (await response.json()) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "Action failed.");
  const activeField = endpoint === "likes" ? "liked" : endpoint === "bookmarks" ? "bookmarked" : "reposted";
  const countField = endpoint === "likes" ? "likeCount" : endpoint === "reposts" ? "repostCount" : null;
  return { active: typeof data[activeField] === "boolean" ? data[activeField] : desiredState, count: countField && typeof data[countField] === "number" ? data[countField] : undefined };
}

export default function SocialActions({ targetType, targetId, slug, compact = false, commentCount = 0, initialLikeCount, initialLiked, initialBookmarked, initialRepostCount = 0, initialReposted = false }: Props) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [pulse, setPulse] = useState<SocialAction | null>(null);
  const failed = () => toast.error("Gagal, coba lagi");
  const cacheUpdater = (action: SocialAction) => (state: OptimisticIntentResponse) => updateSocialCaches(queryClient, targetType, targetId, action, state);
  const like = useOptimisticIntentMutation({ entityKey: `like:${targetType}:${targetId}`, initialState: { active: initialLiked, count: initialLikeCount }, request: desired => requestSocialIntent("likes", desired, targetType, targetId), updateCache: cacheUpdater("like"), onError: failed });
  const bookmark = useOptimisticIntentMutation({ entityKey: `bookmark:${targetType}:${targetId}`, initialState: { active: initialBookmarked }, request: desired => requestSocialIntent("bookmarks", desired, targetType, targetId), updateCache: cacheUpdater("bookmark"), onError: failed });
  const repost = useOptimisticIntentMutation({ entityKey: `repost:${targetType}:${targetId}`, initialState: { active: initialReposted, count: initialRepostCount }, request: desired => requestSocialIntent("reposts", desired, targetType, targetId), updateCache: cacheUpdater("repost"), onError: failed });

  function activate(action: SocialAction, next: boolean, mutate: (desired: boolean) => void) {
    setPulse(action);
    window.setTimeout(() => setPulse(current => current === action ? null : current), 150);
    mutate(next);
    if (action === "repost") toast.success(next ? "Post reposted." : "Repost removed.", { id: `social:${action}:${targetType}:${targetId}` });
    if (action === "bookmark") toast.success(next ? "Post saved." : "Removed from Saved.", { id: `social:${action}:${targetType}:${targetId}` });
  }

  async function report() {
    const reason = window.prompt("Why are you reporting this? (3–500 characters)");
    if (!reason) return;
    const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, reason }) });
    toast[response.ok ? "success" : "error"](response.ok ? "Report submitted." : "Report failed.");
  }

  const commentsHref = slug ? `/${targetType === "post" ? "p" : "d"}/${slug}#comments` : "#comments";
  const pulseClass = (action: SocialAction) => pulse === action ? "motion-safe:scale-110" : "scale-100";
  const likeCount = like.count ?? 0;
  const repostCount = repost.count ?? 0;
  if (compact) return <div className="flex items-center gap-5 text-[#68736C]">
      <button type="button" onClick={() => activate("like", !like.active, like.setDesiredState)} aria-pressed={like.active} className={`flex items-center gap-1.5 text-xs transition hover:text-[#C24A3D] ${like.active ? "text-[#C24A3D]" : ""}`}><Heart className={`h-[18px] w-[18px] transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("like")} ${like.active ? "fill-current" : ""}`} /><span aria-live="polite">{likeCount}</span></button>
      <Link href={commentsHref} className="flex items-center gap-1.5 text-xs transition hover:text-[#164C3D]"><MessageCircle className="h-[18px] w-[18px]" />{commentCount}</Link>
      <button type="button" onClick={() => activate("repost", !repost.active, repost.setDesiredState)} aria-pressed={repost.active} className={`flex items-center gap-1.5 text-xs transition hover:text-[#164C3D] ${repost.active ? "text-[#164C3D]" : ""}`} title={repost.active ? "Undo repost" : "Repost"}><Repeat2 className={`h-[18px] w-[18px] transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("repost")}`} /><span aria-live="polite">{repostCount}</span></button>
      <button type="button" onClick={() => activate("bookmark", !bookmark.active, bookmark.setDesiredState)} aria-pressed={bookmark.active} className={`p-0.5 transition hover:text-[#164C3D] ${bookmark.active ? "text-[#164C3D]" : ""}`} title="Save"><Bookmark className={`h-[18px] w-[18px] transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("bookmark")} ${bookmark.active ? "fill-current" : ""}`} /></button>
      <button type="button" onClick={() => void report()} className="p-0.5 transition hover:text-[#C24A3D]" title="Report"><Flag className="h-[18px] w-[18px]" /></button>
  </div>;

  return <div className="my-6 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => activate("like", !like.active, like.setDesiredState)} aria-pressed={like.active} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${like.active ? "border-[#C24A3D] text-[#C24A3D]" : "border-[#D8DCD3]"}`}><Heart className={`h-4 w-4 transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("like")} ${like.active ? "fill-current" : ""}`} /><span aria-live="polite">{likeCount}</span></button>
      <Link href={commentsHref} className="flex items-center gap-2 rounded-full border border-[#D8DCD3] px-4 py-2 text-sm"><MessageCircle className="h-4 w-4" />{commentCount}</Link>
      <button type="button" onClick={() => activate("repost", !repost.active, repost.setDesiredState)} aria-pressed={repost.active} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${repost.active ? "border-[#164C3D] text-[#164C3D]" : "border-[#D8DCD3]"}`}><Repeat2 className={`h-4 w-4 transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("repost")}`} /><span aria-live="polite">{repostCount}</span></button>
      <button type="button" onClick={() => activate("bookmark", !bookmark.active, bookmark.setDesiredState)} aria-pressed={bookmark.active} className={`rounded-full border p-2.5 ${bookmark.active ? "border-[#164C3D] text-[#164C3D]" : "border-[#D8DCD3]"}`} title="Save"><Bookmark className={`h-4 w-4 transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("bookmark")} ${bookmark.active ? "fill-current" : ""}`} /></button>
      <button type="button" onClick={() => void report()} className="rounded-full border border-[#D8DCD3] p-2.5" title="Report"><Flag className="h-4 w-4" /></button>
  </div>;
}
