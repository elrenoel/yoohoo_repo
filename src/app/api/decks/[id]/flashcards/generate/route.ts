import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { ragSql } from "@/lib/rag/db";
import { RagError, UUID } from "@/lib/rag/core";
import { documentId, jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";
import { POST as runJob } from "@/app/api/jobs/[id]/run/route";

export const runtime = "nodejs";

const MAX_KEYWORDS_PER_JOB = 50;
const READY_STATUSES = ["ready_for_selection", "ready", "completed"];

/**
 * POST /api/decks/:deckId/flashcards/generate
 * Body: { documentIds: string[], keywordIds: string[], idempotencyKey: string }
 *
 * SATU transaksi (sql.begin):
 *   - cek deck milik user
 *   - validasi materi: ada di deck, milik user, siap pakai
 *   - validasi keyword: milik user, berada di materi terpilih, belum punya
 *     flashcard di deck ini
 *   - insert generation_jobs (ON CONFLICT idempotency -> job yang sama)
 *   - insert generation_job_items per keyword (ON CONFLICT DO NOTHING)
 * Balas 202 + jobId. Pemrosesan AI berjalan di worker terpisah (DI LUAR transaksi).
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const deckId = documentId((await context.params).id);
    const body = await jsonBody(request);

    const documentIds = Array.isArray(body.documentIds)
      ? [...new Set((body.documentIds as unknown[]).filter((v): v is string => typeof v === "string" && UUID.test(v)))]
      : [];
    const keywordIds = Array.isArray(body.keywordIds)
      ? [...new Set((body.keywordIds as unknown[]).filter((v): v is string => typeof v === "string" && UUID.test(v)))]
      : [];
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    if (!idempotencyKey || idempotencyKey.length > 200) throw new RagError("Idempotency-Key tidak valid.");
    if (!documentIds.length) throw new RagError("Pilih setidaknya satu materi.");
    if (documentIds.length > 50) throw new RagError("Terlalu banyak materi dalam satu proses.");
    if (!keywordIds.length) throw new RagError("Pilih setidaknya satu keyword.");
    if (keywordIds.length > MAX_KEYWORDS_PER_JOB) {
      throw new RagError(`Maksimal ${MAX_KEYWORDS_PER_JOB} keyword per proses generate.`, 400);
    }

    const sql = ragSql();

    // Idempotency cepat: key ini sudah punya job -> kembalikan job yang sama,
    // tanpa mengulang validasi (mis. retry setelah keyword sudah ber-flashcard).
    const [prior] = await sql`
      select id, status from public.generation_jobs
      where user_id=${userId} and idempotency_key=${idempotencyKey}`;
    if (prior) {
      return Response.json({
        success: true, jobId: String(prior.id), status: String(prior.status),
        keywordCount: keywordIds.length, documentCount: documentIds.length,
        message: "Proses generate dengan kunci ini sudah dimulai sebelumnya.",
      }, { status: 202 });
    }

    const result = await sql.begin(async tx => {
      const [deck] = await tx`select id from public.decks where id=${deckId} and user_id=${userId} for update`;
      if (!deck) throw new RagError("Meja kerja tidak ditemukan.", 404);

      // Materi: ada di deck + milik user + siap pakai.
      const docArray = tx.array(documentIds);
      const docs = await tx`
        select d.id, d.status from public.deck_documents dd
        join public.documents d on d.id = dd.document_id
        where dd.deck_id = ${deckId} and d.user_id = ${userId} and d.deleted_at is null
          and d.id = any(${docArray}::uuid[])`;
      if (docs.length !== documentIds.length) throw new RagError("Ada materi yang bukan bagian meja kerja ini.", 403);
      const notReady = docs.filter(d => !READY_STATUSES.includes(String(d.status)));
      if (notReady.length) throw new RagError("Ada materi yang belum selesai diproses. Pilih materi siap pakai saja.", 409);

      // Keyword: milik user + berada di materi terpilih.
      const kwArray = tx.array(keywordIds);
      const docIdArray = tx.array(documentIds);
      const keywords = await tx`
        select k.id, k.document_id from public.candidate_keywords k
        join public.documents d on d.id = k.document_id
        where k.id = any(${kwArray}::uuid[])
          and k.document_id = any(${docIdArray}::uuid[])
          and d.user_id = ${userId} and d.deleted_at is null`;
      if (keywords.length !== keywordIds.length) throw new RagError("Ada keyword yang bukan milik materi terpilih.", 403);

      // Keyword yang sudah punya flashcard di deck ini -> bukan valid.
      const already = await tx`
        select distinct k.id from public.candidate_keywords k
        join public.flashcards f
          on f.deck_id = ${deckId}
         and (f.keyword_id = k.id or (
              f.keyword_id is null and f.document_id = k.document_id
              and lower(btrim(f.term)) = lower(btrim(k.term))))
        where k.id = any(${kwArray}::uuid[])`;
      const alreadySet = new Set(already.map(r => String(r.id)));
      const valid = keywords.filter(k => !alreadySet.has(String(k.id)));
      if (!valid.length) throw new RagError("Semua keyword terpilih sudah punya flashcard di meja kerja ini.", 409);

      // Insert job (idempoten: klik ganda -> job yang sama).
      const [job] = await tx`
        INSERT INTO public.generation_jobs (
          id, user_id, kind, status, deck_id, document_id, input,
          idempotency_key, created_at, started_at, finished_at,
          attempts, error_message, result,
          selected_keyword_ids, expected_items, quota_count, remaining_quota
        ) VALUES (
          ${randomUUID()}, ${userId}, 'flashcard_generate', 'queued',
          ${deckId}, ${null}, ${tx.json({ documentIds, keywordIds: valid.map(k => String(k.id)) })},
          ${idempotencyKey}, NOW(), NULL, NULL,
          0, NULL, NULL,
          ${tx.array(valid.map(k => String(k.id)))}::uuid[], ${valid.length}, 0, 0
        )
        ON CONFLICT (user_id, idempotency_key) DO UPDATE
          SET status = EXCLUDED.status
          WHERE EXCLUDED.status IN ('queued')
        RETURNING *`;

      // Job sudah ada dari klik sebelumnya dan ON CONFLICT tidak mengembalikan
      // baris (mis. status sudah 'succeeded') -> pakai job lama apa adanya.
      const [finalJob] = job
        ? [job]
        : await tx`select * from public.generation_jobs where user_id=${userId} and idempotency_key=${idempotencyKey}`;
      if (!finalJob) throw new RagError("Gagal membuat proses generate.", 500);

      // Idempoten: kalau job sudah ada dari klik sebelumnya, item lama dipertahankan.
      const [existingCount] = await tx`select count(*)::int as c from public.generation_job_items where job_id=${finalJob.id}`;
      if (!existingCount.c) {
        const rows = valid.map((k, index) => ({
          job_id: finalJob.id as string,
          document_id: String(k.document_id),
          keyword_id: String(k.id),
          batch_index: index + 1,
        }));
        for (let offset = 0; offset < rows.length; offset += 100) {
          await tx`insert into public.generation_job_items ${tx(
            rows.slice(offset, offset + 100),
            "job_id", "document_id", "keyword_id", "batch_index"
          )} on conflict do nothing`;
        }
      }
      return { jobId: String(finalJob.id), status: String(finalJob.status), keywordCount: valid.length, documentCount: documentIds.length };
    });

    // Jalankan worker SETELAH respons 202 terkirim (AI + transaksi insert ada
    // di dalam handler run, jadi di luar transaksi pembuatan job di atas).
    const jobId = result.jobId;
    after(async () => {
      try {
        await runJob(
          new Request(new URL(`/api/jobs/${jobId}/run`, request.url), {
            method: "POST",
            headers: request.headers,
          }),
          { params: Promise.resolve({ id: jobId }) }
        );
      } catch {
        // Job tetap 'queued'; cron /api/jobs/cleanup menandai gagal bila macet.
      }
    });

    return Response.json(
      { success: true, jobId: result.jobId, status: result.status, keywordCount: result.keywordCount, documentCount: result.documentCount,
        message: "Flashcard dan quiz sedang dibuat. Notifikasi akan muncul saat selesai." },
      { status: 202 }
    );
  } catch (error) {
    return ragResponseError(error);
  }
}
