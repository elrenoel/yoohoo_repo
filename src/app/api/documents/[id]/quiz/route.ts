import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    if (!id.trim()) return NextResponse.json({ success: false, error: "Parameter ID dokumen wajib diisi." }, { status: 400 });
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ success: false, error: "Silakan masuk (login) terlebih dahulu.", requireAuth: true }, { status: 401 });
    const doc = await db.from("documents").select("id,title").eq("id", id).eq("user_id", session.user.id).is("deleted_at", null).maybeSingle();
    if (doc.error) throw doc.error;
    if (!doc.data) return NextResponse.json({ success: false, error: `Dokumen dengan ID "${id}" tidak ditemukan.` }, { status: 404 });
    const sets = await db.from("quiz_sets").select("id,label,created_at").eq("document_id", id).order("created_at");
    if (sets.error) throw sets.error;
    if (!sets.data.length) return NextResponse.json({ success: true, documentId: id, documentTitle: doc.data.title, sets: [], quizSetId: null, quizSetLabel: null, total: 0, quiz: [] });
    const requested = new URL(request.url).searchParams.get("setId");
    const selected = requested ? sets.data.find(x => x.id === requested) : sets.data[0];
    if (!selected) return NextResponse.json({ success: false, error: "Set kuis tidak ditemukan." }, { status: 400 });
    const all = await db.from("quiz_questions").select("id,quiz_set_id,question,options,difficulty").eq("document_id", id);
    if (all.error) throw all.error;
    const counts: Record<string, number> = {};
    for (const question of all.data) counts[question.quiz_set_id] = (counts[question.quiz_set_id] ?? 0) + 1;
    const quiz = all.data.filter(question => question.quiz_set_id === selected.id).map(({ id: questionId, question, options, difficulty }) => ({ id: questionId, question, options, difficulty }));
    return NextResponse.json({ success: true, documentId: id, documentTitle: doc.data.title, sets: sets.data.map(x => ({ id: x.id, label: x.label, questionCount: counts[x.id] ?? 0 })), quizSetId: selected.id, quizSetLabel: selected.label, total: quiz.length, quiz });
  } catch (error) { return handleApiError(error, "GET /api/documents/:id/quiz"); }
}
