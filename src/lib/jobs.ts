import { ragSql } from "@/lib/rag/db";
import { randomUUID } from "node:crypto";
import type { Json } from "@/db";

export type JobKind = "material_upload" | "flashcard_generate" | "quiz_generate";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "canceled";

export interface GenerationJob {
  id: string;
  user_id: string;
  kind: JobKind;
  status: JobStatus;
  deck_id: string | null;
  document_id: string | null;
  input: Json | null;
  result: Json | null;
  error_message: string | null;
  attempts: number;
  selected_keyword_ids: string[];
  expected_items: number;
  quota_count: number;
  remaining_quota: number;
  flashcard_count: number;
  quiz_count: number;
  idempotency_key: string;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  job_id: string | null;
  type: string | null;
  severity: "info" | "success" | "error" | null;
  title: string | null;
  body: string | null;
  link: string | null;
  dedupe_key: string;
  read_at: string | null;
  created_at: string;
}

export interface CreateJobInput {
  user_id: string;
  kind: JobKind;
  deck_id?: string | null;
  document_id?: string | null;
  input?: Json;
  idempotency_key: string;
  /** Keyword terpilih (NOT NULL di schema legacy generation_jobs). */
  selected_keyword_ids: string[];
  /** Jumlah keyword yang diharapkan selesai (CHECK expected_items > 0). */
  expected_items: number;
  quota_count?: number;
  remaining_quota?: number;
}

export type QuizGenerationVariant = "different" | "harder";

interface RecordCompletedQuizGenerationInput {
  userId: string;
  documentId: string;
  quizSetId: string;
  quizSetLabel: string;
  questionCount: number;
  remainingQuota: number;
  idempotencyKey: string;
  variant: QuizGenerationVariant;
  sourceQuizSetId?: string | null;
}

/**
 * Mencatat hasil generate ulang quiz sebagai job selesai. Trigger database
 * memakai row ini sebagai sumber notifikasi, sehingga retry tetap idempoten
 * dan detail notifikasi selalu terhubung ke materi serta set quiz yang benar.
 */
export async function recordCompletedQuizGeneration(input: RecordCompletedQuizGenerationInput): Promise<string> {
  const sql = ragSql();
  const jobInput = sql.json({
    variant: input.variant,
    sourceQuizSetId: input.sourceQuizSetId ?? null,
  } as Json);
  const jobResult = sql.json({
    quizSetId: input.quizSetId,
    quizSetLabel: input.quizSetLabel,
    questionCount: input.questionCount,
  } as Json);

  const [job] = await sql`
    INSERT INTO public.generation_jobs (
      id, user_id, kind, status, document_id, input, result,
      idempotency_key, selected_keyword_ids, expected_items,
      quota_count, remaining_quota, flashcard_count, quiz_count,
      attempts, created_at, started_at, finished_at, completed_at
    ) VALUES (
      ${randomUUID()}, ${input.userId}, 'quiz_generate', 'succeeded',
      ${input.documentId}, ${jobInput}, ${jobResult}, ${input.idempotencyKey},
      ARRAY[]::uuid[], ${Math.max(1, input.questionCount)}, 1,
      ${input.remainingQuota}, 0, ${input.questionCount}, 1,
      NOW(), NOW(), NOW(), NOW()
    )
    ON CONFLICT (user_id, idempotency_key) DO UPDATE SET
      status = 'succeeded',
      document_id = EXCLUDED.document_id,
      input = EXCLUDED.input,
      result = EXCLUDED.result,
      expected_items = EXCLUDED.expected_items,
      remaining_quota = EXCLUDED.remaining_quota,
      quiz_count = EXCLUDED.quiz_count,
      error_message = NULL,
      finished_at = NOW(),
      completed_at = NOW()
    RETURNING id
  `;

  await sql`
    UPDATE public.quiz_sets
    SET job_id = ${job.id}
    WHERE id = ${input.quizSetId}
      AND document_id = ${input.documentId}
  `;

  return String(job.id);
}

/**
 * Membuat job baru atau mengembalikan job yang sudah ada (idempoten).
 * Jika idempotency_key sudah pernah digunakan oleh user yang sama,
 * kembalikan job yang ada tanpa membuat yang baru.
 */
export async function createJob(input: CreateJobInput): Promise<GenerationJob> {
  const sql = ragSql();
  
  // Gunakan sql.json untuk JSON dan null untuk null values
  const inputJson = input.input !== undefined ? sql.json(input.input) : null;
  
  const [job] = await sql`
    INSERT INTO public.generation_jobs (
      id, user_id, kind, status, deck_id, document_id, input,
      idempotency_key, created_at, started_at, finished_at,
      attempts, error_message, result,
      selected_keyword_ids, expected_items, quota_count, remaining_quota
    ) VALUES (
      ${randomUUID()}, ${input.user_id}, ${input.kind}, 'queued',
      ${input.deck_id ?? null}, ${input.document_id ?? null},
      ${inputJson}, ${input.idempotency_key}, NOW(), NULL, NULL,
      0, NULL, NULL,
      ${sql.array(input.selected_keyword_ids)}::uuid[], ${input.expected_items},
      ${input.quota_count ?? 0}, ${input.remaining_quota ?? 0}
    )
    ON CONFLICT (user_id, idempotency_key) DO UPDATE
      SET status = EXCLUDED.status
      WHERE EXCLUDED.status = 'queued'
    RETURNING *
  `;
  return job as unknown as GenerationJob;
}

