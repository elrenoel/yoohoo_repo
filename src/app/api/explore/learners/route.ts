import { auth } from "@/lib/auth";
import { getLearnersToDiscover } from "@/lib/explore-server";

export async function GET(request:Request){
  const session=await auth.api.getSession({headers:request.headers});
  const rows=await getLearnersToDiscover(session?.user?.id??"");
  return Response.json({items:rows.map(row=>({id:String(row.id),type:"people",slug:row.slug,title:row.title,summary:row.summary||"",tags:[],publishedAt:new Date(row.published_at).toISOString(),author:{username:row.username,displayName:row.display_name,avatarUrl:row.avatar_url},completionCount:0,averageScore:null,popularity:Number(row.popularity)}))},{headers:{"Cache-Control":"private, max-age=60"}});
}
