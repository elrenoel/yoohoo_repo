import type { S3Event } from "aws-lambda";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { bucket, s3, readPdf, pdfKey } from "../src/lib/rag/storage";
import { extractChunks } from "../src/lib/rag/pdf";
import { summarizeDocument } from "../src/lib/rag/ai";
import { ragSql } from "../src/lib/rag/db";
import { failDocument, ownedDocument, saveChunks, type Job } from "../src/lib/rag/pipeline";
import { UUID } from "../src/lib/rag/core";

export async function handler(event: S3Event) {
  for (const record of event.Records) {
    if (record.s3.bucket.name !== bucket()) throw new Error("Unexpected bucket");
    const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    if (!/^ready\/[0-9a-f-]+\.json$/.test(key)) throw new Error("Unexpected event key");
    const marker = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
    if ((marker.ContentLength ?? 0) > 4096) throw new Error("Invalid marker size");
    const job = JSON.parse(await marker.Body!.transformToString()) as Job;
    if (!UUID.test(job.documentId) || typeof job.userId !== "string" || key !== `ready/${job.documentId}.json`) throw new Error("Invalid marker");
    const doc = await ownedDocument(job);
    if (!doc || ["ready_for_selection", "failed"].includes(doc.status)) continue;
    if (doc.storage_path !== pdfKey(job.userId, job.documentId)) throw new Error("Object ownership mismatch");
    let ids: string[];
    if (doc.status === "indexing") {
      const rows = await ragSql()`select c.id from public.document_chunks c join public.documents d on d.id=c.document_id
        where d.id=${job.documentId} and d.user_id=${job.userId} and d.deleted_at is null order by c.chunk_index`;
      ids = rows.map(row => row.id);
    } else {
      await ragSql()`update public.documents set status='chunking' where id=${job.documentId} and user_id=${job.userId} and status='uploaded' and deleted_at is null`;
      try {
        const result = await extractChunks(await readPdf(doc.storage_path));
        // Generate this once before the Map fan-out; workers reload it from Postgres.
        const documentSummary = await summarizeDocument(String(doc.title), result.pages);
        ids = await saveChunks(job, result.pageCount, result.chunks, documentSummary);
      } catch (error) {
        console.error("[RAG orchestrator] extraction failed", { documentId: job.documentId, errorType: error instanceof Error ? error.name : "Unknown" });
        await failDocument(job, "PDF tidak dapat diproses. Periksa apakah file rusak, terenkripsi, atau melebihi 6.000 halaman.");
        continue;
      }
    }
    if (!ids.length) continue;
    // Deterministic execution name makes duplicate S3 notifications safe.
    try {
      await new SFNClient({}).send(new StartExecutionCommand({ stateMachineArn: process.env.RAG_STATE_MACHINE_ARN,
        name: job.documentId, input: JSON.stringify({ mode: "keywords", ...job, chunkIds: ids }) }));
    } catch (error) {
      if (!(error instanceof Error && error.name === "ExecutionAlreadyExists")) throw error;
    }
  }
}
