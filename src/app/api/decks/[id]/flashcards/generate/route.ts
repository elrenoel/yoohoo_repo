import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { POST as runJob } from "@/app/api/jobs/[id]/run/route";
import { DAILY_LIMIT } from "@/lib/daily-limit";
import { RagError } from "@/lib/rag/core";
import { ragSql } from "@/lib/rag/db";
import { documentId, jsonBody, sessionUser } from "@/lib/rag/http";
import { generateFlashcardsRequestSchema, type GenerateFlashcardsErrorCode, type GenerateFlashcardsErrorResponse } from "@/types/deck-keywords";

export const runtime = "nodejs";
export const maxDuration = 300;
const READY_STATUSES = ["ready_for_selection", "ready", "completed"];

class GenerateError extends Error {
  constructor(message:string,readonly code:GenerateFlashcardsErrorCode,readonly status:number,readonly details?:unknown){super(message)}
}
function errorResponse(error:string,code:GenerateFlashcardsErrorCode,status:number,details?:unknown){
  const body:GenerateFlashcardsErrorResponse={error,code,...(details===undefined?{}:{details})};
  return Response.json(body,{status});
}
function dbField(error:unknown,key:string){return typeof error==="object"&&error!==null&&key in error?String((error as Record<string,unknown>)[key]):""}

