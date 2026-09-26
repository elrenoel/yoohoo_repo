import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ragSql } from "@/lib/rag/db";
import { UUID } from "@/lib/rag/core";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID.test(id)) return NextResponse.json({ success: false, error: "ID flashcard tidak valid." }, { status: 400 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.json({ success: false, error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  try {
    const sql = ragSql();
    const [card] = await sql`select f.id,f.document_id,f.term,f.definition from public.flashcards f join public.documents d on d.id=f.document_id where f.id=${id} and d.user_id=${session.user.id} and d.deleted_at is null`;
    if (!card) return NextResponse.json({ success: false, error: "Flashcard tidak ditemukan." }, { status: 404 });
    await sql`select private.refresh_flashcard_relations(${session.user.id},${id})`;
    const related = await sql`select r.to_flashcard_id,r.relation_type,r.suggested_term,r.source_chunk_id,target.term,target.definition
      from public.flashcard_relations r left join public.flashcards target on target.id=r.to_flashcard_id where r.from_flashcard_id=${id}`;
    return NextResponse.json({ success: true, flashcard: { id: card.id, document_id: card.document_id, term: card.term, definition: card.definition,
      related_terms: related.map(r => r.relation_type === "suggested" ? { term: r.suggested_term, type: "suggested", source_chunk_id: r.source_chunk_id } : { term: r.term, flashcard_id: r.to_flashcard_id, type: "linked", definition: r.definition }) } });
  } catch (error) {
    console.error("[flashcards/:id]", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Gagal memuat flashcard." }, { status: 500 });
  }
}
