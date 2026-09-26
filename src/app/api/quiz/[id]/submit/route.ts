import { NextRequest, NextResponse } from "next/server";

/** Legacy endpoint. New clients should use POST /api/quiz/:quizId/attempts. */
export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return NextResponse.json({ success: false, error: "Gunakan endpoint quiz attempts terbaru.", quizId: id }, { status: 410 });
}
