"use client";

import Link from "next/link";
import { BookOpen, Layers3 } from "lucide-react";
import PostImageGallery, { type PostImage } from "./PostImageGallery";
import SocialActions from "@/components/social/SocialActions";
import { deckCardColor, DECK_CARD_THEMES, type DeckCardColor } from "@/lib/deck-card-colors";
import UserAvatar from "@/components/profile/UserAvatar";

export type SocialPostItem = {
  id: string;
  type: "post" | "deck";
  slug: string;
  sourceDeckId?: string | null;
  title: string;
  summary: string;
  /** Legacy profile compatibility; new views render `summary`. */
  excerpt?: string;
  tags: string[];
  publishedAt: string;
  author: { username: string; displayName: string; avatarUrl?: string | null };
  likeCount: number;
  commentCount: number;
  repostCount: number;
  likedByMe: boolean;
  bookmarkedByMe: boolean;
  repostedByMe: boolean;
  images?: PostImage[];
  embeddedDeck?: { slug: string; sourceDeckId?: string | null; title: string; description: string; tags: string[]; color?: DeckCardColor } | null;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" });

export default function PostCard({ item }: { item: SocialPostItem }) {
  const isPost = item.type === "post";
  const deck = isPost ? item.embeddedDeck : { slug: item.slug, sourceDeckId:item.sourceDeckId, title: item.title, description: item.summary, tags: item.tags };

  return <article className="border-b border-[#D8DCD3] bg-transparent py-6 text-[#16241D]">
    <div className="flex items-start gap-3">
      <AuthorAvatar author={item.author} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <Link href={`/profile/${item.author.username}`} className="truncate text-[15px] font-bold hover:underline">{item.author.displayName}</Link>
          <span className="text-xs text-[#7A8780]">@{item.author.username}</span>
          <span className="text-xs text-[#9AA39D]">· {dateFormatter.format(new Date(item.publishedAt))}</span>
        </div>

        {isPost && item.summary && <Link href={`/p/${item.slug}`} className="mt-1 block whitespace-pre-wrap text-[15px] leading-[1.55] text-[#202C26]">{item.summary}</Link>}
        {!isPost && <p className="mt-1 text-sm text-[#5B6B62]">Shared a public study deck</p>}

        <PostImageGallery images={item.images || []} />
        {deck && <DeckFolderCard deck={deck} />}

        <div className="mt-4 flex items-center text-[#657169]">
          <SocialActions targetType={isPost ? "post" : "public_deck"} targetId={item.id} slug={item.slug} compact commentCount={item.commentCount} initialLikeCount={item.likeCount} initialLiked={item.likedByMe} initialBookmarked={item.bookmarkedByMe} initialRepostCount={item.repostCount} initialReposted={item.repostedByMe} />
        </div>
      </div>
    </div>
  </article>;
}

function AuthorAvatar({ author }: { author: SocialPostItem["author"] }) {
  return <Link href={`/profile/${author.username}`} className="shrink-0"><UserAvatar src={author.avatarUrl} name={author.displayName} size={40} textClassName="text-sm"/></Link>;
}

export function DeckFolderCard({ deck }: { deck: { slug: string; sourceDeckId?: string | null; title: string; description: string; tags: string[]; color?: DeckCardColor } }) {
  const theme = DECK_CARD_THEMES[deckCardColor(deck.color)];
  const href=`/desk/${deck.sourceDeckId||deck.slug}?share=1`;
  return <Link href={href} style={{ backgroundColor: theme.shell, borderColor: theme.border }} className="group relative mt-4 block overflow-hidden rounded-[22px] border px-5 pb-5 pt-8 sm:px-8 sm:pb-7 sm:pt-10">
    <div className="absolute left-8 right-8 top-5 h-28 rotate-[-1.5deg] rounded-2xl border border-[#D8DCD3] bg-white p-4 transition-transform group-hover:-translate-y-1">
      <div className="h-2 w-24 rounded-full bg-[#D9E2DC]" /><div className="mt-3 h-2 w-2/3 rounded-full bg-[#EBEFEB]" /><div className="mt-2 h-2 w-1/2 rounded-full bg-[#EBEFEB]" />
    </div>
    <div style={{ backgroundColor: theme.folder, borderColor: theme.border, color: theme.ink }} className="relative mt-12 min-h-44 rounded-[18px] border p-5 backdrop-blur-sm sm:min-h-48 sm:p-6">
      <span style={{ backgroundColor: theme.tab }} className="absolute -top-5 left-0 h-7 w-32 rounded-t-2xl" />
      <div style={{ color: theme.muted }} className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.16em]"><Layers3 className="h-4 w-4" />Public deck</div>
      <h3 className="mt-3 max-w-lg text-2xl font-bold leading-tight">{deck.title}</h3>
      {deck.description && <p style={{ color: theme.muted }} className="mt-2 line-clamp-2 max-w-xl text-sm leading-6">{deck.description}</p>}
      <div className="mt-5 flex flex-wrap gap-2">{deck.tags.slice(0, 3).map(tag => <span key={tag} className="rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[10px]">{tag}</span>)}</div>
      <span className="absolute bottom-5 right-5 flex h-9 w-9 items-center justify-center rounded-full border border-white/50 transition group-hover:translate-y-1"><BookOpen className="h-4 w-4" /></span>
    </div>
  </Link>;
}