export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 try{
  const userId=await sessionUser(request),deckId=documentId((await context.params).id);
  const parsed=generateFlashcardsRequestSchema.safeParse(await jsonBody(request));
  if(!parsed.success)throw new GenerateError(parsed.error.issues[0]?.message??"Permintaan generate tidak valid.","INVALID_SELECTION",400,parsed.error.flatten());
  const{groupName="",idempotencyKey,selections}=parsed.data;
  const documentIds=[...new Set(selections.map(item=>item.document_id))],keywordIds=[...new Set(selections.flatMap(item=>item.keyword_ids))];
  if(!documentIds.length||!keywordIds.length)throw new GenerateError("Pilih setidaknya satu keyword dari satu materi.","INVALID_SELECTION",400);
  const sql=ragSql();
  const[prior]=await sql`select id,status from public.generation_jobs where user_id=${userId} and idempotency_key=${idempotencyKey}`;
  if(prior)throw new GenerateError("Permintaan generate ini sudah pernah dikirim.","DUPLICATE_REQUEST",409,{jobId:String(prior.id),status:String(prior.status)});

  const result=await sql.begin(async tx=>{
   const[deck]=await tx`select id from public.decks where id=${deckId} and user_id=${userId} and deleted_at is null for update`;
   if(!deck)throw new GenerateError("Deck tidak ditemukan.","DECK_NOT_FOUND",404);

   const staleJobs=await tx`select id,user_id,idempotency_key from public.generation_jobs where deck_id=${deckId} and status in ('queued','running') and created_at<now()-interval '5 minutes' for update`;
   for(const stale of staleJobs){
    await tx`update public.generation_jobs set status='failed',error_message='This took longer than expected and was stopped. Please try again. Your daily quota wasn''t used.',finished_at=now(),completed_at=now() where id=${stale.id}`;
    await tx`select private.refund_generation_quota_event(${String(stale.user_id)},${`flashcard:${String(stale.idempotency_key)}`})`;
   }
   const[active]=await tx`select id,status from public.generation_jobs where deck_id=${deckId} and status in ('queued','running') limit 1`;
   if(active)throw new GenerateError("Masih ada proses generate aktif untuk deck ini.","ACTIVE_JOB_EXISTS",409,{jobId:String(active.id),status:String(active.status)});

   const docs=await tx`select d.id,d.status from public.deck_documents dd join public.documents d on d.id=dd.document_id where dd.deck_id=${deckId} and d.user_id=${userId} and d.deleted_at is null and d.id=any(${tx.array(documentIds)}::uuid[])`;
   if(docs.length!==documentIds.length)throw new GenerateError("Ada materi yang tidak ditemukan di deck ini.","MATERIAL_NOT_FOUND",404);
   if(docs.some(doc=>!READY_STATUSES.includes(String(doc.status))))throw new GenerateError("Ada materi yang belum selesai diproses.","MATERIAL_NOT_READY",409);
   const keywords=await tx`select k.id,k.document_id,k.term from public.candidate_keywords k join public.documents d on d.id=k.document_id where k.id=any(${tx.array(keywordIds)}::uuid[]) and k.document_id=any(${tx.array(documentIds)}::uuid[]) and d.user_id=${userId} and d.deleted_at is null`;
   if(keywords.length!==keywordIds.length)throw new GenerateError("Ada keyword yang tidak ditemukan pada materi terpilih.","INVALID_SELECTION",400);
   const pairs=new Set(selections.flatMap(item=>item.keyword_ids.map(keywordId=>`${item.document_id}:${keywordId}`)));
   if(keywords.some(keyword=>!pairs.has(`${String(keyword.document_id)}:${String(keyword.id)}`)))throw new GenerateError("Pasangan materi dan keyword tidak valid.","INVALID_SELECTION",400);

   const seen=new Set<string>();
   const unique=keywords.filter(keyword=>{const normalized=String(keyword.term).trim().toLowerCase();if(seen.has(normalized))return false;seen.add(normalized);return true});
   if(!unique.length)throw new GenerateError("Tidak ada keyword unik untuk dibuat.","INVALID_SELECTION",400);
   const skippedCount=keywords.length-unique.length;
   const normalizedSelections=documentIds.flatMap(docId=>{const ids=unique.filter(keyword=>String(keyword.document_id)===docId).map(keyword=>String(keyword.id));return ids.length?[{document_id:docId,keyword_ids:ids}]:[]});
   const eventKey=`flashcard:${idempotencyKey}`;
   const[quota]=await tx`select * from private.consume_generation_quota_event(${userId},${eventKey},'flashcard_generate',${DAILY_LIMIT},${null})`;
   const[job]=await tx`insert into public.generation_jobs(id,user_id,kind,status,deck_id,document_id,input,idempotency_key,selected_keyword_ids,expected_items,quota_count,remaining_quota,attempts) values(${randomUUID()},${userId},'flashcard_generate','queued',${deckId},null,${tx.json({groupName:groupName||null,selections:normalizedSelections,skippedCount})},${idempotencyKey},${tx.array(unique.map(keyword=>String(keyword.id)))}::uuid[],${unique.length},${Number(quota.new_count)},${Number(quota.remaining)},0) returning id,status`;
   await tx`update public.generation_quota_events set job_id=${job.id},deck_id=${deckId} where user_id=${userId} and event_key=${eventKey}`;
   const items=unique.map((keyword,index)=>({job_id:job.id as string,document_id:String(keyword.document_id),keyword_id:String(keyword.id),batch_index:index+1}));
   await tx`insert into public.generation_job_items ${tx(items,"job_id","document_id","keyword_id","batch_index")} on conflict do nothing`;
   return{jobId:String(job.id),status:String(job.status),keywordCount:unique.length,documentCount:documentIds.length,skippedCount};
  });
  after(async()=>{try{await runJob(new Request(new URL(`/api/jobs/${result.jobId}/run`,request.url),{method:"POST",headers:request.headers}),{params:Promise.resolve({id:result.jobId})})}catch{/* cleanup handles stalled jobs */}});
  return Response.json({success:true,...result,message:`${result.keywordCount} flashcard sedang dibuat.${result.skippedCount?` ${result.skippedCount} keyword duplikat dilewati.`:""}`},{status:202});
 }catch(error){
  if(error instanceof GenerateError)return errorResponse(error.message,error.code,error.status,error.details);
  if(error instanceof z.ZodError)return errorResponse("Permintaan generate tidak valid.","INVALID_REQUEST",400,error.flatten());
  if(error instanceof RagError)return errorResponse(error.message,"INVALID_REQUEST",error.status);
  const message=error instanceof Error?error.message:"";
  if(message.includes("DAILY_LIMIT_REACHED"))return errorResponse("Kuota generate hari ini sudah habis.","QUOTA_EXCEEDED",429);
  if(dbField(error,"code")==="23505"){
   const constraint=dbField(error,"constraint_name")||dbField(error,"constraint");
   return constraint==="uq_generation_jobs_active_per_deck"
    ?errorResponse("Masih ada proses generate aktif untuk deck ini.","ACTIVE_JOB_EXISTS",409)
    :errorResponse("Permintaan generate ini sudah pernah dikirim.","DUPLICATE_REQUEST",409);
  }
  console.error("[flashcard-generate]",{errorType:error instanceof Error?error.name:"Unknown",code:dbField(error,"code")});
  return errorResponse("Flashcard tidak dapat dibuat. Coba lagi beberapa saat lagi.","INTERNAL_ERROR",500);
 }
}
