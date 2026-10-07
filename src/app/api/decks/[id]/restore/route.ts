import { ragSql } from "@/lib/rag/db";
import { documentId, ragResponseError, sessionUser } from "@/lib/rag/http";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const userId = await sessionUser(request);
    const id = documentId((await context.params).id);
    const [row] = await ragSql().begin(async sql => {
      const [restored] = await sql`update public.decks set deleted_at=null
        where id=${id} and user_id=${userId} and deleted_at is not null
        returning id,title`;
      if (!restored) return [];
      await sql`insert into public.notifications (user_id,type,severity,title,body,link,dedupe_key)
        values (${userId},'deck_restored','success','Deck berhasil dipulihkan',${`Deck "${String(restored.title)}" kembali ke Your Desk.`},${`/desk/${id}`},${`deck:${id}:restored`})
        on conflict (dedupe_key) do update set read_at=null,created_at=now(),body=excluded.body`;
      return [restored];
    });
    if (!row) return Response.json({ error: "Deck tidak ditemukan di trash." }, { status: 404 });
    return Response.json({ success: true, restoredDeckId: String(row.id) });
  } catch (error) { return ragResponseError(error); }
}
