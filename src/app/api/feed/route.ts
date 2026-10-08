import{ragSql}from"@/lib/rag/db";import{ragResponseError,sessionUser}from"@/lib/rag/http";import{decodeCursor,encodeCursor}from"@/lib/feed";import{withApiTiming}from"@/lib/api-timing";
export async function GET(request:Request){return withApiTiming(request,"GET /api/feed",async time=>{try{const userId=await time("auth",()=>sessionUser(request)),cursorParam=new URL(request.url).searchParams.get("cursor"),cursor=decodeCursor(cursorParam);if(cursorParam&&!cursor)return Response.json({error:"Cursor tidak valid."},{status:400});const sql=ragSql(),following=await time("db.following",()=>sql<{count:number}[]>`select count(*)::int count from public.follows where follower_id=${userId}`);if(!(following[0]?.count??0))return Response.json({items:[],nextCursor:null,hasFollowing:false});const rows=await time("db.feed",()=>sql`
with feed_items as(
 select p.id,'post'::text type,p.slug,p.title,coalesce(nullif(p.body,''),p.excerpt) summary,p.tags,p.published_at,pr.username,pr.display_name,coalesce(pr.avatar_url,u.image) avatar_url,p.like_count,p.comment_count,p.repost_count,
  exists(select 1 from public.likes l where l.user_id=${userId} and l.target_type='post' and l.target_id=p.id) liked_by_me,
  exists(select 1 from public.bookmarks b where b.user_id=${userId} and b.target_type='post' and b.target_id=p.id) bookmarked_by_me,
  exists(select 1 from public.reposts r where r.user_id=${userId} and r.target_type='post' and r.target_id=p.id) reposted_by_me,
  coalesce((select json_agg(json_build_object('id',i.id,'url','/api/post-images/'||i.id,'width',i.width,'height',i.height,'altText',i.alt_text) order by i.position) from public.post_images i where i.post_id=p.id),'[]'::json) images,
  case when d.id is null then null else json_build_object('slug',d.slug,'sourceDeckId',d.source_deck_id,'title',d.title,'description',d.description,'tags',d.tags,'color',p.embedded_deck_color) end embedded_deck,0::int stat_count,d.source_deck_id deck_source_id
 from public.posts p join public.follows f on f.following_id=p.author_id and f.follower_id=${userId} join public.profiles pr on pr.user_id=p.author_id join public."user" u on u.id=pr.user_id left join public.public_decks d on d.id=p.embedded_public_deck_id and d.status='published'
 where p.status='published' and p.deleted_at is null
 union all
 select d.id,'deck',d.slug,d.title,d.description,d.tags,d.published_at,pr.username,pr.display_name,coalesce(pr.avatar_url,u.image) avatar_url,d.like_count,d.comment_count,d.repost_count,
  exists(select 1 from public.likes l where l.user_id=${userId} and l.target_type='public_deck' and l.target_id=d.id) liked_by_me,
  exists(select 1 from public.bookmarks b where b.user_id=${userId} and b.target_type='public_deck' and b.target_id=d.id) bookmarked_by_me,
  exists(select 1 from public.reposts r where r.user_id=${userId} and r.target_type='public_deck' and r.target_id=d.id) reposted_by_me,
  '[]'::json,null::json,d.fork_count::int,d.source_deck_id deck_source_id
 from public.public_decks d join public.follows f on f.following_id=d.owner_id and f.follower_id=${userId} join public.profiles pr on pr.user_id=d.owner_id join public."user" u on u.id=pr.user_id
 where d.status='published' and not exists(select 1 from public.posts p where p.embedded_public_deck_id=d.id and p.status='published' and p.deleted_at is null)
)select * from feed_items ${cursor?sql`where(published_at,id)<(${cursor.publishedAt},${cursor.id})`:sql``} order by published_at desc,id desc limit 21`);
const page=rows.slice(0,20),last=rows.length>20?page.at(-1):null;return Response.json({items:page.map(mapItem),nextCursor:last?encodeCursor({publishedAt:new Date(last.published_at).toISOString(),id:String(last.id)}):null,hasFollowing:true})}catch(error){return ragResponseError(error)}})}
function mapItem(r:Record<string,unknown>){return{id:String(r.id),type:r.type,slug:r.slug,sourceDeckId:r.deck_source_id?String(r.deck_source_id):null,title:r.title,summary:r.summary||"",tags:r.tags||[],publishedAt:r.published_at,author:{username:r.username,displayName:r.display_name,avatarUrl:r.avatar_url},statCount:Number(r.stat_count),likeCount:Number(r.like_count),commentCount:Number(r.comment_count),repostCount:Number(r.repost_count),likedByMe:Boolean(r.liked_by_me),bookmarkedByMe:Boolean(r.bookmarked_by_me),repostedByMe:Boolean(r.reposted_by_me),images:r.images||[],embeddedDeck:r.embedded_deck}}
