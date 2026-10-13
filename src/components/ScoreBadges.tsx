"use client";

import { Difficulty, DIFFICULTIES, ScoreTag } from "@/lib/scores";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  christmas: "bg-mint",
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

interface DifficultyBadgeProps {
  difficulty: Difficulty;
  /** When set, the badge is a button opening a small chooser */
  onChange?: (difficulty: Difficulty) => void;
  /** Show the ▾ caret on a plain badge too (to reserve the clickable badge's width) */
  caret?: boolean;
}

export function DifficultyBadge({ difficulty, onChange, caret }: DifficultyBadgeProps) {
  const { t } = useI18n();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  // Where the chooser opens (fixed position, under the badge or above it near the bottom of the window)
  const [anchor, setAnchor] = useState<CSSProperties | null>(null);

  // Close on outside click, Escape, scroll or resize
  useEffect(() => {
    if (!anchor) return;
    const close = () => setAnchor(null);
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!popoverRef.current?.contains(target) && !buttonRef.current?.contains(target)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Don't also leave full screen or close a dialog
      e.stopPropagation();
      close();
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor]);

  const className = `inline-block text-[10px] font-bold px-2 py-px border-2 border-ink rounded-full ${DIFFICULTY_STYLE[difficulty]}`;
  if (!onChange) {
    return (
      <span className={className}>
        {t(`difficulty.${difficulty}`)}
        {caret && " ▾"}
      </span>
    );
  }

  const toggle = () => {
    if (anchor) return setAnchor(null);
    const r = buttonRef.current!.getBoundingClientRect();
    const right = window.innerWidth - r.right;
    setAnchor(
      r.bottom + 180 > window.innerHeight
        ? { right, bottom: window.innerHeight - r.top + 6 }
        : { right, top: r.bottom + 6 }
    );
  };

  return (
    <>
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        title={t("difficulty.change")}
        aria-haspopup="listbox"
        aria-expanded={!!anchor}
        className={`${className} cursor-pointer transition-shadow hover:shadow-nb-sm ${anchor ? "shadow-nb-sm" : ""}`}
      >
        {t(`difficulty.${difficulty}`)} ▾
      </button>
      {anchor &&
        createPortal(
          <div
            ref={popoverRef}
            role="listbox"
            aria-label={t("difficulty.change")}
            style={anchor}
            className="fixed z-[70] nb-card p-1.5 flex flex-col gap-1"
          >
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                role="option"
                aria-selected={d === difficulty}
                autoFocus={d === difficulty}
                onClick={() => {
                  onChange(d);
                  setAnchor(null);
                }}
                className={`nb-chip justify-between gap-3 ${DIFFICULTY_STYLE[d]} ${d === difficulty ? "shadow-nb-sm" : ""}`}
              >
                {t(`difficulty.${d}`)}
                <span className={d === difficulty ? "" : "invisible"}>✓</span>
              </button>
            ))}
          </div>,
          document.body
        )}
    </>
  );
}
