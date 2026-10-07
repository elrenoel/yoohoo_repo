import{ragSql}from"@/lib/rag/db";import{ragResponseError,sessionUser}from"@/lib/rag/http";import{decodeCursor,encodeCursor}from"@/lib/feed";
export async function GET(request:Request){try{const userId=await sessionUser(request),cursorParam=new URL(request.url).searchParams.get("cursor"),cursor=decodeCursor(cursorParam);if(cursorParam&&!cursor)return Response.json({error:"Cursor tidak valid."},{status:400});const sql=ragSql(),following=await sql<{count:number}[]>`select count(*)::int count from public.follows where follower_id=${userId}`;if(!(following[0]?.count??0))return Response.json({items:[],nextCursor:null,hasFollowing:false});const rows=await sql`
with feed_items as(
 select p.id,'post'::text type,p.slug,p.title,coalesce(nullif(p.body,''),p.excerpt) summary,p.tags,p.published_at,pr.username,pr.display_name,pr.avatar_url,p.like_count,p.comment_count,
  coalesce((select json_agg(json_build_object('id',i.id,'url','/api/post-images/'||i.id,'width',i.width,'height',i.height,'altText',i.alt_text) order by i.position) from public.post_images i where i.post_id=p.id),'[]'::json) images,
  case when d.id is null then null else json_build_object('slug',d.slug,'title',d.title,'description',d.description,'tags',d.tags) end embedded_deck,0::int stat_count
 from public.posts p join public.follows f on f.following_id=p.author_id and f.follower_id=${userId} join public.profiles pr on pr.user_id=p.author_id left join public.public_decks d on d.id=p.embedded_public_deck_id and d.status='published'
 where p.status='published' and p.deleted_at is null
 union all
 select d.id,'deck',d.slug,d.title,d.description,d.tags,d.published_at,pr.username,pr.display_name,pr.avatar_url,d.like_count,d.comment_count,'[]'::json,null::json,d.fork_count::int
 from public.public_decks d join public.follows f on f.following_id=d.owner_id and f.follower_id=${userId} join public.profiles pr on pr.user_id=d.owner_id
 where d.status='published' and not exists(select 1 from public.posts p where p.embedded_public_deck_id=d.id and p.status='published' and p.deleted_at is null)
)select * from feed_items ${cursor?sql`where(published_at,id)<(${cursor.publishedAt},${cursor.id})`:sql``} order by published_at desc,id desc limit 21`;
const page=rows.slice(0,20),last=rows.length>20?page.at(-1):null;return Response.json({items:page.map(mapItem),nextCursor:last?encodeCursor({publishedAt:new Date(last.published_at).toISOString(),id:String(last.id)}):null,hasFollowing:true})}catch(error){return ragResponseError(error)}}
function mapItem(r:Record<string,unknown>){return{id:String(r.id),type:r.type,slug:r.slug,title:r.title,summary:r.summary||"",tags:r.tags||[],publishedAt:r.published_at,author:{username:r.username,displayName:r.display_name,avatarUrl:r.avatar_url},statCount:Number(r.stat_count),likeCount:Number(r.like_count),commentCount:Number(r.comment_count),images:r.images||[],embeddedDeck:r.embedded_deck}}
