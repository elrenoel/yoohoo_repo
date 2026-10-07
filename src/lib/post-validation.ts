import { z } from "zod";

export const postInputSchema = z.object({
  title: z.string().max(120, "Judul maksimal 120 karakter.").default(""),
  bodyMd: z.string().max(50_000, "Isi post maksimal 50.000 karakter.").default(""),
  embeddedPublicDeckId: z.uuid("Deck tidak valid.").nullable().optional(),
}).strict();

export const postPatchSchema = postInputSchema.partial().refine(value => Object.keys(value).length > 0, "Tidak ada perubahan.");

export function postSlug(title: string) {
  const base = title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "tips-belajar";
  return `${base}-${crypto.randomUUID().replaceAll("-", "").slice(0, 7)}`;
}

export function markdownExcerpt(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/(^|\s)[#>*_~+-]+(?=\s|$)/g, " ")
    .replace(/\s+/g, " ").trim().slice(0, 240);
}
