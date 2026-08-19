"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

export default function Metronome() {
  const { t } = useI18n();
  const [bpm, setBpm] = useState(100);
  const [playing, setPlaying] = useState(false);
  const [beat, setBeat] = useState(false);
  const acRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getAc = useCallback(() => {
    if (!acRef.current || acRef.current.state === "closed") {
      acRef.current = new AudioContext();
    }
    return acRef.current;
  }, []);

  const playClick = useCallback(() => {
    const ac = getAc();
    if (ac.state === "suspended") ac.resume();

    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime);
    osc.stop(ac.currentTime + 0.08);

    setBeat(true);
    setTimeout(() => setBeat(false), 80);
  }, [getAc]);

  const start = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPlaying(true);
    playClick();
    timerRef.current = setInterval(playClick, (60 / bpm) * 1000);
  }, [bpm, playClick]);

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
    setBeat(false);
  }, []);

  // Restart interval when BPM changes during playback
  useEffect(() => {
    if (!playing) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(playClick, (60 / bpm) * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [bpm, playing, playClick]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div
        className={`bg-zinc-900 border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 transition-colors ${
          beat ? "border-amber-500" : "border-zinc-700"
        }`}
      >
        {/* Beat indicator */}
        <div
          className={`w-3 h-3 rounded-full shrink-0 transition-colors ${
            beat ? "bg-amber-400" : playing ? "bg-zinc-600" : "bg-zinc-700"
          }`}
        />

        {/* BPM slider */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="40"
            max="220"
            value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-20 accent-amber-500"
          />
          <span className="text-xs text-zinc-300 font-mono w-12 text-right">
            {bpm} <span className="text-zinc-500">bpm</span>
          </span>
        </div>

        {/* On/Off button */}
        <button
          onClick={playing ? stop : start}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
            playing
              ? "bg-amber-500 text-zinc-900 hover:bg-amber-400"
              : "bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-amber-500/50"
          }`}
        >
          {playing ? t("metronome.stop") : t("metronome.start")}
        </button>
      </div>
    </div>
  );
}
