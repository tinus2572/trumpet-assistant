"use client";

import { Difficulty, DIFFICULTIES, ScoreTag } from "@/lib/scores";
import { useI18n } from "@/lib/i18n";

export const DIFFICULTY_STYLE: Record<Difficulty, { dot: string; active: string; text: string }> = {
  easy: { dot: "bg-green-500", active: "bg-green-500/20 border-green-500 text-green-300", text: "text-green-400" },
  medium: { dot: "bg-amber-400", active: "bg-amber-500/20 border-amber-400 text-amber-300", text: "text-amber-300" },
  hard: { dot: "bg-red-500", active: "bg-red-500/20 border-red-500 text-red-300", text: "text-red-400" },
  impossible: { dot: "bg-fuchsia-500", active: "bg-fuchsia-500/20 border-fuchsia-500 text-fuchsia-300", text: "text-fuchsia-400" },
};

export function TagPill({ tag }: { tag: ScoreTag }) {
  const { t } = useI18n();
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400">
      {t(`tag.${tag}`)}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const { t } = useI18n();
  const style = DIFFICULTY_STYLE[difficulty];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${style.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
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
      <span className="text-xs text-zinc-500 mr-1">{t("difficulty.label")}</span>
      {DIFFICULTIES.map((d) => (
        <button
          key={d}
          onClick={() => onChange(d)}
          className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${
            d === value
              ? DIFFICULTY_STYLE[d].active
              : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500"
          }`}
        >
          {t(`difficulty.${d}`)}
        </button>
      ))}
      {overridden && (
        <button
          onClick={() => onChange(null)}
          className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors ml-1"
          title={t("difficulty.reset")}
        >
          ↺
        </button>
      )}
    </div>
  );
}
