"use client";

import { useMemo, useState } from "react";
import { Difficulty, DIFFICULTIES, Score, ScoreTag, SCORE_TAGS, scoreDuration } from "@/lib/scores";
import { effectiveDifficulty } from "@/lib/score-prefs";
import { useI18n } from "@/lib/i18n";
import { DifficultyBadge, DIFFICULTY_STYLE, TAG_STYLE, TagPill } from "./ScoreBadges";

type SortKey = "title" | "difficulty";
const SORT_KEYS: SortKey[] = ["title", "difficulty"];

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
  onDifficultyChange: (score: Score, difficulty: Difficulty) => void;
}

export default function ScoreLibrary({
  scores,
  selectedId,
  onSelect,
  overrides,
  onDifficultyChange,
}: ScoreLibraryProps) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [tags, setTags] = useState<Set<ScoreTag>>(new Set());
  // "or": a score needs any selected label, "and": it needs all of them
  const [tagMode, setTagMode] = useState<"or" | "and">("or");
  const [levels, setLevels] = useState<Set<Difficulty>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "difficulty", asc: true });

  const visible = useMemo(() => {
    const q = normalize(search.trim());
    const filtered = scores.filter((s) => {
      if (q && !normalize(`${s.title} ${s.composer ?? ""}`).includes(q)) return false;
      if (tags.size > 0) {
        const has = (tag: ScoreTag) => s.tags.includes(tag);
        if (tagMode === "and" ? ![...tags].every(has) : ![...tags].some(has)) return false;
      }
      if (levels.size > 0 && !levels.has(effectiveDifficulty(s, overrides))) return false;
      return true;
    });
    const value = (s: Score): number | string => {
      switch (sort.key) {
        case "title": return normalize(s.title);
        case "difficulty": return DIFFICULTIES.indexOf(effectiveDifficulty(s, overrides));
      }
    };
    return filtered.sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = va < vb ? -1 : va > vb ? 1 : normalize(a.title).localeCompare(normalize(b.title));
      return sort.asc ? cmp : -cmp;
    });
  }, [scores, search, tags, tagMode, levels, sort, overrides]);

  const inactiveChip = "bg-card";

  return (
    <aside className="nb-card flex flex-col overflow-hidden lg:flex-1 lg:min-h-0">
      {/* Header */}
      <div className="px-4 py-3 bg-sun border-b-2 border-ink">
        <h2 className="nb-label text-sm">
          {t("scores.title")}
          <span className="ml-2 font-mono font-bold normal-case tracking-normal">
            {visible.length}/{scores.length}
          </span>
        </h2>
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
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold mr-0.5">{t("filter.labels")}</span>
            <div className="inline-flex border-2 border-ink rounded-nb overflow-hidden bg-card text-xs font-bold">
              {(["or", "and"] as const).map((mode, i) => (
                <button
                  key={mode}
                  onClick={() => setTagMode(mode)}
                  title={t(`filter.${mode}Title`)}
                  className={`px-2 py-0.5 transition-colors ${i > 0 ? "border-l-2 border-ink" : ""} ${
                    tagMode === mode ? "bg-sun" : "hover:bg-muted"
                  }`}
                >
                  {t(`filter.${mode}`)}
                </button>
              ))}
            </div>
          </div>
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
      <ul className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 max-h-[50vh] lg:max-h-none">
        {visible.map((s) => {
          const selected = s.id === selectedId;
          const difficulty = effectiveDifficulty(s, overrides);
          // Card and badge move together on hover/selection (the badge sits on top of the card button)
          const shift = selected
            ? "translate-x-0.5 translate-y-0.5"
            : "group-hover:-translate-x-px group-hover:-translate-y-px";
          return (
            <li key={s.id} className="relative group">
              <button
                onClick={() => onSelect(s)}
                className={`w-full text-left px-3 py-2.5 border-2 border-ink rounded-nb transition-all ${shift} ${
                  selected ? "bg-sun shadow-nb-sm" : "bg-card group-hover:shadow-nb-sm"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-bold leading-tight">{s.title}</span>
                  {/* Placeholder keeping room for the clickable badge below */}
                  <span className="shrink-0 invisible" aria-hidden>
                    <DifficultyBadge difficulty={difficulty} caret />
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
              {/* Not inside the card: a button can't contain another button */}
              <span className={`absolute top-3 right-3.5 transition-all ${shift}`}>
                <DifficultyBadge difficulty={difficulty} onChange={(d) => onDifficultyChange(s, d)} />
              </span>
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