/**
 * Claim job yang sedang queued untuk diproses.
 * Hanya mengambil job jika statusnya masih 'queued'.
 * Return null jika tidak ada job yang bisa di-claim.
 */
export async function claimJob(jobId: string, userId: string, documentId?: string): Promise<GenerationJob | null> {
  const sql = ragSql();
  const [job] = await sql`
    UPDATE public.generation_jobs
    SET status = 'running', started_at = NOW(), attempts = attempts + 1
    WHERE id = ${jobId}
      AND user_id = ${userId}
      AND status = 'queued'
      ${documentId ? sql`AND document_id = ${documentId}` : sql``}
    RETURNING *
  `;
  return job as GenerationJob || null;
}

/**
 * Menandai job sebagai gagal dengan pesan error (dipotong 500 karakter).
 */
export async function failJob(jobId: string, userId: string, documentId?: string, errorCode?: string): Promise<void> {
  const sql = ragSql();
  const error = errorCode ? errorCode.slice(0, 500) : "Unknown error";
  await sql`
    UPDATE public.generation_jobs
    SET status = 'failed', error_message = ${error}, finished_at = NOW(), completed_at = NOW()
    WHERE id = ${jobId}
      AND user_id = ${userId}
      ${documentId ? sql`AND document_id = ${documentId}` : sql``}
  `;
}

/**
 * Menandai job sebagai berhasil.
 */
export async function completeJob(jobId: string, userId: string, documentId?: string): Promise<void> {
  const sql = ragSql();
  await sql`
    UPDATE public.generation_jobs
    SET status = 'succeeded', finished_at = NOW(), completed_at = NOW()
    WHERE id = ${jobId}
      AND user_id = ${userId}
      ${documentId ? sql`AND document_id = ${documentId}` : sql``}
  `;
}

/**
 * Membatalkan job yang sedang berjalan.
 */
export async function cancelJob(jobId: string, userId: string, documentId?: string): Promise<void> {
  const sql = ragSql();
  await sql`
    UPDATE public.generation_jobs
    SET status = 'canceled', finished_at = NOW(), completed_at = NOW()
    WHERE id = ${jobId}
      AND user_id = ${userId}
      ${documentId ? sql`AND document_id = ${documentId}` : sql``}
  `;
}

/**
 * Mendapatkan notifikasi untuk user tertentu dengan pagination.
 */
export async function getNotifications(
  userId: string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<{ notifications: Notification[]; total: number }> {
  const sql = ragSql();
  const limit = options.limit ?? 20;
  const offset = options.offset ?? 0;

  const notifications = await sql`
    SELECT * FROM public.notifications
    WHERE user_id = ${userId}
      ${options.unreadOnly ? sql`AND read_at IS NULL` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const [totalResult] = await sql`
    SELECT COUNT(*)::int as count FROM public.notifications
    WHERE user_id = ${userId}
      ${options.unreadOnly ? sql`AND read_at IS NULL` : sql``}
  `;

  return {
    notifications: notifications as unknown as Notification[],
    total: totalResult?.count ?? 0,
  };
}

/**
 * Menandai notifikasi sebagai sudah dibaca.
 */
export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  const sql = ragSql();
  await sql`
    UPDATE public.notifications
    SET read_at = NOW()
    WHERE id = ${notificationId}
      AND user_id = ${userId}
      AND read_at IS NULL
  `;
}

/**
 * Menandai semua notifikasi sebagai sudah dibaca.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const sql = ragSql();
  await sql`
    UPDATE public.notifications
    SET read_at = NOW()
    WHERE user_id = ${userId}
      AND read_at IS NULL
  `;
}

/**
 * Get count of unread notifications for badge.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const sql = ragSql();
  const [result] = await sql`
    SELECT COUNT(*)::int as count FROM public.notifications
    WHERE user_id = ${userId} AND read_at IS NULL
  `;
  return result?.count ?? 0;
}

/**
 * Polling helper: check if there's a running job for the user.
 * Return true jika ada job yang sedang berjalan (status = 'running' atau 'queued').
 */
export async function hasRunningJob(userId: string): Promise<boolean> {
  const sql = ragSql();
  const [result] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM public.generation_jobs
      WHERE user_id = ${userId}
        AND status IN ('queued', 'running')
      LIMIT 1
    ) as has_running
  `;
  return result?.has_running ?? false;
}

/**
 * Extended job status check - untuk polling UI.
 */
export async function getActiveJob(userId: string): Promise<GenerationJob | null> {
  const sql = ragSql();
  const [job] = await sql`
    SELECT * FROM public.generation_jobs
    WHERE user_id = ${userId}
      AND status IN ('queued', 'running')
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return job as GenerationJob | null;
}
