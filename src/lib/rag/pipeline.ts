import { randomUUID } from "node:crypto";
import { ragSql } from "./db";
import { normalizeTerm, type Chunk, type Keyword } from "./core";

export interface Job { documentId: string; userId: string }
export interface ChunkJob extends Job { chunkId: string }
export async function ownedDocument(job: Job) {
  const [doc] = await ragSql()`select id,status,storage_path,file_size from public.documents
    where id=${job.documentId} and user_id=${job.userId} and deleted_at is null and storage_path is not null`;
  return doc;
}
export async function failDocument(job: Job, message: string) {
  await ragSql()`update public.documents set status='failed',error_message=${message}
    where id=${job.documentId} and user_id=${job.userId} and status not in ('ready_for_selection','failed') and deleted_at is null`;
}
export async function saveChunks(job: Job, pageCount: number, chunks: Chunk[]) {
  return ragSql().begin(async sql => {
    const [doc] = await sql`select id,status from public.documents where id=${job.documentId} and user_id=${job.userId} and deleted_at is null for update`;
    if (!doc || doc.status === "failed" || doc.status === "ready_for_selection") return [];
    const existing = await sql`select id from public.document_chunks where document_id=${job.documentId} order by chunk_index`;
    if (existing.length) return existing.map(c => String(c.id));
    const rows = chunks.map(c => ({ id: randomUUID(), document_id: job.documentId, chunk_index: c.chunkIndex,
      page_start: c.pageStart, page_end: c.pageEnd, content: c.content, scan_pages: sql.json(c.scanPages) }));
    // Keep protocol parameter count bounded even for thousands of pages.
    for (let offset = 0; offset < rows.length; offset += 100) {
      await sql`insert into public.document_chunks ${sql(rows.slice(offset, offset + 100), "id", "document_id", "chunk_index", "page_start", "page_end", "content", "scan_pages")}`;
    }
    await sql`update public.documents set page_count=${pageCount},status='indexing',error_message=null where id=${job.documentId} and user_id=${job.userId}`;
    return rows.map(c => c.id);
  });
}
export async function loadChunk(job: ChunkJob) {
  const [chunk] = await ragSql()`select c.*,d.storage_path from public.document_chunks c join public.documents d on d.id=c.document_id
    where c.id=${job.chunkId} and d.id=${job.documentId} and d.user_id=${job.userId} and d.deleted_at is null and d.status='indexing'`;
  return chunk;
}
export async function finishChunk(job: ChunkJob, keywords: Keyword[], error: string | null) {
  await ragSql().begin(async sql => {
    // Parent lock also serializes finalization and protects against deletion mid-write.
    const [doc] = await sql`select id from public.documents where id=${job.documentId} and user_id=${job.userId}
      and deleted_at is null and status='indexing' for update`;
    if (!doc) return;
    const [chunk] = await sql`select id,processed_at from public.document_chunks where id=${job.chunkId} and document_id=${job.documentId} for update`;
    if (!chunk || chunk.processed_at) return;
    for (const keyword of keywords) {
      await sql`insert into public.candidate_keywords (document_id,chunk_id,term,snippet)
        values (${job.documentId},${job.chunkId},${keyword.term},${keyword.snippet})`;
    }
    await sql`update public.document_chunks set processed_at=now(),processing_error=${error} where id=${job.chunkId} and document_id=${job.documentId}`;
  });
}
export async function finalizeDocument(job: Job) {
  return ragSql().begin(async sql => {
    const [doc] = await sql`select id,status from public.documents where id=${job.documentId} and user_id=${job.userId} and deleted_at is null for update`;
    if (!doc || doc.status === "ready_for_selection" || doc.status === "failed") return;
    const [progress] = await sql`select count(*)::int as total,count(processed_at)::int as completed,
      count(*) filter(where processing_error is not null)::int as skipped from public.document_chunks where document_id=${job.documentId}`;
    if (!progress.total || progress.total !== progress.completed) throw new Error("Chunks have not all completed");
    const keywords = await sql`select id,term from public.candidate_keywords where document_id=${job.documentId} order by created_at,id`;
    const seen = new Set<string>(), duplicates: string[] = [];
    for (const row of keywords) {
      const key = normalizeTerm(row.term);
      if (seen.has(key)) duplicates.push(row.id); else seen.add(key);
    }
    if (duplicates.length) await sql`delete from public.candidate_keywords where document_id=${job.documentId} and id=any(${sql.array(duplicates)}::uuid[])`;
    const message = !seen.size ? "Tidak ada keyword yang berhasil diekstrak. Coba PDF lain atau unggah ulang."
      : progress.skipped ? `${progress.skipped} dari ${progress.total} chunk gagal diproses. Hasil yang tersedia ditampilkan.` : null;
    await sql`update public.documents set status=${seen.size ? "ready_for_selection" : "failed"},error_message=${message}
      where id=${job.documentId} and user_id=${job.userId}`;
    return { keywordCount: seen.size, skipped: progress.skipped };
  });
}
