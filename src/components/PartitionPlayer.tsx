"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Difficulty, Score, scoreDuration, beatsToSeconds } from "@/lib/scores";
import { TrumpetSynth } from "@/lib/synth-trumpet";
import { useI18n } from "@/lib/i18n";
import Staff from "./Staff";
import TileView, { TILE_LOOKAHEAD } from "./TileView";
import { DifficultyPicker, TagPill } from "./ScoreBadges";
import { Note, NoteInfo, PlayedNote, NOTE_TO_SEMITONE, evaluatePitch } from "@/lib/trumpet";

// Transposition steps: Do3 ↔ Sol3 ↔ Do4 ↔ Sol4 ↔ Do5
const TRANSPOSE_STEPS = [
  { semitones: -12, label: "Do3" },
  { semitones: -5,  label: "Sol3" },
  { semitones: 0,   label: "Do4" },
  { semitones: 7,   label: "Sol4" },
  { semitones: 12,  label: "Do5" },
];
const DEFAULT_TRANSPOSE_IDX = 2; // Do4 = no transposition

const NOTE_NAMES: Note[] = [
  Note.C, Note.Cs, Note.D, Note.Ds, Note.E, Note.F,
  Note.Fs, Note.G, Note.Gs, Note.A, Note.As, Note.B,
];

/** Transpose a note by the given number of semitones */
function transposeNote(
  note: Note,
  octave: number,
  semitones: number
): { note: Note; octave: number } {
  const midi = (octave + 1) * 12 + NOTE_TO_SEMITONE[note] + semitones;
  const newOctave = Math.floor(midi / 12) - 1;
  const newSemitone = ((midi % 12) + 12) % 12;
  return { note: NOTE_NAMES[newSemitone], octave: newOctave };
}

/** Create a transposed copy of a score */
function transposeScore(score: Score, semitones: number): Score {
  if (semitones === 0) return score;
  return {
    ...score,
    notes: score.notes.map((n) => {
      const { note, octave } = transposeNote(n.note, n.octave, semitones);
      return { ...n, note, octave };
    }),
  };
}

export type ScoreView = "sheet" | "tiles";

interface ScorePlayerProps {
  score: Score;
  view: ScoreView;
  onViewChange: (view: ScoreView) => void;
  difficulty: Difficulty;
  difficultyOverridden: boolean;
  onDifficultyChange: (difficulty: Difficulty | null) => void;
  onClose: () => void;
  micReady: boolean;
  /** Note currently detected on the mic, highlighted on the staff */
  liveNote: NoteInfo | null;
}

// Convert score notes to PlayedNote[] for the Staff component
function scoreToPlayedNotes(score: Score): PlayedNote[] {
  let currentTime = 0;
  return score.notes.map((n) => {
    const rest = n.rest ?? 0;
    currentTime += rest;
    const start = currentTime;
    const duration = beatsToSeconds(n.duration, score.tempo);
    currentTime += n.duration;

    return {
      note: {
        concertNote: Note.C,
        concertOctave: 0,
        writtenNote: n.note,
        writtenOctave: n.octave,
        frequency: 0,
        centsOffset: 0,
        pistons: [false, false, false],
        fingeringLabel: "",
      },
      timestamp: start,
      duration,
      relativeTime: beatsToSeconds(start, score.tempo),
    };
  });
}

