"use client";

import { useEffect, useRef } from "react";
import { Note, PlayedNote, evaluatePitch } from "@/lib/trumpet";
import { useI18n } from "@/lib/i18n";

// Rendering constants
const LINE_SP = 10;
const HALF = LINE_SP / 2;
const REF_Y = 110; // Y of C4 (middle C)
const NOTE_SP = 55;
const LEFT_MARGIN = 45;
const RIGHT_PAD = 40;
const R = 4.5; // note radius
const SVG_H = 175;

// Diatonic positions of staff lines (treble clef)
// E4=2, G4=4, B4=6, D5=8, F5=10
const STAFF_LINES = [2, 4, 6, 8, 10];

// Diatonic position: steps from C in the octave
const BASE_POS: Record<Note, number> = {
  [Note.C]: 0, [Note.Cs]: 0, [Note.D]: 1, [Note.Ds]: 1, [Note.E]: 2,
  [Note.F]: 3, [Note.Fs]: 3, [Note.G]: 4, [Note.Gs]: 4, [Note.A]: 5, [Note.As]: 5, [Note.B]: 6,
};

function posY(nom: Note, octave: number): number {
  const pos = (octave - 4) * 7 + (BASE_POS[nom] ?? 0);
  return REF_Y - pos * HALF;
}

function diaPos(nom: Note, octave: number): number {
  return (octave - 4) * 7 + (BASE_POS[nom] ?? 0);
}

function isSharp(nom: Note): boolean {
  return nom.includes("#");
}

// Ledger lines needed for a given diatonic position
function ledgerLines(pos: number): number[] {
  const lines: number[] = [];
  if (pos <= 0) {
    for (let p = 0; p >= pos; p -= 2) lines.push(p);
  }
  if (pos >= 12) {
    for (let p = 12; p <= pos; p += 2) lines.push(p);
  }
  return lines;
}

interface StaffProps {
  notes: PlayedNote[];
  noteActiveIndex: number | null;
  mode: "live" | "replay";
}

export default function Staff({ notes, noteActiveIndex, mode }: StaffProps) {
  const { t, dn } = useI18n();
  const scrollRef = useRef<HTMLDivElement>(null);

  const svgW = Math.max(400, LEFT_MARGIN + notes.length * NOTE_SP + RIGHT_PAD);

  // Auto-scroll to active note
  useEffect(() => {
    if (noteActiveIndex === null || !scrollRef.current) return;
    const x = LEFT_MARGIN + noteActiveIndex * NOTE_SP;
    const container = scrollRef.current;
    const scrollTarget = x - container.clientWidth / 2;
    container.scrollTo({ left: scrollTarget, behavior: mode === "live" ? "smooth" : "auto" });
  }, [noteActiveIndex, mode]);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          {t("staff.title")}
        </h2>
        {mode === "replay" && noteActiveIndex !== null && (
          <span className="text-[10px] text-amber-500/70 bg-amber-500/10 px-1.5 py-0.5 rounded">
            {t("staff.playing")}
          </span>
        )}
      </div>
      <div ref={scrollRef} className="overflow-x-auto px-2 pb-3">
        <svg width={svgW} height={SVG_H} className="block">
          {/* Staff: 5 lines */}
          {STAFF_LINES.map((pos) => (
            <line
              key={pos}
              x1={10}
              y1={REF_Y - pos * HALF}
              x2={svgW - 10}
              y2={REF_Y - pos * HALF}
              stroke="#3f3f46"
              strokeWidth={1}
            />
          ))}

          {/* Treble clef (simplified) */}
          <text
            x={14}
            y={REF_Y - 4 * HALF + 8}
            fontSize={38}
            fill="#71717a"
            fontFamily="serif"
          >
            {"\uD834\uDD1E"}
          </text>

          {/* Notes */}
          {notes.map((n, i) => {
            const x = LEFT_MARGIN + i * NOTE_SP;
            const noteName = n.note.writtenNote;
            const octave = n.note.writtenOctave;
            const y = posY(noteName, octave);
            const pos = diaPos(noteName, octave);
            const sharp = isSharp(noteName);
            const active = i === noteActiveIndex;
            const j = evaluatePitch(n.note.centsOffset);
            const color = active ? j.color : "#a1a1aa";
            const opacity = active ? 1 : noteActiveIndex !== null && mode === "replay" ? 0.4 : 0.7;

            return (
              <g key={i} opacity={opacity}>
                {/* Ledger lines */}
                {ledgerLines(pos).map((lp) => (
                  <line
                    key={lp}
                    x1={x - 10}
                    y1={REF_Y - lp * HALF}
                    x2={x + 10}
                    y2={REF_Y - lp * HALF}
                    stroke={active ? color : "#52525b"}
                    strokeWidth={1}
                  />
                ))}

                {/* Note head (oval) */}
                <ellipse
                  cx={x}
                  cy={y}
                  rx={active ? R + 1.5 : R}
                  ry={active ? R : R - 0.5}
                  fill={color}
                  transform={`rotate(-15, ${x}, ${y})`}
                />

                {/* Stem */}
                {pos < 6 ? (
                  <line x1={x + R} y1={y} x2={x + R} y2={y - 30} stroke={color} strokeWidth={1.2} />
                ) : (
                  <line x1={x - R} y1={y} x2={x - R} y2={y + 30} stroke={color} strokeWidth={1.2} />
                )}

                {/* Sharp sign */}
                {sharp && (
                  <text
                    x={x - R - 10}
                    y={y + 4}
                    fontSize={12}
                    fill={color}
                    fontFamily="serif"
                  >
                    {"\u266F"}
                  </text>
                )}

                {/* Note name below staff if active */}
                {active && (
                  <>
                    <text
                      x={x}
                      y={SVG_H - 8}
                      textAnchor="middle"
                      fontSize={11}
                      fontWeight="bold"
                      fill={color}
                    >
                      {dn(noteName)}{octave}
                    </text>
                    {/* Halo */}
                    <ellipse
                      cx={x}
                      cy={y}
                      rx={R + 6}
                      ry={R + 4}
                      fill="none"
                      stroke={color}
                      strokeWidth={1.5}
                      opacity={0.3}
                      transform={`rotate(-15, ${x}, ${y})`}
                    />
                  </>
                )}

                {/* Pitch quality dot */}
                {!active && (
                  <circle cx={x} cy={SVG_H - 12} r={2} fill={j.color} opacity={0.6} />
                )}
              </g>
            );
          })}

          {/* Empty state */}
          {notes.length === 0 && (
            <text
              x={svgW / 2}
              y={REF_Y - 3 * HALF}
              textAnchor="middle"
              fontSize={12}
              fill="#52525b"
            >
              {mode === "live" ? t("staff.emptyLive") : t("staff.emptyReplay")}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
