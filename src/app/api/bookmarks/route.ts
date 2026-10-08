import{ZodError}from"zod";import{ragSql}from"@/lib/rag/db";import{jsonBody,ragResponseError,sessionUser}from"@/lib/rag/http";import{targetSchema}from"@/lib/social";import{withApiTiming}from"@/lib/api-timing";
import{interactionNotificationCopy,interactionNotificationKey,shouldCreateInteractionNotification}from"@/lib/interaction-notifications";
export async function GET(request:Request){return withApiTiming(request,"GET /api/bookmarks",async time=>{try{const userId=await time("auth",()=>sessionUser(request)),u=new URL(request.url),input=targetSchema.parse({targetType:u.searchParams.get("targetType"),targetId:u.searchParams.get("targetId")}),rows=await time("db.bookmarks",()=>ragSql()`select exists(select 1 from public.bookmarks where user_id=${userId} and target_type=${input.targetType} and target_id=${input.targetId}) bookmarked`);return Response.json({bookmarked:rows[0].bookmarked})}catch(e){if(e instanceof ZodError)return Response.json({error:"Target tidak valid."},{status:400});return ragResponseError(e)}})}
async function mutate(request:Request,remove:boolean){
 try{
  const userId=await sessionUser(request),input=targetSchema.parse(await jsonBody(request)),sql=ragSql();
  const result=await sql.begin(async tx=>{
   const targets=input.targetType==="post"
    ?await tx`select author_id owner_id,slug,title from public.posts where id=${input.targetId} and status='published' and deleted_at is null for update`
    :await tx`select owner_id,slug,title from public.public_decks where id=${input.targetId} and status='published' for update`;
   const target=targets[0];
   if(!target)return null;
   const dedupeKey=interactionNotificationKey(userId,"save",input.targetType,input.targetId);
   if(remove){
    const deleted=await tx`delete from public.bookmarks where user_id=${userId} and target_type=${input.targetType} and target_id=${input.targetId} returning target_id`;
    if(deleted[0])await tx`delete from public.notifications where dedupe_key=${dedupeKey} and actor_id=${userId} and type='save'`;
   }else{
    const inserted=await tx`insert into public.bookmarks(user_id,target_type,target_id) values(${userId},${input.targetType},${input.targetId}) on conflict do nothing returning target_id`;
    if(inserted[0]&&shouldCreateInteractionNotification(String(target.owner_id),userId)){
     const[actor]=await tx`select coalesce(p.display_name,u.name,'Seseorang') display_name from public."user" u left join public.profiles p on p.user_id=u.id where u.id=${userId}`;
     const title=interactionNotificationCopy(String(actor?.display_name??"Seseorang"),"save",input.targetType);
     await tx`insert into public.notifications(user_id,actor_id,type,severity,title,body,link,target_type,target_id,dedupe_key)
      values(${target.owner_id},${userId},'save','info',${title},${title},${`/${input.targetType==="post"?"p":"d"}/${target.slug}`},${input.targetType},${input.targetId},${dedupeKey})
      on conflict(dedupe_key) do nothing`;
    }
   }
   return{bookmarked:!remove};
  });
  return result?Response.json(result):Response.json({error:"Konten tidak ditemukan."},{status:404});
 }catch(e){if(e instanceof ZodError)return Response.json({error:"Target tidak valid."},{status:400});return ragResponseError(e)}
}
export function PUT(r:Request){return mutate(r,false)}export function POST(r:Request){return mutate(r,false)}export function DELETE(r:Request){return mutate(r,true)}
