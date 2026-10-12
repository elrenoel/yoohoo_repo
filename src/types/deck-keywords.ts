import { z } from "zod";

export const deckKeywordSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  term: z.string(),
  snippet: z.string().nullable(),
  normalizedTerm: z.string(),
  alreadyHasFlashcard: z.boolean(),
  twinIds: z.array(z.string().uuid()),
});

export const deckKeywordGroupSchema = z.object({
  documentId: z.string().uuid(),
  title: z.string(),
  keywords: z.array(deckKeywordSchema),
});

export const deckKeywordsResponseSchema = z.object({
  documents: z.array(deckKeywordGroupSchema),
});

export type DeckKeyword = z.infer<typeof deckKeywordSchema>;
export type DeckKeywordGroup = z.infer<typeof deckKeywordGroupSchema>;
export type DeckKeywordsResponse = z.infer<typeof deckKeywordsResponseSchema>;

export const generateFlashcardsRequestSchema = z.object({
  groupName: z.string().trim().max(60, "Nama grup maksimal 60 karakter.").optional(),
  idempotencyKey: z.string().uuid("Idempotency key tidak valid."),
  selections: z.array(z.object({
    document_id: z.string().uuid("ID materi tidak valid."),
    keyword_ids: z.array(z.string().uuid("ID keyword tidak valid.")).min(1, "Pilih setidaknya satu keyword."),
  })).min(1, "Pilih setidaknya satu keyword dari satu materi.").max(50, "Maksimal 50 materi per proses generate."),
}).superRefine((value, context) => {
  const keywordIds = new Set(value.selections.flatMap(selection => selection.keyword_ids));
  if (keywordIds.size > 50) {
    context.addIssue({ code: "custom", path: ["selections"], message: "Maksimal 50 keyword per proses generate." });
  }
});

export type GenerateFlashcardsRequest = z.infer<typeof generateFlashcardsRequestSchema>;

export type GenerateFlashcardsErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_SELECTION"
  | "DUPLICATE_REQUEST"
  | "QUOTA_EXCEEDED"
  | "DECK_NOT_FOUND"
  | "MATERIAL_NOT_FOUND"
  | "MATERIAL_NOT_READY"
  | "ACTIVE_JOB_EXISTS"
  | "INTERNAL_ERROR";

export type GenerateFlashcardsErrorResponse = {
  error: string;
  code: GenerateFlashcardsErrorCode;
  details?: unknown;
};
