/**
 * Centralized query-key factory.
 *
 * Using a single source of truth for query keys ensures that
 * invalidation always targets the exact same cache entry — no
 * misspelled or mismatched keys.
 */
export const queryKeys = {
  /** Document list (history page) */
  documents: ["documents"] as const,

  /** Flashcards for a specific document */
  flashcards: (docId: string) => ["flashcards", docId] as const,

  /** Quiz questions for a specific document + optional set */
  quiz: (docId: string, setId?: string | null) =>
    ["quiz", docId, setId ?? null] as const,

  /** Attempt list for a specific document */
  attempts: (docId: string) => ["attempts", docId] as const,

  /** Trashed documents (trash page) */
  trash: ["trash"] as const,

  /** Daily generation quota */
  quota: ["quota"] as const,
} as const;
