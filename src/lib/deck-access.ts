export type DeckAccessRow = { user_id: string; visibility: "private" | "unlisted" | "public"; deleted_at?: unknown };

export function canViewDeck(deck: DeckAccessRow, userId?: string | null) {
  return !deck.deleted_at && (deck.user_id === userId || deck.visibility === "public" || deck.visibility === "unlisted");
}

export function canEditDeck(deck: Pick<DeckAccessRow, "user_id">, userId?: string | null) {
  return Boolean(userId && deck.user_id === userId);
}
