import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/lib/pdf";
import { generateStudyMaterials } from "@/lib/ai";
import { handleApiError } from "@/lib/api-error";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

// ── Simple in-memory IP rate limiter ────────────────────────────────────────
// Max 5 trial generations per IP per hour. Resets automatically after TTL.
const TRIAL_RATE_LIMIT = 5;
const TRIAL_RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const ipHits = new Map<string, number[]>();

function checkIpRateLimit(ip: string): boolean {
  const now = Date.now();
  const hits = ipHits.get(ip) || [];
  // Remove expired entries
  const recent = hits.filter((t) => now - t < TRIAL_RATE_WINDOW_MS);
  if (recent.length >= TRIAL_RATE_LIMIT) return false;
  recent.push(now);
  ipHits.set(ip, recent);
  return true;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Memeriksa apakah buffer file memiliki header Magic Bytes standar PDF (%PDF-)
 */
function isValidPdfHeader(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const header = new Uint8Array(buffer.slice(0, 5));
  // %PDF- dalam kode ASCII adalah [37, 80, 68, 70, 45]
  return (
    header[0] === 0x25 && // %
    header[1] === 0x50 && // P
    header[2] === 0x44 && // D
    header[3] === 0x46 && // F
    header[4] === 0x2d    // -
  );
}

/**
 * Endpoint Stateless untuk Trial Pengguna (Anonymous / Belum Login)
 * PENTING: Endpoint ini TIDAK menulis data apapun ke database.
 */
export async function POST(request: NextRequest) {
  try {
    // ── IP rate limit check ───────────────────────────────────────────────
    const clientIp = getClientIp(request);
    if (!checkIpRateLimit(clientIp)) {
      return NextResponse.json(
        {
          success: false,
          error: "Terlalu banyak percobaan trial dari IP ini. Coba lagi dalam 1 jam.",
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const customTitle = (formData.get("title") as string) || null;
    const contentLanguage = (formData.get("contentLanguage") as string) || "auto";

    if (!file) {
      return NextResponse.json(
        {
          success: false,
          error: "File PDF tidak ditemukan dalam request (field 'file' harus diisi).",
        },
        { status: 400 }
      );
    }

    const fileName = file.name || "Dokumen Tanpa Judul";
    const title =
      customTitle ||
      fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").trim() ||
      "Materi Pembelajaran";

    // Validasi format file
    const lowerName = fileName.toLowerCase();
    const isPdf =
      file.type === "application/pdf" || lowerName.endsWith(".pdf");

    if (!isPdf) {
      const isOffice =
        lowerName.endsWith(".doc") ||
        lowerName.endsWith(".docx") ||
        lowerName.endsWith(".ppt") ||
        lowerName.endsWith(".pptx");

      const errorMsg = isOffice
        ? "Format Word / PowerPoint belum didukung langsung. Silakan buka file tersebut dan pilih 'Save As / Export to PDF' terlebih dahulu."
        : "Format file tidak didukung. Mohon upload file dengan format PDF (.pdf).";

      return NextResponse.json(
        {
          success: false,
          error: errorMsg,
        },
        { status: 400 }
      );
    }

    // Convert file to ArrayBuffer
    const buffer = await file.arrayBuffer();

    // Validasi ukuran kosong
    if (buffer.byteLength === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "File PDF kosong (0 byte). Mohon periksa kembali file dokumen Anda.",
        },
        { status: 400 }
      );
    }

    // Validasi ukuran maksimal (15 MB)
    if (buffer.byteLength > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (buffer.byteLength / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          success: false,
          error: `Ukuran file terlalu besar (${sizeMb} MB). Maksimal ukuran file yang didukung adalah 15 MB.`,
        },
        { status: 400 }
      );
    }

    // Validasi keaslian header PDF (Magic Bytes)
    if (!isValidPdfHeader(buffer)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "File bukan merupakan dokumen PDF yang valid atau file telah rusak (corrupt).",
        },
        { status: 400 }
      );
    }

    // 1. Ekstraksi teks dari PDF
    const { text, totalPages, wordCount } = await extractPdfText(buffer);

    // Validasi teks hasil ekstraksi
    if (!text || text.trim().length === 0 || wordCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tidak ditemukan teks yang dapat dibaca dalam PDF ini. Dokumen kemungkinan berupa hasil scan gambar atau PDF yang diproteksi password.",
        },
        { status: 400 }
      );
    }

    // Edge case scan gambar
    if (totalPages > 2 && wordCount < 20) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Dokumen ini memiliki ${totalPages} halaman namun teks yang dapat diekstrak sangat minim (${wordCount} kata). Jika PDF berupa scan gambar/slide tanpa layer teks, silakan gunakan tool OCR terlebih dahulu.`,
        },
        { status: 400 }
      );
    }

    // 2. Ekstraksi Flashcards & Quiz dengan AI Pipeline
    const aiResult = await generateStudyMaterials(text, contentLanguage);

    if (aiResult.flashcards.length === 0 && aiResult.quiz.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "AI tidak berhasil menghasilkan flashcard atau quiz dari materi ini.",
        },
        { status: 500 }
      );
    }

    // 3. Return respons JSON murni (Tanpa menulis ke Database)
    return NextResponse.json(
      {
        success: true,
        title,
        raw_text: text,
        content_language: contentLanguage,
        flashcards: aiResult.flashcards,
        quiz: aiResult.quiz,
        totalPages,
        wordCount,
        isTruncated: aiResult.isTruncated,
        usedModel: aiResult.usedModel,
        latencyMs: aiResult.latencyMs,
        message: "Trial generate berhasil diproses.",
      },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, "POST /api/trial/generate");
  }
}
