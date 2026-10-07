import { NextRequest, NextResponse } from "next/server";
import { ragSql } from "@/lib/rag/db";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * POST /api/jobs/cleanup
 * Menandai job yang statusnya 'running' atau 'queued' lebih dari 10 menit sebagai 'failed'.
 * Endpoint ini dimaksudkan untuk dipanggil oleh cron/job scheduler secara berkala.
 * Hanya merespons jika ada job yang perlu dibersihkan.
 */
export async function POST(request: NextRequest) {
  try {
    // Hanya izinkan dari internal cron atau localhost
    const authHeader = request.headers.get("authorization");
    const allowed =
      authHeader === `Bearer ${process.env.CRON_SECRET}` ||
      request.headers.get("x-internal-cron") === "true" ||
      request.headers.get("x-forwarded-for")?.includes("127.0.0.1");

    if (!allowed) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = ragSql();
    const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Update job yang sudah lebih dari 10 menit dalam status queued atau running
    const [result] = await sql`
      UPDATE public.generation_jobs
      SET status = 'failed',
          error = COALESCE(
            error,
            CASE 
              WHEN status = 'queued' THEN 'Job menganggur di antrian terlalu lama (timeout 10 menit)'
              WHEN status = 'running' THEN 'Job berjalan terlalu lama tanpa progress (timeout 10 menit)'
              ELSE 'Job timeout'
            END
          ),
          finished_at = NOW()
      WHERE id IN (
        SELECT id FROM public.generation_jobs
        WHERE status IN ('queued', 'running')
          AND created_at < ${TEN_MINUTES_AGO}
        LIMIT 100
      )
      RETURNING id, status, error
    `;

    return NextResponse.json({
      success: true,
      cleanedUp: result?.length ?? 0,
      message: result?.length
        ? `Telah menandai ${result.length} job sebagai failed karena timeout.`
        : "Tidak ada job yang perlu dibersihkan.",
    });
  } catch (error) {
    console.error("[jobs/cleanup]", error);
    return NextResponse.json(
      { success: false, error: "Gagal membersihkan job timeout." },
      { status: 500 }
    );
  }
}

/**
 *GET /api/jobs/cleanup/status
 * Untuk monitoring: mengembalikan jumlah job yang berisiko timeout.
 */
export async function GET() {
  try {
    const TEN_MINUTES_AGO = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const sql = ragSql();

    const [result] = await sql`
      SELECT COUNT(*)::int as count
      FROM public.generation_jobs
      WHERE status IN ('queued', 'running')
        AND created_at < ${TEN_MINUTES_AGO}
    `;

    return NextResponse.json({
      success: true,
      atRiskCount: result?.count ?? 0,
      threshold: "10 menit",
    });
  } catch (error) {
    console.error("[jobs/cleanup/status]", error);
    return NextResponse.json(
      { success: false, error: "Gagal memeriksa status job." },
      { status: 500 }
    );
  }
}
