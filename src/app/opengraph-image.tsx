import { ImageResponse } from "next/og";
import { DARK_THEME } from "@/lib/theme-tokens";

export const alt = "Yoohoo — turn course PDFs into flashcards and quizzes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: DARK_THEME.bg,
        color: DARK_THEME.text,
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: 72,
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 980 }}>
        <div style={{ color: DARK_THEME.accent, display: "flex", fontSize: 34, fontWeight: 800 }}>YOOHOO</div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 800, letterSpacing: -3, lineHeight: 1.08, marginTop: 28 }}>
          Turn course PDFs into flashcards and quizzes.
        </div>
        <div style={{ color: DARK_THEME.textSecondary, display: "flex", fontSize: 30, marginTop: 34 }}>
          Learn what matters. Remember it longer.
        </div>
      </div>
    </div>,
    size,
  );
}
