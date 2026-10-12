"use client";

import Image from "next/image";
import { LoaderCircle, MessageCircle, Reply, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { useSession } from "@/lib/session-provider";
import { useToast } from "@/lib/toast";
import { trackFeedEvent } from "@/lib/feed-events-client";

type Comment = { id: string; parent_id: string | null; body: string | null; deleted_at: string | null; created_at: string; author_id: string; username: string; display_name: string; avatar_url?: string | null };

export default function CommentsSection({ targetType, targetId }: { targetType: "post" | "public_deck"; targetId: string }) {
  const { data: session } = useSession();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [reply, setReply] = useState<Comment | null>(null);
  const key = queryKeys.comments(targetType, targetId);
  const query = useQuery<{ comments: Comment[] }>({ queryKey: key, queryFn: async ({ signal }) => { const response = await fetch(`/api/comments?targetType=${targetType}&targetId=${targetId}`, { signal }); const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; } });
  const send = useMutation({ mutationFn: async () => { const response = await fetch("/api/comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, body, parentId: reply?.id }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); return data; }, onSuccess: async () => { trackFeedEvent({itemType:targetType==="public_deck"?"deck":"post",itemId:targetId,eventType:"comment"});setBody(""); setReply(null); await queryClient.invalidateQueries({ queryKey: key }); await queryClient.invalidateQueries({ queryKey: queryKeys.feedRoot }); }, onError: error => toast.error(error instanceof Error ? error.message : "Reply could not be sent.") });
  const remove = useMutation({ mutationFn: async (id: string) => { const response = await fetch(`/api/comments/${id}`, { method: "DELETE" }); if (!response.ok) throw new Error("Comment could not be deleted."); }, onSuccess: () => queryClient.invalidateQueries({ queryKey: key }), onError: error => toast.error(error instanceof Error ? error.message : "Comment could not be deleted.") });
  const comments = query.data?.comments ?? [];
  const roots = comments.filter(comment => !comment.parent_id);

  return <section id="comments" className="py-6">
    <h2 className="flex items-center gap-2 text-sm font-bold"><MessageCircle className="h-4 w-4" />{comments.length} {comments.length === 1 ? "reply" : "replies"}</h2>
    {session?.user ? <div className="mt-5 rounded-xl border border-border bg-surface p-4">
      {reply && <p className="mb-2 text-xs text-text-secondary">Replying to @{reply.username} <button type="button" onClick={() => setReply(null)} className="ml-1 font-semibold underline">Cancel</button></p>}
      <textarea value={body} onChange={event => setBody(event.target.value.slice(0, 1000))} placeholder={reply ? `Reply to @${reply.username}...` : "Leave a reply..."} className="min-h-16 w-full resize-none bg-transparent text-sm outline-none" />
      <div className="mt-2 flex items-center justify-between"><span className="text-[10px] text-text-muted">{body.length}/1000</span><button type="button" onClick={() => send.mutate()} disabled={send.isPending || !body.trim()} className="flex items-center gap-2 rounded-full bg-action-primary px-4 py-2 text-xs font-bold text-on-action-primary disabled:opacity-40">{send.isPending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" />}Reply</button></div>
    </div> : <p className="mt-4 text-sm text-text-secondary">Log in to join the conversation.</p>}

    {query.isPending ? <div className="mt-6 h-24 animate-pulse rounded-xl bg-skeleton" /> : <div className="mt-7 space-y-6">
      {roots.map(comment => <div key={comment.id} className="border-b border-border pb-6"><CommentRow comment={comment} own={session?.user?.id === comment.author_id} onReply={() => setReply(comment)} onDelete={id => remove.mutate(id)} />
        <div className="ml-5 mt-5 space-y-5 border-l border-border pl-5">{comments.filter(item => item.parent_id === comment.id).map(child => <CommentRow key={child.id} comment={child} own={session?.user?.id === child.author_id} onDelete={id => remove.mutate(id)} />)}</div>
      </div>)}
      {!roots.length && <p className="py-8 text-center text-sm text-text-secondary">No replies yet. Start the conversation.</p>}
    </div>}
  </section>;
}

function CommentRow({ comment, own, onReply, onDelete }: { comment: Comment; own: boolean; onReply?: () => void; onDelete: (id: string) => void }) {
  return <div className="flex gap-3"><Avatar comment={comment} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-sm font-bold">{comment.display_name}</span><span className="text-xs text-text-muted">@{comment.username} Â· {new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(new Date(comment.created_at))}</span></div><p className={`mt-1 whitespace-pre-wrap text-sm leading-6 ${comment.deleted_at ? "italic text-text-muted" : ""}`}>{comment.deleted_at ? "This comment was deleted." : comment.body}</p><div className="mt-2 flex gap-3">{onReply && !comment.deleted_at && <button type="button" onClick={onReply} className="flex items-center gap-1 text-xs font-semibold text-text-secondary hover:text-accent"><Reply className="h-3.5 w-3.5" />Reply</button>}{own && !comment.deleted_at && <button type="button" onClick={() => onDelete(comment.id)} className="flex items-center gap-1 text-xs text-danger-text"><Trash2 className="h-3.5 w-3.5" />Delete</button>}</div></div></div>;
}

function Avatar({ comment }: { comment: Comment }) {
  return comment.avatar_url ? <Image src={comment.avatar_url} alt={comment.display_name} width={36} height={36} unoptimized className="h-9 w-9 rounded-full object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-xs font-bold text-accent">{comment.display_name.slice(0, 1).toUpperCase()}</span>;
}
