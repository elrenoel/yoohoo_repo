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

const BATCH_SIZE = 10;
const PARALLEL_BATCHES = 3;

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

/** Jalankan worker per batch dengan batas paralel; hasil tetap berurutan. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let offset = 0; offset < items.length; offset += limit) {
    const wave = items.slice(offset, offset + limit);
    results.push(...await Promise.all(wave.map(fn)));
  }
  return results;
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
    const failCurrent = async (message:string) => {
      await sql.begin(async tx=>{
        await tx`update public.generation_jobs set status='failed',error_message=${message.slice(0,500)},finished_at=now(),completed_at=now() where id=${rawId} and user_id=${userId}`;
        await tx`select private.refund_generation_quota_event(${userId},${`flashcard:${String(jobBefore.idempotency_key)}`})`;
        await tx`update public.notifications set title='Flashcard group could not be created',body=${`${requestedGroupName || "New flashcard group"}: ${message}`}
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
      await failCurrent("Tidak ada keyword untuk diproses.");
      return Response.json({ success: false, status: "failed", error: "Tidak ada keyword untuk diproses." }, { status: 409 });
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
          const message = `Materi "${documentTitle}" tidak memiliki konteks sumber (chunk RAG) untuk batch ini.`;
          await failCurrent(message);
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
    type BatchOutcome = { batch: Batch; result: GeneratedFlashcardMaterials } | { batch: Batch; error: Error };
    let outcomes: BatchOutcome[];
    try {
      outcomes = await mapLimit(batches, PARALLEL_BATCHES, async batch => {
        try {
          const result = await generateSelectedFlashcards(batch.sourceChunks, batch.keywords, batch.contentLanguage);
          return { batch, result } as BatchOutcome;
        } catch (error) {
          return { batch, error: error instanceof Error ? error : new Error(String(error)) } as BatchOutcome;
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await failCurrent(`Gagal memanggil AI: ${message}`.slice(0, 500));
      return Response.json({ success: false, status: "failed", error: "Gagal memanggil AI." }, { status: 500 });
    }

    const failed = outcomes.filter((o): o is { batch: Batch; error: Error } => "error" in o);
    if (failed.length) {
      const detail = failed.slice(0, 3).map(f => `Materi "${f.batch.documentTitle}": ${f.error.message}`).join(" | ");
      const message = `Gagal membuat flashcard — ${failed.length} batch bermasalah. ${detail}`.slice(0, 500);
      await failCurrent(message);
      return Response.json({ success: false, status: "failed", error: message }, { status: 500 });
    }

    // 4. SATU transaksi: insert semua flashcard + tandai job succeeded.
    const deckId = String(job.deck_id);
    const generated = new Map((outcomes as { batch: Batch; result: GeneratedFlashcardMaterials }[])
      .flatMap(outcome=>outcome.result.flashcards).map(card=>[card.keyword_id,card]));
    let previousBlobVariant: number | undefined;
    const validCards = rows.flatMap(row=>{
      const card=generated.get(String(row.keyword_id));
      if(!card)return[];
      const blobVariant=nextBlobVariant(previousBlobVariant);previousBlobVariant=blobVariant;
      return[{document_id:String(row.document_id),source_document_id:String(row.document_id),deck_id:deckId,keyword_id:String(row.keyword_id),job_id:rawId,term:String(row.term).trim().slice(0,250),definition:card.definition.slice(0,4000),blob_variant:blobVariant}];
    });
    if (validCards.length !== rows.length) {
      const message = `AI hanya menghasilkan ${validCards.length} dari ${rows.length} kartu. Tidak ada data yang disimpan.`;
      await failCurrent(message);
      return Response.json({ success: false, status: "failed", error: message }, { status: 500 });
    }

    let groupQuiz: GeneratedQuizQuestion[];
    try {
      groupQuiz = await generateRepresentativeQuiz(
        validCards.map(card => ({ term: card.term, definition: card.definition })),
        representativeQuizCount(validCards.length),
        batches[0]?.contentLanguage ?? "auto",
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Quiz untuk grup gagal dibuat: ${detail}. Tidak ada data yang disimpan.`.slice(0, 500);
      await failCurrent(message);
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
            result=${tx.json({ groupId: String(group.id), groupName, flashcardCount: count, quizCount, skippedCount, quizSetId: String(quizSet.id) })}
        where id=${rawId} and user_id=${userId} and status='running'
        returning id`;
      if (!updated) throw new Error("Job tidak lagi berstatus running.");
      await tx`update public.notifications set title='Flashcard group ready',body=${`${groupName}: ${count} cards created${skippedCount ? `; ${skippedCount} duplicates skipped` : ""}.`},link=${`/desk/${deckId}`}
        where user_id=${userId} and dedupe_key=${`${rawId}:succeeded`}`;
      return { groupId: String(group.id), groupName, flashcardCount: count, quizCount, skippedCount, quizSetId: String(quizSet.id) };
    }).catch(async error => {
      const message = `Penyimpanan flashcard gagal: ${error instanceof Error ? error.message : String(error)}`.slice(0, 500);
      await failCurrent(message);
      throw error;
    });

    return Response.json({ success: true, status: "succeeded", jobId: rawId, ...inserted });
  } catch (error) {
    return ragResponseError(error);
  }
}
