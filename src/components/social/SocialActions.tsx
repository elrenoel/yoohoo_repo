"use client";

import Link from "next/link";
import { Bookmark, Flag, Heart, MessageCircle, Repeat2 } from "lucide-react";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useOptimisticIntentMutation, type OptimisticIntentResponse } from "@/hooks/use-optimistic-intent-mutation";
import { updateSocialCaches, type SocialAction, type SocialTargetType } from "@/lib/social-cache";
import { queryKeys } from "@/lib/query-keys";
import { useToast } from "@/lib/toast";
import { trackFeedEvent } from "@/lib/feed-events-client";
import { useSession } from "@/lib/session-provider";

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
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pulse, setPulse] = useState<SocialAction | null>(null);
  const failed = () => toast.error("Something went wrong. Try again.");
  const cacheUpdater = (action: SocialAction) => (state: OptimisticIntentResponse) => updateSocialCaches(queryClient, targetType, targetId, action, state);
  const itemType=targetType==="public_deck"?"deck":"post";
  const like = useOptimisticIntentMutation({ entityKey: `like:${targetType}:${targetId}`, initialState: { active: initialLiked, count: initialLikeCount }, request: async desired => {const result=await requestSocialIntent("likes", desired, targetType, targetId);if(desired)trackFeedEvent({itemType,itemId:targetId,eventType:"like"});return result}, updateCache: cacheUpdater("like"), onError: failed });
  const bookmark = useOptimisticIntentMutation({ entityKey: `bookmark:${targetType}:${targetId}`, initialState: { active: initialBookmarked }, request: async desired => {
    const result = await requestSocialIntent("bookmarks", desired, targetType, targetId);
    if(desired)trackFeedEvent({itemType,itemId:targetId,eventType:"save"});
    await queryClient.invalidateQueries({ queryKey: queryKeys.saved(targetType) });
    return result;
  }, updateCache: cacheUpdater("bookmark"), onError: failed });
  const repost = useOptimisticIntentMutation({ entityKey: `repost:${targetType}:${targetId}`, initialState: { active: initialReposted, count: initialRepostCount }, request: async desired => {const result=await requestSocialIntent("reposts", desired, targetType, targetId);if(desired)trackFeedEvent({itemType,itemId:targetId,eventType:"share"});return result}, updateCache: cacheUpdater("repost"), onError: failed });

  function activate(action: SocialAction, next: boolean, mutate: (desired: boolean) => void) {
    if (!session?.user) {
      toast.info("Log in to continue.", { action: { label: "Log in", onClick: () => router.push(`/login?next=${encodeURIComponent(pathname)}`) } });
      return;
    }
    setPulse(action);
    window.setTimeout(() => setPulse(current => current === action ? null : current), 150);
    mutate(next);
    if (action === "repost") toast.success(next ? "Post reposted." : "Repost removed.", { id: `social:${action}:${targetType}:${targetId}` });
    if (action === "bookmark") toast.success(next ? "Post saved." : "Removed from Saved.", { id: `social:${action}:${targetType}:${targetId}` });
  }

  async function report() {
    if (!session?.user) {
      toast.info("Log in to continue.", { action: { label: "Log in", onClick: () => router.push(`/login?next=${encodeURIComponent(pathname)}`) } });
      return;
    }
    const reason = window.prompt("Why are you reporting this? (3–500 characters)");
    if (!reason) return;
    const response = await fetch("/api/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, reason }) });
    toast[response.ok ? "success" : "error"](response.ok ? "Report submitted." : "Report failed.");
  }

  const commentsHref = slug ? `/${targetType === "post" ? "p" : "d"}/${slug}#comments` : "#comments";
  const pulseClass = (action: SocialAction) => pulse === action ? "motion-safe:scale-110" : "scale-100";
  const likeCount = like.count ?? 0;
  const repostCount = repost.count ?? 0;
  if (compact) return <div className="flex items-center gap-5 text-text-secondary">
      <button type="button" onClick={() => activate("like", !like.active, like.setDesiredState)} aria-pressed={like.active} className={`flex items-center gap-1.5 text-xs transition hover:text-danger-text ${like.active ? "text-danger-text" : ""}`}><Heart className={`h-[18px] w-[18px] transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("like")} ${like.active ? "fill-current" : ""}`} /><span aria-live="polite">{likeCount}</span></button>
      <Link href={commentsHref} className="flex items-center gap-1.5 text-xs transition hover:text-accent"><MessageCircle className="h-[18px] w-[18px]" />{commentCount}</Link>
      <button type="button" onClick={() => activate("repost", !repost.active, repost.setDesiredState)} aria-pressed={repost.active} className={`flex items-center gap-1.5 text-xs transition hover:text-accent ${repost.active ? "text-accent" : ""}`} title={repost.active ? "Undo repost" : "Repost"}><Repeat2 className={`h-[18px] w-[18px] transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("repost")}`} /><span aria-live="polite">{repostCount}</span></button>
      <button type="button" onClick={() => activate("bookmark", !bookmark.active, bookmark.setDesiredState)} aria-pressed={bookmark.active} className={`p-0.5 transition hover:text-accent ${bookmark.active ? "text-accent" : ""}`} title={bookmark.active ? "Saved" : "Save"}><Bookmark className={`h-[18px] w-[18px] transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("bookmark")} ${bookmark.active ? "fill-current" : ""}`} /></button>
      <button type="button" onClick={() => void report()} className="p-0.5 transition hover:text-danger-text" title="Report"><Flag className="h-[18px] w-[18px]" /></button>
  </div>;

  return <div className="my-6 flex flex-wrap items-center gap-3">
      <button type="button" onClick={() => activate("like", !like.active, like.setDesiredState)} aria-pressed={like.active} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${like.active ? "border-danger bg-danger-subtle text-danger-text" : "border-border text-text-secondary"}`}><Heart className={`h-4 w-4 transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("like")} ${like.active ? "fill-current" : ""}`} /><span aria-live="polite">{likeCount}</span></button>
      <Link href={commentsHref} className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-text-secondary"><MessageCircle className="h-4 w-4" />{commentCount}</Link>
      <button type="button" onClick={() => activate("repost", !repost.active, repost.setDesiredState)} aria-pressed={repost.active} className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm ${repost.active ? "border-accent bg-accent-subtle text-accent" : "border-border text-text-secondary"}`}><Repeat2 className={`h-4 w-4 transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("repost")}`} /><span aria-live="polite">{repostCount}</span></button>
      <button type="button" onClick={() => activate("bookmark", !bookmark.active, bookmark.setDesiredState)} aria-pressed={bookmark.active} className={`rounded-full border p-2.5 ${bookmark.active ? "border-accent bg-accent-subtle text-accent" : "border-border text-text-secondary"}`} title={bookmark.active ? "Saved" : "Save"}><Bookmark className={`h-4 w-4 transform transition-transform duration-150 motion-reduce:transition-none ${pulseClass("bookmark")} ${bookmark.active ? "fill-current" : ""}`} /></button>
      <button type="button" onClick={() => void report()} className="rounded-full border border-border p-2.5 text-text-secondary" title="Report"><Flag className="h-4 w-4" /></button>
  </div>;
}
