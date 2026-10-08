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
import { claimJob, failJob } from "@/lib/jobs";

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

interface DocumentQuiz {
  documentId: string;
  questions: GeneratedQuizQuestion[];
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
      select id, status, deck_id, kind from public.generation_jobs
      where id=${rawId} and user_id=${userId}`;
    if (!jobBefore) throw new RagError("Proses generate tidak ditemukan.", 404);
    if (String(jobBefore.kind) !== "flashcard_generate") throw new RagError("Jenis proses ini tidak didukung worker ini.", 400);
    if (!jobBefore.deck_id) throw new RagError("Job tidak memiliki meja kerja tujuan.", 400);

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
      await failJob(rawId, userId, undefined, "Tidak ada keyword untuk diproses.");
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
          await failJob(rawId, userId, undefined, message);
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
      await failJob(rawId, userId, undefined, `Gagal memanggil AI: ${message}`.slice(0, 500));
      return Response.json({ success: false, status: "failed", error: "Gagal memanggil AI." }, { status: 500 });
    }

    const failed = outcomes.filter((o): o is { batch: Batch; error: Error } => "error" in o);
    if (failed.length) {
      const detail = failed.slice(0, 3).map(f => `Materi "${f.batch.documentTitle}": ${f.error.message}`).join(" | ");
      const message = `Gagal membuat flashcard — ${failed.length} batch bermasalah. ${detail}`.slice(0, 500);
      await failJob(rawId, userId, undefined, message);
      return Response.json({ success: false, status: "failed", error: message }, { status: 500 });
    }

    // 4. SATU transaksi: insert semua flashcard + tandai job succeeded.
    const deckId = String(job.deck_id);
    let previousBlobVariant: number | undefined;
    const cards = (outcomes as { batch: Batch; result: GeneratedFlashcardMaterials }[])
      .flatMap(({ batch, result }) =>
        result.flashcards.map(card => {
          const blobVariant = nextBlobVariant(previousBlobVariant);
          previousBlobVariant = blobVariant;
          return {
            document_id: batch.documentId,
            deck_id: deckId,
            keyword_id: card.keyword_id,
            job_id: rawId,
            term: card.term.slice(0, 250),
            definition: card.definition.slice(0, 4000),
            blob_variant: blobVariant,
          };
        })
      );
    // Keyword di luar job ini (AI tidak boleh mengeluarkannya, tapi disaring lagi).
    const allowedKeywordIds = new Set(rows.map(r => String(r.keyword_id)));
    const validCards = cards.filter(card => allowedKeywordIds.has(card.keyword_id));
    if (!validCards.length) {
      const message = "AI tidak menghasilkan flashcard yang valid untuk keyword terpilih.";
      await failJob(rawId, userId, undefined, message);
      return Response.json({ success: false, status: "failed", error: message }, { status: 500 });
    }

    // Buat satu set quiz representatif per materi. Sertakan flashcard lama dari
    // deck yang sama agar set terbaru mencakup seluruh konsep materi, bukan
    // hanya keyword pada batch terakhir.
    const generatedByDocument = new Map<string, typeof validCards>();
    for (const card of validCards) {
      generatedByDocument.set(card.document_id, [
        ...(generatedByDocument.get(card.document_id) ?? []),
        card,
      ]);
    }

    let documentQuizzes: DocumentQuiz[];
    try {
      documentQuizzes = await mapLimit(
        [...generatedByDocument.entries()],
        PARALLEL_BATCHES,
        async ([documentId, generatedCards]) => {
          const existingCards = await sql`
            select term, definition from public.flashcards
            where deck_id=${deckId} and document_id=${documentId}
            order by id`;
          const cards = [
            ...existingCards.map(card => ({ term: String(card.term), definition: String(card.definition) })),
            ...generatedCards.map(card => ({ term: card.term, definition: card.definition })),
          ];
          const contentLanguage = batches.find(batch => batch.documentId === documentId)?.contentLanguage ?? "auto";
          const questions = await generateRepresentativeQuiz(
            cards,
            representativeQuizCount(cards.length),
            contentLanguage,
          );
          return { documentId, questions };
        },
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const message = `Flashcard berhasil dibuat oleh AI, tetapi quiz gagal dibuat: ${detail}`.slice(0, 500);
      await failJob(rawId, userId, undefined, message);
      return Response.json({ success: false, status: "failed", error: message }, { status: 500 });
    }

    const inserted = await sql.begin(async tx => {
      let count = 0;
      const [schema] = await tx<{ hasBlobVariant: boolean }[]>`
        select exists (
          select 1 from information_schema.columns
          where table_schema='public' and table_name='flashcards'
            and column_name='blob_variant'
        ) as "hasBlobVariant"`;
      for (let offset = 0; offset < validCards.length; offset += 100) {
        const chunk = validCards.slice(offset, offset + 100);
        const rowsInserted = schema?.hasBlobVariant
          ? await tx`
              insert into public.flashcards ${tx(
                chunk, "document_id", "deck_id", "keyword_id", "job_id",
                "term", "definition", "blob_variant"
              )}
              on conflict (deck_id, keyword_id) do nothing
              returning id`
          : await tx`
              insert into public.flashcards ${tx(
                chunk, "document_id", "deck_id", "keyword_id", "job_id",
                "term", "definition"
              )}
              on conflict (deck_id, keyword_id) do nothing
              returning id`;
        count += rowsInserted.length;
      }

      let quizCount = 0;
      const quizSets: { id: string; documentId: string }[] = [];
      for (const quiz of documentQuizzes) {
        // Serialisasi penomoran set untuk satu dokumen bila dua job selesai bersamaan.
        await tx`select pg_advisory_xact_lock(hashtextextended(${quiz.documentId}, 0))`;
        const [setCount] = await tx`
          select count(*)::int as count from public.quiz_sets
          where document_id=${quiz.documentId}`;
        const [quizSet] = await tx`
          insert into public.quiz_sets (document_id, label, job_id)
          values (${quiz.documentId}, ${`Set ${Number(setCount.count) + 1}`}, ${rawId})
          returning id`;
        for (const question of quiz.questions) {
          await tx`insert into public.quiz_questions
            (document_id, quiz_set_id, question, options, correct_index, explanation, difficulty)
            values (${quiz.documentId},${quizSet.id},${question.question},${tx.json(question.options)},
              ${question.correct_index},${question.explanation},${question.difficulty})`;
        }
        quizCount += quiz.questions.length;
        quizSets.push({ id: String(quizSet.id), documentId: quiz.documentId });
      }
      await tx`update public.generation_job_items set status='completed', updated_at=now()
        where job_id=${rawId} and status <> 'completed'`;
      const [updated] = await tx`
        update public.generation_jobs
        set status='succeeded', finished_at=now(), completed_at=now(),
            flashcard_count=flashcard_count + ${count},
            quiz_count=quiz_count + ${quizCount},
            result=${tx.json({ flashcardCount: count, quizCount, quizSets })}
        where id=${rawId} and user_id=${userId} and status='running'
        returning id`;
      if (!updated) throw new Error("Job tidak lagi berstatus running.");
      return { flashcardCount: count, quizCount, quizSets };
    });

    return Response.json({ success: true, status: "succeeded", jobId: rawId, ...inserted });
  } catch (error) {
    return ragResponseError(error);
  }
}
