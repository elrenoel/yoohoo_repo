import { randomInt } from "node:crypto";
import { ragSql } from "@/lib/rag/db";
import { RagError, UUID } from "@/lib/rag/core";
import { ragResponseError, sessionUser } from "@/lib/rag/http";
import {
  generateRepresentativeQuiz,
  generateSelectedFlashcards,
  representativeQuizCount,
  type GeneratedFlashcardMaterials,
  type GeneratedQuizQuestion,
  type SelectedKeyword,
  type SourceChunk,
} from "@/lib/rag/materials";
import { claimJob } from "@/lib/jobs";

export const runtime = "nodejs";
export const maxDuration = 300;

const BATCH_SIZE = 6;
const PARALLEL_BATCHES = 3;
// Anggaran waktu di dalam maxDuration (300 dtk): flashcard dulu, sisanya quiz + simpan.
const FLASHCARD_BUDGET_MS = 200_000;
const QUIZ_BUDGET_MS = 275_000;
const FLASHCARD_ATTEMPT_TIMEOUT_MS = 90_000;

function nextBlobVariant(previous?: number) {
  let variant = randomInt(1, 6);
  while (previous !== undefined && variant === previous) {
    variant = randomInt(1, 6);
  }
  return variant;
}

interface JobKeywordRow {
  keyword_id: string;
  document_id: string;
  term: string;
  snippet: string | null;
  chunk_id: string | null;
  content: string | null;
  document_summary: string | null;
  content_language: string | null;
  document_title: string;
}

interface Batch {
  documentId: string;
  documentTitle: string;
  contentLanguage: string;
  keywords: SelectedKeyword[];
  sourceChunks: SourceChunk[];
}

const QUOTA_NOTE = "Your daily quota wasn't used.";

/**
 * Pesan gagal untuk user (notifikasi + toast). Detail teknis (kode HTTP, JSON
 * error Gemini) hanya ke log server, tidak pernah ke UI.
 */
function friendlyAiFailure(errors: unknown[]) {
  const text = errors.map(error => error instanceof Error ? error.message : String(error)).join(" ");
  if (/429|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(text)) {
    return `The AI is getting too many requests right now. Please wait a minute and try again. ${QUOTA_NOTE}`;
  }
  if (/503|UNAVAILABLE|high demand|overloaded/i.test(text)) {
    return `The AI service is very busy right now. Please try again in a few minutes. ${QUOTA_NOTE}`;
  }
  if (/504|502|500|DEADLINE|timed? ?out|timeout|abort|time budget/i.test(text)) {
    return `The AI took too long to respond. Please try again in a few minutes, or pick fewer keywords. ${QUOTA_NOTE}`;
  }
  if (/skipped|usable flashcards/i.test(text)) {
    return `The AI couldn't find enough information in your material for these keywords. Try choosing different keywords. ${QUOTA_NOTE}`;
  }
  return `Something went wrong while creating your flashcards. Please try again. ${QUOTA_NOTE}`;
}

/** Jalankan worker per batch dengan batas paralel; hasil tetap berurutan. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += limit) {
    const wave = items.slice(offset, offset + limit);
    results.push(...await Promise.all(wave.map(fn)));
  }
  return results;
}

type Flashcard = GeneratedFlashcardMaterials["flashcards"][number];
type BatchResult = { flashcards: Flashcard[]; errors: Error[] };

function subBatch(batch: Batch, keywords: SelectedKeyword[]): Batch {
  const chunkIds = new Set(keywords.map(keyword => keyword.chunk_id));
  const sourceChunks = batch.sourceChunks.filter(chunk => chunkIds.has(chunk.chunk_id));
  return { ...batch, keywords, sourceChunks: sourceChunks.length ? sourceChunks : batch.sourceChunks };
}

/**
 * Generate satu batch tanpa pernah melempar error:
 *  - gagal total (mis. 504 karena output terlalu besar) -> belah dua dan coba
 *    tiap paruh paralel, alih-alih mengulang payload besar yang sama;
 *  - AI melewati sebagian keyword -> coba ulang khusus keyword yang terlewat.
 * Keyword yang tetap gagal dicatat di `errors` dan dilewati oleh pemanggil.
 */
