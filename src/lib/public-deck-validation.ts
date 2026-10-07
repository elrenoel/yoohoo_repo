import { z } from "zod";

export const publishDeckSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]).transform(items => [...new Set(items.map(item => item.toLowerCase()))]),
  language: z.string().trim().min(2).max(10).default("id"),
  caption: z.string().trim().max(500).optional().default(""),
}).strict();

export const attemptSchema = z.object({
  answers: z.array(z.object({
    questionId: z.uuid(),
    selectedIndex: z.number().int().min(0).nullable(),
    timeTakenMs: z.number().int().min(0).max(3_600_000).nullable().optional(),
  }).strict()).min(1).max(200),
  durationMs: z.number().int().min(0).max(86_400_000).nullable().optional(),
}).strict();

export function slugBase(title: string) {
  return title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "deck";
}
