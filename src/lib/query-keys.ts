/**
 * Centralized query-key factory.
 *
 * Using a single source of truth for query keys ensures that
 * invalidation always targets the exact same cache entry — no
 * misspelled or mismatched keys.
 */
export const queryKeys = {
  feedRoot: ["feed"] as const,
  feed: ["feed", "following"] as const,
  feedForYou: ["feed", "for-you"] as const,
  feedSuggestions: ["feed", "suggestions"] as const,
  explore: (filters: { q: string; tab: string; tag: string; sort: string }) =>
    ["explore", filters] as const,
  exploreTags: ["explore", "tags"] as const,
  posts: (userId?: string) => ["posts", userId ?? "guest"] as const,
  profile: (userId?: string) => ["profile", userId ?? "guest"] as const,
  publicDeckRoot: ["public-deck"] as const,
  publicDeck: (slug: string) => ["public-deck", slug] as const,
  saved: (targetType: "post" | "public_deck") => ["saved", targetType] as const,
  comments: (targetType: "post" | "public_deck", targetId: string) =>
    ["comments", targetType, targetId] as const,
  publicDeckProgress: (deckId: string, userId?: string) =>
    ["public-deck-progress", deckId, userId ?? "guest"] as const,
  /** Document list (history page) */
  documents: ["documents"] as const,

  /** Flashcards for a specific document */
  flashcards: (docId: string) => ["flashcards", docId] as const,

  /** Quiz questions for a specific document + optional set */
  quiz: (docId: string, setId?: string | null) =>
    ["quiz", docId, setId ?? null] as const,

  /** Attempt list for a specific document */
  attempts: (docId: string) => ["attempts", docId] as const,

  /** Daily generation quota */
  quota: ["quota"] as const,

  /** Notifications */
  notifications: (
    userId?: string,
    filter?: "all" | "unread",
    limit?: number,
    offset?: number
  ) => ["notifications", userId ?? "guest", filter ?? "all", limit ?? 50, offset ?? 0] as const,
  unreadCount: (userId?: string) => ["unread-count", userId ?? "guest"] as const,
} as const;
