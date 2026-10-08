import type { BlobVariant } from "@/components/flashcard/FlashcardArtwork";

export function resolveBlobVariant(
  value: unknown,
  stableFallbackKey: string,
): BlobVariant {
  if (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 5
  ) {
    return value as BlobVariant;
  }

  let hash = 2166136261;
  for (let index = 0; index < stableFallbackKey.length; index += 1) {
    hash ^= stableFallbackKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 5 + 1) as BlobVariant;
}
