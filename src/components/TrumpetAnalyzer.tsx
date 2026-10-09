"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitch } from "@/lib/pitch-detection";
import {
  frequencyToNote,
  computeSummary,
  NoteInfo,
  PlayedNote,
  Recording,
} from "@/lib/trumpet";
import {
  saveAudio,
  loadAllAudio,
  loadAudioBlob,
  deleteAudio,
  clearAllAudio,
} from "@/lib/audio-storage";
import { trimAudio } from "@/lib/audio-trim";
import { useI18n } from "@/lib/i18n";
import ChromaticScale from "./ChromaticScale";
import Staff from "./Staff";
import History from "./History";
import ScorePlayer, { ScoreView } from "./PartitionPlayer";
import ScoreLibrary from "./ScoreLibrary";
import { SCORES } from "@/lib/scores";
import {
  effectiveDifficulty,
  setDifficultyOverride,
  setLibraryFolded,
  useDifficultyOverrides,
  useLibraryFolded,
} from "@/lib/score-prefs";
import LangSwitch from "./LangSwitch";
import Metronome from "./Metronome";

const STORAGE_KEY = "trumpet-assistant-history";

function loadHistory(): Recording[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveHistory(recordings: Recording[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recordings));
}

export default function TrumpetAnalyzer() {
  const { t, lang } = useI18n();
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);
  // The mic starts on page load; browsers may hold audio until the first click ("suspended")
  const [micState, setMicState] = useState<"starting" | "ready" | "suspended" | "error">("starting");
  const [micAttempt, setMicAttempt] = useState(0);
  const [recording, setRecording] = useState(false);
  const [currentNote, setCurrentNote] = useState<NoteInfo | null>(null);
  const [playedNotes, setPlayedNotes] = useState<PlayedNote[]>([]);
  const [history, setHistory] = useState<Recording[]>([]);

  useEffect(() => {
    const brut = loadHistory().map((e) =>
      e.summary ? e : { ...e, summary: computeSummary(e.notes ?? []) }
    );
    const vus = new Set<string>();
    const dedup = brut.filter((e) => {
      if (vus.has(e.id)) return false;
      vus.add(e.id);
      return true;
    });
    if (dedup.length !== brut.length) saveHistory(dedup);
    setHistory(dedup);
  }, []);
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const [scoreView, setScoreView] = useState<ScoreView>("sheet");
  const difficultyOverrides = useDifficultyOverrides();
  const libraryFolded = useLibraryFolded();
  const [playbackTime, setPlaybackTime] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);
  const recordingSavedRef = useRef(false);
  // Stabilization: a note must be detected N consecutive frames before being confirmed
  const candidateRef = useRef<string | null>(null);
  const candidateCountRef = useRef(0);
  const confirmedNoteRef = useRef<string | null>(null);
  const confirmedNoteInfoRef = useRef<NoteInfo | null>(null);
  const noteStartRef = useRef<number>(0);
  const silenceCountRef = useRef(0);
  const FRAMES_TO_CONFIRM = 6; // ~100ms at 60fps
  const FRAMES_SILENCE_TO_CUT = 10; // ~170ms of silence to end a note
  const MIN_NOTE_DURATION = 0.15; // seconds

  useEffect(() => {
    // Load audio URLs from IndexedDB
    const ids = history.map((e) => e.id);
    if (ids.length > 0) {
      loadAllAudio(ids).then(setAudioUrls);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyzerLoop = useCallback(
    (analyser: AnalyserNode, sampleRate: number) => {
      const buffer = new Float32Array(analyser.fftSize);

      const saveConfirmedNote = (now: number) => {
        if (confirmedNoteRef.current && confirmedNoteInfoRef.current && noteStartRef.current > 0) {
          const duration = (now - noteStartRef.current) / 1000;
          if (duration >= MIN_NOTE_DURATION) {
            const info = confirmedNoteInfoRef.current;
            setPlayedNotes((prev) => [
              ...prev,
              { note: info, timestamp: noteStartRef.current, duration },
            ]);
          }
        }
      };

      const loop = () => {
        analyser.getFloatTimeDomainData(buffer);
        const freq = detectPitch(buffer, sampleRate);
        const now = Date.now();

        if (freq !== null) {
          const note = frequencyToNote(freq);
          if (note) {
            const noteKey = `${note.writtenNote}${note.writtenOctave}`;
            silenceCountRef.current = 0;

            if (noteKey === confirmedNoteRef.current) {
              setCurrentNote(note);
              confirmedNoteInfoRef.current = note;
            } else if (noteKey === candidateRef.current) {
              candidateCountRef.current++;
              if (candidateCountRef.current >= FRAMES_TO_CONFIRM) {
                saveConfirmedNote(now);
                confirmedNoteRef.current = noteKey;
                confirmedNoteInfoRef.current = note;
                noteStartRef.current = now;
                setCurrentNote(note);
                candidateRef.current = null;
                candidateCountRef.current = 0;
              }
            } else {
              candidateRef.current = noteKey;
              candidateCountRef.current = 1;
            }
          }
        } else {
          candidateRef.current = null;
          candidateCountRef.current = 0;
          silenceCountRef.current++;

          if (silenceCountRef.current >= FRAMES_SILENCE_TO_CUT && confirmedNoteRef.current) {
            saveConfirmedNote(now);
            confirmedNoteRef.current = null;
            confirmedNoteInfoRef.current = null;
            noteStartRef.current = 0;
            setCurrentNote(null);
          }
        }

        rafRef.current = requestAnimationFrame(loop);
      };

      loop();
    },
    []
  );

  // Always-on microphone
  useEffect(() => {
    let cancelled = false;
    let teardown: (() => void) | null = null;

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch {
        if (!cancelled) setMicState("error");
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 8192;
      source.connect(analyser);
      analyzerLoop(analyser, audioCtx.sampleRate);

      // An AudioContext created without a user gesture starts suspended: resume on first interaction
      const resume = () => {
        audioCtx.resume().then(() => {
          if (!cancelled) setMicState("ready");
        });
      };
      if (audioCtx.state === "suspended") {
        setMicState("suspended");
        window.addEventListener("pointerdown", resume, { once: true });
        window.addEventListener("keydown", resume, { once: true });
      } else {
        setMicState("ready");
      }

      teardown = () => {
        window.removeEventListener("pointerdown", resume);
        window.removeEventListener("keydown", resume);
        cancelAnimationFrame(rafRef.current);
        source.disconnect();
        audioCtx.close();
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        candidateRef.current = null;
        candidateCountRef.current = 0;
        confirmedNoteRef.current = null;
        confirmedNoteInfoRef.current = null;
        silenceCountRef.current = 0;
      };
    })();

    return () => {
      cancelled = true;
      teardown?.();
    };
  }, [analyzerLoop, micAttempt]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    chunksRef.current = [];
    setPlayedNotes([]);
    startRef.current = Date.now();
    recordingSavedRef.current = false;
    candidateRef.current = null;
    candidateCountRef.current = 0;
    confirmedNoteRef.current = null;
    confirmedNoteInfoRef.current = null;

    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setRecording(true);
  }, []);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    recorder.onstop = () => {
      if (recordingSavedRef.current) return;
      recordingSavedRef.current = true;

      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      const audioUrl = URL.createObjectURL(blob);
      const now = Date.now();
      const id = now.toString();
      const start = startRef.current;
      const duration = (now - start) / 1000;

      saveAudio(id, blob).then(() => {
        setAudioUrls((prev) => ({ ...prev, [id]: audioUrl }));
      });

      setPlayedNotes((prevNotes) => {
        const notes = prevNotes.map((n) => ({
          ...n,
          relativeTime: (n.timestamp - start) / 1000,
        }));

        const locale = langRef.current === "en" ? "en-US" : "fr-FR";
        const newRecording: Recording = {
          id,
          date: new Date(now).toLocaleString(locale),
          duration,
          notes,
          summary: computeSummary(notes),
        };

        setHistory((prev) => {
          if (prev.some((e) => e.id === id)) return prev;
          const updated = [newRecording, ...prev];
          saveHistory(updated);
          return updated;
        });

        return [];
      });
    };

    recorder.stop();
    setRecording(false);
  }, []);

  const deleteRecording = useCallback(
    (id: string) => {
      const updated = history.filter((e) => e.id !== id);
      setHistory(updated);
      saveHistory(updated);
      deleteAudio(id);
      setAudioUrls((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (selectionId === id) setSelectionId(null);
    },
    [history, selectionId]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    clearAllAudio();
    setAudioUrls({});
    setSelectionId(null);
  }, []);

  const trimRecording = useCallback(
    async (id: string, start: number, end: number) => {
      const blob = await loadAudioBlob(id);
      if (!blob) return;

      const trimmed = await trimAudio(blob, start, end);
      await saveAudio(id, trimmed);

      // Update audio URL
      const newUrl = URL.createObjectURL(trimmed);
      setAudioUrls((prev) => {
        if (prev[id]) URL.revokeObjectURL(prev[id]);
        return { ...prev, [id]: newUrl };
      });

      // Update notes and duration
      setHistory((prev) => {
        const updated = prev.map((e) => {
          if (e.id !== id) return e;

          const newDuration = end - start;
          const notes = e.notes
            .filter((n) => {
              const t = n.relativeTime ?? 0;
              return t >= start && t + n.duration <= end;
            })
            .map((n) => ({
              ...n,
              relativeTime: (n.relativeTime ?? 0) - start,
            }));

          return {
            ...e,
            duration: newDuration,
            notes,
            summary: computeSummary(notes),
          };
        });
        saveHistory(updated);
        return updated;
      });
    },
    []
  );

  // Active note index in replay mode (audio sync)
  const selectedRecording = history.find((e) => e.id === selectionId) ?? null;
  const replayNoteIndex = (() => {
    if (playbackTime === null || !selectedRecording) return null;
    const notes = selectedRecording.notes;
    if (notes.length === 0) return null;

    const hasRelativeTime = notes[0].relativeTime !== undefined;

    if (hasRelativeTime) {
      // Find the note whose window [relativeTime, relativeTime+duration] contains the playback time
      for (let i = 0; i < notes.length; i++) {
        const t = notes[i].relativeTime ?? 0;
        const fin = t + notes[i].duration;
        if (playbackTime >= t && playbackTime <= fin) return i;
      }
      // Between notes: find the next upcoming note and show the previous one
      for (let i = 0; i < notes.length; i++) {
        const t = notes[i].relativeTime ?? 0;
        if (t > playbackTime) {
          return i > 0 ? i - 1 : null;
        }
      }
      // After the last note
      return null;
    }

    // Fallback for old recordings without relativeTime: distribute evenly
    if (selectedRecording.duration > 0) {
      const ratio = playbackTime / selectedRecording.duration;
      return Math.min(Math.floor(ratio * notes.length), notes.length - 1);
    }
    return null;
  })();

  const micReady = micState === "ready";
  const selectedScore = SCORES.find((s) => s.id === selectedScoreId) ?? null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-amber-400">{t("app.title")}</h1>
            <p className="text-sm text-zinc-500">{t("app.subtitle")}</p>
          </div>
          <div className="shrink-0">
            <LangSwitch />
          </div>
        </header>

        {micState === "error" && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-4 flex items-center justify-between gap-4">
            <span>{t("mic.error")}</span>
            <button
              onClick={() => {
                setMicState("starting");
                setMicAttempt((n) => n + 1);
              }}
              className="px-3 py-1 text-sm bg-red-800/60 hover:bg-red-700/60 rounded transition-colors"
            >
              {t("mic.retry")}
            </button>
          </div>
        )}
        {micState === "suspended" && (
          <div className="bg-amber-500/10 border border-amber-500/40 text-amber-300 px-4 py-3 rounded-lg mb-4 text-sm">
            {t("mic.clickToStart")}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 lg:items-start">
          <ScoreLibrary
            scores={SCORES}
            selectedId={selectedScoreId}
            onSelect={(score) => setSelectedScoreId(score.id)}
            overrides={difficultyOverrides}
            folded={libraryFolded}
            onFoldedChange={setLibraryFolded}
          />

          <main className="flex-1 min-w-0 space-y-4">
            {/* Mic status + recording */}
            <div className="flex items-center justify-between gap-4">
              <span className="inline-flex items-center gap-2 text-xs text-zinc-400">
                <span
                  className={`w-2 h-2 rounded-full ${
                    micReady ? "bg-green-500 animate-pulse" : micState === "error" ? "bg-red-500" : "bg-zinc-600"
                  }`}
                />
                {micReady ? t("mic.listening") : micState === "error" ? t("tiles.micHint") : t("mic.starting")}
              </span>
              {!recording ? (
                <button
                  onClick={startRecording}
                  disabled={!micReady}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white" />
                  {t("rec.start")}
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-colors animate-pulse flex items-center gap-2"
                >
                  <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                  {t("rec.stop")}
                </button>
              )}
            </div>

            <ChromaticScale currentNote={currentNote} />

            {/* Live staff during recording */}
            {recording && (
              <Staff
                notes={playedNotes}
                noteActiveIndex={playedNotes.length > 0 ? playedNotes.length - 1 : null}
                mode="live"
              />
            )}

            {/* Selected score */}
            {selectedScore ? (
              <ScorePlayer
                key={selectedScore.id}
                score={selectedScore}
                view={scoreView}
                onViewChange={setScoreView}
                difficulty={effectiveDifficulty(selectedScore, difficultyOverrides)}
                difficultyOverridden={selectedScore.id in difficultyOverrides}
                onDifficultyChange={(d) => setDifficultyOverride(selectedScore.id, d)}
                onClose={() => setSelectedScoreId(null)}
                micReady={micReady}
                liveNote={currentNote}
              />
            ) : (
              <div className="bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800 px-6 py-10 text-center text-sm text-zinc-500">
                {t("scores.empty")}
              </div>
            )}

            {/* History */}
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                  {t("history.title")}
                </h2>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                  >
                    {t("history.clearAll")}
                  </button>
                )}
              </div>
              <History
                recordings={history}
                audioUrls={audioUrls}
                onSelect={(e) => {
                  setSelectionId(selectionId === e.id ? null : e.id);
                  setPlaybackTime(null);
                }}
                onDelete={deleteRecording}
                onTrim={trimRecording}
                selectionId={selectionId}
                onPlaybackTime={setPlaybackTime}
                replayNoteIndex={replayNoteIndex}
              />
            </div>
          </main>
        </div>
      </div>
      <Metronome />
    </div>
  );
}
