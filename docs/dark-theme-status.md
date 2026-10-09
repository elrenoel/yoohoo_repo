# Dark theme migration status

Last updated: 2026-10-09 (Asia/Jakarta)

Branch: `feat/dark-theme`  
Visual baseline: clean worktree at commit `588b89f`

This document is the hand-off for continuing the semantic color migration after Batch 1 and the Flashcard work have landed on `main`. Do not rebase this branch before those changes are available.

## Semantic tokens

The source of truth is `src/app/globals.css`. Tailwind utilities are exposed from the same variables, so application components should use semantic utilities rather than palette utilities or raw color values.

| Role | Tokens | Intended use |
| --- | --- | --- |
| Page canvas | `--bg`, `--canvas-soft` | Main application canvas and the existing slightly tinted light canvas |
| Surfaces | `--surface`, `--surface-raised`, `--surface-sunken`, `--surface-hover` | Cards, menus, dialogs, inset areas, and hover hierarchy |
| Structure | `--border`, `--border-strong`, `--control-border` | Subtle card separators, emphasized boundaries, and accessible control outlines |
| Text | `--text`, `--text-secondary`, `--text-muted`, `--text-inverse` | Primary copy, supporting copy, nonessential metadata, and inverse text |
| Accent | `--accent`, `--accent-hover`, `--accent-subtle`, `--on-accent` | Active state, focus, links, and lime accent surfaces |
| Primary action | `--action-primary`, `--action-primary-hover`, `--on-action-primary` | Primary buttons whose light-theme color must remain visually compatible with the current product |
| Feedback | `--success-*`, `--warning-*`, `--danger-*` and matching `--on-*` tokens | Status surfaces, borders, text, icons, and labels |
| Interaction | `--focus-ring`, `--focus-offset` | Global visible keyboard focus |
| Loading | `--skeleton`, `--skeleton-highlight` | Semantic skeleton and shimmer |
| Chrome | `--scrollbar-track`, `--scrollbar-thumb`, `--scrollbar-thumb-hover` | Native-feeling themed scrollbar |

Dark key palette remains: background `#0C120F`, surface `#131B17`, raised surface `#1A2420`, border `#26332D`, primary text `#E8EEE9`, secondary text `#9AA9A0`, accent `#AADD66`, and danger `#F27B6B`. The dark muted text was raised to `#7C8D84` so it reaches 4.5:1 on both regular and raised surfaces.

## Usage rules

- Choose a token by UI role, never by resemblance to an old hex value.
- `text-muted` is only for nonessential metadata or decorative copy. Essential instructions, labels, values, and body text must use `text-secondary` or `text`.
- Use `control-border` for inputs, checkboxes, selects, outline buttons, and other functional control boundaries. Keep `border` for quiet card edges and separators.
- Text and icons on an accent surface must use `on-accent`. Text on the primary-action surface must use `on-action-primary`.
- Feedback surfaces must pair with their matching `on-success`, `on-warning`, or `on-danger` role. Quiz/error/success states also need an icon or explicit text label; color alone is insufficient.
- Use `currentColor` for icons unless the graphic is intentionally brand-owned.
- The Flashcard artwork is an explicit exception. Its fixed palette remains `#013528`, `#AADD66`, and `rgba(237, 234, 191, 0.8)` in both themes. It still needs a subtle semantic outline on dark canvases after the Flashcard branch is merged.
- User-uploaded images are not recolored; give them a subtle semantic border where necessary.
- Do not introduce raw hex/RGB values or built-in Tailwind palette utilities in application components. The final phase will enforce this in lint/CI, with explicit exceptions for the token source and Flashcard artwork.

## Completed on this branch

- Semantic light/dark token foundation and Tailwind exposure.
- `next-themes` integration with `system` as the default, hydration-safe HTML attributes, persistence, and matching `color-scheme`.
- System/Light/Dark selector in the More menu.
- Shared UI primitives, including controls, dropdowns, dialogs, toasts, tooltips, skeleton shimmer, focus ring, and scrollbar.
- Navigation chrome: sidebar, navbar, dropdowns, mobile navigation, and More menu, excluding `NotificationBell`.
- Quiz running view, quiz results, and attempt detail.
- Authentication screens: login and registration.
- Trial quiz and trial results.
- Trash screens.
- Not-found/error screens.

Commits are intentionally split by stage/area; retain that history when this branch is eventually rebased.

## Deferred until after rebase

These areas were deliberately not touched because they overlap Batch 1, Flashcard work, or a later migration area:

- `SocialActions`, `FollowControls`, and `ProfileFollowControls`.
- `NotificationBell`, notification hooks, notification pages, and notification cards.
- `PostComposer`, post cards, feed surfaces, and social-status labels.
- Saved page and its cards.
- Deck and flashcard shell, including `DeskWorkspaceNav`.
- Public deck shell/experience and public deck cards in the feed.
- All Flashcard components, trial Flashcard, learning/preview Flashcard views, and fixed-palette cleanup (`#fff`/`#ffe36e`).
- Profile surfaces and remaining desk/deck pages not named as completed above.
- Full Settings theme selector; the current selector intentionally exists only in More.
- Final lint/CI rule forbidding raw color literals and built-in Tailwind color utilities.

