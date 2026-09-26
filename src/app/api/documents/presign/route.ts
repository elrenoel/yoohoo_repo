import { randomUUID } from "node:crypto";
import { MAX_PDF_BYTES, RagError } from "@/lib/rag/core";
import { presignPdf } from "@/lib/rag/storage";
import { jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";
import { DAILY_LIMIT, getUserQuota } from "@/lib/daily-limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const userId = await sessionUser(request);
    const { filename, contentType, fileSize } = await jsonBody(request);
    if (typeof filename !== "string" || filename.length > 255 || !filename.toLowerCase().endsWith(".pdf") || contentType !== "application/pdf") throw new RagError("Upload harus berupa PDF.");
    if (typeof fileSize !== "number" || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_PDF_BYTES) throw new RagError("Ukuran PDF harus 1 byte sampai 100 MB.");
    const quota = await getUserQuota(userId);
    if (!quota) throw new RagError("Data user tidak ditemukan.", 404);
    if (quota.remainingToday <= 0) return Response.json({ limitReached: true, remainingToday: 0, dailyLimit: DAILY_LIMIT, error: "Limit harian sudah tercapai. Coba lagi besok." }, { status: 429 });
    const id = randomUUID();
    return Response.json({ documentId: id, ...await presignPdf(userId, id, fileSize) });
  } catch (error) { return ragResponseError(error); }
}
