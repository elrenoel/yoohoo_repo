import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { handleApiError } from "@/lib/api-error";
import { ragSql } from "@/lib/rag/db";

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
    const requested = new URL(request.url).searchParams.get("setId");
    const sets = await db.from("quiz_sets").select("id,label,created_at").eq("document_id", id).order("created_at");
    if (sets.error) throw sets.error;
    let availableSets = sets.data;
    if (requested && !availableSets.some(set => set.id === requested)) {
      const [groupSet] = await ragSql()`select qs.id,qs.label,qs.created_at from public.quiz_sets qs
        join public.flashcard_groups g on g.id=qs.group_id
        join public.flashcards f on f.group_id=g.id and f.source_document_id=${id}
        where qs.id=${requested} and g.user_id=${session.user.id} limit 1`;
      if (groupSet) availableSets = [...availableSets, groupSet as typeof availableSets[number]];
    }
    if (!availableSets.length) return NextResponse.json({ success: true, documentId: id, documentTitle: doc.data.title, sets: [], quizSetId: null, quizSetLabel: null, total: 0, quiz: [] });
    const selected = requested ? availableSets.find(x => x.id === requested) : availableSets.at(-1);
    if (!selected) return NextResponse.json({ success: false, error: "Set kuis tidak ditemukan." }, { status: 400 });
    const all = await db.from("quiz_questions").select("id,quiz_set_id,question,options,difficulty").eq("document_id", id);
    if (all.error) throw all.error;
    const stats: Record<string, { questionCount: number; easy: number; medium: number; hard: number }> = {};
    for (const question of all.data) {
      const current = stats[question.quiz_set_id] ?? { questionCount: 0, easy: 0, medium: 0, hard: 0 };
      current.questionCount += 1;
      if (question.difficulty === "easy" || question.difficulty === "medium" || question.difficulty === "hard") {
        current[question.difficulty] += 1;
      }
      stats[question.quiz_set_id] = current;
    }
    const quiz = all.data.filter(question => question.quiz_set_id === selected.id).map(({ id: questionId, question, options, difficulty }) => ({ id: questionId, question, options, difficulty }));
    return NextResponse.json({
      success: true,
      documentId: id,
      documentTitle: doc.data.title,
      sets: availableSets.map((set, index) => {
        const normalizedLabel = set.label.toLocaleLowerCase();
        const variant = normalizedLabel.includes("level up") || normalizedLabel.includes("lebih sulit")
          ? "harder"
          : normalizedLabel.includes("regenerate") || normalizedLabel.includes("berbeda")
            ? "different"
            : index === 0 ? "original" : "different";
        const setStats = stats[set.id] ?? { questionCount: 0, easy: 0, medium: 0, hard: 0 };
        return {
          id: set.id,
          label: set.label,
          createdAt: set.created_at,
          variant,
          questionCount: setStats.questionCount,
          difficultyCounts: { easy: setStats.easy, medium: setStats.medium, hard: setStats.hard },
        };
      }),
      quizSetId: selected.id,
      quizSetLabel: selected.label,
      total: quiz.length,
      quiz,
    });
  } catch (error) { return handleApiError(error, "GET /api/documents/:id/quiz"); }
}
