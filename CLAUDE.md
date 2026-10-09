@AGENTS.md

# UI style: neobrutalist, product-oriented

The whole app uses a neobrutalist style: playful but functional, never purely decorative. Keep new UI consistent with it.

## Tokens (src/app/globals.css)

- Colors: `ink` (#121212, text and borders), `paper` (page background, warm off-white with a dot grid), `card` (white panels), `muted` (beige), and flat accents `sun` (yellow), `sky`, `mint`, `tomato`, `pink`, `grape`.
- Shadows are hard offsets, never blurred: `shadow-nb-sm` (2px), `shadow-nb` (4px), `shadow-nb-lg` (6px). Radius: `rounded-nb` (10px).
- Fonts: Space Grotesk for text (`font-sans`), Archivo Black for titles and section labels (`font-display`), Space Mono for numbers like Hz, cents and BPM (`font-mono`).
- Light theme only. Don't introduce zinc/amber dark styles, gradients, glows or blurred shadows.

## Building blocks

- `nb-card`: white panel, 2px ink border, hard shadow. Use for every top-level section.
- `nb-btn`: pressable button that lifts on hover and presses flat on click. Give it a background color (`bg-sun`, `bg-card`…).
- `nb-chip`: pill for filters, tags and segmented choices. Inactive chips are white (`bg-card`), active ones get their color plus `shadow-nb-sm`. Don't fade inactive chips with opacity.
- `nb-input` for text fields, `nb-range` for sliders, `nb-label` for uppercase section headings.
- Segmented controls: a bordered group with `border-l-2 border-ink` dividers, the active segment in `bg-sun`.
- Borders are always 2px `border-ink`. Use dashed ink borders for empty states and tips.

## Color roles

Color carries meaning; keep it consistent.

- `sun`: primary action and current selection.
- `tomato`: recording, errors, destructive actions.
- `mint`: success, "mic on", in tune.
- `sky`: info and the open score's header. `pink`: secondary playful action (3… 2… 1…).
- Difficulty: easy `mint`, medium `sun`, hard `tomato`, impossible `ink` with white text.
- Labels: jazz `pink`, traditional `sky`, classical `grape`, exercise `muted`.
- Pitch accuracy keeps the `evaluatePitch` colors (green to red).

## Canvas (TileView)

Canvas drawing mirrors the same style through the `COLORS` constant and the `drawBox` / `stickerText` helpers: flat fills, 2px ink outlines, hard offset shadows, and the "pressed" state (shifted, no shadow) for active elements.
