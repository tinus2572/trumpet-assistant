"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Score,
  SCORES,
  scoreDuration,
  beatsToSeconds,
} from "@/lib/partitions";
import { TrumpetSynth } from "@/lib/synth-trumpet";
import { useI18n } from "@/lib/i18n";
import Staff from "./Staff";
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

interface ScorePlayerProps {
  onRequestMic?: () => void;
  micActive?: boolean;
  /** Note currently detected on the mic, highlighted on the staff */
  liveNote?: NoteInfo | null;
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

export default function ScorePlayer({
  onRequestMic,
  micActive,
  liveNote,
}: ScorePlayerProps) {
  const { t } = useI18n();
  const [activeScore, setActiveScore] = useState<Score | null>(null);
  const [search, setSearch] = useState("");
  const [noteActiveIdx, setNoteActiveIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [transposeIdx, setTransposeIdx] = useState(DEFAULT_TRANSPOSE_IDX);
  const transposedScore = useMemo(
    () =>
      activeScore
        ? transposeScore(activeScore, TRANSPOSE_STEPS[transposeIdx].semitones)
        : null,
    [activeScore, transposeIdx]
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
    if (!transposedScore) return;

    if (!synthRef.current) {
      synthRef.current = new TrumpetSynth();
    }

    const synth = synthRef.current;
    synth.setOnNoteChange((idx) => setNoteActiveIdx(idx));

    setPlaying(true);
    setNoteActiveIdx(null);

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
  }, []);

  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setCountdown(null);
  }, []);

  const playWithCountdown = useCallback(() => {
    if (countdown !== null) {
      cancelCountdown();
      return;
    }
    setCountdown(3);
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

  const selectScore = (p: Score) => {
    stop();
    cancelCountdown();
    setActiveScore(p);
    setNoteActiveIdx(null);
    setTransposeIdx(DEFAULT_TRANSPOSE_IDX);
    setSearch("");
  };

  const notesStaff = useMemo(
    () => (transposedScore ? scoreToPlayedNotes(transposedScore) : []),
    [transposedScore]
  );
  const staffHighlight = liveNote
    ? {
        note: liveNote.writtenNote,
        octave: liveNote.writtenOctave,
        color: evaluatePitch(liveNote.centsOffset).color,
      }
    : null;
  const duration = transposedScore ? scoreDuration(transposedScore) : 0;

  // Filter scores by search query
  const searchResults =
    search.trim().length > 0
      ? SCORES.filter((p) => {
          const normalize = (s: string) =>
            s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
          const r = normalize(search);
          return (
            normalize(p.title).includes(r) ||
            normalize(p.id).includes(r) ||
            (p.composer && normalize(p.composer).includes(r))
          );
        })
      : SCORES;

  return (
    <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
      <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
        {t("scores.title")}
      </h2>

      {/* Score selection */}
      {!activeScore && (
        <div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("scores.search")}
            className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 mb-4"
          />

          <div className="grid gap-2">
            {searchResults.map((p) => (
              <button
                key={p.id}
                onClick={() => selectScore(p)}
                className="text-left px-4 py-3 bg-zinc-800 hover:bg-zinc-750 hover:border-amber-500/50 border border-zinc-700 rounded-lg transition-colors"
              >
                <div className="font-medium text-zinc-200">{p.title}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {p.composer && <span>{p.composer} · </span>}
                  <span>{p.tempo} BPM</span>
                  <span> · {p.notes.length} {t("note.plural")}</span>
                </div>
              </button>
            ))}
            {searchResults.length === 0 && (
              <p className="text-zinc-500 text-sm text-center py-4">
                {t("scores.none")}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Score player */}
      {activeScore && (
        <div className="space-y-4">
          {/* Score info */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-amber-400">
                {activeScore.title}
              </h3>
              <p className="text-xs text-zinc-500">
                {activeScore.composer && (
                  <span>{activeScore.composer} · </span>
                )}
                {activeScore.tempo} BPM · {Math.round(duration)}s ·{" "}
                {activeScore.notes.length} {t("note.plural")}
              </p>
            </div>
            <button
              onClick={() => {
                stop();
                setActiveScore(null);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {t("scores.change")}
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

          {/* Staff */}
          <Staff
            notes={notesStaff}
            noteActiveIndex={noteActiveIdx}
            mode={playing ? "replay" : "live"}
            score={transposedScore ?? undefined}
            highlight={staffHighlight}
          />

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

            {/* Mic button */}
            {onRequestMic && (
              <button
                onClick={onRequestMic}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  micActive
                    ? "bg-green-900/30 text-green-400 border border-green-800"
                    : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-amber-500/50"
                }`}
              >
                {micActive ? t("scores.micActive") : t("scores.micEnable")}
              </button>
            )}
          </div>

          {/* Instructions */}
          <div className="text-xs text-zinc-600 bg-zinc-800/50 rounded-lg px-3 py-2">
            <p>
              <strong className="text-zinc-500">{t("scores.howTo")}</strong>{" "}
              {t("scores.instructions")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