First next-stage defect after rebase: the **“Your Desk”** title in the dark quiz shell has insufficient contrast. It belongs to the deferred deck/flashcard shell and must be fixed through `DeskWorkspaceNav`/its semantic text role, not with a one-off color.

## Manual-review candidates

The following legacy colors/utilities are context-sensitive and must not be mass-replaced:

- `text-white`: decide among `on-accent`, `on-action-primary`, inverse text, or fixed artwork.
- `#164C3D`: may be an action surface, branded green, active icon, or text depending on context.
- `bg-neutral-900` / other neutral utilities: may represent modal chrome, primary action, tooltip, or a fixed visual.
- All button colors: review the button's semantic role before mapping.
- Literal colors inside Google/provider SVG artwork: keep brand-owned colors where required; otherwise migrate deliberately.
- `PublicDeckExperience.tsx`: was found active at the baseline inspection and therefore remains deferred rather than deleted or migrated in isolation.
- Authenticated/sidebar states, real feed/public-deck data, hover/focus states, high zoom, reduced motion, and browser-native form controls need another manual pass after rebase.
- Run a fresh repository-wide raw-color inventory after Batch 1 and Flashcard are merged; do not reuse the old count as if it were current.

## Light-theme baseline comparison

Screenshots were captured at the same viewport from the clean `588b89f` worktree and this branch in forced Light mode. Layout and feature logic were not intentionally changed.

| Page | Pixel summary | Result and explanation |
| --- | --- | --- |
| Quiz running | mean delta 1.497; 12.15% pixels changed | Geometry/content match. Differences are the intentionally stronger `control-border` and semantic status/control colors required for contrast. |
| Quiz results | mean delta 0.567; 7.74% changed | Geometry/content match. Small differences are semantic success/error surfaces and control borders. |
| Attempt detail | mean delta 0.991; 9.64% changed | Geometry/content match. Feedback backgrounds/borders are intentionally semantic. A transient dev “Compiling…” overlay appeared in one baseline capture and is not an application change. |
| Trial quiz | mean delta 1.287; 10.07% changed | Geometry/content match. Option borders and banner controls use the accessible semantic control roles. |
| Trial results | mean delta 1.227; 11.04% changed | Geometry/content match. Differences are limited to semantic feedback/control colors. |
| Trash | mean delta 0.049; 0.37% changed | Effectively identical. An unintended canvas mismatch was found and corrected with `canvas-soft`. |
| Not-found | mean delta 0.199; 0.82% changed | Effectively identical. Unintended canvas and radius changes were removed; remaining pixels are rendering noise/token plumbing. |

The intentional Light-theme differences above are limited to accessibility changes explicitly requested for control borders and feedback colors. No layout, spacing, or behavior change is intended. If future screenshots show larger deltas, treat them as regressions rather than acceptable theme drift.

## Theme boot and persistence verification

Chrome DevTools Protocol instrumentation sampled the HTML attribute from document start through first paint:

| Preference | Attribute timing | First paint | Cross-tab persistence |
| --- | --- | --- | --- |
| Dark | initial pre-script sample was unset at 232.7 ms; `data-theme=dark` by 269.6 ms | 372 ms | Second tab resolved `dark` and retained stored value `dark` |
| System with OS dark | initial pre-script sample was unset at 212.8 ms; `data-theme=dark` by 223.9 ms | 292 ms | Second tab resolved `dark` and retained stored value `system` |

In both cases the correct dark attribute was present before first paint, so no wrong-theme painted frame was observed. Storage was shared across tabs and the System preference remained System rather than being rewritten to Dark.

## Contrast verification

| Pair | Ratio | Requirement | Status |
| --- | ---: | ---: | --- |
| Dark muted `#7C8D84` on surface `#131B17` | 5.01:1 | 4.5:1 | Pass |
| Dark muted `#7C8D84` on raised `#1A2420` | 4.56:1 | 4.5:1 | Pass |
| Light danger text `#AA382F` on danger-subtle | 5.55:1 | 4.5:1 | Pass |
| Light control border `#8A948E` on white surface | 3.13:1 | 3:1 | Pass |
| Dark control border `#6F7F76` on surface `#131B17` | 4.16:1 | 3:1 | Pass |
| Dark control border `#6F7F76` on raised `#1A2420` | 3.78:1 | 3:1 | Pass |

Card borders and separators intentionally remain quieter because they are structural decoration rather than the sole boundary of an interactive control.

## Known pre-existing lint debt

Do not mix these unrelated fixes into the theme branch:

- Quiz page: state update inside an effect, handler referenced before declaration, hook dependency warning, and unused router.
- Quiz results: state update inside an effect.
- Trial quiz/results: state update inside effects.
- Navbar: existing raw `<img>` warning.

No new `any` should be introduced when continuing the migration.

## Resume procedure

1. Wait until Batch 1 and Flashcard changes are merged into `main`.
2. Rebase this branch then; do not rebase or merge it earlier.
3. Resolve overlapping UI files by preserving the newer interaction logic and applying semantic colors around it. Never overwrite optimistic behavior with this branch's older component version.
4. Re-run type-check, touched-file lint, contrast checks, and the full Light-baseline/Dark screenshot matrix.
5. Continue one area and one commit at a time, starting with the dark “Your Desk” shell contrast defect and the explicitly deferred areas above.
