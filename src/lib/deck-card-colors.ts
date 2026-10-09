export const DECK_CARD_COLORS = ["green", "blue", "peach", "lavender", "rose"] as const;

export type DeckCardColor = (typeof DECK_CARD_COLORS)[number];

export const DECK_CARD_THEMES: Record<DeckCardColor, {
  label: string;
  shell: string;
  folder: string;
  tab: string;
  border: string;
  ink: string;
  muted: string;
}> = {
  green: { label: "Green", shell: "#101914", folder: "#1d4d3d", tab: "#28624f", border: "#3f806a", ink: "#e8eee9", muted: "rgba(232,238,233,.78)" },
  blue: { label: "Blue", shell: "#10161d", folder: "#24415f", tab: "#315676", border: "#52789e", ink: "#f0f5fa", muted: "rgba(240,245,250,.80)" },
  peach: { label: "Peach", shell: "#1b1512", folder: "#6a3f2e", tab: "#80523c", border: "#a76f52", ink: "#fff3eb", muted: "rgba(255,243,235,.80)" },
  lavender: { label: "Lavender", shell: "#17141d", folder: "#44365f", tab: "#584873", border: "#79689a", ink: "#f5f0ff", muted: "rgba(245,240,255,.80)" },
  rose: { label: "Rose", shell: "#1c1316", folder: "#673441", tab: "#7e4352", border: "#a45c6e", ink: "#fff0f3", muted: "rgba(255,240,243,.80)" },
};

export function deckCardColor(value: unknown): DeckCardColor {
  return DECK_CARD_COLORS.includes(value as DeckCardColor) ? value as DeckCardColor : "green";
}