/** Player for one score. Remount it (key={score.id}) to start fresh on another score. */
export default function ScorePlayer({
  score,
  view,
  onViewChange,
  difficulty,
  difficultyOverridden,
  onDifficultyChange,
  onClose,
  micReady,
  liveNote,
}: ScorePlayerProps) {
  const { t } = useI18n();
  const [noteActiveIdx, setNoteActiveIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [transposeIdx, setTransposeIdx] = useState(DEFAULT_TRANSPOSE_IDX);
  // performance.now() at which the first beat reaches the tile hit line
  const [tileOrigin, setTileOrigin] = useState<number | null>(null);
  const transposedScore = useMemo(
    () => transposeScore(score, TRANSPOSE_STEPS[transposeIdx].semitones),
    [score, transposeIdx]
  );

  const synthRef = useRef<TrumpetSynth | null>(null);
  const playbackCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup synth + intervals on unmount
  useEffect(() => {
    return () => {
      if (playbackCheckRef.current) clearInterval(playbackCheckRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      synthRef.current?.dispose();
    };
  }, []);

  const play = useCallback(() => {
    if (!synthRef.current) {
      synthRef.current = new TrumpetSynth();
    }

    const synth = synthRef.current;
    synth.setOnNoteChange((idx) => setNoteActiveIdx(idx));

    setPlaying(true);
    setNoteActiveIdx(null);
    // Without a countdown the tiles start right at the line
    setTileOrigin((o) => (o !== null && o > performance.now() - 100 ? o : performance.now()));

    synth.playScore(transposedScore, {
      volume: muted ? 0 : volume,
    });

    // Periodically check if playback is done
    if (playbackCheckRef.current) clearInterval(playbackCheckRef.current);
    playbackCheckRef.current = setInterval(() => {
      if (!synth.playing) {
        setPlaying(false);
        setNoteActiveIdx(null);
        if (playbackCheckRef.current) clearInterval(playbackCheckRef.current);
        playbackCheckRef.current = null;
      }
    }, 200);
  }, [transposedScore, volume, muted]);

  const stop = useCallback(() => {
    if (playbackCheckRef.current) clearInterval(playbackCheckRef.current);
    playbackCheckRef.current = null;
    synthRef.current?.stop();
    setPlaying(false);
    setNoteActiveIdx(null);
    setTileOrigin(null);
  }, []);

  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setCountdown(null);
    setTileOrigin(null);
  }, []);

  const playWithCountdown = useCallback(() => {
    if (countdown !== null) {
      cancelCountdown();
      return;
    }
    setCountdown(3);
    // Tiles start falling now and reach the line when the countdown ends
    setTileOrigin(performance.now() + TILE_LOOKAHEAD * 1000);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          // Use setTimeout(0) so play() runs after state update
          setTimeout(() => play(), 0);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [countdown, cancelCountdown, play]);

  const notesStaff = useMemo(() => scoreToPlayedNotes(transposedScore), [transposedScore]);
  const staffHighlight = liveNote
    ? {
        note: liveNote.writtenNote,
        octave: liveNote.writtenOctave,
        color: evaluatePitch(liveNote.centsOffset).color,
      }
    : null;
  const duration = scoreDuration(transposedScore);

  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <div className="space-y-4">
          {/* Score info */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-amber-400">{score.title}</h3>
              <div className="flex items-center gap-1.5 flex-wrap text-xs text-zinc-500">
                {score.tags.map((tag) => (
                  <TagPill key={tag} tag={tag} />
                ))}
                <span>
                  {score.composer && <>{score.composer} · </>}
                  {score.tempo} BPM · {Math.round(duration)}s · {score.notes.length} {t("note.plural")}
                </span>
              </div>
              <DifficultyPicker
                value={difficulty}
                overridden={difficultyOverridden}
                onChange={onDifficultyChange}
              />
            </div>
            <button
              onClick={() => {
                stop();
                cancelCountdown();
                onClose();
              }}
              title={t("scores.close")}
              className="text-zinc-500 hover:text-zinc-200 transition-colors text-lg leading-none px-1"
            >
              ×
            </button>
          </div>

          {/* Transpose */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTransposeIdx((i) => Math.max(0, i - 1))}
              disabled={transposeIdx === 0}
              className="px-2 py-1 text-sm rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ▼
            </button>
            <div className="flex gap-1">
              {TRANSPOSE_STEPS.map((step, i) => (
                <button
                  key={i}
                  onClick={() => { stop(); setTransposeIdx(i); }}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    i === transposeIdx
                      ? "bg-amber-500 text-zinc-900 font-bold"
                      : "bg-zinc-800 text-zinc-500 border border-zinc-700 hover:text-zinc-300"
                  }`}
                >
                  {step.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setTransposeIdx((i) => Math.min(TRANSPOSE_STEPS.length - 1, i + 1))}
              disabled={transposeIdx === TRANSPOSE_STEPS.length - 1}
              className="px-2 py-1 text-sm rounded border border-zinc-700 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ▲
            </button>
          </div>

          {/* View switch */}
          <div className="inline-flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
            {(["sheet", "tiles"] as const).map((v) => (
              <button
                key={v}
                onClick={() => onViewChange(v)}
                className={`px-3 py-1.5 transition-colors ${
                  view === v
                    ? "bg-amber-500 text-zinc-900 font-bold"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {v === "sheet" ? t("scores.viewSheet") : t("scores.viewTiles")}
              </button>
            ))}
          </div>

          {view === "sheet" ? (
            <Staff
              notes={notesStaff}
              noteActiveIndex={noteActiveIdx}
              mode={playing ? "replay" : "live"}
              score={transposedScore}
              highlight={staffHighlight}
            />
          ) : (
            <TileView
              score={transposedScore}
              origin={tileOrigin}
              liveNote={liveNote}
              micActive={micReady}
            />
          )}

          {/* Playback controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {!playing && countdown === null ? (
              <>
                <button
                  onClick={play}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold rounded-lg transition-colors text-sm"
                >
                  {t("scores.listen")}
                </button>
                <button
                  onClick={playWithCountdown}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg transition-colors text-sm border border-zinc-700"
                  title={t("scores.listenCountdown")}
                >
                  3… 2… 1…
                </button>
              </>
            ) : countdown !== null ? (
              <button
                onClick={cancelCountdown}
                className="px-5 py-2 bg-amber-500 text-zinc-900 font-bold rounded-lg text-2xl min-w-[80px] animate-pulse"
              >
                {countdown}
              </button>
            ) : (
              <button
                onClick={stop}
                className="px-5 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-bold rounded-lg transition-colors text-sm"
              >
                {t("scores.stop")}
              </button>
            )}

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMuted(!muted)}
                className={`text-sm px-2 py-1 rounded ${
                  muted
                    ? "bg-red-900/30 text-red-400 border border-red-800"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                }`}
                title={muted ? t("scores.muted") : t("scores.sound")}
              >
                {muted ? t("scores.muted") : t("scores.sound")}
              </button>
              {!muted && (
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={Math.round(volume * 100)}
                  onChange={(e) => setVolume(Number(e.target.value) / 100)}
                  className="w-20 accent-amber-500"
                />
              )}
            </div>
          </div>

          {/* Instructions */}
          <div className="text-xs text-zinc-600 bg-zinc-800/50 rounded-lg px-3 py-2">
            <p>
              <strong className="text-zinc-500">{t("scores.howTo")}</strong>{" "}
              {view === "tiles" ? t("tiles.instructions") : t("scores.instructions")}
            </p>
          </div>
        </div>
    </div>
  );
}
