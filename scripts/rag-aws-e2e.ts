import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { samplePdf } from "./rag-fixture";

dotenv.config({ path: ".env.local", quiet: true });

const TERMINAL = new Set(["ready_for_selection", "failed"]);

async function main() {
  const [{ ragSql, closeRagSql }, { dispatchDocument, pdfKey }] = await Promise.all([
    import("../src/lib/rag/db"),
    import("../src/lib/rag/storage"),
  ]);
  const bucket = process.env.RAG_BUCKET_NAME;
  const region = process.env.AWS_REGION;
  assert.ok(bucket, "RAG_BUCKET_NAME is required");
  assert.ok(region, "AWS_REGION is required");

  const sql = ragSql();
  const s3 = new S3Client({ region, requestChecksumCalculation: "WHEN_REQUIRED" });
  const userId = `rag-aws-e2e-${randomUUID()}`;
  const documentId = randomUUID();
  const storagePath = pdfKey(userId, documentId);
  const markerPath = `ready/${documentId}.json`;
  const pdf = samplePdf();
  let userCreated = false;

  try {
    await sql`insert into public."user" (id,name,email,email_verified,created_at,updated_at)
      values (${userId},'RAG AWS E2E test',${userId + "@example.invalid"},false,now(),now())`;
    userCreated = true;
    await sql`insert into public.documents (id,user_id,title,raw_text,storage_path,file_size,status)
      values (${documentId},${userId},'RAG AWS E2E test','',${storagePath},${pdf.byteLength},'uploaded')`;
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: storagePath,
      Body: pdf,
      ContentType: "application/pdf",
    }));
    await dispatchDocument(documentId, userId);

    const deadline = Date.now() + 15 * 60_000;
    let lastProgress = "";
    while (Date.now() < deadline) {
      const [document] = await sql`select status,page_count,error_message from public.documents
        where id=${documentId} and user_id=${userId}`;
      assert.ok(document, "test document disappeared during workflow");
      const [progress] = await sql`select count(*)::int as total,
        count(*) filter (where processed_at is not null)::int as completed
        from public.document_chunks where document_id=${documentId}`;
      const summary = `${document.status} ${progress.completed}/${progress.total}`;
      if (summary !== lastProgress) {
        console.log(`RAG AWS E2E: ${summary}`);
        lastProgress = summary;
      }
      if (TERMINAL.has(document.status)) {
        if (document.status === "failed") throw new Error(document.error_message || "RAG workflow failed");
        const keywords = await sql`select term from public.candidate_keywords
          where document_id=${documentId} order by created_at,id`;
        assert.ok(keywords.length > 0, "workflow completed without candidate keywords");
        console.log(`RAG AWS E2E passed: ${document.page_count} page, ${progress.total} chunk, ${keywords.length} keywords`);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
    throw new Error("RAG AWS E2E timed out after 15 minutes");
  } finally {
    try {
      if (userCreated) {
        await sql`delete from public.documents where id=${documentId} and user_id=${userId}`;
        await sql`delete from public."user" where id=${userId} and email=${userId + "@example.invalid"}`;
      }
      await s3.send(new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: [{ Key: storagePath }, { Key: markerPath }], Quiet: true },
      }));
    } finally {
      await closeRagSql();
      s3.destroy();
    }
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown RAG AWS E2E error");
  process.exitCode = 1;
});
