import { randomUUID } from "node:crypto";
import { ragSql } from "./db";
import { isSnippetEcho, normalizeTerm, type Chunk, type Keyword } from "./core";
import { embedKeywordTexts } from "./ai";

export interface Job { documentId: string; userId: string }
export interface ChunkJob extends Job { chunkId: string }
type RelationKeyword = { id: string; term: string; snippet: string | null; chunkId: string | null; chunkIndex: number | null };

function termMentioned(text: string, term: string) {
  const value = term.trim();
  if (value.length <= 3) return false;
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(text);
}

function buildKeywordRelations(documentId: string, keywords: RelationKeyword[]) {
  const relations = new Map<string, { document_id: string; from_keyword_id: string; to_keyword_id: string; relation_type: "mentioned" | "co_occurs" }>();
  const add = (from: string, to: string, relationType: "mentioned" | "co_occurs") => {
    if (from === to) return;
    const key = `${from}:${to}`;
    const existing = relations.get(key);
    if (!existing || relationType === "mentioned") {
      relations.set(key, { document_id: documentId, from_keyword_id: from, to_keyword_id: to, relation_type: relationType });
    }
  };

  for (const source of keywords) {
    const snippet = source.snippet ?? "";
    for (const target of keywords) {
      if (termMentioned(snippet, target.term)) add(source.id, target.id, "mentioned");
    }
  }

  for (let index = 0; index < keywords.length; index += 1) {
    for (let next = index + 1; next < keywords.length; next += 1) {
      const left = keywords[index], right = keywords[next];
      const sameChunk = Boolean(left.chunkId && right.chunkId && left.chunkId === right.chunkId);
      const adjacent = left.chunkIndex !== null && right.chunkIndex !== null && Math.abs(left.chunkIndex - right.chunkIndex) <= 1;
      if (sameChunk || adjacent) add(left.id, right.id, "co_occurs");
    }
  }
  return [...relations.values()];
}
export async function ownedDocument(job: Job) {
  const [doc] = await ragSql()`select id,title,status,storage_path,file_size,document_summary from public.documents
    where id=${job.documentId} and user_id=${job.userId} and deleted_at is null and storage_path is not null`;
  return doc;
}
export async function failDocument(job: Job, message: string) {
  await ragSql()`update public.documents set status='failed',error_message=${message}
    where id=${job.documentId} and user_id=${job.userId} and status not in ('ready_for_selection','failed') and deleted_at is null`;
}
export async function saveChunks(job: Job, pageCount: number, chunks: Chunk[], documentSummary: string) {
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
    await sql`update public.documents set page_count=${pageCount},document_summary=${documentSummary},status='indexing',error_message=null where id=${job.documentId} and user_id=${job.userId}`;
    return rows.map(c => c.id);
  });
}
export async function loadChunk(job: ChunkJob) {
  const [chunk] = await ragSql()`select c.*,d.storage_path,d.document_summary from public.document_chunks c join public.documents d on d.id=c.document_id
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
  const result = await ragSql().begin(async sql => {
    const [doc] = await sql`select id,status from public.documents where id=${job.documentId} and user_id=${job.userId} and deleted_at is null for update`;
    if (!doc || doc.status === "ready_for_selection" || doc.status === "failed") return;
    const [progress] = await sql`select count(*)::int as total,count(processed_at)::int as completed,
      count(*) filter(where processing_error is not null)::int as skipped from public.document_chunks where document_id=${job.documentId}`;
    if (!progress.total || progress.total !== progress.completed) throw new Error("Chunks have not all completed");
    const keywords = await sql`select k.id,k.term,k.snippet,k.chunk_id as "chunkId",c.chunk_index as "chunkIndex"
      from public.candidate_keywords k left join public.document_chunks c on c.id=k.chunk_id
      where k.document_id=${job.documentId} order by k.created_at,k.id`;
    const seen = new Set<string>(), discarded: string[] = [], echoed: string[] = [];
    for (const row of keywords) {
      const key = normalizeTerm(row.term);
      if (isSnippetEcho(String(row.term), String(row.snippet ?? ""))) {
        discarded.push(row.id); echoed.push(row.id);
      } else if (seen.has(key)) discarded.push(row.id); else seen.add(key);
    }
    if (discarded.length) await sql`delete from public.candidate_keywords where document_id=${job.documentId} and id=any(${sql.array(discarded)}::uuid[])`;
    if (echoed.length) console.warn("[RAG finalizer] discarded low-quality keyword snippets", {
      documentId: job.documentId, discardedCount: echoed.length,
    });
    const survivingKeywords = keywords.filter(row => !discarded.includes(String(row.id))).map(row => ({
      id: String(row.id), term: String(row.term), snippet: row.snippet as string | null,
      chunkId: row.chunkId ? String(row.chunkId) : null, chunkIndex: row.chunkIndex === null ? null : Number(row.chunkIndex),
    }));
    const relations = buildKeywordRelations(job.documentId, survivingKeywords);
    await sql`delete from public.keyword_relations where document_id=${job.documentId}`;
    for (let offset = 0; offset < relations.length; offset += 200) {
      const batch = relations.slice(offset, offset + 200);
      await sql`insert into public.keyword_relations ${sql(batch, "document_id", "from_keyword_id", "to_keyword_id", "relation_type")}
        on conflict do update set relation_type=excluded.relation_type`;
    }
    const message = !seen.size ? "Tidak ada keyword yang berhasil diekstrak. Coba PDF lain atau unggah ulang."
      : progress.skipped ? `${progress.skipped} dari ${progress.total} chunk gagal diproses. Hasil yang tersedia ditampilkan.` : null;
    // Keep the document in indexing state while embeddings are generated. This
    // prevents the UI from showing an apparently complete map with no edges.
    if (!seen.size) await sql`update public.documents set status='failed',error_message=${message}
      where id=${job.documentId} and user_id=${job.userId}`;
    return { keywordCount: seen.size, skipped: progress.skipped, keywordIds: survivingKeywords.map(k => k.id) };
  });

  if (!result || !result.keywordCount) return result;
  try {
    await embedAndRelateKeywords(job.documentId, result.keywordIds);
  } catch (error) {
    // Keyword extraction remains useful even when the optional embedding API
    // is unavailable or rate-limited. The failure is observable in logs and
    // can be retried by the backfill helper.
    console.warn("[RAG] semantic keyword relation step failed", {
      documentId: job.documentId,
      errorType: error instanceof Error ? error.name : "Unknown",
      message: error instanceof Error ? error.message : String(error),
    });
  }
  const message = result.skipped ? `${result.skipped} chunk gagal diproses. Hasil yang tersedia ditampilkan.` : null;
  await ragSql()`update public.documents set status='ready_for_selection',error_message=${message}
    where id=${job.documentId} and user_id=${job.userId} and status='indexing'`;
  return { keywordCount: result.keywordCount, skipped: result.skipped };
}

const embeddingBatchSize = 80;
const semanticThreshold = () => {
  const value = Number(process.env.SEMANTIC_RELATION_THRESHOLD ?? "0.78");
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.78;
};
const semanticTopK = () => {
  const value = Number(process.env.SEMANTIC_RELATION_TOP_K ?? "5");
  return Number.isFinite(value) ? Math.max(1, Math.min(20, Math.floor(value))) : 5;
};

/** Generate missing vectors and create cross-document semantic edges. */
export async function embedAndRelateKeywords(documentId: string, keywordIds?: string[]) {
  const sql = ragSql();
  const missing = await sql`select id,term,snippet from public.candidate_keywords
    where document_id=${documentId} and embedding is null
    ${keywordIds?.length ? sql`and id=any(${sql.array(keywordIds)}::uuid[])` : sql``}
    order by created_at,id`;
  for (let offset = 0; offset < missing.length; offset += embeddingBatchSize) {
    const batch = missing.slice(offset, offset + embeddingBatchSize);
    const vectors = await embedKeywordTexts(batch.map(row => `${row.term}\n${row.snippet ?? ""}`));
    await sql.begin(async tx => {
      for (let index = 0; index < batch.length; index += 1) {
        const literal = `[${vectors[index].join(",")}]`;
        await tx`update public.candidate_keywords set embedding=${literal}::extensions.vector
          where id=${batch[index].id} and embedding is null`;
      }
    });
  }

  const current = await sql`select k.id from public.candidate_keywords k
    where k.document_id=${documentId} and k.embedding is not null
    ${keywordIds?.length ? sql`and k.id=any(${sql.array(keywordIds)}::uuid[])` : sql``}`;
  const ids = current.map(row => String(row.id));
  if (!ids.length) return { embedded: 0, relations: 0 };
  await sql`delete from public.keyword_relations
    where relation_type='semantic' and (from_keyword_id=any(${sql.array(ids)}::uuid[])
      or to_keyword_id=any(${sql.array(ids)}::uuid[]))`;

  const threshold = semanticThreshold();
  const topK = semanticTopK();
  const relationRows: Array<{ deck_id: string; document_id: string; from_keyword_id: string; to_keyword_id: string; relation_type: "semantic" }> = [];
  for (const id of ids) {
    const matches = await sql`select source.document_id as source_document_id, source.id as source_id,
        existing.document_id as existing_document_id, existing.id as existing_id, dd.deck_id,
        1 - (source.embedding <=> existing.embedding) as similarity
      from public.candidate_keywords source
      join public.deck_documents dd on dd.document_id=source.document_id
      join public.candidate_keywords existing on existing.embedding is not null and existing.id<>source.id
      join public.deck_documents existing_dd on existing_dd.deck_id=dd.deck_id and existing_dd.document_id=existing.document_id
      where source.id=${id} and 1 - (source.embedding <=> existing.embedding) >= ${threshold}
      order by source.embedding <=> existing.embedding asc limit ${topK}`;
    for (const match of matches) {
      relationRows.push({ deck_id: String(match.deck_id), document_id: String(match.source_document_id), from_keyword_id: String(match.source_id), to_keyword_id: String(match.existing_id), relation_type: "semantic" });
      relationRows.push({ deck_id: String(match.deck_id), document_id: String(match.existing_document_id), from_keyword_id: String(match.existing_id), to_keyword_id: String(match.source_id), relation_type: "semantic" });
    }
  }
  for (let offset = 0; offset < relationRows.length; offset += 200) {
    const batch = relationRows.slice(offset, offset + 200);
    await sql`insert into public.keyword_relations as existing ${sql(batch, "deck_id", "document_id", "from_keyword_id", "to_keyword_id", "relation_type")}
      on conflict do update set
        deck_id=coalesce(existing.deck_id, excluded.deck_id),
        relation_type=case when existing.relation_type in ('mentioned','co_occurs')
          then existing.relation_type else excluded.relation_type end`;
  }
  return { embedded: ids.length, relations: relationRows.length };
}
