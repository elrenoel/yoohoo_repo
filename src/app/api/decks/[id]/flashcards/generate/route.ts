import { randomUUID } from "node:crypto";
import { after } from "next/server";
import { ragSql } from "@/lib/rag/db";
import { RagError, UUID } from "@/lib/rag/core";
import { documentId, jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";
import { POST as runJob } from "@/app/api/jobs/[id]/run/route";

export const runtime = "nodejs";

const MAX_KEYWORDS_PER_JOB = 50;
const READY_STATUSES = ["ready_for_selection", "ready", "completed"];
type Selection = { documentId: string; keywordIds: string[] };

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const deckId = documentId((await context.params).id);
    const body = await jsonBody(request);
    const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const requestedName = typeof body.groupName === "string" ? body.groupName.trim() : "";
    if (!idempotencyKey || idempotencyKey.length > 200) throw new RagError("Idempotency-Key tidak valid.");
    if (requestedName.length > 60) throw new RagError("Nama grup maksimal 60 karakter.");

    const rawSelections = Array.isArray(body.selections) ? body.selections : [];
    const selections: Selection[] = rawSelections.flatMap(value => {
      if (!value || typeof value !== "object") return [];
      const item = value as { document_id?: unknown; documentId?: unknown; keyword_ids?: unknown; keywordIds?: unknown };
      const docId = typeof item.document_id === "string" ? item.document_id : item.documentId;
      const rawKeywordIds = Array.isArray(item.keyword_ids) ? item.keyword_ids : Array.isArray(item.keywordIds) ? item.keywordIds : [];
      if (typeof docId !== "string" || !UUID.test(docId)) return [];
      const keywordIds = [...new Set(rawKeywordIds.filter((id): id is string => typeof id === "string" && UUID.test(id)))];
      return keywordIds.length ? [{ documentId: docId, keywordIds }] : [];
    });
    const documentIds = [...new Set(selections.map(item => item.documentId))];
    const keywordIds = [...new Set(selections.flatMap(item => item.keywordIds))];
    if (!documentIds.length || !keywordIds.length) throw new RagError("Pilih setidaknya satu keyword dari satu materi.");
    if (documentIds.length > 50 || keywordIds.length > MAX_KEYWORDS_PER_JOB) throw new RagError(`Maksimal ${MAX_KEYWORDS_PER_JOB} keyword per proses generate.`);

    const sql = ragSql();
    const [prior] = await sql`select id,status from public.generation_jobs where user_id=${userId} and idempotency_key=${idempotencyKey}`;
    if (prior) return Response.json({ success: true, jobId: String(prior.id), status: String(prior.status), keywordCount: keywordIds.length, documentCount: documentIds.length }, { status: 202 });

    const result = await sql.begin(async tx => {
      const [deck] = await tx`select id from public.decks where id=${deckId} and user_id=${userId} and deleted_at is null for update`;
      if (!deck) throw new RagError("Deck tidak ditemukan.", 404);
      const docs = await tx`select d.id,d.status from public.deck_documents dd join public.documents d on d.id=dd.document_id
        where dd.deck_id=${deckId} and d.user_id=${userId} and d.deleted_at is null and d.id=any(${tx.array(documentIds)}::uuid[])`;
      if (docs.length !== documentIds.length) throw new RagError("Ada materi yang bukan bagian deck ini.", 403);
      if (docs.some(doc => !READY_STATUSES.includes(String(doc.status)))) throw new RagError("Ada materi yang belum selesai diproses.", 409);

      const keywords = await tx`select k.id,k.document_id,k.term from public.candidate_keywords k join public.documents d on d.id=k.document_id
        where k.id=any(${tx.array(keywordIds)}::uuid[]) and k.document_id=any(${tx.array(documentIds)}::uuid[])
          and d.user_id=${userId} and d.deleted_at is null`;
      if (keywords.length !== keywordIds.length) throw new RagError("Ada keyword yang bukan milik materi terpilih.", 403);
      const selectedPairs = new Set(selections.flatMap(item => item.keywordIds.map(keywordId => `${item.documentId}:${keywordId}`)));
      if (keywords.some(keyword => !selectedPairs.has(`${String(keyword.document_id)}:${String(keyword.id)}`))) throw new RagError("Pasangan materi dan keyword tidak valid.", 403);

      const seen = new Set<string>();
      const unique = keywords.filter(keyword => {
        const normalized = String(keyword.term).trim().toLowerCase();
        if (seen.has(normalized)) return false;
        seen.add(normalized);
        return true;
      });
      const skippedCount = keywords.length - unique.length;
      const normalizedSelections = documentIds.flatMap(docId => {
        const ids = unique.filter(keyword => String(keyword.document_id) === docId).map(keyword => String(keyword.id));
        return ids.length ? [{ document_id: docId, keyword_ids: ids }] : [];
      });
      const [job] = await tx`insert into public.generation_jobs
        (id,user_id,kind,status,deck_id,document_id,input,idempotency_key,selected_keyword_ids,expected_items,quota_count,remaining_quota,attempts)
        values(${randomUUID()},${userId},'flashcard_generate','queued',${deckId},null,
          ${tx.json({ groupName: requestedName || null, selections: normalizedSelections, skippedCount })},${idempotencyKey},
          ${tx.array(unique.map(keyword => String(keyword.id)))}::uuid[],${unique.length},0,0,0) returning id,status`;
      const rows = unique.map((keyword, index) => ({ job_id: job.id as string, document_id: String(keyword.document_id), keyword_id: String(keyword.id), batch_index: index + 1 }));
      await tx`insert into public.generation_job_items ${tx(rows,"job_id","document_id","keyword_id","batch_index")} on conflict do nothing`;
      return { jobId: String(job.id), status: String(job.status), keywordCount: unique.length, documentCount: documentIds.length, skippedCount };
    });

    after(async () => {
      try {
        await runJob(new Request(new URL(`/api/jobs/${result.jobId}/run`, request.url), { method: "POST", headers: request.headers }), { params: Promise.resolve({ id: result.jobId }) });
      } catch { /* cleanup worker marks a stalled job */ }
    });
    return Response.json({ success: true, ...result, message: `${result.keywordCount} flashcard sedang dibuat.${result.skippedCount ? ` ${result.skippedCount} keyword duplikat dilewati.` : ""}` }, { status: 202 });
  } catch (error) {
    return ragResponseError(error);
  }
}
