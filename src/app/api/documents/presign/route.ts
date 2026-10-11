import { randomUUID } from "node:crypto";
import { MAX_PDF_BYTES, RagError } from "@/lib/rag/core";
import { presignPdf } from "@/lib/rag/storage";
import { jsonBody, ragResponseError, sessionUser } from "@/lib/rag/http";
import { DAILY_LIMIT, getUserQuota } from "@/lib/daily-limit";
export const runtime = "nodejs";

function serverFailure(stage: "quota" | "presign", error: unknown) {
  const details = error instanceof Error
    ? { errorType: error.name, message: error.message, code: (error as Error & { code?: string }).code }
    : { errorType: "UnknownError", message: String(error), code: undefined };
  console.error(`[DOCUMENT PRESIGN] ${stage} failed`, details);

  if (stage === "quota") {
    return Response.json({
      code: "QUOTA_LOOKUP_FAILED",
      error: "Could not check the upload quota. Check the Supabase server configuration.",
    }, { status: 503 });
  }
  if (details.errorType === "CredentialsProviderError" || /credential/i.test(details.message)) {
    const missing = [
      !process.env.AWS_ACCESS_KEY_ID?.trim() && "AWS_ACCESS_KEY_ID",
      !process.env.AWS_SECRET_ACCESS_KEY?.trim() && "AWS_SECRET_ACCESS_KEY",
    ].filter(Boolean);
    return Response.json({
      code: "AWS_CREDENTIALS_UNAVAILABLE",
      error: missing.length
        ? `The server cannot read ${missing.join(" and ")}.`
        : "The server could not authenticate with AWS.",
      missing,
    }, { status: 503 });
  }
  if (/region/i.test(details.message)) {
    return Response.json({
      code: "AWS_REGION_MISSING",
      error: "The AWS region is not configured on the server.",
    }, { status: 503 });
  }
  return Response.json({
    code: "PRESIGN_FAILED",
    error: "The server could not prepare the S3 upload. Check the function log for [DOCUMENT PRESIGN].",
  }, { status: 503 });
}

export async function POST(request: Request) {
  try {
    const userId = await sessionUser(request);
    const { filename, contentType, fileSize } = await jsonBody(request);
    if (typeof filename !== "string" || filename.length > 255 || !filename.toLowerCase().endsWith(".pdf") || contentType !== "application/pdf") throw new RagError("Upload harus berupa PDF.");
    if (typeof fileSize !== "number" || !Number.isSafeInteger(fileSize) || fileSize <= 0 || fileSize > MAX_PDF_BYTES) throw new RagError("Ukuran PDF harus 1 byte sampai 100 MB.");
    let quota;
    try {
      quota = await getUserQuota(userId);
    } catch (error) {
      return serverFailure("quota", error);
    }
    if (!quota) throw new RagError("Data user tidak ditemukan.", 404);
    if (quota.remainingToday <= 0) return Response.json({ limitReached: true, remainingToday: 0, dailyLimit: DAILY_LIMIT, error: "Limit harian sudah tercapai. Coba lagi besok." }, { status: 429 });
    if (!process.env.AWS_REGION || !process.env.RAG_BUCKET_NAME) {
      console.error("[DOCUMENT PRESIGN] AWS configuration missing", {
        hasRegion: Boolean(process.env.AWS_REGION),
        hasBucket: Boolean(process.env.RAG_BUCKET_NAME),
      });
      return Response.json({
        code: "AWS_CONFIG_MISSING",
        error: "The AWS region or S3 bucket is not configured on the server.",
      }, { status: 503 });
    }
    if (process.env.VERCEL && (!process.env.AWS_ACCESS_KEY_ID?.trim() || !process.env.AWS_SECRET_ACCESS_KEY?.trim())) {
      const missing = [
        !process.env.AWS_ACCESS_KEY_ID?.trim() && "AWS_ACCESS_KEY_ID",
        !process.env.AWS_SECRET_ACCESS_KEY?.trim() && "AWS_SECRET_ACCESS_KEY",
      ].filter(Boolean);
      console.error("[DOCUMENT PRESIGN] AWS credentials missing in Vercel runtime", { missing });
      return Response.json({
        code: "AWS_CREDENTIALS_UNAVAILABLE",
        error: `The server cannot read ${missing.join(" and ")}.`,
        missing,
      }, { status: 503 });
    }
    const id = randomUUID();
    try {
      return Response.json({ documentId: id, ...await presignPdf(userId, id, fileSize) });
    } catch (error) {
      return serverFailure("presign", error);
    }
  } catch (error) { return ragResponseError(error); }
}