async function generateBatch(batch: Batch, deadlineAt: number): Promise<BatchResult> {
  const canRetry = () => batch.keywords.length > 1 && deadlineAt - Date.now() >= 20_000;
  let flashcards: Flashcard[];
  try {
    flashcards = (await generateSelectedFlashcards(batch.sourceChunks, batch.keywords, batch.contentLanguage, {
      deadlineAt,
      timeoutMs: FLASHCARD_ATTEMPT_TIMEOUT_MS,
      maxAttempts: batch.keywords.length > 1 ? 1 : 2,
    })).flashcards;
  } catch (cause) {
    const error = cause instanceof Error ? cause : new Error(String(cause));
    if (!canRetry()) return { flashcards: [], errors: [error] };
    console.warn("[jobs/run] batch failed; splitting", {
      documentId: batch.documentId,
      keywords: batch.keywords.length,
      error: error.message.slice(0, 200),
    });
    const middle = Math.ceil(batch.keywords.length / 2);
    const results = await Promise.all([batch.keywords.slice(0, middle), batch.keywords.slice(middle)]
      .map(keywords => generateBatch(subBatch(batch, keywords), deadlineAt)));
    return { flashcards: results.flatMap(result => result.flashcards), errors: results.flatMap(result => result.errors) };
  }

  const done = new Set(flashcards.map(card => card.keyword_id));
  const missing = batch.keywords.filter(keyword => !done.has(keyword.id));
  if (!missing.length || !canRetry()) {
    return { flashcards, errors: missing.length ? [new Error(`AI skipped ${missing.length} keyword(s)`)] : [] };
  }
  console.warn("[jobs/run] AI skipped keywords; retrying them", { documentId: batch.documentId, missing: missing.length });
  // `missing` selalu lebih kecil dari batch (hasil kosong sudah dilempar), jadi rekursi berhenti.
  const retry = await generateBatch(subBatch(batch, missing), deadlineAt);
  return { flashcards: [...flashcards, ...retry.flashcards], errors: retry.errors };
}

