"use client";

import { Ref, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Difficulty, Score, scoreDuration, beatsToSeconds } from "@/lib/scores";
import { TrumpetSynth, unlockAudio } from "@/lib/synth-trumpet";
import { useI18n } from "@/lib/i18n";
import Staff from "./Staff";
import TileView, { TILE_LOOKAHEAD } from "./TileView";
import SeekBar from "./SeekBar";
import { DifficultyBadge, TagPill } from "./ScoreBadges";
import { ScoreView } from "./ScoreViewControls";
import { Note, NoteInfo, PlayedNote, NOTE_TO_SEMITONE, evaluatePitch } from "@/lib/trumpet";

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
  score: Score;
  view: ScoreView;
  /** Transposition in semitones */
  transpose: number;
  difficulty: Difficulty;
  onDifficultyChange: (difficulty: Difficulty) => void;
  onClose: () => void;
  micReady: boolean;
  /** Note currently detected on the mic, highlighted on the staff */
  liveNote: NoteInfo | null;
  ref?: Ref<ScorePlayerHandle>;
}

export interface ScorePlayerHandle {
  /** Stop playback and any countdown (e.g. before the transposition changes) */
  stop: () => void;
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
  transpose,
  difficulty,
  onDifficultyChange,
  onClose,
  micReady,
  liveNote,
  ref,
}: ScorePlayerProps) {
  const { t } = useI18n();
  const [noteActiveIdx, setNoteActiveIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  // performance.now() at which the first beat reaches the tile hit line
  const [tileOrigin, setTileOrigin] = useState<number | null>(null);
  // performance.now() at which playback position 0 was, for the seek bar
  const [playOrigin, setPlayOrigin] = useState(0);
  // Position in seconds while paused, null otherwise
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  // The player covers the whole window, leaving more room for the sheet
  const [fullscreen, setFullscreen] = useState(false);

  // Escape leaves full screen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);
  const transposedScore = useMemo(
    () => transposeScore(score, transpose),
    [score, transpose]
  );

  const synthRef = useRef<TrumpetSynth | null>(null);
  const playbackCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Create the synth on mount so samples load before the first play; cleanup on unmount
  useEffect(() => {
    synthRef.current = new TrumpetSynth();
    return () => {
      if (playbackCheckRef.current) clearInterval(playbackCheckRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      synthRef.current?.dispose();
      synthRef.current = null;
    };
  }, []);

  /** Play from the given position in seconds (0 = start) */
  const play = useCallback((from = 0) => {
    unlockAudio();
    synthRef.current ??= new TrumpetSynth();
    const synth = synthRef.current;
    synth.setOnNoteChange((idx) => setNoteActiveIdx(idx));

    setPlaying(true);
    setPausedAt(null);
    setNoteActiveIdx(null);
    const origin = performance.now() - from * 1000;
    setPlayOrigin(origin);
    // From the start, keep the countdown's origin; otherwise the tiles start right at the line
    setTileOrigin((o) => (from === 0 && o !== null && o > origin - 100 ? o : origin));

    synth.playScore(transposedScore, {
      volume: muted ? 0 : volume,
      from,
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
    setPausedAt(null);
    setNoteActiveIdx(null);
    setTileOrigin(null);
  }, []);

  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setCountdown(null);
    setTileOrigin(null);
  }, []);

  useImperativeHandle(ref, () => ({
    stop: () => {
      stop();
      cancelCountdown();
    },
  }), [stop, cancelCountdown]);

  const playWithCountdown = useCallback(() => {
    if (countdown !== null) {
      cancelCountdown();
      return;
    }
    // Unlock audio during the click: play() runs from a timer, which browsers don't count as a gesture
    unlockAudio();
    let remaining = 3;
    setCountdown(remaining);
    // Tiles start falling now and reach the line when the countdown ends
    setTileOrigin(performance.now() + TILE_LOOKAHEAD * 1000);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
        return;
      }
      if (countdownRef.current) clearInterval(countdownRef.current);
      countdownRef.current = null;
      setCountdown(null);
      play();
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

  /** Move the paused position and the highlighted note without playing */
  const seekPaused = (seconds: number) => {
    setPausedAt(seconds);
    const idx = notesStaff.findLastIndex((n) => n.relativeTime !== undefined && n.relativeTime <= seconds);
    setNoteActiveIdx(idx >= 0 ? idx : null);
  };

  /** Stop the sound but keep the position, the active note and the frozen tiles */
  const pause = () => {
    if (playbackCheckRef.current) clearInterval(playbackCheckRef.current);
    playbackCheckRef.current = null;
    synthRef.current?.stop();
    setPlaying(false);
    setPausedAt(Math.min(duration, (performance.now() - playOrigin) / 1000));
  };

  return (
    <section
      className={`nb-card overflow-hidden flex flex-col ${
        fullscreen ? "fixed inset-2 z-50 shadow-nb-lg" : "lg:flex-1 lg:min-h-0"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4 px-5 py-3 bg-sky border-b-2 border-ink">
        <div className="min-w-0 space-y-1.5">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h3 className="font-display text-xl leading-tight">{score.title}</h3>
            <DifficultyBadge difficulty={difficulty} onChange={onDifficultyChange} />
          </div>
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setFullscreen((f) => !f)}
            title={fullscreen ? t("scores.exitFullscreen") : t("scores.fullscreen")}
            aria-label={fullscreen ? t("scores.exitFullscreen") : t("scores.fullscreen")}
            aria-pressed={fullscreen}
            className={`nb-btn w-9 h-9 ${fullscreen ? "bg-sun" : "bg-card"}`}
          >
            <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
              {fullscreen ? (
                <path d="M6 1v5H1M10 1v5h5M6 15v-5H1M10 15v-5h5" />
              ) : (
                <path d="M1 6V1h5M15 6V1h-5M1 10v5h5M15 10v5h-5" />
              )}
            </svg>
          </button>
          <button
            onClick={() => {
              stop();
              cancelCountdown();
              onClose();
            }}
            title={t("scores.close")}
            className="nb-btn bg-card w-9 h-9 text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      <div className={`p-5 flex flex-col gap-4 ${fullscreen ? "flex-1 min-h-0" : "lg:flex-1 lg:min-h-0"}`}>
        {/* The sheet scrolls inside; toolbar and transport stay in view */}
        <div
          data-scroll-area
          className={`${fullscreen ? "flex-1 min-h-0 overflow-y-auto" : "lg:flex-1 lg:min-h-0 lg:overflow-y-auto"}`}
        >
          {view === "sheet" ? (
            <Staff
              notes={notesStaff}
              noteActiveIndex={noteActiveIdx}
              mode={playing || pausedAt !== null ? "replay" : "live"}
              score={transposedScore}
              highlight={staffHighlight}
            />
          ) : (
            <TileView
              score={transposedScore}
              origin={tileOrigin}
              pausedAt={pausedAt}
              liveNote={liveNote}
              micActive={micReady}
            />
          )}
        </div>

        {/* Transport */}
        <div className="flex items-center gap-3 flex-wrap">
          {!playing && pausedAt === null && countdown === null ? (
            <>
              <button onClick={() => play()} className="nb-btn bg-sun px-5 py-2.5 text-sm">
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
            <>
              {pausedAt !== null ? (
                <button onClick={() => play(pausedAt)} className="nb-btn bg-sun px-4 py-2.5 text-sm">
                  ▶ {t("scores.resume")}
                </button>
              ) : (
                <button onClick={pause} className="nb-btn bg-card px-4 py-2.5 text-sm">
                  ❚❚ {t("scores.pause")}
                </button>
              )}
              <button onClick={stop} className="nb-btn bg-ink text-card px-4 py-2.5 text-sm">
                ■ {t("scores.stop")}
              </button>
              <SeekBar
                origin={playOrigin}
                duration={duration}
                pausedAt={pausedAt}
                onSeek={pausedAt !== null ? seekPaused : play}
                label={t("scores.seek")}
              />
            </>
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

      </div>
    </section>
  );
}
