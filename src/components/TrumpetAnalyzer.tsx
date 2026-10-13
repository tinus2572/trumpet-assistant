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
import History from "./History";
import ScorePlayer, { ScorePlayerHandle } from "./PartitionPlayer";
import ScoreViewControls, { DEFAULT_TRANSPOSE_IDX, ScoreView, TRANSPOSE_STEPS } from "./ScoreViewControls";
import ScoreLibrary from "./ScoreLibrary";
import { Difficulty, Score } from "@/lib/scores";
import {
  effectiveDifficulty,
  setDifficultyOverride,
  useDifficultyOverrides,
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

export default function TrumpetAnalyzer({ scores }: { scores: Score[] }) {
  const { t, lang } = useI18n();
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);
  // The mic starts on page load; browsers may hold audio until the first click ("suspended")
  const [micState, setMicState] = useState<"starting" | "ready" | "suspended" | "error">("starting");
  const [micAttempt, setMicAttempt] = useState(0);
  const [recording, setRecording] = useState(false);
  const [currentNote, setCurrentNote] = useState<NoteInfo | null>(null);
  // Notes detected during the current recording (kept out of state: nothing renders them live)
  const playedNotesRef = useRef<PlayedNote[]>([]);
  const recordingActiveRef = useRef(false);
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
  const [historyOpen, setHistoryOpen] = useState(false);

  // Picking the score's own difficulty again just drops the override
  const changeDifficulty = (score: Score, difficulty: Difficulty) =>
    setDifficultyOverride(score.id, difficulty === score.difficulty ? null : difficulty);

  // Escape closes the history dialog
  useEffect(() => {
    if (!historyOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHistoryOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyOpen]);
  const [selectedScoreId, setSelectedScoreId] = useState<string | null>(null);
  const selectedScore = scores.find((s) => s.id === selectedScoreId) ?? null;
  // Score open when the recording started, saved with it
  const recordingScoreRef = useRef<Score | null>(null);
  const [scoreView, setScoreView] = useState<ScoreView>("sheet");
  const [transposeIdx, setTransposeIdx] = useState(DEFAULT_TRANSPOSE_IDX);
  const playerRef = useRef<ScorePlayerHandle>(null);
  const difficultyOverrides = useDifficultyOverrides();
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
            if (recordingActiveRef.current) {
              playedNotesRef.current.push({ note: confirmedNoteInfoRef.current, timestamp: noteStartRef.current, duration });
            }
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
    playedNotesRef.current = [];
    recordingActiveRef.current = true;
    startRef.current = Date.now();
    recordingSavedRef.current = false;
    candidateRef.current = null;
    candidateCountRef.current = 0;
    confirmedNoteRef.current = null;
    confirmedNoteInfoRef.current = null;
    recordingScoreRef.current = selectedScore;

    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.start();
    setRecording(true);
  }, [selectedScore]);

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

      const notes = playedNotesRef.current.map((n) => ({
        ...n,
        relativeTime: (n.timestamp - start) / 1000,
      }));
      playedNotesRef.current = [];

      const locale = langRef.current === "en" ? "en-US" : "fr-FR";
      // The score open at the start, or else one opened during the recording
      const score = recordingScoreRef.current ?? selectedScore;
      const newRecording: Recording = {
        id,
        date: new Date(now).toLocaleString(locale),
        duration,
        notes,
        summary: computeSummary(notes),
        ...(score && { score: { id: score.id, title: score.title } }),
      };

      setHistory((prev) => {
        if (prev.some((e) => e.id === id)) return prev;
        const updated = [newRecording, ...prev];
        saveHistory(updated);
        return updated;
      });
    };

    recordingActiveRef.current = false;
    recorder.stop();
    setRecording(false);
  }, [selectedScore]);

  const renameRecording = useCallback((id: string, title: string) => {
    setHistory((prev) => {
      const updated = prev.map((e) => (e.id === id ? { ...e, title: title.trim() || undefined } : e));
      saveHistory(updated);
      return updated;
    });
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

  return (
    // On large screens the dashboard fills the window without scrolling: only the score list and the sheet scroll inside
    <div className="min-h-screen lg:h-dvh lg:min-h-0 flex flex-col text-ink">
      <div className="w-full max-w-7xl mx-auto px-4 py-6 flex-1 lg:min-h-0 flex flex-col">
        <h1 className="sr-only">{t("app.title")}</h1>

        {micState === "error" && (
          <div className="nb-card bg-tomato px-4 py-3 mb-5 flex items-center justify-between gap-4 font-semibold">
            <span>{t("mic.error")}</span>
            <button
              onClick={() => {
                setMicState("starting");
                setMicAttempt((n) => n + 1);
              }}
              className="nb-btn bg-card px-3 py-1 text-sm"
            >
              {t("mic.retry")}
            </button>
          </div>
        )}
        {micState === "suspended" && (
          <div className="nb-card bg-sun px-4 py-3 mb-5 text-sm font-semibold">
            👆 {t("mic.clickToStart")}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6 lg:flex-1 lg:min-h-0">
          {/* Left column: controls above the score list, so the right column starts at the top */}
          <div className="lg:w-80 shrink-0 flex flex-col gap-5 lg:min-h-0">
            {/* Toolbar: metronome, display options, history, recording */}
            <div className="flex flex-wrap items-center gap-2.5">
              <Metronome />
              <LangSwitch />
              <ScoreViewControls
                view={scoreView}
                onViewChange={setScoreView}
                transposeIdx={transposeIdx}
                onTransposeChange={(i) => {
                  // The notes change: stop what is playing
                  playerRef.current?.stop();
                  setTransposeIdx(i);
                }}
              />
              <div className="flex flex-wrap items-center gap-2.5">
                <button onClick={() => setHistoryOpen(true)} className="nb-btn bg-card px-3.5 py-2 text-sm">
                  🕘 {t("history.button")}
                  {history.length > 0 && (
                    <span className="font-mono text-xs bg-sky border-2 border-ink rounded-full px-1.5 leading-tight">
                      {history.length}
                    </span>
                  )}
                </button>
                {!recording ? (
                  <button
                    onClick={startRecording}
                    disabled={!micReady}
                    className="nb-btn bg-tomato px-4 py-2 text-sm"
                  >
                    <span className="w-3 h-3 rounded-full bg-ink" />
                    {t("rec.start")}
                  </button>
                ) : (
                  <button onClick={stopRecording} className="nb-btn bg-ink text-card px-4 py-2 text-sm">
                    <span className="w-3 h-3 rounded-sm bg-tomato animate-pulse" />
                    {t("rec.stop")}
                  </button>
                )}
              </div>
            </div>

            <ScoreLibrary
              scores={scores}
              selectedId={selectedScoreId}
              onSelect={(score) => setSelectedScoreId(score.id)}
              overrides={difficultyOverrides}
              onDifficultyChange={changeDifficulty}
            />
          </div>

          <main className="flex-1 min-w-0 flex flex-col gap-5 lg:min-h-0">
            <ChromaticScale currentNote={currentNote} />

            {/* Selected score */}
            {selectedScore ? (
              <ScorePlayer
                key={selectedScore.id}
                score={selectedScore}
                ref={playerRef}
                view={scoreView}
                transpose={TRANSPOSE_STEPS[transposeIdx].semitones}
                difficulty={effectiveDifficulty(selectedScore, difficultyOverrides)}
                onDifficultyChange={(d) => changeDifficulty(selectedScore, d)}
                onClose={() => setSelectedScoreId(null)}
                micReady={micReady}
                liveNote={currentNote}
              />
            ) : (
              <div className="border-2 border-dashed border-ink rounded-nb bg-card/60 px-6 py-12 text-center lg:flex-1 flex flex-col justify-center">
                <p className="font-display text-lg">🎼</p>
                <p className="mt-2 font-semibold">{t("scores.empty")}</p>
              </div>
            )}

          </main>
        </div>
      </div>
      {/* History dialog */}
      {historyOpen && (
        <div
          className="fixed inset-0 z-[60] bg-ink/40 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setHistoryOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={t("history.title")}
            className="nb-card shadow-nb-lg w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            <div className="flex justify-between items-center gap-3 px-5 py-3 bg-sky border-b-2 border-ink">
              <h2 className="nb-label">{t("history.title")}</h2>
              <div className="flex items-center gap-2">
                {history.length > 0 && (
                  <button onClick={clearHistory} className="nb-btn bg-card px-2.5 py-1 text-xs">
                    {t("history.clearAll")}
                  </button>
                )}
                <button
                  onClick={() => setHistoryOpen(false)}
                  title={t("history.close")}
                  aria-label={t("history.close")}
                  className="nb-btn bg-card w-8 h-8 text-lg leading-none"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto">
              <History
                recordings={history}
                audioUrls={audioUrls}
                onSelect={(e) => {
                  setSelectionId(selectionId === e.id ? null : e.id);
                  setPlaybackTime(null);
                }}
                onDelete={deleteRecording}
                onRename={renameRecording}
                onTrim={trimRecording}
                selectionId={selectionId}
                onPlaybackTime={setPlaybackTime}
                replayNoteIndex={replayNoteIndex}
              />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
