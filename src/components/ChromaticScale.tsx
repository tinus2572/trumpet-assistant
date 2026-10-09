"use client";

import { useState } from "react";
import { Note, NoteInfo, evaluatePitch, TRUMPET_RANGE } from "@/lib/trumpet";
import { useI18n } from "@/lib/i18n";

const SCALE = TRUMPET_RANGE;

interface ChromaticScaleProps {
  currentNote: NoteInfo | null;
}

export default function ChromaticScale({ currentNote }: ChromaticScaleProps) {
  const { t, dn } = useI18n();
  const [hover, setHover] = useState<number | null>(null);

  const activeKey = currentNote
    ? `${currentNote.writtenNote}${currentNote.writtenOctave}`
    : null;
  const pitchQuality = currentNote ? evaluatePitch(currentNote.centsOffset) : null;

  const cents = currentNote?.centsOffset ?? 0;

  return (
    <section className="nb-card p-4">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <h2 className="nb-label">{t("range.title")}</h2>
        <div className="flex items-center gap-2 h-9">
          {currentNote ? (
            <>
              <span
                className="min-w-14 text-center font-display text-lg px-2 py-0.5 border-2 border-ink rounded-nb shadow-nb-sm"
                style={{ backgroundColor: pitchQuality?.color }}
              >
                {dn(currentNote.writtenNote)}
                <span className="text-sm">{currentNote.writtenOctave}</span>
              </span>
              <span className="text-xs font-mono font-bold tabular-nums">
                {Math.round(currentNote.frequency)} Hz
              </span>
              <span className="text-xs font-mono font-bold tabular-nums px-1.5 py-0.5 border-2 border-ink rounded-md bg-card">
                {cents > 0 ? "+" : ""}
                {cents}¢
              </span>
            </>
          ) : (
            <span className="text-xs font-semibold text-ink/50">—</span>
          )}
        </div>
      </div>

      {/* Chromatic scale */}
      <div className="relative flex gap-0.5">
        {SCALE.map((n, i) => {
          const clef = `${n.name}${n.octave}`;
          const active = clef === activeKey;
          const hovered = hover === i;
          const isC = n.name === Note.C;
          const showLabel = active || hovered || n.natural;

          return (
            <div
              key={i}
              className="flex-1 min-w-0 flex flex-col items-center gap-1 relative"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* Hover tooltip */}
              {hovered && !active && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  <div className="nb-card px-2.5 py-1.5 whitespace-nowrap">
                    <p className="font-display text-sm">
                      {dn(n.name)}
                      <span className="text-[10px]">{n.octave}</span>
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      {n.pistons.map((pressed, pi) => (
                        <div
                          key={pi}
                          className={`w-4 h-5 rounded-sm border-2 border-ink text-[9px] flex items-center justify-center font-bold ${
                            pressed ? "bg-sun" : "bg-card text-ink/30"
                          }`}
                        >
                          {pi + 1}
                        </div>
                      ))}
                      <span className="text-[10px] font-semibold ml-1">{n.fingeringLabel}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Key: naturals are tall and white, sharps short and black, like a keyboard */}
              <div
                className={`w-full border-2 border-ink rounded-b-md transition-all duration-100 cursor-pointer ${
                  n.natural ? "h-11" : "h-7"
                } ${
                  active
                    ? "translate-y-0.5"
                    : hovered
                    ? "bg-sun"
                    : n.natural
                    ? "bg-card"
                    : "bg-ink"
                }`}
                style={active ? { backgroundColor: pitchQuality?.color } : undefined}
              />
              {/* Label */}
              <span
                className={`text-center leading-none truncate max-w-full ${
                  active || hovered
                    ? "font-bold text-[11px]"
                    : n.natural
                    ? `text-[9px] ${isC ? "font-bold" : "font-medium text-ink/50"}`
                    : "text-transparent text-[9px]"
                }`}
              >
                {showLabel ? dn(n.name) : "·"}
                {(isC || active || hovered || i === 0) && <span className="text-[8px]">{n.octave}</span>}
              </span>
            </div>
          );
        })}
      </div>

      {/* Tuner: always shown so the layout doesn't jump */}
      <div className="mt-3 flex items-center gap-2">
        <span className="text-sm font-bold w-5 text-right">&#9837;</span>
        <div className="flex-1 relative h-4 border-2 border-ink rounded-full bg-card overflow-hidden">
          {/* In-tune zone */}
          <div className="absolute inset-y-0 left-[45%] w-[10%] bg-mint" />
          <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-ink" />
          {currentNote && (
            <div
              className="absolute top-1/2 h-5 w-2.5 -translate-x-1/2 -translate-y-1/2 border-2 border-ink rounded-sm transition-all duration-100"
              style={{
                left: `${Math.max(3, Math.min(97, 50 + cents))}%`,
                backgroundColor: pitchQuality?.color,
              }}
            />
          )}
        </div>
        <span className="text-sm font-bold w-5">&#9839;</span>
      </div>
    </section>
  );
}
