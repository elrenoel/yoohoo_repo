import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";

export const deckVisibilitySchema = z.enum(["private", "unlisted", "public"]);
export const shareDeckSchema = z.object({ visibility: deckVisibilitySchema });

// Must satisfy both decks.slug and the existing public_decks_slug_format check.
const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
export function newShareSlug(length = 9) {
  const bytes = randomBytes(length);
  return Array.from(bytes, byte => ALPHABET[byte % ALPHABET.length]).join("");
}
