import { createHash } from "node:crypto";
import { S3Client, GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SFNClient, StartExecutionCommand } from "@aws-sdk/client-sfn";
import { MAX_PDF_BYTES, RagError } from "./core";

let client: S3Client | undefined;
let workflowClient: SFNClient | undefined;
export function s3() { return client ??= new S3Client({ region: process.env.AWS_REGION, requestChecksumCalculation: "WHEN_REQUIRED" }); }
function sfn() { return workflowClient ??= new SFNClient({ region: process.env.AWS_REGION }); }
export function bucket() {
  if (!process.env.RAG_BUCKET_NAME) throw new Error("RAG_BUCKET_NAME is required");
  return process.env.RAG_BUCKET_NAME;
}
export function pdfKey(userId: string, id: string) {
  return `uploads/${createHash("sha256").update(userId).digest("hex")}/${id}.pdf`;
}
export async function presignPdf(userId: string, id: string, size: number) {
  const headers = { "Content-Type": "application/pdf", "If-None-Match": "*" };
  const uploadUrl = await getSignedUrl(s3(), new PutObjectCommand({ Bucket: bucket(), Key: pdfKey(userId, id),
    ContentType: headers["Content-Type"], ContentLength: size, IfNoneMatch: "*" }), {
    expiresIn: 300, signableHeaders: new Set(["content-type", "content-length", "if-none-match"]),
  });
  return { uploadUrl, headers, expiresIn: 300 };
}
export async function verifyPdf(key: string) {
  const head = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  const size = head.ContentLength ?? 0;
  if (!size || size > MAX_PDF_BYTES || head.ContentType !== "application/pdf") throw new RagError("PDF kosong, terlalu besar, atau tipe file salah.");
  const prefix = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key, Range: "bytes=0-4" }));
  if (Buffer.from(await prefix.Body!.transformToByteArray()).toString() !== "%PDF-") throw new RagError("Header PDF tidak valid.");
  return size;
}
export async function readPdf(key: string) {
  const result = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!result.ContentLength || result.ContentLength > MAX_PDF_BYTES) throw new Error("Invalid PDF size");
  return result.Body!.transformToByteArray();
}
export async function dispatchDocument(documentId: string, userId: string) {
  // Only the trusted backend can write ready/*; browsers can PUT only their signed PDF key.
  // This ObjectCreated event happens AFTER the document transaction commits.
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: `ready/${documentId}.json`,
    ContentType: "application/json", Body: JSON.stringify({ documentId, userId }) }));
}

export async function dispatchGeneration(jobId: string, documentId: string, userId: string, chunkIds: string[]) {
  const stateMachineArn = process.env.RAG_STATE_MACHINE_ARN;
  if (!stateMachineArn) throw new Error("RAG_STATE_MACHINE_ARN is required");
  try {
    await sfn().send(new StartExecutionCommand({
      stateMachineArn,
      name: jobId,
      input: JSON.stringify({ mode: "generate", jobId, documentId, userId, chunkIds }),
    }));
  } catch (error) {
    if (error instanceof Error && error.name === "ExecutionAlreadyExists") return;
    throw error;
  }
}
