import { auth } from "@/lib/auth";
import { ragSql } from "@/lib/rag/db";
import { canViewDeck } from "@/lib/deck-access";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id:identifier}=await params,sql=ragSql();
 const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"unknown";
 if(!checkRateLimit(`public-deck:${ip}`,60,60_000).allowed)return Response.json({error:"Terlalu banyak permintaan."},{status:429});
 const session=await auth.api.getSession({headers:request.headers});
 const result=await sql.begin(async tx=>{
  const viewerId=session?.user?.id??"";
  const decks=await tx`select d.id,d.source_deck_id,d.slug,d.title,d.description,d.tags,d.language,d.version,d.view_count,d.fork_count,d.like_count,d.comment_count,d.published_at,d.owner_id,p.username,p.display_name,
   coalesce(source.user_id,d.owner_id) source_user_id,coalesce(source.visibility,'public') visibility,source.deleted_at,
   exists(select 1 from public.likes l where l.user_id=${viewerId} and l.target_type='public_deck' and l.target_id=d.id) liked_by_me,
   exists(select 1 from public.bookmarks b where b.user_id=${viewerId} and b.target_type='public_deck' and b.target_id=d.id) bookmarked_by_me,
   exists(select 1 from public.reposts r where r.user_id=${viewerId} and r.target_type='public_deck' and r.target_id=d.id) reposted_by_me,
   d.repost_count
   from public.public_decks d join public.profiles p on p.user_id=d.owner_id left join public.decks source on source.id=d.source_deck_id where (d.slug=${identifier} or d.source_deck_id::text=${identifier}) and d.status='published' limit 1`;
  const deck=decks[0]; if(!deck||!canViewDeck({user_id:deck.source_user_id,visibility:deck.visibility,deleted_at:deck.deleted_at},session?.user?.id))return null;
  if(!session?.user||session.user.id!==deck.owner_id){await tx`update public.public_decks set view_count=view_count+1 where id=${deck.id}`;deck.view_count=Number(deck.view_count)+1}
  const cardRows=await tx`select c.id,c.position,c.front,c.back,c.content_type,
    (to_jsonb(c)->>'blob_variant')::smallint as blob_variant
    from public.public_deck_cards c where c.public_deck_id=${deck.id} order by c.position`;
  const cards=cardRows.map(card=>({id:String(card.id),position:Number(card.position),front:String(card.front),back:String(card.back),contentType:String(card.content_type),blobVariant:card.blob_variant==null?null:Number(card.blob_variant)}));
  // Deliberately omit correct_index and explanation until the attempt is submitted.
  const questions=await tx`select id,position,question,options,difficulty from public.public_deck_questions where public_deck_id=${deck.id} order by position`;
  const stats=await tx<{completions:number;attempts:number;averageScore:number|null}[]>`select count(distinct user_id)::int completions,count(*)::int attempts,case when count(*)>=5 then round(avg(score::numeric/nullif(total,0))*100,1)::float else null end as "averageScore" from public.public_deck_attempts where public_deck_id=${deck.id}`;
  return {deck:{id:String(deck.id),sourceDeckId:deck.source_deck_id?String(deck.source_deck_id):null,slug:deck.slug,title:deck.title,description:deck.description,tags:deck.tags,language:deck.language,visibility:deck.visibility,isOwner:session?.user?.id===deck.owner_id,version:Number(deck.version),viewCount:Number(deck.view_count),forkCount:Number(deck.fork_count),likeCount:Number(deck.like_count),commentCount:Number(deck.comment_count),repostCount:Number(deck.repost_count),likedByMe:Boolean(deck.liked_by_me),bookmarkedByMe:Boolean(deck.bookmarked_by_me),repostedByMe:Boolean(deck.reposted_by_me),publishedAt:deck.published_at,owner:{username:deck.username,displayName:deck.display_name},cardCount:cards.length,questionCount:questions.length},cards,questions,stats:stats[0]};
 });
 if(!result)return Response.json({error:"Deck publik tidak ditemukan."},{status:404});return Response.json(result,{headers:{"Cache-Control":"no-store"}});
}
