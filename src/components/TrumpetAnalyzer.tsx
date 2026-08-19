"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { detectPitch } from "@/lib/pitch-detection";
import {
  frequencyToNote,
  evaluatePitch,
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
import PistonDisplay from "./PistonDisplay";
import ChromaticScale from "./ChromaticScale";
import Staff from "./Staff";
import History from "./History";
import ScorePlayer from "./PartitionPlayer";
import LangSwitch from "./LangSwitch";

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
  const { t, lang, dn } = useI18n();
  const langRef = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [currentNote, setCurrentNote] = useState<NoteInfo | null>(null);
  const [playedNotes, setPlayedNotes] = useState<PlayedNote[]>([]);
  const [history, setHistory] = useState<Recording[]>(() => {
    if (typeof window === "undefined") return [];
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
    return dedup;
  });
  const [selectionId, setSelectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [compensationCents, setCompensationCents] = useState(25);
  const [playbackTime, setPlaybackTime] = useState<number | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startRef = useRef<number>(0);
  const recordingSavedRef = useRef(false);
  const muteRef = useRef({ active: false, cents: 25 });
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

  useEffect(() => {
    muteRef.current = { active: muted, cents: compensationCents };
  }, [muted, compensationCents]);

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
          const { active, cents } = muteRef.current;
          const note = frequencyToNote(freq, active ? cents : 0);
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

  const startListening = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 8192;
      source.connect(analyser);

      setListening(true);
      analyzerLoop(analyser, audioCtx.sampleRate);
    } catch {
      setError(t("mic.error"));
    }
  }, [analyzerLoop, t]);

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

  const stopListening = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioCtxRef.current) audioCtxRef.current.close();
    if (streamRef.current)
      streamRef.current.getTracks().forEach((track) => track.stop());

    setListening(false);
    setCurrentNote(null);
    candidateRef.current = null;
    candidateCountRef.current = 0;
    confirmedNoteRef.current = null;
    confirmedNoteInfoRef.current = null;
    silenceCountRef.current = 0;

    if (recording) stopRecording();
  }, [recording, stopRecording]);

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

  const pitchQuality = currentNote ? evaluatePitch(currentNote.centsOffset) : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-8 relative">
          <div className="absolute right-0 top-0">
            <LangSwitch />
          </div>
          <h1 className="text-3xl font-bold text-amber-400">
            {t("app.title")}
          </h1>
          <p className="text-zinc-400 mt-1">
            {t("app.subtitle")}
          </p>
        </header>

        {error && (
          <div className="bg-red-900/30 border border-red-700 text-red-300 px-4 py-3 rounded-lg mb-6 text-center">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-8">
          {!listening ? (
            <button
              onClick={startListening}
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold rounded-lg transition-colors"
            >
              {t("mic.enable")}
            </button>
          ) : (
            <>
              <button
                onClick={stopListening}
                className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 font-bold rounded-lg transition-colors"
              >
                {t("mic.disable")}
              </button>
              {!recording ? (
                <button
                  onClick={startRecording}
                  className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
                >
                  <span className="w-3 h-3 rounded-full bg-white" />
                  {t("rec.start")}
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg transition-colors animate-pulse flex items-center gap-2"
                >
                  <span className="w-3 h-3 rounded-sm bg-white" />
                  {t("rec.stop")}
                </button>
              )}
            </>
          )}
        </div>

        {/* Mute compensation mode */}
        <div className="flex justify-center mb-6">
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-4 py-3 inline-flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={muted}
                onChange={(e) => setMuted(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 rounded-full peer-checked:bg-amber-500 relative transition-colors">
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${muted ? "left-[1.125rem]" : "left-0.5"}`} />
              </div>
              <span className="text-sm text-zinc-300">{t("mute.label")}</span>
            </label>
            {muted && (
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={compensationCents}
                  onChange={(e) => setCompensationCents(Number(e.target.value))}
                  className="w-24 accent-amber-500"
                />
                <span className="text-xs text-zinc-400 w-16">
                  -{compensationCents} cents
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Main display */}
        {listening && (
          <div className="space-y-4 mb-8">
            {/* Chromatic scale + pitch */}
            <ChromaticScale currentNote={currentNote} />

            {/* Fingering */}
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 flex flex-col items-center">
              <h2 className="text-sm font-medium text-zinc-400 mb-3 uppercase tracking-wider">
                {t("fingering.title")}
              </h2>
              <PistonDisplay
                pistons={currentNote?.pistons ?? [false, false, false]}
                fingeringLabel={currentNote?.fingeringLabel ?? "-"}
              />
              {currentNote && (
                <p className="text-xs text-zinc-500 mt-2">
                  {t("fingering.concert")} : {dn(currentNote.concertNote)}
                  {currentNote.concertOctave}
                  {" · "}
                  <span style={{ color: pitchQuality?.color }}>
                    {pitchQuality ? t(pitchQuality.labelKey) : ""}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}

        {/* Live staff during recording */}
        {recording && (
          <div className="mb-8">
            <Staff
              notes={playedNotes}
              noteActiveIndex={playedNotes.length > 0 ? playedNotes.length - 1 : null}
              mode="live"
            />
          </div>
        )}

        {/* Scores */}
        <div className="mb-8">
          <ScorePlayer
            onRequestMic={!listening ? startListening : undefined}
            micActive={listening}
          />
        </div>

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
      </div>
    </div>
  );
}
