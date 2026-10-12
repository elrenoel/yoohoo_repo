import { getFeaturedPost } from "@/lib/explore-server";

export async function GET(){
  const row=await getFeaturedPost();
  if(!row)return Response.json({item:null});
  return Response.json({item:{id:String(row.id),type:"post",slug:row.slug,title:row.title,summary:row.summary||"",tags:row.tags||[],publishedAt:new Date(row.published_at).toISOString(),author:{username:row.username,displayName:row.display_name,avatarUrl:row.avatar_url},completionCount:0,averageScore:null,popularity:Number(row.popularity)}},{headers:{"Cache-Control":"public, max-age=60, stale-while-revalidate=300"}});
}
