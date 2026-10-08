import{ragSql}from"@/lib/rag/db";import{ragResponseError,sessionUser}from"@/lib/rag/http";
export async function GET(request:Request){
 try{
  const userId=await sessionUser(request),tab=new URL(request.url).searchParams.get("tab")==="post"?"post":"public_deck",sql=ragSql();
  const rows=tab==="post"
   ?await sql`select p.id,p.slug,p.title,p.excerpt summary,p.like_count,p.comment_count,b.created_at,exists(select 1 from public.reposts r where r.user_id=${userId} and r.target_type='post' and r.target_id=p.id) reposted_by_me from public.bookmarks b join public.posts p on p.id=b.target_id and b.target_type='post' where b.user_id=${userId} and p.status='published' and p.deleted_at is null order by b.created_at desc`
   :await sql`select d.id,d.slug,d.title,d.description summary,d.like_count,d.comment_count,b.created_at,exists(select 1 from public.reposts r where r.user_id=${userId} and r.target_type='public_deck' and r.target_id=d.id) reposted_by_me from public.bookmarks b join public.public_decks d on d.id=b.target_id and b.target_type='public_deck' where b.user_id=${userId} and d.status='published' order by b.created_at desc`;
  return Response.json({items:rows.map(row=>({...row,type:tab,bookmarkedByMe:true,repostedByMe:Boolean(row.reposted_by_me)}))});
 }catch(e){return ragResponseError(e)}
}
