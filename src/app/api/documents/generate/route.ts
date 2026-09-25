import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, type Json } from "@/db";
import { isQuotaError } from "@/db/helpers";
import { handleApiError } from "@/lib/api-error";
import { extractPdfText } from "@/lib/pdf";
import { generateStudyMaterials } from "@/lib/ai";
import { DAILY_LIMIT, getUserQuota } from "@/lib/daily-limit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

function isValidPdfHeader(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const header = new Uint8Array(buffer.slice(0, 5));
  return (
    header[0] === 0x25 &&
    header[1] === 0x50 &&
    header[2] === 0x44 &&
    header[3] === 0x46 &&
    header[4] === 0x2d
  );
}

/**
 * Endpoint generate untuk user yang sudah login.
 * Mengecek daily limit sebelum memanggil AI.
 * Menyimpan hasil langsung ke database.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verifikasi sesi
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "Silakan masuk (login) terlebih dahulu untuk generate materi.",
          requireAuth: true,
        },
        { status: 401 }
      );
    }

    // 2. Ambil status kuota harian user (reset otomatis jika hari baru)
    const quota = await getUserQuota(session.user.id);

    if (!quota) {
      return NextResponse.json(
        { success: false, error: "Data user tidak ditemukan." },
        { status: 404 }
      );
    }

    // 3. Cek daily limit
    if (quota.currentCount >= DAILY_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error: `Limit harian ${DAILY_LIMIT}x generate sudah tercapai. Coba lagi besok!`,
          limitReached: true,
          remainingToday: 0,
          resetDate: quota.today,
        },
        { status: 429 }
      );
    }

    // 4. Parse form data dan validasi file
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const customTitle = (formData.get("title") as string) || null;
    const contentLanguage = (formData.get("contentLanguage") as string) || "auto";

    if (!file) {
      return NextResponse.json(
        { success: false, error: "File PDF tidak ditemukan dalam request." },
        { status: 400 }
      );
    }

    const fileName = file.name || "Dokumen Tanpa Judul";
    const title =
      customTitle ||
      fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim() ||
      "Materi Pembelajaran";

    const lowerName = fileName.toLowerCase();
    const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");

    if (!isPdf) {
      const isOffice =
        lowerName.endsWith(".doc") ||
        lowerName.endsWith(".docx") ||
        lowerName.endsWith(".ppt") ||
        lowerName.endsWith(".pptx");

      const errorMsg = isOffice
        ? "Format Word / PowerPoint belum didukung langsung. Silakan Export ke PDF terlebih dahulu."
        : "Format file tidak didukung. Mohon upload file PDF (.pdf).";

      return NextResponse.json({ success: false, error: errorMsg }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();

    if (buffer.byteLength === 0) {
      return NextResponse.json(
        { success: false, error: "File PDF kosong (0 byte)." },
        { status: 400 }
      );
    }

    if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (buffer.byteLength / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        { success: false, error: `Ukuran file terlalu besar (${sizeMb} MB). Maksimal 15 MB.` },
        { status: 400 }
      );
    }

    if (!isValidPdfHeader(buffer)) {
      return NextResponse.json(
        { success: false, error: "File bukan PDF yang valid atau telah rusak (corrupt)." },
        { status: 400 }
      );
    }

    // 5. Ekstraksi teks
    const { text, totalPages, wordCount } = await extractPdfText(buffer);

    if (!text || text.trim().length === 0 || wordCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Tidak ditemukan teks dalam PDF ini. Kemungkinan hasil scan gambar atau diproteksi password.",
        },
        { status: 400 }
      );
    }

    if (totalPages > 2 && wordCount < 20) {
      return NextResponse.json(
        {
          success: false,
          error: `Dokumen ${totalPages} halaman namun teks sangat minim (${wordCount} kata). Gunakan OCR terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    // 6. Generate dengan AI
    const aiResult = await generateStudyMaterials(text, contentLanguage);

    // 7. Simpan seluruh graph + consume quota dalam satu transaksi PostgreSQL.
    const saved = await db.rpc("create_generated_document", {
      p_user_id: session.user.id, p_title: title, p_raw_text: text,
      p_content_language: contentLanguage,
      p_flashcards: aiResult.flashcards as unknown as Json,
      p_questions: aiResult.quiz as unknown as Json, p_daily_limit: DAILY_LIMIT,
    });
    if (saved.error) {
      if (isQuotaError(saved.error)) return NextResponse.json({success:false,error:`Limit harian ${DAILY_LIMIT}x generate sudah tercapai. Coba lagi besok!`,limitReached:true,remainingToday:0,resetDate:quota.today},{status:429});
      throw saved.error;
    }
    const result = saved.data as { id:string; created_at:string; new_count:number; remaining:number };

    return NextResponse.json(
      {
        success: true,
        document: {
          id: result.id,
          title,
          totalPages,
          wordCount,
          createdAt: result.created_at,
        },
        remainingToday: result.remaining,
        totalGeneratedToday: result.new_count,
        message: "Materi berhasil di-generate dan disimpan.",
      },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error, "POST /api/documents/generate");
  }
}

/**
 * GET /api/documents/generate — Ambil info kuota harian user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user) {
      return NextResponse.json({ remainingToday: null, requireAuth: true }, { status: 401 });
    }

    const quota = await getUserQuota(session.user.id);
    if (!quota) {
      return NextResponse.json({ remainingToday: DAILY_LIMIT });
    }

    return NextResponse.json({
      remainingToday: quota.remainingToday,
      usedToday: quota.currentCount,
      dailyLimit: DAILY_LIMIT,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/documents/generate");
  }
}
