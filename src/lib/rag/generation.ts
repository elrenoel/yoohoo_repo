import { ragSql } from "./db";
import { representativeQuizCount, type GeneratedFlashcardMaterials, type GeneratedQuizQuestion, type SelectedKeyword, type SourceChunk } from "./materials";

export interface GenerationJob {
  mode: "generate";
  jobId: string;
  documentId: string;
  userId: string;
}

export interface GenerationBatchJob extends GenerationJob {
  batchId: string;
}

export async function loadGenerationBatch(job: GenerationBatchJob) {
  return ragSql().begin(async sql => {
    const [item] = await sql`select i.id,i.status,i.keyword_ids,d.content_language
      from public.generation_job_items i
      join public.generation_jobs j on j.id=i.job_id
      join public.documents d on d.id=j.document_id
      where i.id=${job.batchId} and i.job_id=${job.jobId}
        and j.document_id=${job.documentId} and j.user_id=${job.userId}
        and d.user_id=${job.userId} and d.deleted_at is null
      for update of i`;
    if (!item || item.status === "completed") return item;
    if (item.status === "failed") throw new Error("Generation item already failed");
    const keywordIds = Array.isArray(item.keyword_ids)
      ? item.keyword_ids.map(String)
      : [];
    if (!keywordIds.length) throw new Error("Generation item has no keyword IDs");
    if (keywordIds.length > 10) throw new Error("Generation item exceeds batch limit");
    const keywordIdArray = sql.array(keywordIds);
    const keywords = await sql`select k.id,k.term,k.snippet,k.chunk_id,c.content
      from public.candidate_keywords k
      join public.document_chunks c on c.id=k.chunk_id and c.document_id=k.document_id
      where k.document_id=${job.documentId} and k.id=any(${keywordIdArray}::uuid[])
      order by array_position(${keywordIdArray}::uuid[], k.id)`;
    if (!keywords.length) throw new Error("No selected keywords for generation item");
    await sql`update public.generation_job_items set status='processing',updated_at=now()
      where id=${job.batchId} and job_id=${job.jobId}`;
    await sql`update public.generation_jobs set status='processing',started_at=coalesce(started_at,now())
      where id=${job.jobId} and status='queued'`;
    const sourceChunks = [...new Map(keywords.map(keyword => [String(keyword.chunk_id), {
      chunk_id: String(keyword.chunk_id), content: String(keyword.content),
    }])).values()];
    return { ...item,
      keywords: keywords.map(keyword => ({ id: String(keyword.id), term: String(keyword.term), snippet: keyword.snippet as string | null, chunk_id: String(keyword.chunk_id) })) as SelectedKeyword[],
      sourceChunks: sourceChunks as SourceChunk[],
    };
  });
}

export async function finishGenerationBatch(job: GenerationBatchJob, result: GeneratedFlashcardMaterials) {
  await ragSql()`update public.generation_job_items set status='completed',flashcards=${ragSql().json(result.flashcards)},
    questions=null,error_message=null,updated_at=now()
    where id=${job.batchId} and job_id=${job.jobId} and status <> 'completed'`;
}

export async function failGenerationBatch(job: GenerationBatchJob, message: string) {
  await ragSql().begin(async sql => {
    await sql`update public.generation_job_items set status='failed',error_message=${message},updated_at=now()
      where id=${job.batchId} and job_id=${job.jobId} and status <> 'completed'`;
    await sql`update public.generation_jobs set status='failed',error_message=${message},completed_at=now()
      where id=${job.jobId} and document_id=${job.documentId} and user_id=${job.userId} and status <> 'completed'`;
  });
}

export async function failGenerationJob(job: GenerationJob, message: string) {
  await ragSql()`update public.generation_jobs set status='failed',error_message=${message},completed_at=now()
    where id=${job.jobId} and document_id=${job.documentId} and user_id=${job.userId} and status <> 'completed'`;
}

export async function loadGenerationFlashcardsForQuiz(job: GenerationJob) {
  const [generation] = await ragSql()`select j.status,j.selected_keyword_ids,d.content_language
    from public.generation_jobs j join public.documents d on d.id=j.document_id
    where j.id=${job.jobId} and j.document_id=${job.documentId} and j.user_id=${job.userId}
      and d.user_id=${job.userId} and d.deleted_at is null`;
  if (!generation || generation.status === "completed") return null;
  if (generation.status === "failed") throw new Error("Generation job already failed");
  const selectedKeywordIds = Array.isArray(generation.selected_keyword_ids) ? generation.selected_keyword_ids : [];
  if (!selectedKeywordIds.length) throw new Error("Generation job has no selected keywords");
  const items = await ragSql()`select flashcards from public.generation_job_items
    where job_id=${job.jobId} and status='completed' order by batch_index,id`;
  const flashcards = items.flatMap(item => Array.isArray(item.flashcards) ? item.flashcards : [])
    .flatMap((card): { term: string; definition: string }[] => {
      if (!card || typeof card !== "object") return [];
      const value = card as { term?: unknown; definition?: unknown };
      return typeof value.term === "string" && typeof value.definition === "string"
        ? [{ term: value.term, definition: value.definition }]
        : [];
    });
  if (!flashcards.length) throw new Error("Generation job has no staged flashcards");
  return { flashcards, expectedQuizCount: representativeQuizCount(selectedKeywordIds.length), contentLanguage: String(generation.content_language ?? "auto") };
}

export async function finalizeGenerationJob(job: GenerationJob, questions: GeneratedQuizQuestion[]) {
  // JSON round-trip narrows the validated domain objects to postgres.js's JSON value type.
  const payload = JSON.parse(JSON.stringify(questions));
  const [result] = await ragSql()`select private.complete_selected_content_generation(${job.jobId}::uuid,${ragSql().json(payload)}::jsonb) as result`;
  return result?.result;
}
