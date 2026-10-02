import { readPdf } from "../src/lib/rag/storage";
import { renderScanPages } from "../src/lib/rag/pdf";
import { extractKeywords } from "../src/lib/rag/ai";
import { finishChunk, loadChunk, type ChunkJob } from "../src/lib/rag/pipeline";
import type { Keyword } from "../src/lib/rag/core";
import { generateSelectedFlashcards } from "../src/lib/rag/materials";
import { finishGenerationBatch, loadGenerationBatch, type GenerationBatchJob } from "../src/lib/rag/generation";
import { classifyCoreKeywordsForDocument } from "../src/lib/rag/core-keywords";

interface CoreClassificationJob { mode: "classify-core"; documentId: string; userId: string }

function isGenerationBatchJob(job: ChunkJob | GenerationBatchJob | CoreClassificationJob): job is GenerationBatchJob {
  return "mode" in job && job.mode === "generate";
}

export async function handler(job: ChunkJob | GenerationBatchJob | CoreClassificationJob) {
  if ("mode" in job && job.mode === "classify-core") {
    const results = await classifyCoreKeywordsForDocument(job.documentId, job.userId);
    return { done: true, decks: results };
  }
  if (isGenerationBatchJob(job)) {
    const item = await loadGenerationBatch(job);
    if (!item || item.status === "completed") return { done: true };
    const materials = await generateSelectedFlashcards(item.sourceChunks, item.keywords, String(item.content_language ?? "auto"));
    await finishGenerationBatch(job, materials);
    return { done: true, generated: materials.flashcards.length };
  }
  const chunk = await loadChunk(job);
  if (!chunk || chunk.processed_at) return { done: true };
  let keywords: Keyword[] = [], failure: string | null = null;
  try {
    const images = chunk.scan_pages.length ? await renderScanPages(await readPdf(chunk.storage_path), chunk.scan_pages) : [];
    keywords = await extractKeywords(chunk.content, images, String(chunk.document_summary ?? ""));
  } catch (error) {
    failure = "Ekstraksi keyword gagal setelah fallback model atau rendering PDF gagal.";
    console.warn("[RAG worker] skipping chunk", { chunkId: job.chunkId, errorType: error instanceof Error ? error.name : "Unknown" });
  }
  // DB failures propagate so Step Functions retries. AI failures are persisted and skipped.
  await finishChunk(job, keywords, failure);
  return { done: true, skipped: !!failure };
}
