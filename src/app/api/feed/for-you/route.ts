import { ragSql } from "@/lib/rag/db";
import { ragResponseError, sessionUser } from "@/lib/rag/http";
import { decodeForYouCursor, encodeForYouCursor } from "@/lib/feed";
import { rerankFeedCandidates, type RankedFeedCandidate } from "@/lib/feed-ranking";
import { withApiTiming } from "@/lib/api-timing";

const PAGE_SIZE=20;

export async function GET(request:Request){
  return withApiTiming(request,"GET /api/feed/for-you",async time=>{
    try{
      const userId=await time("auth",()=>sessionUser(request));
      const cursorParam=new URL(request.url).searchParams.get("cursor"),cursor=decodeForYouCursor(cursorParam);
      if(cursorParam&&!cursor)return Response.json({error:"Cursor tidak valid."},{status:400});
      const sql=ragSql();
      const candidates=await time("db.rank",()=>sql<RankedFeedCandidate[]>`
        select * from public.get_for_you_feed(
          ${userId},${cursor?.score??null},${cursor?.publishedAt??null},${cursor?.itemType??null},${cursor?.itemId??null},${PAGE_SIZE}
        )
      `);
      const ranked=rerankFeedCandidates(candidates,PAGE_SIZE);
      const postIds=ranked.filter(item=>item.item_type==="post").map(item=>item.item_id);
      const deckIds=ranked.filter(item=>item.item_type==="deck").map(item=>item.item_id);
      const [posts,decks]=await time("db.hydrate",()=>Promise.all([
        postIds.length?sql`select p.id,'post'::text type,p.slug,p.title,coalesce(nullif(p.body,''),p.excerpt) summary,p.tags,p.published_at,p.author_id,pr.username,pr.display_name,coalesce(pr.avatar_url,u.image) avatar_url,p.like_count,p.comment_count,p.repost_count,
          exists(select 1 from public.likes l where l.user_id=${userId} and l.target_type='post' and l.target_id=p.id) liked_by_me,
          exists(select 1 from public.bookmarks b where b.user_id=${userId} and b.target_type='post' and b.target_id=p.id) bookmarked_by_me,
          exists(select 1 from public.reposts r where r.user_id=${userId} and r.target_type='post' and r.target_id=p.id) reposted_by_me,
          coalesce((select json_agg(json_build_object('id',i.id,'url','/api/post-images/'||i.id,'width',i.width,'height',i.height,'altText',i.alt_text) order by i.position) from public.post_images i where i.post_id=p.id),'[]'::json) images,
          case when d.id is null then null else json_build_object('slug',d.slug,'sourceDeckId',d.source_deck_id,'title',d.title,'description',d.description,'tags',d.tags,'color',p.embedded_deck_color) end embedded_deck,null::uuid deck_source_id
          from public.posts p join public.profiles pr on pr.user_id=p.author_id join public."user" u on u.id=pr.user_id left join public.public_decks d on d.id=p.embedded_public_deck_id and d.status='published'
          where p.id in ${sql(postIds)} and p.status='published' and p.deleted_at is null`:Promise.resolve([]),
        deckIds.length?sql`select d.id,'deck'::text type,d.slug,d.title,d.description summary,d.tags,d.published_at,d.owner_id author_id,pr.username,pr.display_name,coalesce(pr.avatar_url,u.image) avatar_url,d.like_count,d.comment_count,d.repost_count,
          exists(select 1 from public.likes l where l.user_id=${userId} and l.target_type='public_deck' and l.target_id=d.id) liked_by_me,
          exists(select 1 from public.bookmarks b where b.user_id=${userId} and b.target_type='public_deck' and b.target_id=d.id) bookmarked_by_me,
          exists(select 1 from public.reposts r where r.user_id=${userId} and r.target_type='public_deck' and r.target_id=d.id) reposted_by_me,
          '[]'::json images,null::json embedded_deck,d.source_deck_id deck_source_id
          from public.public_decks d join public.profiles pr on pr.user_id=d.owner_id join public."user" u on u.id=pr.user_id
          where d.id in ${sql(deckIds)} and d.status='published'`:Promise.resolve([]),
      ]));
      const byKey=new Map([...posts,...decks].map(row=>[`${row.type}:${row.id}`,row]));
      const items=ranked.flatMap(candidate=>{
        const row=byKey.get(`${candidate.item_type}:${candidate.item_id}`);
        return row?[mapItem(row)]:[];
      });
      const boundary=candidates.at(-1);
      return Response.json({items,nextCursor:boundary?encodeForYouCursor({score:Number(boundary.final_score),publishedAt:new Date(boundary.published_at).toISOString(),itemType:boundary.item_type,itemId:String(boundary.item_id)}):null},{headers:{"Cache-Control":"private,no-store"}});
    }catch(error){return ragResponseError(error)}
  });
}

function mapItem(row:Record<string,unknown>){return{id:String(row.id),type:row.type,slug:row.slug,sourceDeckId:row.deck_source_id?String(row.deck_source_id):null,title:row.title,summary:row.summary||"",tags:row.tags||[],publishedAt:row.published_at,author:{username:row.username,displayName:row.display_name,avatarUrl:row.avatar_url},likeCount:Number(row.like_count),commentCount:Number(row.comment_count),repostCount:Number(row.repost_count),likedByMe:Boolean(row.liked_by_me),bookmarkedByMe:Boolean(row.bookmarked_by_me),repostedByMe:Boolean(row.reposted_by_me),images:row.images||[],embeddedDeck:row.embedded_deck}}
