import { z } from "zod";
import { DECK_CARD_COLORS } from "@/lib/deck-card-colors";

export const POST_MAX_LENGTH = 500;
export const POST_MAX_IMAGES = 4;
export const POST_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const unifiedPostSchema = z.object({
  body: z.string().trim().max(POST_MAX_LENGTH, `Post maksimal ${POST_MAX_LENGTH} karakter.`).default(""),
  tags: z.array(z.string().trim().min(1).max(24)).max(3).default([])
    .transform(values => [...new Set(values.map(value => value.toLowerCase()))]),
  imageIds: z.array(z.uuid()).max(POST_MAX_IMAGES).default([]),
  deckId: z.uuid().nullable().optional(),
  deckColor: z.enum(DECK_CARD_COLORS).default("green"),
}).strict().refine(value => Boolean(value.body || value.imageIds.length || value.deckId), {
  message: "Tambahkan teks, gambar, atau deck sebelum mengirim.",
});

export const progressSchema = z.object({ cardId: z.uuid(), status: z.enum(["new","learning","known"]) }).strict();
