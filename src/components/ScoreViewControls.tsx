"use client";

import { useI18n } from "@/lib/i18n";

export type ScoreView = "sheet" | "tiles";

// Transposition steps: Do3 ↔ Sol3 ↔ Do4 ↔ Sol4 ↔ Do5
export const TRANSPOSE_STEPS = [
  { semitones: -12, label: "Do3" },
  { semitones: -5, label: "Sol3" },
  { semitones: 0, label: "Do4" },
  { semitones: 7, label: "Sol4" },
  { semitones: 12, label: "Do5" },
];
export const DEFAULT_TRANSPOSE_IDX = 2; // Do4 = no transposition

const segment = (active: boolean, first: boolean) =>
  `px-2.5 py-1.5 text-xs font-bold transition-colors ${first ? "" : "border-l-2 border-ink"} ${
    active ? "bg-sun" : "bg-card hover:bg-muted"
  }`;

interface ScoreViewControlsProps {
  view: ScoreView;
  onViewChange: (view: ScoreView) => void;
  transposeIdx: number;
  onTransposeChange: (idx: number) => void;
}

/** How the open score is shown: sheet or falling tiles, and in which register */
export default function ScoreViewControls({
  view,
  onViewChange,
  transposeIdx,
  onTransposeChange,
}: ScoreViewControlsProps) {
  const { t } = useI18n();
  const last = TRANSPOSE_STEPS.length - 1;

  return (
    <>
      <div className="inline-flex border-2 border-ink rounded-nb overflow-hidden shadow-nb-sm">
        {(["sheet", "tiles"] as const).map((v, i) => (
          <button key={v} onClick={() => onViewChange(v)} className={segment(view === v, i === 0)}>
            {v === "sheet" ? `🎼 ${t("scores.viewSheet")}` : `🟨 ${t("scores.viewTiles")}`}
          </button>
        ))}
      </div>

      <div className="inline-flex border-2 border-ink rounded-nb overflow-hidden shadow-nb-sm">
        <button
          onClick={() => onTransposeChange(Math.max(0, transposeIdx - 1))}
          disabled={transposeIdx === 0}
          className={`${segment(false, true)} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          ▼
        </button>
        {TRANSPOSE_STEPS.map((step, i) => (
          <button key={i} onClick={() => onTransposeChange(i)} className={segment(i === transposeIdx, false)}>
            {step.label}
          </button>
        ))}
        <button
          onClick={() => onTransposeChange(Math.min(last, transposeIdx + 1))}
          disabled={transposeIdx === last}
          className={`${segment(false, false)} disabled:opacity-30 disabled:cursor-not-allowed`}
        >
          ▲
        </button>
      </div>
    </>
  );
}
