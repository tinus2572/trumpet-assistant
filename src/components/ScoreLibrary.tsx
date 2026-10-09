"use client";

import { useMemo, useState } from "react";
import { Difficulty, DIFFICULTIES, Score, ScoreTag, SCORE_TAGS, scoreDuration } from "@/lib/scores";
import { effectiveDifficulty } from "@/lib/score-prefs";
import { useI18n } from "@/lib/i18n";
import { DifficultyBadge, DIFFICULTY_STYLE, TagPill } from "./ScoreBadges";

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
      <aside className="lg:w-12 shrink-0">
        <button
          onClick={() => onFoldedChange(false)}
          title={t("library.unfold")}
          className="w-full lg:h-48 flex lg:flex-col items-center justify-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-zinc-400 hover:text-amber-400 hover:border-amber-500/50 transition-colors"
        >
          <span className="text-lg leading-none">»</span>
          <span className="text-xs font-medium uppercase tracking-wider lg:[writing-mode:vertical-rl]">
            {t("scores.title")}
          </span>
        </button>
      </aside>
    );
  }

  const chip = (active: boolean, activeClass = "bg-amber-500/20 border-amber-500 text-amber-300") =>
    `px-2 py-0.5 text-xs rounded-full border transition-colors ${
      active ? activeClass : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500"
    }`;

  return (
    <aside className="lg:w-80 shrink-0 bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          {t("scores.title")}
          <span className="ml-2 text-zinc-600 normal-case tracking-normal">
            {visible.length}/{scores.length}
          </span>
        </h2>
        <button
          onClick={() => onFoldedChange(true)}
          title={t("library.fold")}
          className="text-zinc-500 hover:text-amber-400 transition-colors text-lg leading-none px-1"
        >
          «
        </button>
      </div>

      {/* Search, filters, sort */}
      <div className="px-4 space-y-3 pb-3 border-b border-zinc-800">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("scores.search")}
          className="w-full px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
        />
        <div className="flex flex-wrap gap-1.5">
          {SCORE_TAGS.map((tag) => (
            <button key={tag} onClick={() => setTags((s) => toggled(s, tag))} className={chip(tags.has(tag))}>
              {t(`tag.${tag}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DIFFICULTIES.map((d) => (
            <button
              key={d}
              onClick={() => setLevels((s) => toggled(s, d))}
              className={chip(levels.has(d), DIFFICULTY_STYLE[d].active)}
            >
              {t(`difficulty.${d}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-zinc-600 mr-1">{t("sort.label")}</span>
          {SORT_KEYS.map((key) => {
            const active = sort.key === key;
            return (
              <button
                key={key}
                onClick={() => setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: true }))}
                className={`px-2 py-0.5 text-xs rounded transition-colors ${
                  active ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {t(`sort.${key}`)}
                {active && <span className="ml-0.5">{sort.asc ? "↑" : "↓"}</span>}
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
            className="text-xs text-zinc-500 hover:text-amber-400 transition-colors"
          >
            {t("library.clearFilters")}
          </button>
        )}
      </div>

      {/* List */}
      <ul className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[50vh] lg:max-h-none">
        {visible.map((s) => {
          const selected = s.id === selectedId;
          return (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                  selected
                    ? "bg-amber-500/10 border-amber-500/60"
                    : "border-transparent hover:bg-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`text-sm font-medium ${selected ? "text-amber-400" : "text-zinc-200"}`}>
                    {s.title}
                  </span>
                  <span className="shrink-0 mt-0.5">
                    <DifficultyBadge difficulty={effectiveDifficulty(s, overrides)} />
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {s.tags.map((tag) => (
                    <TagPill key={tag} tag={tag} />
                  ))}
                  <span className="text-[11px] text-zinc-500">
                    {s.composer && <>{s.composer} · </>}
                    {s.tempo} BPM · {Math.round(scoreDuration(s))}s
                  </span>
                </div>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="text-zinc-500 text-sm text-center py-6 px-4">{t("scores.none")}</li>
        )}
      </ul>
    </aside>
  );
}
