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
  green: { label: "Green", shell: "#EDF2F4", folder: "#4E8B75", tab: "#5A9982", border: "#2E6D58", ink: "#FFFFFF", muted: "rgba(255,255,255,.78)" },
  blue: { label: "Blue", shell: "#EEF3F8", folder: "#7699BE", tab: "#88A9CA", border: "#557A9F", ink: "#FFFFFF", muted: "rgba(255,255,255,.82)" },
  peach: { label: "Peach", shell: "#FAF1EB", folder: "#D99A78", tab: "#E5AA8B", border: "#BB7958", ink: "#35251D", muted: "rgba(53,37,29,.72)" },
  lavender: { label: "Lavender", shell: "#F2EFF9", folder: "#9B8BC2", tab: "#AB9BCF", border: "#7868A0", ink: "#FFFFFF", muted: "rgba(255,255,255,.82)" },
  rose: { label: "Rose", shell: "#FAEFF1", folder: "#C88998", tab: "#D49AA7", border: "#A96676", ink: "#FFFFFF", muted: "rgba(255,255,255,.82)" },
};

export function deckCardColor(value: unknown): DeckCardColor {
  return DECK_CARD_COLORS.includes(value as DeckCardColor) ? value as DeckCardColor : "green";
}
