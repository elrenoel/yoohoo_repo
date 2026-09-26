import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ragSql } from "@/lib/rag/db";
import { UUID } from "@/lib/rag/core";
import { generateSelectedFlashcards } from "@/lib/rag/materials";
import { DAILY_LIMIT } from "@/lib/daily-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  if (!UUID.test(id)) return NextResponse.json({ success: false, error: "ID flashcard tidak valid." }, { status: 400 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) return NextResponse.json({ success: false, error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { suggested_term?: unknown; source_chunk_id?: unknown };
    const term = typeof body.suggested_term === "string" ? body.suggested_term.trim() : "";
    const chunkId = typeof body.source_chunk_id === "string" ? body.source_chunk_id : "";
    if (term.length < 2 || term.length > 250 || !UUID.test(chunkId)) return NextResponse.json({ success: false, error: "Term atau sumber chunk tidak valid." }, { status: 400 });
    const sql = ragSql();
    const [source] = await sql`select f.id,f.document_id,d.content_language,c.content from public.flashcards f
      join public.documents d on d.id=f.document_id and d.user_id=${session.user.id} and d.deleted_at is null
      join public.document_chunks c on c.id=${chunkId} and c.document_id=f.document_id
      where f.id=${id}`;
    if (!source) return NextResponse.json({ success: false, error: "Flashcard atau sumber materi tidak ditemukan." }, { status: 404 });
    const [relation] = await sql`select id,to_flashcard_id from public.flashcard_relations where from_flashcard_id=${id} and relation_type='suggested' and lower(trim(suggested_term))=lower(trim(${term})) and source_chunk_id=${chunkId}`;
    if (!relation) return NextResponse.json({ success: false, error: "Saran istilah tidak ditemukan atau sudah tidak berlaku." }, { status: 404 });
    if (relation.to_flashcard_id) return NextResponse.json({ success: true, alreadyLinked: true, flashcardId: relation.to_flashcard_id });

    const ai = await generateSelectedFlashcards([{ chunk_id: chunkId, content: String(source.content) }], [{ id: String(relation.id), term, snippet: null, chunk_id: chunkId }], String(source.content_language ?? "auto"));
    const generated = ai.flashcards[0] && { term: ai.flashcards[0].term, definition: ai.flashcards[0].definition };
    if (!generated || generated.definition.trim().length < 4) throw new Error("AI tidak menghasilkan definisi yang valid.");
    const result = await sql.begin(async tx => {
      const [locked] = await tx`select to_flashcard_id,relation_type from public.flashcard_relations where id=${relation.id} for update`;
      if (!locked) throw new Error("SUGGESTION_NOT_FOUND");
      if (locked.to_flashcard_id) return { existing: true, card: { id: locked.to_flashcard_id }, remaining: null };
      const [quota] = await tx`select * from public.consume_generation_quota(${session.user.id},${DAILY_LIMIT})`;
      const [card] = await tx`insert into public.flashcards(document_id,term,definition) values (${source.document_id},${generated.term.trim()},${generated.definition.trim()}) returning id,term,definition`;
      await tx`update public.flashcard_relations set relation_type='linked',to_flashcard_id=${card.id},suggested_term=null,source_chunk_id=null where id=${relation.id} and relation_type='suggested'`;
      return { card, remaining: quota.remaining };
    });
    return NextResponse.json({ success: true, flashcard: result.card, remainingToday: result.remaining, alreadyLinked: result.existing === true }, { status: result.existing ? 200 : 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("DAILY_LIMIT_REACHED")) return NextResponse.json({ success: false, error: "Limit harian sudah tercapai. Coba lagi besok.", limitReached: true, remainingToday: 0, dailyLimit: DAILY_LIMIT }, { status: 429 });
    if (error instanceof Error && error.message.includes("SUGGESTION_NOT_FOUND")) return NextResponse.json({ success: false, error: "Saran istilah sudah tidak tersedia." }, { status: 404 });
    console.error("[flashcards/add-suggested]", error instanceof Error ? error.message : error);
    return NextResponse.json({ success: false, error: "Gagal menambahkan flashcard dari saran." }, { status: 500 });
  }
}
