import { NextRequest, NextResponse } from "next/server";
import { ragSql } from "@/lib/rag/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request:NextRequest){
 try{
  const secret=process.env.CRON_SECRET;
  if(!secret||request.headers.get("authorization")!==`Bearer ${secret}`)return NextResponse.json({error:"Unauthorized"},{status:401});
  const sql=ragSql();
  const cleaned=await sql.begin(async tx=>{
   const stale=await tx`select id,user_id,idempotency_key,kind from public.generation_jobs where status in ('queued','running') and created_at<now()-interval '5 minutes' order by created_at limit 100 for update skip locked`;
   for(const job of stale){
    await tx`update public.generation_jobs set status='failed',error_message='This took longer than expected and was stopped. Please try again.',finished_at=now(),completed_at=now() where id=${job.id} and status in ('queued','running')`;
    if(String(job.kind)==="flashcard_generate")await tx`select private.refund_generation_quota_event(${String(job.user_id)},${`flashcard:${String(job.idempotency_key)}`})`;
   }
   return stale.length;
  });
  return NextResponse.json({success:true,cleanedUp:cleaned});
 }catch(error){
  console.error("[jobs/cleanup]",{errorType:error instanceof Error?error.name:"Unknown"});
  return NextResponse.json({success:false,error:"Job cleanup failed."},{status:500});
 }
}
