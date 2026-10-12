import { ragSql } from "@/lib/rag/db";
import { RagError } from "@/lib/rag/core";
import { documentId, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

/**
 * GET /api/decks/:deckId/documents?ready=1
 * Materi dalam deck: id, judul, status, jumlah keyword, jumlah keyword yang
 * sudah punya flashcard di deck ini. `?ready=1` menyaring hanya materi siap
 * dipakai (ready_for_selection/ready/completed).
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const deckId = documentId((await context.params).id);
    const readyOnly = new URL(request.url).searchParams.get("ready") === "1";
    const sql = ragSql();
    const [deck] = await sql`select id from public.decks where id=${deckId} and user_id=${userId}`;
    if (!deck) throw new RagError("Meja kerja tidak ditemukan.", 404);
    const [documents, groupNames] = await Promise.all([sql`
      select d.id, d.title, d.status, dd.added_at,
        (select count(*)::int from public.candidate_keywords k where k.document_id = d.id) as keyword_count,
        (select count(distinct k.id)::int
           from public.candidate_keywords k
           join public.flashcards f on f.deck_id = ${deckId} and f.keyword_id = k.id
          where k.document_id = d.id) as keyword_with_flashcard
      from public.deck_documents dd
      join public.documents d on d.id = dd.document_id
      where dd.deck_id = ${deckId} and d.user_id = ${userId} and d.deleted_at is null
        ${readyOnly ? sql`and d.status in ('ready_for_selection','ready','completed')` : sql``}
      order by dd.added_at desc`, sql`select name from public.flashcard_groups where deck_id=${deckId}`]);
    const usedNames = new Set(groupNames.map(row => String(row.name).trim().toLowerCase()));
    let nextNumber = groupNames.length + 1;
    while (usedNames.has(`kartu ${nextNumber}`)) nextNumber += 1;
    return Response.json({
      suggestedGroupName: `Cards ${nextNumber}`,
      documents: documents.map(row => ({
        id: String(row.id),
        title: String(row.title),
        status: String(row.status),
        ready: ["ready_for_selection", "ready", "completed"].includes(String(row.status)),
        keywordCount: Number(row.keyword_count ?? 0),
        keywordWithFlashcard: Number(row.keyword_with_flashcard ?? 0),
        addedAt: row.added_at,
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return ragResponseError(error);
  }
}
