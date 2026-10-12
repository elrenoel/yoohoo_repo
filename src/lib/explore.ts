import { z } from "zod";

export type ExploreSearch =
  | { mode: "idle"; raw: string; term: ""; tags: [] }
  | { mode: "tag"; raw: string; term: string; tags: string[] }
  | { mode: "account" | "mixed"; raw: string; term: string; tags: [] };

export function parseExploreSearchQuery(input: string): ExploreSearch {
  const raw = input.slice(0, 80).trim().replace(/\s+/g, " ");
  if (raw.startsWith("#")) {
    const tags = raw.slice(1).trim().split(/\s+/).map(value => value.replace(/^#+/, "").toLocaleLowerCase("en")).filter(Boolean);
    return tags[0] ? { mode: "tag", raw, term: tags[0], tags: [...new Set(tags)] } : { mode: "idle", raw, term: "", tags: [] };
  }
  const account = raw.startsWith("@");
  const term = (account ? raw.slice(1) : raw).trim().toLocaleLowerCase("en");
  if (!term || (!account && term.length < 2)) return { mode: "idle", raw, term: "", tags: [] };
  return { mode: account ? "account" : "mixed", raw, term, tags: [] };
}

export function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

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
