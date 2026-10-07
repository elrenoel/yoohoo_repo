import { z } from "zod";

export const exploreQuerySchema = z.object({
  q: z.string().trim().max(80).default(""),
  tab: z.enum(["all", "deck", "post", "people"]).default("all"),
  tag: z.string().trim().toLowerCase().max(40).default(""),
  sort: z.enum(["newest", "popular", "proven"]).default("newest"),
});

const cursorSchema = z.object({
  sort: z.enum(["newest", "popular", "proven"]),
  value: z.number(),
  publishedAt: z.iso.datetime(),
  id: z.string().min(1).max(255),
  type: z.enum(["deck", "post", "people"]),
});

export type ExploreCursor = z.infer<typeof cursorSchema>;
export function encodeExploreCursor(value: ExploreCursor) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}
export function decodeExploreCursor(value: string | null) {
  if (!value) return null;
  try {
    return cursorSchema.parse(JSON.parse(Buffer.from(value, "base64url").toString("utf8")));
  } catch {
    return null;
  }
}
