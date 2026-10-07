import { auth } from "@/lib/auth";
import { ragSql } from "@/lib/rag/db";

export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){
 const {id:slug}=await params,sql=ragSql();
 const session=await auth.api.getSession({headers:request.headers});
 const result=await sql.begin(async tx=>{
  const decks=await tx`select d.id,d.slug,d.title,d.description,d.tags,d.language,d.version,d.view_count,d.fork_count,d.published_at,d.owner_id,p.username,p.display_name
   from public.public_decks d join public.profiles p on p.user_id=d.owner_id where d.slug=${slug} and d.status='published' limit 1`;
  const deck=decks[0]; if(!deck)return null;
  if(!session?.user||session.user.id!==deck.owner_id){await tx`update public.public_decks set view_count=view_count+1 where id=${deck.id}`;deck.view_count=Number(deck.view_count)+1}
  const cards=await tx`select id,position,front,back,content_type from public.public_deck_cards where public_deck_id=${deck.id} order by position`;
  // Deliberately omit correct_index and explanation until the attempt is submitted.
  const questions=await tx`select id,position,question,options,difficulty from public.public_deck_questions where public_deck_id=${deck.id} order by position`;
  const stats=await tx<{completions:number;attempts:number;averageScore:number|null}[]>`select count(distinct user_id)::int completions,count(*)::int attempts,case when count(*)>=5 then round(avg(score::numeric/nullif(total,0))*100,1)::float else null end as "averageScore" from public.public_deck_attempts where public_deck_id=${deck.id}`;
  return {deck:{id:String(deck.id),slug:deck.slug,title:deck.title,description:deck.description,tags:deck.tags,language:deck.language,version:Number(deck.version),viewCount:Number(deck.view_count),forkCount:Number(deck.fork_count),publishedAt:deck.published_at,owner:{username:deck.username,displayName:deck.display_name},cardCount:cards.length,questionCount:questions.length},cards,questions,stats:stats[0]};
 });
 if(!result)return Response.json({error:"Deck publik tidak ditemukan."},{status:404});return Response.json(result,{headers:{"Cache-Control":"no-store"}});
}
