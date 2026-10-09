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
    <div className="bg-paper rounded-nb p-3 border-2 border-ink">
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
        <span className="nb-label">{t("trim.title")}</span>
        <span className="text-[11px] font-mono font-bold">
          {formatTime(trimmedDuration)} {t("trim.selected")}{trimmedDuration !== dur ? ` / ${formatTime(dur)}` : ""}
        </span>
      </div>

      {/* Visual selection bar */}
      <div className="relative h-8 bg-card border-2 border-ink rounded-md overflow-hidden mb-3">
        {/* Cut zone left */}
        <div
          className="absolute inset-y-0 left-0 bg-ink/25"
          style={{ width: `${startPct}%` }}
        />
        {/* Cut zone right */}
        <div
          className="absolute inset-y-0 right-0 bg-ink/25"
          style={{ width: `${100 - endPct}%` }}
        />
        {/* Kept zone */}
        <div
          className="absolute inset-y-0 bg-sun border-x-2 border-ink"
          style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
        />
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase">{t("trim.start")}</span>
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
              className="nb-range flex-1"
            />
            <span className="text-xs font-bold w-10 text-right font-mono">
              {formatTime(start)}
            </span>
          </div>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase">{t("trim.end")}</span>
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
              className="nb-range flex-1"
            />
            <span className="text-xs font-bold w-10 text-right font-mono">
              {formatTime(end)}
            </span>
          </div>
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={playing ? stopPreview : preview}
          className="nb-btn bg-sky px-3 py-1.5 text-xs"
        >
          {playing ? "Stop" : t("trim.preview")}
        </button>
        <div className="flex-1" />
        <button
          onClick={onCancel}
          className="nb-btn bg-card px-3 py-1.5 text-xs"
        >
          {t("trim.cancel")}
        </button>
        <button
          onClick={() => {
            stopPreview();
            onConfirm(start, end);
          }}
          disabled={start === 0 && end >= dur - 0.05}
          className="nb-btn bg-sun px-3 py-1.5 text-xs"
        >
          {t("trim.apply")}
        </button>
      </div>
    </div>
  );
}
