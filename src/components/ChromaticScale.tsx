"use client";

import { useState } from "react";
import { Note, NoteInfo, evaluatePitch, FINGERINGS, NOTE_TO_SEMITONE, formatValves } from "@/lib/trumpet";
import { useI18n } from "@/lib/i18n";

// Written chromatic scale for Bb trumpet: Fa#2 -> Do5 (31 notes)
const SCALE: { name: Note; octave: number; natural: boolean; pistons: [boolean, boolean, boolean]; fingeringLabel: string }[] = [
  Note.Fs, Note.G, Note.Gs, Note.A, Note.As, Note.B,
  Note.C, Note.Cs, Note.D, Note.Ds, Note.E, Note.F, Note.Fs, Note.G, Note.Gs, Note.A, Note.As, Note.B,
  Note.C, Note.Cs, Note.D, Note.Ds, Note.E, Note.F, Note.Fs, Note.G, Note.Gs, Note.A, Note.As, Note.B,
  Note.C,
].map((name, i) => {
  const octave = i < 6 ? 2 : i < 18 ? 3 : i < 30 ? 4 : 5;
  const natural = !name.includes("#");
  const pistons = FINGERINGS[NOTE_TO_SEMITONE[name]] ?? [false, false, false];
  return { name, octave, natural, pistons, fingeringLabel: formatValves(pistons) };
});

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

  return (
    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          {t("range.title")}
        </h2>
        {currentNote && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold" style={{ color: pitchQuality?.color }}>
              {dn(currentNote.writtenNote)}{currentNote.writtenOctave}
            </span>
            <span className="text-xs text-zinc-500">
              {Math.round(currentNote.frequency)} Hz
            </span>
            <span
              className="text-xs font-medium"
              style={{ color: pitchQuality?.color }}
            >
              {currentNote.centsOffset > 0 ? "+" : ""}
              {currentNote.centsOffset}¢
            </span>
          </div>
        )}
      </div>

      {/* Chromatic scale */}
      <div className="relative flex gap-px">
        {SCALE.map((n, i) => {
          const clef = `${n.name}${n.octave}`;
          const active = clef === activeKey;
          const hovered = hover === i;
          const isC = n.name === Note.C;
          const showLabel = active || hovered || n.natural;

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center gap-1 relative"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {/* Hover tooltip */}
              {hovered && !active && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                  <div className="bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 py-1.5 whitespace-nowrap shadow-xl">
                    <p className="text-xs font-bold text-amber-400">
                      {dn(n.name)}<span className="text-[10px] text-zinc-400">{n.octave}</span>
                    </p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {n.pistons.map((pressed, pi) => (
                        <div
                          key={pi}
                          className={`w-3.5 h-5 rounded-sm border text-[8px] flex items-center justify-center font-bold ${
                            pressed
                              ? "border-amber-400 bg-amber-500/30 text-amber-400"
                              : "border-zinc-600 bg-zinc-800 text-zinc-600"
                          }`}
                        >
                          {pi + 1}
                        </div>
                      ))}
                      <span className="text-[10px] text-zinc-400 ml-0.5">{n.fingeringLabel}</span>
                    </div>
                  </div>
                  <div className="w-2 h-2 bg-zinc-800 border-b border-r border-zinc-600 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1" />
                </div>
              )}

              {/* Note bar */}
              <div
                className={`w-full rounded-sm transition-all duration-100 cursor-pointer ${
                  n.natural ? "h-10" : "h-7"
                } ${
                  active
                    ? "shadow-lg"
                    : hovered
                    ? "bg-amber-500/30"
                    : n.natural
                    ? "bg-zinc-700/60"
                    : "bg-zinc-800/80"
                }`}
                style={
                  active
                    ? {
                        backgroundColor: pitchQuality?.color,
                        boxShadow: `0 0 12px ${pitchQuality?.color}60`,
                      }
                    : undefined
                }
              />
              {/* Label */}
              <span
                className={`text-center leading-none transition-colors ${
                  active
                    ? "font-bold text-xs"
                    : hovered
                    ? "font-medium text-[10px] text-amber-400"
                    : n.natural
                    ? "text-zinc-600 text-[9px]"
                    : "text-transparent text-[9px]"
                } ${!active && !hovered && isC ? "text-zinc-400" : ""}`}
                style={active ? { color: pitchQuality?.color } : undefined}
              >
                {showLabel ? dn(n.name) : "·"}
                {(isC || active || hovered || i === 0) && (
                  <span className="text-[8px]">{n.octave}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Fine pitch indicator below active note */}
      {currentNote && activeKey && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-zinc-600 w-8 text-right">&#9837;</span>
          <div className="flex-1 relative h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div className="absolute inset-0 flex">
              <div className="flex-1 bg-gradient-to-r from-red-500/20 via-green-500/20 to-transparent" />
              <div className="flex-1 bg-gradient-to-r from-transparent via-green-500/20 to-red-500/20" />
            </div>
            <div
              className="absolute top-0 h-full w-1 rounded-full transition-all duration-100"
              style={{
                left: `${Math.max(0, Math.min(100, 50 + currentNote.centsOffset))}%`,
                backgroundColor: pitchQuality?.color,
                boxShadow: `0 0 4px ${pitchQuality?.color}`,
              }}
            />
          </div>
          <span className="text-[10px] text-zinc-600 w-8">&#9839;</span>
        </div>
      )}
    </div>
  );
}
