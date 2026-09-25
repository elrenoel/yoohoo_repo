import { extractText } from "unpdf";

export interface PdfExtractionResult {
  text: string;
  totalPages: number;
  wordCount: number;
  characterCount: number;
}

/**
 * Membersihkan dan menormalisasi teks hasil ekstraksi slide/PDF agar lebih ringkas:
 * - Menghilangkan spasi/tab berlebih
 * - Menghapus baris kosong berulang (> 2 baris kosong berurutan)
 * - Menghapus karakter kontrol aneh
 */
function cleanExtractedText(raw: string): string {
  if (!raw) return "";

  return raw
    // Normalisasi carriage return
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    // Ganti spasi/tab ganda dalam satu baris menjadi satu spasi
    .replace(/[ \t]+/g, " ")
    // Hapus spasi di awal/akhir tiap baris
    .split("\n")
    .map((line) => line.trim())
    // Satukan kembali dan batasi baris kosong berturut-turut maks 2
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Mengekstrak teks dari buffer file PDF menggunakan unpdf
 */
export async function extractPdfText(
  buffer: ArrayBuffer | Uint8Array | Buffer
): Promise<PdfExtractionResult> {
  try {
    // Pastikan data dikirim sebagai Uint8Array standar
    let uint8Array: Uint8Array;
    if (buffer instanceof Uint8Array && !Buffer.isBuffer(buffer)) {
      uint8Array = buffer;
    } else if (Buffer.isBuffer(buffer)) {
      uint8Array = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } else if (buffer instanceof ArrayBuffer) {
      uint8Array = new Uint8Array(buffer);
    } else {
      uint8Array = new Uint8Array(buffer);
    }

    const result = await extractText(uint8Array);
    const text = Array.isArray(result.text) ? result.text.join("\n\n") : String(result.text || "");
    const cleanedText = cleanExtractedText(text);
    const words = cleanedText ? cleanedText.split(/\s+/).filter(Boolean) : [];

    return {
      text: cleanedText,
      totalPages: result.totalPages || 1,
      wordCount: words.length,
      characterCount: cleanedText.length,
    };
  } catch (error) {
    throw new Error(
      `Gagal membaca file PDF: ${error instanceof Error ? error.message : "Format PDF tidak valid"}`
    );
  }
}
