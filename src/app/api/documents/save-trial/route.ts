import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, type Json } from "@/db";
import { isQuotaError } from "@/db/helpers";
import { handleApiError } from "@/lib/api-error";
import { DAILY_LIMIT, getUserQuota } from "@/lib/daily-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type SaveTrialBody = {
  title: string;
  raw_text: string;
  content_language?: string;
  flashcards: { term: string; definition: string }[];
  quiz: { question: string; options: string[]; correct_index: number }[];
};

/**
 * Endpoint untuk migrasi data trial (localStorage) ke database
 * setelah user berhasil login/register.
 * Membutuhkan sesi aktif (auth wajib).
 * Tidak memanggil AI sama sekali — data sudah ada dari trial sebelumnya.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verifikasi sesi
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "Sesi tidak valid. Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as SaveTrialBody;

    // 2. Cek daily limit (sama persis seperti generate)
    const quota = await getUserQuota(session.user.id);
    if (!quota) {
      return NextResponse.json(
        { success: false, error: "Data user tidak ditemukan." },
        { status: 404 }
      );
    }

    if (quota.currentCount >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Limit harian ${DAILY_LIMIT}x generate sudah tercapai. Data trial kamu masih tersimpan di browser ini, akan otomatis disimpan besok setelah limit reset.`,
          limitReached: true,
          remainingToday: 0,
          resetDate: quota.today,
        },
        { status: 429 }
      );
    }

    // 3. Validasi payload dasar
    if (!body.raw_text || !body.title) {
      return NextResponse.json(
        { success: false, error: "Data trial tidak lengkap (title atau raw_text kosong)." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.flashcards) || body.flashcards.length === 0) {
      return NextResponse.json(
        { success: false, error: "Data flashcard tidak ditemukan dalam payload." },
        { status: 400 }
      );
    }

    if (!Array.isArray(body.quiz) || body.quiz.length === 0) {
      return NextResponse.json(
        { success: false, error: "Data quiz tidak ditemukan dalam payload." },
        { status: 400 }
      );
    }

    const saved=await db.rpc("create_generated_document",{p_user_id:session.user.id,p_title:body.title,p_raw_text:body.raw_text,p_content_language:body.content_language||"auto",p_flashcards:body.flashcards as unknown as Json,p_questions:body.quiz as unknown as Json,p_daily_limit:DAILY_LIMIT});
    if(saved.error){if(isQuotaError(saved.error))return NextResponse.json({success:false,error:`Limit harian ${DAILY_LIMIT}x generate sudah tercapai. Data trial kamu masih tersimpan di browser ini, akan otomatis disimpan besok setelah limit reset.`,limitReached:true,remainingToday:0,resetDate:quota.today},{status:429});throw saved.error;}
    const result=saved.data as {id:string;remaining:number};

    return NextResponse.json(
      {
        success: true,
        documentId: result.id,
        remainingToday: result.remaining,
        message: "Data trial berhasil disimpan ke akun Anda.",
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "POST /api/documents/save-trial");
  }
}