/**
 * POST /api/jobs/:id/run
 * Worker handler untuk job flashcard multi-materi:
 *  1. claim (queued -> running); jika bukan queued, hentikan.
 *  2. Kumpulkan keyword + chunk RAG per materi (baca, di luar transaksi).
 *  3. Panggil Gemini per batch ~10 keyword, paralel maks 3 — DI LUAR transaksi.
 *  4. SATU sql.begin: insert flashcards ON CONFLICT (deck_id, keyword_id)
 *     DO NOTHING + update job 'succeeded'. Gagal -> job 'failed' dengan
 *     pesan batch bermasalah. Notifikasi datang dari trigger yang sudah ada.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const startedAt = Date.now();
  try {
    const userId = await sessionUser(request);
    const rawId = (await context.params).id;
    if (!UUID.test(rawId)) throw new RagError("ID proses tidak valid.");

    const sql = ragSql();
    const [jobBefore] = await sql`
      select id, status, deck_id, kind, input, idempotency_key from public.generation_jobs
      where id=${rawId} and user_id=${userId}`;
    if (!jobBefore) throw new RagError("Proses generate tidak ditemukan.", 404);
    if (String(jobBefore.kind) !== "flashcard_generate") throw new RagError("Jenis proses ini tidak didukung worker ini.", 400);
    if (!jobBefore.deck_id) throw new RagError("Job tidak memiliki meja kerja tujuan.", 400);
    const jobInput = jobBefore.input && typeof jobBefore.input === "object" ? jobBefore.input as { groupName?: unknown; skippedCount?: unknown } : {};
    const requestedGroupName = typeof jobInput.groupName === "string" ? jobInput.groupName.trim().slice(0, 60) : "";
    const skippedCount = Number(jobInput.skippedCount ?? 0) || 0;
    // message = teks ramah untuk user; detail = info teknis, hanya ke log.
    const failCurrent = async (message:string, detail?:string) => {
      if (detail) console.error("[jobs/run] generation failed", { jobId: rawId, detail: detail.slice(0, 2000) });
      await sql.begin(async tx=>{
        await tx`update public.generation_jobs set status='failed',error_message=${message.slice(0,500)},finished_at=now(),completed_at=now() where id=${rawId} and user_id=${userId}`;
        await tx`select private.refund_generation_quota_event(${userId},${`flashcard:${String(jobBefore.idempotency_key)}`})`;
        await tx`update public.notifications set title='Flashcard group could not be created',body=${requestedGroupName ? `"${requestedGroupName}": ${message}` : message}
          where user_id=${userId} and dedupe_key=${`${rawId}:failed`}`;
      });
    };

    // 1. Claim: queued -> running. 0 row = sudah diproses/diakhiri di tempat lain.
    const job = await claimJob(rawId, userId);
    if (!job) {
      const [current] = await sql`select status from public.generation_jobs where id=${rawId}`;
      return Response.json({ success: false, status: String(current?.status ?? "unknown"), error: "Job sudah diklaim atau selesai." }, { status: 409 });
    }

    // 2. Baca keyword + chunk RAG per materi (di luar transaksi).
    const rows = await sql<JobKeywordRow[]>`
      select i.keyword_id, i.document_id, k.term, k.snippet, k.chunk_id,
        c.content, d.document_summary, d.content_language, d.title as document_title
      from public.generation_job_items i
      join public.candidate_keywords k on k.id = i.keyword_id
      join public.documents d on d.id = i.document_id
      left join public.document_chunks c on c.id = k.chunk_id and c.document_id = i.document_id
      where i.job_id = ${rawId} and d.deleted_at is null
      order by i.document_id, i.batch_index, i.keyword_id`;

    if (!rows.length) {
      const message = `The selected keywords are no longer available. Please choose them again. ${QUOTA_NOTE}`;
      await failCurrent(message, "no job items");
      return Response.json({ success: false, status: "failed", error: message }, { status: 409 });
    }

    // Kelompokkan per materi lalu potong per ~10 keyword.
    const byDocument = new Map<string, JobKeywordRow[]>();
    for (const row of rows) {
      const key = String(row.document_id);
      byDocument.set(key, [...(byDocument.get(key) ?? []), row]);
    }
    const batches: Batch[] = [];
    for (const group of byDocument.values()) {
      for (let offset = 0; offset < group.length; offset += BATCH_SIZE) {
        const slice = group.slice(offset, offset + BATCH_SIZE);
        const documentTitle = String(slice[0].document_title);
        const keywords: SelectedKeyword[] = slice.map(row => ({
          id: String(row.keyword_id), term: String(row.term),
          snippet: row.snippet as string | null, chunk_id: String(row.chunk_id ?? ""),
        }));
        // Konteks sumber: chunk RAG keyword; fallback ringkasan dokumen.
        const chunkByKeyword = new Map<string, string>();
        for (const row of slice) {
          const content = row.content ?? row.document_summary ?? "";
          if (row.chunk_id && content) chunkByKeyword.set(String(row.chunk_id), String(content));
        }
        const sourceChunks: SourceChunk[] = [...chunkByKeyword.entries()].map(([chunk_id, content]) => ({ chunk_id, content }));
        if (!sourceChunks.length) {
          const message = `"${documentTitle}" doesn't have enough readable content for some of these keywords. Try other keywords or upload the material again. ${QUOTA_NOTE}`;
          await failCurrent(message, `no source chunks for document ${String(slice[0].document_id)}`);
          return Response.json({ success: false, status: "failed", error: message }, { status: 409 });
        }
        batches.push({
          documentId: String(slice[0].document_id),
          documentTitle,
          contentLanguage: String(slice[0].content_language ?? "auto"),
          keywords,
          sourceChunks,
        });
      }
    }

    // 3. Panggil Gemini per batch, paralel maks 3, DI LUAR transaksi.
    const outcomes = await mapLimit(batches, PARALLEL_BATCHES, batch => generateBatch(batch, startedAt + FLASHCARD_BUDGET_MS));
    const batchErrors = outcomes.flatMap(outcome => outcome.errors);

    // 4. SATU transaksi: insert semua flashcard + tandai job succeeded.
    const deckId = String(job.deck_id);
    const generated = new Map(outcomes.flatMap(outcome=>outcome.flashcards).map(card=>[card.keyword_id,card]));
    let previousBlobVariant: number | undefined;
    const validCards = rows.flatMap(row=>{
      const card=generated.get(String(row.keyword_id));
      if(!card)return[];
      const blobVariant=nextBlobVariant(previousBlobVariant);previousBlobVariant=blobVariant;
      return[{document_id:String(row.document_id),source_document_id:String(row.document_id),deck_id:deckId,keyword_id:String(row.keyword_id),job_id:rawId,term:String(row.term).trim().slice(0,250),definition:card.definition.slice(0,4000),blob_variant:blobVariant}];
    });
    // Sebagian keyword boleh terlewat (materi tidak membahasnya); gagal hanya bila tidak ada kartu sama sekali.
    const uncoveredCount = rows.length - validCards.length;
    if (!validCards.length) {
      const message = friendlyAiFailure(batchErrors);
      await failCurrent(message, `AI produced 0 of ${rows.length} cards: ${batchErrors.map(error => error.message).join(" | ")}`);
      return Response.json({ success: false, status: "failed", error: message }, { status: 500 });
    }
    if (uncoveredCount) {
      console.warn("[jobs/run] saving partial group", { jobId: rawId, created: validCards.length, uncoveredCount,
        errors: batchErrors.map(error => error.message.slice(0, 200)) });
    }

    let groupQuiz: GeneratedQuizQuestion[];
    try {
      groupQuiz = await generateRepresentativeQuiz(
        validCards.map(card => ({ term: card.term, definition: card.definition })),
        representativeQuizCount(validCards.length),
        batches[0]?.contentLanguage ?? "auto",
        [],
        { deadlineAt: startedAt + QUIZ_BUDGET_MS, timeoutMs: FLASHCARD_ATTEMPT_TIMEOUT_MS },
      );
    } catch (error) {
      const message = friendlyAiFailure([error]);
      await failCurrent(message, `quiz: ${error instanceof Error ? error.message : String(error)}`);
      return Response.json({ success: false, status: "failed", error: message }, { status: 500 });
    }

    const inserted = await sql.begin(async tx => {
      await tx`select pg_advisory_xact_lock(hashtextextended(${deckId}, 0))`;
      let groupName = requestedGroupName;
      if (!groupName) {
        const names = await tx`select name from public.flashcard_groups where deck_id=${deckId}`;
        const used = new Set(names.map(row => String(row.name).trim().toLowerCase()));
        let number = names.length + 1;
        while (used.has(`kartu ${number}`)) number += 1;
        groupName = `Cards ${number}`;
      }
      const [group] = await tx`insert into public.flashcard_groups(deck_id,user_id,name) values(${deckId},${userId},${groupName}) returning id,name`;
      let count = 0;
      const [schema] = await tx<{ hasBlobVariant: boolean }[]>`
        select exists (
          select 1 from information_schema.columns
          where table_schema='public' and table_name='flashcards'
            and column_name='blob_variant'
        ) as "hasBlobVariant"`;
      for (let offset = 0; offset < validCards.length; offset += 100) {
        const chunk = validCards.slice(offset, offset + 100).map(card => ({ ...card, group_id: group.id }));
        const rowsInserted = schema?.hasBlobVariant
          ? await tx`
              insert into public.flashcards ${tx(
                chunk, "document_id", "source_document_id", "deck_id", "group_id", "keyword_id", "job_id",
                "term", "definition", "blob_variant"
              )}
              on conflict (group_id, normalized_keyword) do nothing
              returning id`
          : await tx`
              insert into public.flashcards ${tx(
                chunk, "document_id", "source_document_id", "deck_id", "group_id", "keyword_id", "job_id",
                "term", "definition"
              )}
              on conflict (group_id, normalized_keyword) do nothing
              returning id`;
        count += rowsInserted.length;
      }

      const sourceDocumentId = validCards[0].source_document_id;
      const [quizSet] = await tx`insert into public.quiz_sets(document_id,group_id,label,job_id)
        values(null,${group.id},${groupName},${rawId}) returning id`;
      for (const question of groupQuiz) {
        await tx`insert into public.quiz_questions(document_id,quiz_set_id,question,options,correct_index,explanation,difficulty)
          values(${sourceDocumentId},${quizSet.id},${question.question},${tx.json(question.options)},${question.correct_index},${question.explanation},${question.difficulty})`;
      }
      const quizCount = groupQuiz.length;
      await tx`update public.generation_job_items set status='completed', updated_at=now()
        where job_id=${rawId} and status <> 'completed'`;
      const [updated] = await tx`
        update public.generation_jobs
        set status='succeeded', finished_at=now(), completed_at=now(),
            flashcard_count=flashcard_count + ${count},
            quiz_count=quiz_count + ${quizCount},
            result=${tx.json({ groupId: String(group.id), groupName, flashcardCount: count, quizCount, skippedCount, uncoveredCount, quizSetId: String(quizSet.id) })}
        where id=${rawId} and user_id=${userId} and status='running'
        returning id`;
      if (!updated) throw new Error("Job tidak lagi berstatus running.");
      await tx`update public.notifications set title='Flashcard group ready',body=${`${groupName}: ${count} cards created${skippedCount ? `; ${skippedCount} duplicates skipped` : ""}${uncoveredCount ? `; ${uncoveredCount} keyword${uncoveredCount === 1 ? " was" : "s were"} skipped because the material didn't cover ${uncoveredCount === 1 ? "it" : "them"}` : ""}.`},link=${`/desk/${deckId}`}
        where user_id=${userId} and dedupe_key=${`${rawId}:succeeded`}`;
      return { groupId: String(group.id), groupName, flashcardCount: count, quizCount, skippedCount, uncoveredCount, quizSetId: String(quizSet.id) };
    }).catch(async error => {
      const message = `Your flashcards were created but couldn't be saved. Please try again. ${QUOTA_NOTE}`;
      await failCurrent(message, `save: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    });

    return Response.json({ success: true, status: "succeeded", jobId: rawId, ...inserted });
  } catch (error) {
    return ragResponseError(error);
  }
}
