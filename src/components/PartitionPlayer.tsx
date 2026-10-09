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

  const segment = (active: boolean, first: boolean) =>
    `px-2.5 py-1.5 text-xs font-bold transition-colors ${first ? "" : "border-l-2 border-ink"} ${
      active ? "bg-sun" : "bg-card hover:bg-muted"
    }`;

  return (
    <section className="nb-card overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-4 bg-sky border-b-2 border-ink">
        <div className="min-w-0 space-y-1.5">
          <h3 className="font-display text-xl sm:text-2xl leading-tight">{score.title}</h3>
          <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold">
            {score.tags.map((tag) => (
              <TagPill key={tag} tag={tag} />
            ))}
            <span>
              {score.composer && <>{score.composer} · </>}
              {score.tempo} BPM · {Math.round(duration)}s · {score.notes.length} {t("note.plural")}
            </span>
          </div>
        </div>
        <button
          onClick={() => {
            stop();
            cancelCountdown();
            onClose();
          }}
          title={t("scores.close")}
          className="nb-btn bg-card w-9 h-9 shrink-0 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Toolbar: view, transposition, difficulty */}
        <div className="flex items-center gap-x-4 gap-y-3 flex-wrap">
          <div className="inline-flex border-2 border-ink rounded-nb overflow-hidden shadow-nb-sm">
            {(["sheet", "tiles"] as const).map((v, i) => (
              <button key={v} onClick={() => onViewChange(v)} className={segment(view === v, i === 0)}>
                {v === "sheet" ? `🎼 ${t("scores.viewSheet")}` : `🟨 ${t("scores.viewTiles")}`}
              </button>
            ))}
          </div>

          <div className="inline-flex border-2 border-ink rounded-nb overflow-hidden shadow-nb-sm">
            <button
              onClick={() => setTransposeIdx((i) => Math.max(0, i - 1))}
              disabled={transposeIdx === 0}
              className={`${segment(false, true)} disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              ▼
            </button>
            {TRANSPOSE_STEPS.map((step, i) => (
              <button
                key={i}
                onClick={() => {
                  stop();
                  setTransposeIdx(i);
                }}
                className={segment(i === transposeIdx, false)}
              >
                {step.label}
              </button>
            ))}
            <button
              onClick={() => setTransposeIdx((i) => Math.min(TRANSPOSE_STEPS.length - 1, i + 1))}
              disabled={transposeIdx === TRANSPOSE_STEPS.length - 1}
              className={`${segment(false, false)} disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              ▲
            </button>
          </div>

          <DifficultyPicker value={difficulty} overridden={difficultyOverridden} onChange={onDifficultyChange} />
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
          <TileView score={transposedScore} origin={tileOrigin} liveNote={liveNote} micActive={micReady} />
        )}

        {/* Transport */}
        <div className="flex items-center gap-3 flex-wrap">
          {!playing && countdown === null ? (
            <>
              <button onClick={play} className="nb-btn bg-sun px-5 py-2.5 text-sm">
                ▶ {t("scores.listen")}
              </button>
              <button
                onClick={playWithCountdown}
                className="nb-btn bg-pink px-4 py-2.5 text-sm"
                title={t("scores.listenCountdown")}
              >
                3… 2… 1…
              </button>
            </>
          ) : countdown !== null ? (
            <button
              onClick={cancelCountdown}
              className="nb-btn bg-pink px-5 py-1 text-2xl font-display min-w-20 animate-pulse"
            >
              {countdown}
            </button>
          ) : (
            <button onClick={stop} className="nb-btn bg-ink text-card px-5 py-2.5 text-sm">
              ■ {t("scores.stop")}
            </button>
          )}

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              onClick={() => setMuted(!muted)}
              className={`nb-btn px-3 py-1.5 text-xs ${muted ? "bg-tomato" : "bg-card"}`}
              title={muted ? t("scores.muted") : t("scores.sound")}
            >
              {muted ? `🔇 ${t("scores.muted")}` : `🔊 ${t("scores.sound")}`}
            </button>
            {!muted && (
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(volume * 100)}
                onChange={(e) => setVolume(Number(e.target.value) / 100)}
                className="nb-range w-24"
              />
            )}
          </div>
        </div>

        {/* Instructions */}
        <p className="text-xs font-medium bg-paper border-2 border-dashed border-ink rounded-nb px-3 py-2">
          <strong>💡 {t("scores.howTo")}</strong>{" "}
          {view === "tiles" ? t("tiles.instructions") : t("scores.instructions")}
        </p>
      </div>
    </section>
  );
}
