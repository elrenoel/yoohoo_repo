import{ragSql}from"@/lib/rag/db";
import{deleteStoredObject}from"@/lib/rag/storage";

export const dynamic="force-dynamic";
export const maxDuration=30;
const CLEANUP_LIMIT=50;

async function cleanup(request:Request){
 const startedAt=Date.now(),secret=process.env.CRON_SECRET,authorization=request.headers.get("authorization");
 if(!secret||authorization!==`Bearer ${secret}`)return Response.json({error:"Unauthorized"},{status:401});
 try{
  const rows=await ragSql()`with candidates as(
    select id from public.post_images
    where post_id is null and created_at<now()-interval '24 hours'
    order by created_at asc
    limit ${CLEANUP_LIMIT}
    for update skip locked
   )
   delete from public.post_images image using candidates
   where image.id=candidates.id
   returning image.storage_path`;
  await Promise.all(rows.map(row=>deleteStoredObject(String(row.storage_path))));
  const durationMs=Date.now()-startedAt;
  console.info("[post-images/cleanup] completed",{deleted:rows.length,durationMs,limit:CLEANUP_LIMIT});
  return Response.json({success:true,deleted:rows.length,durationMs,limit:CLEANUP_LIMIT});
 }catch(error){
  const durationMs=Date.now()-startedAt;
  console.error("[post-images/cleanup] failed",{durationMs,error:error instanceof Error?error.message:"unknown"});
  return Response.json({success:false,error:"Cleanup gagal.",durationMs},{status:500});
 }
}

export const GET=cleanup;
export const POST=cleanup;
