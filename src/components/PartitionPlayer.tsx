"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Score,
  SCORES,
  scoreDuration,
  beatsToSeconds,
} from "@/lib/partitions";
import { TrumpetSynth } from "@/lib/synth-trumpet";
import { useI18n } from "@/lib/i18n";
import Staff from "./Staff";
import { Note, PlayedNote } from "@/lib/trumpet";

interface ScorePlayerProps {
  onRequestMic?: () => void;
  micActive?: boolean;
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
}: ScorePlayerProps) {
  const { t } = useI18n();
  const [activeScore, setActiveScore] = useState<Score | null>(null);
  const [search, setSearch] = useState("");
  const [noteActiveIdx, setNoteActiveIdx] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const [muted, setMuted] = useState(false);
  const synthRef = useRef<TrumpetSynth | null>(null);
  const playbackCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup synth + interval on unmount
  useEffect(() => {
    return () => {
      if (playbackCheckRef.current) clearInterval(playbackCheckRef.current);
      synthRef.current?.dispose();
    };
  }, []);

  const play = useCallback(() => {
    if (!activeScore) return;

    if (!synthRef.current) {
      synthRef.current = new TrumpetSynth();
    }

    const synth = synthRef.current;
    synth.setOnNoteChange((idx) => setNoteActiveIdx(idx));

    setPlaying(true);
    setNoteActiveIdx(null);

    synth.playScore(activeScore, {
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
  }, [activeScore, volume, muted]);

  const stop = useCallback(() => {
    if (playbackCheckRef.current) clearInterval(playbackCheckRef.current);
    playbackCheckRef.current = null;
    synthRef.current?.stop();
    setPlaying(false);
    setNoteActiveIdx(null);
  }, []);

  const selectScore = (p: Score) => {
    stop();
    setActiveScore(p);
    setNoteActiveIdx(null);
    setSearch("");
  };

  const notesStaff = activeScore ? scoreToPlayedNotes(activeScore) : [];
  const duration = activeScore ? scoreDuration(activeScore) : 0;

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

          {/* Staff */}
          <Staff
            notes={notesStaff}
            noteActiveIndex={noteActiveIdx}
            mode={playing ? "replay" : "live"}
          />

          {/* Playback controls */}
          <div className="flex items-center gap-3 flex-wrap">
            {!playing ? (
              <button
                onClick={play}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold rounded-lg transition-colors text-sm"
              >
                {t("scores.listen")}
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
