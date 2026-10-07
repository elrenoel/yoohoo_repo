import { ragSql } from "@/lib/rag/db";
import { RagError, UUID } from "@/lib/rag/core";
import { documentId, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

interface KeywordRow {
  id: string;
  document_id: string;
  term: string;
  snippet: string | null;
}

/** Istilah ternormalisasi: dasar penggabungan istilah kembar lintas materi. */
function normalizedTerm(term: string) {
  return term.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * GET /api/decks/:deckId/keywords?documentIds=a,b,c
 * Keyword per materi terpilih, dengan flag alreadyHasFlashcard di deck ini
 * dan info istilah kembar (kemunculan istilah ternormalisasi yang sama di
 * lebih dari satu materi terpilih) supaya UI bisa menggabungkannya.
 */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const deckId = documentId((await context.params).id);
    const raw = new URL(request.url).searchParams.get("documentIds") ?? "";
    const documentIds = [...new Set(raw.split(",").map(v => v.trim()).filter(Boolean))];
    if (!documentIds.length) throw new RagError("Pilih setidaknya satu materi terlebih dahulu.");
    if (documentIds.length > 50) throw new RagError("Terlalu banyak materi dalam satu permintaan.");
    if (!documentIds.every(id => UUID.test(id))) throw new RagError("ID materi tidak valid.");

    const sql = ragSql();
    const [deck] = await sql`select id from public.decks where id=${deckId} and user_id=${userId}`;
    if (!deck) throw new RagError("Meja kerja tidak ditemukan.", 404);

    const idArray = sql.array(documentIds);
    // Kepemilikan: materi harus ada di deck ini dan milik user.
    const owned = await sql`
      select d.id from public.deck_documents dd
      join public.documents d on d.id = dd.document_id
      where dd.deck_id = ${deckId} and d.user_id = ${userId} and d.deleted_at is null
        and d.id = any(${idArray}::uuid[])`;
    if (owned.length !== documentIds.length) throw new RagError("Ada materi yang bukan bagian meja kerja ini.", 403);

    const keywords = await sql<KeywordRow[]>`
      select k.id, k.document_id, k.term, k.snippet
      from public.candidate_keywords k
      where k.document_id = any(${idArray}::uuid[])
      order by lower(k.term), k.id`;

    // Keyword yang sudah punya flashcard di deck ini (link eksplisit via keyword_id,
    // atau fallback istilah untuk kartu lama yang belum punya keyword_id).
    const withFlashcard = await sql`
      select k.id from public.candidate_keywords k
      join public.flashcards f
        on f.deck_id = ${deckId}
       and (f.keyword_id = k.id or (
            f.keyword_id is null and f.document_id = k.document_id
            and lower(btrim(f.term)) = lower(btrim(k.term))))
      where k.document_id = any(${idArray}::uuid[])`;
    const flashcardKeywordIds = new Set(withFlashcard.map(r => String(r.id)));

    // Grup kembar: istilah ternormalisasi yang muncul di >1 materi terpilih.
    const byNormalized = new Map<string, string[]>();
    for (const row of keywords) {
      const key = normalizedTerm(row.term);
      byNormalized.set(key, [...(byNormalized.get(key) ?? []), String(row.id)]);
    }

    const documents = await sql`
      select id, title from public.documents
      where id = any(${idArray}::uuid[]) order by lower(title)`;

    return Response.json({
      documents: documents.map(doc => ({
        id: String(doc.id),
        title: String(doc.title),
        keywords: keywords
          .filter(row => String(row.document_id) === String(doc.id))
          .map(row => {
            const key = normalizedTerm(row.term);
            const twinIds = (byNormalized.get(key) ?? []).filter(id => id !== String(row.id));
            return {
              id: String(row.id),
              documentId: String(row.document_id),
              term: String(row.term),
              snippet: row.snippet as string | null,
              normalizedTerm: key,
              alreadyHasFlashcard: flashcardKeywordIds.has(String(row.id)),
              // Kembar di materi lain (untuk digabung UI): id lain dengan istilah sama.
              twinIds,
            };
          }),
      })),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return ragResponseError(error);
  }
}
