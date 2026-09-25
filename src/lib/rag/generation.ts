import { ragSql } from "./db";
import type { GeneratedChunkMaterials, SelectedKeyword } from "./materials";

export interface GenerationJob {
  mode: "generate";
  jobId: string;
  documentId: string;
  userId: string;
}

export interface GenerationChunkJob extends GenerationJob {
  chunkId: string;
}

export async function loadGenerationChunk(job: GenerationChunkJob) {
  return ragSql().begin(async sql => {
    const [item] = await sql`select i.id,i.status,c.content,d.content_language
      from public.generation_job_items i
      join public.generation_jobs j on j.id=i.job_id
      join public.document_chunks c on c.id=i.chunk_id and c.document_id=j.document_id
      join public.documents d on d.id=j.document_id
      where i.job_id=${job.jobId} and i.chunk_id=${job.chunkId}
        and j.document_id=${job.documentId} and j.user_id=${job.userId}
        and d.user_id=${job.userId} and d.deleted_at is null
      for update of i`;
    if (!item || item.status === "completed") return item;
    if (item.status === "failed") throw new Error("Generation item already failed");
    const keywords = await sql`select k.id,k.term,k.snippet
      from public.candidate_keywords k
      join public.generation_jobs j on j.id=${job.jobId}
      where k.document_id=${job.documentId} and k.chunk_id=${job.chunkId}
        and k.id=any(j.selected_keyword_ids) order by k.created_at,k.id`;
    if (!keywords.length) throw new Error("No selected keywords for generation item");
    await sql`update public.generation_job_items set status='processing',updated_at=now()
      where job_id=${job.jobId} and chunk_id=${job.chunkId}`;
    await sql`update public.generation_jobs set status='processing',started_at=coalesce(started_at,now())
      where id=${job.jobId} and status='queued'`;
    return { ...item, keywords: keywords as unknown as SelectedKeyword[] };
  });
}

export async function finishGenerationChunk(job: GenerationChunkJob, result: GeneratedChunkMaterials) {
  await ragSql()`update public.generation_job_items set status='completed',flashcards=${ragSql().json(result.flashcards)},
    questions=${ragSql().json(result.questions)},error_message=null,updated_at=now()
    where job_id=${job.jobId} and chunk_id=${job.chunkId} and status <> 'completed'`;
}

export async function failGenerationChunk(job: GenerationChunkJob, message: string) {
  await ragSql().begin(async sql => {
    await sql`update public.generation_job_items set status='failed',error_message=${message},updated_at=now()
      where job_id=${job.jobId} and chunk_id=${job.chunkId} and status <> 'completed'`;
    await sql`update public.generation_jobs set status='failed',error_message=${message},completed_at=now()
      where id=${job.jobId} and document_id=${job.documentId} and user_id=${job.userId} and status <> 'completed'`;
  });
}

export async function failGenerationJob(job: GenerationJob, message: string) {
  await ragSql()`update public.generation_jobs set status='failed',error_message=${message},completed_at=now()
    where id=${job.jobId} and document_id=${job.documentId} and user_id=${job.userId} and status <> 'completed'`;
}

export async function finalizeGenerationJob(job: GenerationJob) {
  const [result] = await ragSql()`select private.complete_selected_content_generation(${job.jobId}::uuid) as result`;
  return result?.result;
}
