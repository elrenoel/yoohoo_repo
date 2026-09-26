import { failDocument, finalizeDocument, finishChunk, type Job, type ChunkJob } from "../src/lib/rag/pipeline";
import type { S3Event } from "aws-lambda";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { bucket, s3 } from "../src/lib/rag/storage";
import { generateRepresentativeQuiz } from "../src/lib/rag/materials";
import { failGenerationBatch, failGenerationJob, finalizeGenerationJob, loadGenerationFlashcardsForQuiz, type GenerationJob } from "../src/lib/rag/generation";
type FinalizeEvent = Job & { failed?: boolean; skippedChunkId?: string };
type GenerationEvent = GenerationJob & { failed?: boolean; failedBatchId?: string };
export async function handler(input: FinalizeEvent | GenerationEvent | { detail: { input: string } } | { requestPayload: S3Event }) {
  if ("requestPayload" in input) {
    for (const record of input.requestPayload.Records) {
      const key = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
      if (record.s3.bucket.name !== bucket() || !/^ready\/[0-9a-f-]+\.json$/.test(key)) throw new Error("Invalid failed event");
      const marker = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
      const job = JSON.parse(await marker.Body!.transformToString()) as Job;
      await failDocument(job, "Orkestrator gagal setelah retry. Silakan unggah ulang.");
    }
    return { failed: true };
  }
  const event: FinalizeEvent | GenerationEvent = "detail" in input ? { ...JSON.parse(input.detail.input), failed: true } : input;
  if ("mode" in event && event.mode === "generate") {
    if (event.failedBatchId) {
      await failGenerationBatch({ ...event, batchId: event.failedBatchId }, "Pembuatan materi gagal setelah beberapa percobaan.");
      return { failed: true };
    }
    if (event.failed) {
      await failGenerationJob(event, "Pembuatan materi gagal setelah beberapa percobaan.");
      return { failed: true };
    }
    const staged = await loadGenerationFlashcardsForQuiz(event);
    if (!staged) return { done: true };
    const questions = await generateRepresentativeQuiz(staged.flashcards, staged.expectedQuizCount, staged.contentLanguage);
    return await finalizeGenerationJob(event, questions) ?? { done: true };
  }
  if ("skippedChunkId" in event && event.skippedChunkId) {
    const job: ChunkJob = { ...event, chunkId: event.skippedChunkId };
    await finishChunk(job, [], "Worker timeout atau gagal setelah retry.");
    return { skipped: true };
  }
  if (event.failed) {
    await failDocument(event, "Pipeline gagal setelah retry. Silakan unggah ulang.");
    return { failed: true };
  }
  return await finalizeDocument(event) ?? { done: true };
}
