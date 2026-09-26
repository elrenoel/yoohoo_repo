import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import { ragSql, closeRagSql } from "../src/lib/rag/db";
import { saveChunks, loadChunk, finishChunk, finalizeDocument } from "../src/lib/rag/pipeline";
dotenv.config({ path: ".env.local", quiet: true });

test("live database: idempotency, ownership, dedupe and failure progress", { skip: process.env.RAG_DB_TEST !== "1" }, async () => {
  const sql = ragSql(), userId = `rag-test-${randomUUID()}`, documentId = randomUUID(), job = { userId, documentId };
  let created = false;
  try {
    await sql`insert into public."user" (id,name,email,email_verified,created_at,updated_at)
      values (${userId},'RAG integration test',${userId + "@example.invalid"},false,now(),now())`;
    created = true;
    await sql`insert into public.documents (id,user_id,title,raw_text,storage_path,file_size,status)
      values (${documentId},${userId},'RAG integration test','',${'test-only/' + documentId},100,'chunking')`;
    const chunks = [{ chunkIndex: 0, pageStart: 1, pageEnd: 5, content: "Complete original text", scanPages: [2] },
      { chunkIndex: 1, pageStart: 6, pageEnd: 6, content: "Remaining original text", scanPages: [] }];
    const overview = "Dokumen latihan yang membahas konsep manajemen memori sistem operasi.";
    const ids = await saveChunks(job, 6, chunks, overview);
    assert.deepEqual(await saveChunks(job, 6, chunks, overview), ids, "duplicate orchestrator preserves chunk IDs");
    const first = await loadChunk({ ...job, chunkId: ids[0] });
    assert.deepEqual(first.scan_pages, [2], "scan pages are JSON array, not JSON string");
    assert.equal(await loadChunk({ ...job, userId: "other-user", chunkId: ids[0] }), undefined);
    await finishChunk({ ...job, userId: "other-user", chunkId: ids[0] }, [{ term: "Forbidden", snippet: "Cross-user write" }], null);
    const keywords = [{ term: "Paging", snippet: "Memory divided into pages" }];
    await Promise.all([finishChunk({ ...job, chunkId: ids[0] }, keywords, null), finishChunk({ ...job, chunkId: ids[0] }, keywords, null)]);
    await finishChunk({ ...job, chunkId: ids[1] }, [{ term: " paging ", snippet: "Duplicate keyword from next page" }, { term: "TLB", snippet: "Address translation cache" }], null);
    assert.deepEqual(await finalizeDocument(job), { keywordCount: 2, skipped: 0 });
    await finalizeDocument(job); // Safe replay.
    const [{ count }] = await sql`select count(*)::int as count from public.candidate_keywords where document_id=${documentId}`;
    assert.equal(count, 2);
    const [{ status }] = await sql`select status from public.documents where id=${documentId}`;
    assert.equal(status, "ready_for_selection");
    // Reuse only this fixture to exercise all-failed completion and incomplete guards.
    await sql`delete from public.candidate_keywords where document_id=${documentId}`;
    await sql`update public.documents set status='indexing' where id=${documentId} and user_id=${userId}`;
    await sql`update public.document_chunks set processed_at=null where document_id=${documentId}`;
    await assert.rejects(() => finalizeDocument(job), /not all completed/);
    for (const chunkId of ids) await finishChunk({ ...job, chunkId }, [], "Simulated invalid AI JSON");
    assert.deepEqual(await finalizeDocument(job), { keywordCount: 0, skipped: 2 });
    const [failed] = await sql`select status,error_message from public.documents where id=${documentId}`;
    assert.equal(failed.status, "failed");
    assert.ok(failed.error_message);
  } finally {
    // Delete only this run's generated fixture. Never enumerate or delete real users.
    try {
      if (created) {
        await sql`delete from public.documents where id=${documentId} and user_id=${userId}`;
        await sql`delete from public."user" where id=${userId} and email=${userId + "@example.invalid"}`;
      }
    } finally { await closeRagSql(); }
  }
});
