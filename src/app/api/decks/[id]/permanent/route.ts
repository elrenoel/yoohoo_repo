import { ragSql } from "@/lib/rag/db";
import { documentId, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    // Hard delete of a trashed deck only; deck_documents cascade with it while
    // the source documents in public.documents stay untouched.
    const [row] = await ragSql().begin(async sql => {
      const [deleted] = await sql`delete from public.decks
        where id=${id} and user_id=${userId} and deleted_at is not null
        returning id,title`;
      if (!deleted) return [];
      await sql`insert into public.notifications (user_id,type,severity,title,body,link,dedupe_key)
        values (${userId},'deck_deleted_permanently','info','Deck dihapus permanen',${`Deck "${String(deleted.title)}" telah dihapus permanen.`},'/trash',${`deck:${id}:deleted_permanently`})
        on conflict (dedupe_key) do nothing`;
      return [deleted];
    });
    if (!row) return Response.json({ error: "Deck tidak ditemukan di trash." }, { status: 404 });
    return Response.json({ success: true, deletedDeckId: String(row.id) });
  } catch (error) { return ragResponseError(error); }
}
