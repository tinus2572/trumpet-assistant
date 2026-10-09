"use client";

import { useMemo, useState } from "react";
import { Difficulty, DIFFICULTIES, Score, ScoreTag, SCORE_TAGS, scoreDuration } from "@/lib/scores";
import { effectiveDifficulty } from "@/lib/score-prefs";
import { useI18n } from "@/lib/i18n";
import { DifficultyBadge, DIFFICULTY_STYLE, TAG_STYLE, TagPill } from "./ScoreBadges";

type SortKey = "title" | "difficulty" | "tempo" | "duration";
const SORT_KEYS: SortKey[] = ["title", "difficulty", "tempo", "duration"];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Toggle a value in a set, returning a new set */
function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

interface ScoreLibraryProps {
  scores: Score[];
  selectedId: string | null;
  onSelect: (score: Score) => void;
  overrides: Record<string, Difficulty>;
  folded: boolean;
  onFoldedChange: (folded: boolean) => void;
}

export default function ScoreLibrary({
  scores,
  selectedId,
  onSelect,
  overrides,
  folded,
  onFoldedChange,
}: ScoreLibraryProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<Set<ScoreTag>>(new Set());
  const [levels, setLevels] = useState<Set<Difficulty>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "difficulty", asc: true });

  const visible = useMemo(() => {
    const q = normalize(search.trim());
    const filtered = scores.filter((s) => {
      if (q && !normalize(`${s.title} ${s.composer ?? ""}`).includes(q)) return false;
      if (tags.size > 0 && !s.tags.some((tag) => tags.has(tag))) return false;
      if (levels.size > 0 && !levels.has(effectiveDifficulty(s, overrides))) return false;
      return true;
    });
    const value = (s: Score): number | string => {
      switch (sort.key) {
        case "title": return normalize(s.title);
        case "difficulty": return DIFFICULTIES.indexOf(effectiveDifficulty(s, overrides));
        case "tempo": return s.tempo;
        case "duration": return scoreDuration(s);
      }
    };
    return filtered.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : normalize(a.title).localeCompare(normalize(b.title));
      return sort.asc ? cmp : -cmp;
    });
  }, [scores, search, tags, levels, sort, overrides]);

  if (folded) {
    return (
      <aside className="lg:w-14 shrink-0">
        <button
          onClick={() => onFoldedChange(false)}
          title={t("library.unfold")}
          className="nb-btn bg-sun w-full lg:h-52 lg:flex-col px-3 py-2"
        >
          <span className="text-lg leading-none">»</span>
          <span className="nb-label lg:[writing-mode:vertical-rl]">{t("scores.title")}</span>
        </button>
      </aside>
    );
  }

  const inactiveChip = "bg-card";

  return (
    <aside className="nb-card lg:w-80 shrink-0 flex flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-sun border-b-2 border-ink">
        <h2 className="nb-label text-sm">
          {t("scores.title")}
          <span className="ml-2 font-mono font-bold normal-case tracking-normal">
            {visible.length}/{scores.length}
          </span>
        </h2>
        <button
          onClick={() => onFoldedChange(true)}
          title={t("library.fold")}
          className="nb-btn bg-card w-8 h-8 text-lg leading-none"
        >
          «
        </button>
      </div>

      {/* Search, filters, sort */}
      <div className="px-4 py-3 space-y-3 border-b-2 border-ink bg-paper">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("scores.search")}
          className="nb-input text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {SCORE_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setTags((s) => toggled(s, tag))}
              className={`nb-chip ${tags.has(tag) ? `${TAG_STYLE[tag]} shadow-nb-sm` : inactiveChip}`}
            >
              {t(`tag.${tag}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setLevels((s) => toggled(s, d))}
              className={`nb-chip ${levels.has(d) ? `${DIFFICULTY_STYLE[d]} shadow-nb-sm` : inactiveChip}`}
            >
              {t(`difficulty.${d}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold mr-0.5">{t("sort.label")}</span>
          {SORT_KEYS.map((key) => {
            const active = sort.key === key;
            return (
              <button
                key={key}
                onClick={() => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }))}
                className={`nb-chip ${active ? "bg-ink text-card" : inactiveChip}`}
              >
                {t(`sort.${key}`)}
                {active && <span>{sort.asc ? "↑" : "↓"}</span>}
              </button>
            );
          })}
        </div>
        {(tags.size > 0 || levels.size > 0 || search) && (
          <button
            onClick={() => {
              setTags(new Set());
              setLevels(new Set());
              setSearch("");
            }}
            className="text-xs font-bold underline underline-offset-2 decoration-2 hover:decoration-sun-deep"
          >
            {t("library.clearFilters")}
          </button>
        )}
      </div>

      {/* List */}
      <ul className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[50vh] lg:max-h-none">
        {visible.map((s) => {
          const selected = s.id === selectedId;
          return (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s)}
                className={`w-full text-left px-3 py-2.5 border-2 border-ink rounded-nb transition-all ${
                  selected
                    ? "bg-sun shadow-nb-sm translate-x-0.5 translate-y-0.5"
                    : "bg-card hover:shadow-nb-sm hover:-translate-x-px hover:-translate-y-px"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold leading-tight">{s.title}</span>
                  <span className="shrink-0">
                    <DifficultyBadge difficulty={effectiveDifficulty(s, overrides)} />
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  {s.tags.map((tag) => (
                    <TagPill key={tag} tag={tag} />
                  ))}
                  <span className="text-[11px] font-medium text-ink/60">
                    {s.composer && <>{s.composer} · </>}
                    {s.tempo} BPM · {Math.round(scoreDuration(s))}s
                  </span>
                </div>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="text-sm font-medium text-center py-6 px-4 text-ink/60">{t("scores.none")}</li>
        )}
      </ul>
    </aside>
  );
}
