import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ragSql } from "@/lib/rag/db";
import { UUID } from "@/lib/rag/core";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    if (!UUID.test(id)) return NextResponse.json({ success: false, error: "ID dokumen tidak valid." }, { status: 400 });
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ success: false, error: "Silakan masuk terlebih dahulu.", requireAuth: true }, { status: 401 });
    const sql = ragSql();
    const [doc] = await sql`select id,title from public.documents where id=${id} and user_id=${session.user.id} and deleted_at is null`;
    if (!doc) return NextResponse.json({ success: false, error: "Dokumen tidak ditemukan." }, { status: 404 });
    const cards = await sql`select id,term,definition from public.flashcards where document_id=${id} order by id`;
    for (const card of cards) await sql`select private.refresh_flashcard_relations(${session.user.id},${card.id})`;
    const relations = await sql`select r.from_flashcard_id,r.to_flashcard_id,r.relation_type,r.suggested_term,r.source_chunk_id,
      target.term as target_term,target.definition as target_definition
      from public.flashcard_relations r left join public.flashcards target on target.id=r.to_flashcard_id
      join public.flashcards source on source.id=r.from_flashcard_id
      where source.document_id=${id} and r.from_flashcard_id is not null`;
    const bySource = new Map<string, unknown[]>();
    for (const relation of relations) {
      const list = bySource.get(String(relation.from_flashcard_id)) ?? [];
      list.push(relation.relation_type === "suggested"
        ? { term: String(relation.suggested_term), type: "suggested", source_chunk_id: relation.source_chunk_id }
        : { term: String(relation.target_term), flashcard_id: String(relation.to_flashcard_id), type: "linked", definition: relation.target_definition });
      bySource.set(String(relation.from_flashcard_id), list);
    }
    return NextResponse.json({ success: true, documentId: id, documentTitle: doc.title, total: cards.length,
      flashcards: cards.map(card => ({ id: String(card.id), term: String(card.term), definition: String(card.definition), related_terms: bySource.get(String(card.id)) ?? [] })) });
  } catch (error) {
    console.error("[flashcards]", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Gagal memuat flashcard." }, { status: 500 });
  }
}
