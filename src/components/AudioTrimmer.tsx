"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

interface AudioTrimmerProps {
  audioUrl: string;
  duration: number;
  onConfirm: (start: number, end: number) => void;
  onCancel: () => void;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 10);
  return m > 0 ? `${m}:${String(sec).padStart(2, "0")}.${ms}` : `${sec}.${ms}s`;
}

export default function AudioTrimmer({ audioUrl, duration, onConfirm, onCancel }: AudioTrimmerProps) {
  const { t } = useI18n();
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  // Real audio duration (may differ from recorded duration)
  const [realDuration, setRealDuration] = useState(duration);
  const dur = realDuration || duration;

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
  }, []);

  const preview = useCallback(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    audio.currentTime = start;
    audio.play();
    setPlaying(true);

    const check = () => {
      if (audio.currentTime >= end) {
        audio.pause();
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(check);
    };
    rafRef.current = requestAnimationFrame(check);
  }, [start, end]);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      if (audio) audio.pause();
    };
  }, []);

  const startPct = (start / dur) * 100;
  const endPct = (end / dur) * 100;
  const trimmedDuration = end - start;

  return (
    <div className="bg-zinc-800 rounded-lg p-3 border border-amber-500/30">
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (isFinite(d) && d > 0) {
            setRealDuration(d);
            setEnd((prev) => Math.min(prev, d));
          }
        }}
      />

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-amber-400">{t("trim.title")}</span>
        <span className="text-[10px] text-zinc-400">
          {formatTime(trimmedDuration)} {t("trim.selected")}{trimmedDuration !== dur ? ` / ${formatTime(dur)}` : ""}
        </span>
      </div>

      {/* Visual selection bar */}
      <div className="relative h-8 bg-zinc-900 rounded mb-2">
        {/* Cut zone left */}
        <div
          className="absolute inset-y-0 left-0 bg-red-900/30 rounded-l"
          style={{ width: `${startPct}%` }}
        />
        {/* Cut zone right */}
        <div
          className="absolute inset-y-0 right-0 bg-red-900/30 rounded-r"
          style={{ width: `${100 - endPct}%` }}
        />
        {/* Kept zone */}
        <div
          className="absolute inset-y-0 bg-amber-500/15 border-x-2 border-amber-500"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500 uppercase">{t("trim.start")}</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={dur}
              step={0.1}
              value={start}
              onChange={(e) => {
                const v = Number(e.target.value);
                setStart(Math.min(v, end - 0.2));
                stopPreview();
              }}
              className="flex-1 accent-amber-500 h-1"
            />
            <span className="text-xs text-zinc-300 w-10 text-right font-mono">
              {formatTime(start)}
            </span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] text-zinc-500 uppercase">{t("trim.end")}</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={dur}
              step={0.1}
              value={end}
              onChange={(e) => {
                const v = Number(e.target.value);
                setEnd(Math.max(v, start + 0.2));
                stopPreview();
              }}
              className="flex-1 accent-amber-500 h-1"
            />
            <span className="text-xs text-zinc-300 w-10 text-right font-mono">
              {formatTime(end)}
            </span>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={playing ? stopPreview : preview}
          className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded transition-colors"
        >
          {playing ? "Stop" : t("trim.preview")}
        </button>
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          {t("trim.cancel")}
        </button>
        <button
          onClick={() => {
            stopPreview();
            onConfirm(start, end);
          }}
          disabled={start === 0 && end >= dur - 0.05}
          className="px-3 py-1.5 text-xs bg-amber-500 hover:bg-amber-400 text-zinc-900 font-bold rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          {t("trim.apply")}
        </button>
      </div>
    </div>
  );
}
