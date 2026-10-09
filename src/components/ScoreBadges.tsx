"use client";

import { Difficulty, DIFFICULTIES, ScoreTag } from "@/lib/scores";
import { useI18n } from "@/lib/i18n";

/** Fill colors for each difficulty, from mint (easy) to ink (impossible) */
export const DIFFICULTY_STYLE: Record<Difficulty, string> = {
  easy: "bg-mint text-ink",
  medium: "bg-sun text-ink",
  hard: "bg-tomato text-ink",
  impossible: "bg-ink text-card",
};

export const TAG_STYLE: Record<ScoreTag, string> = {
  jazz: "bg-pink",
  traditional: "bg-sky",
  classical: "bg-grape",
  exercise: "bg-muted",
};

export function TagPill({ tag }: { tag: ScoreTag }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-px border-2 border-ink rounded-md ${TAG_STYLE[tag]}`}
    >
      {t(`tag.${tag}`)}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-block text-[10px] font-bold px-2 py-px border-2 border-ink rounded-full ${DIFFICULTY_STYLE[difficulty]}`}
    >
      {t(`difficulty.${difficulty}`)}
    </span>
  );
}

interface DifficultyPickerProps {
  value: Difficulty;
  /** Set when the player changed the default difficulty */
  overridden: boolean;
  onChange: (difficulty: Difficulty | null) => void;
}

export function DifficultyPicker({ value, overridden, onChange }: DifficultyPickerProps) {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-bold mr-1">{t("difficulty.label")}</span>
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`nb-chip ${d === value ? `${DIFFICULTY_STYLE[d]} shadow-nb-sm` : "bg-card"}`}
        >
          {t(`difficulty.${d}`)}
        </button>
      ))}
      {overridden && (
        <button
          onClick={() => onChange(null)}
          className="nb-chip bg-card"
          title={t("difficulty.reset")}
        >
          ↺
        </button>
      )}
    </div>
  );
}
