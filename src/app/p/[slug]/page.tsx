import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import PostImageGallery from "@/components/posts/PostImageGallery";
import { DeckFolderCard } from "@/components/posts/PostCard";
import SocialActions from "@/components/social/SocialActions";
import CommentsSection from "@/components/social/CommentsSection";
import { auth } from "@/lib/auth";
import { ragSql } from "@/lib/rag/db";

export default async function PublicPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  const userId = session?.user?.id ?? "";
  const sql = ragSql();
  const rows = await sql`select p.id,p.title,p.body,p.body_md,p.published_at,p.like_count,p.comment_count,p.repost_count,p.embedded_deck_color,pr.username,pr.display_name,pr.avatar_url,d.slug deck_slug,d.title deck_title,d.description deck_description,d.tags deck_tags,d.version deck_version,
    exists(select 1 from public.likes l where l.user_id=${userId} and l.target_type='post' and l.target_id=p.id) liked_by_me,
    exists(select 1 from public.bookmarks b where b.user_id=${userId} and b.target_type='post' and b.target_id=p.id) bookmarked_by_me,
    exists(select 1 from public.reposts r where r.user_id=${userId} and r.target_type='post' and r.target_id=p.id) reposted_by_me
    from public.posts p join public.profiles pr on pr.user_id=p.author_id left join public.public_decks d on d.id=p.embedded_public_deck_id and d.status='published'
    where p.slug=${slug} and p.status='published' and p.deleted_at is null limit 1`;
  const post = rows[0];
  if (!post) notFound();
  const images = await sql`select id,width,height,alt_text from public.post_images where post_id=${post.id} order by position`;

  return <AppShell><main className="min-h-screen bg-bg px-5 py-8 text-text"><div className="mx-auto max-w-[720px]">
    <article className="border-b border-border pb-7">
      <p className="text-sm font-bold">{post.display_name}<Link href={`/u/${post.username}`} className="ml-2 font-normal text-text-secondary">@{post.username}</Link></p>
      <p className="mt-4 whitespace-pre-wrap text-base leading-7">{post.body || post.body_md}</p>
      <PostImageGallery images={images.map(image => ({ id: String(image.id), url: `/api/post-images/${image.id}`, width: Number(image.width), height: Number(image.height), altText: image.alt_text ? String(image.alt_text) : null }))} />
      {post.deck_slug && <DeckFolderCard deck={{ slug: String(post.deck_slug), title: String(post.deck_title), description: String(post.deck_description || ""), tags: Array.isArray(post.deck_tags) ? post.deck_tags : [], color: post.embedded_deck_color }} />}
      <div className="mt-5"><SocialActions targetType="post" targetId={String(post.id)} slug={slug} compact commentCount={Number(post.comment_count)} initialLikeCount={Number(post.like_count)} initialLiked={Boolean(post.liked_by_me)} initialBookmarked={Boolean(post.bookmarked_by_me)} initialRepostCount={Number(post.repost_count)} initialReposted={Boolean(post.reposted_by_me)} /></div>
      <p className="mt-5 text-xs text-text-muted">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(post.published_at))}</p>
    </article>
    <CommentsSection targetType="post" targetId={String(post.id)} />
  </div></main></AppShell>;
}
