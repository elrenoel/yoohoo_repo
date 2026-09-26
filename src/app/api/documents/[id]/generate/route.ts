import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DAILY_LIMIT } from "@/lib/daily-limit";
import { UUID } from "@/lib/rag/core";
import { ragSql } from "@/lib/rag/db";
import { dispatchGeneration } from "@/lib/rag/storage";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("DOCUMENT_NOT_FOUND")) return NextResponse.json({ success: false, error: "Dokumen tidak ditemukan." }, { status: 404 });
  if (message.includes("DOCUMENT_NOT_READY")) return NextResponse.json({ success: false, error: "Dokumen belum selesai dianalisis." }, { status: 409 });
  if (message.includes("NO_KEYWORDS_SELECTED")) return NextResponse.json({ success: false, error: "Pilih setidaknya satu keyword terlebih dahulu." }, { status: 400 });
  if (message.includes("SELECTED_KEYWORD_MISSING_CHUNK")) return NextResponse.json({ success: false, error: "Ada keyword tanpa konteks sumber. Ubah pilihan keyword lalu coba lagi." }, { status: 400 });
  if (message.includes("GENERATION_IN_PROGRESS")) return NextResponse.json({ success: false, error: "Generasi dengan pilihan lain masih berjalan." }, { status: 409 });
  if (message.includes("DAILY_LIMIT_REACHED")) {
    return NextResponse.json({
      success: false,
      error: `Limit harian ${DAILY_LIMIT}x generate sudah tercapai. Coba lagi besok!`,
      limitReached: true,
      remainingToday: 0,
      dailyLimit: DAILY_LIMIT,
    }, { status: 429 });
  }
  console.error("[documents/generate]", { errorType: error instanceof Error ? error.name : "Unknown" });
  return NextResponse.json({ success: false, error: "Gagal memulai pembuatan materi." }, { status: 500 });
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) return NextResponse.json({ success: false, error: "ID dokumen tidak valid." }, { status: 400 });
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ success: false, error: "Silakan login terlebih dahulu.", requireAuth: true }, { status: 401 });
    const [row] = await ragSql()`select private.start_selected_content_generation(
      ${session.user.id},${id}::uuid,${DAILY_LIMIT}
    ) as job`;
    const job = row.job as { id: string; status: string; remaining_quota: number };
    if (job.status !== "completed") {
      const batches = await ragSql()`select i.id from public.generation_job_items i
        join public.generation_jobs j on j.id=i.job_id
        where j.id=${job.id} and j.document_id=${id} and j.user_id=${session.user.id}
        order by i.batch_index,i.id`;
      await dispatchGeneration(job.id, id, session.user.id, batches.map(batch => String(batch.id)));
    }
    return NextResponse.json({ success: true, documentId: id, jobId: job.id, status: job.status,
      remainingToday: job.remaining_quota }, { status: job.status === "completed" ? 200 : 202 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const { id } = await context.params;
    if (!UUID.test(id)) return NextResponse.json({ success: false, error: "ID dokumen tidak valid." }, { status: 400 });
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) return NextResponse.json({ success: false, error: "Silakan login terlebih dahulu.", requireAuth: true }, { status: 401 });
    const requestedJobId = request.nextUrl.searchParams.get("jobId");
    if (requestedJobId && !UUID.test(requestedJobId)) return NextResponse.json({ success: false, error: "ID proses tidak valid." }, { status: 400 });
    const rows = requestedJobId
      ? await ragSql()`select id,status,error_message,flashcard_count,quiz_count,created_at,started_at,completed_at
          from public.generation_jobs where id=${requestedJobId} and document_id=${id} and user_id=${session.user.id}`
      : await ragSql()`select id,status,error_message,flashcard_count,quiz_count,created_at,started_at,completed_at
          from public.generation_jobs where document_id=${id} and user_id=${session.user.id} order by created_at desc limit 1`;
    const job = rows[0];
    if (!job) return NextResponse.json({ success: false, error: "Proses generate tidak ditemukan." }, { status: 404 });
    return NextResponse.json({ success: true, job: { id: job.id, status: job.status,
      errorMessage: job.error_message, flashcardCount: job.flashcard_count, quizCount: job.quiz_count,
      createdAt: job.created_at, startedAt: job.started_at, completedAt: job.completed_at } });
  } catch (error) {
    return errorResponse(error);
  }
}
