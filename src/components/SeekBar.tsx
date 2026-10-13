"use client";

import { useEffect, useRef, useState } from "react";

const KEY_STEP = 5; // seconds per arrow key press

/** m:ss */
function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

interface SeekBarProps {
  /** performance.now() at which playback position 0 was (or would have been) */
  origin: number;
  duration: number;
  /** Position while paused; the bar stops moving */
  pausedAt?: number | null;
  onSeek: (seconds: number) => void;
  label: string;
}

/** Playback progress with elapsed and remaining time. Click or drag to jump; arrow keys skip 5s. */
export default function SeekBar({ origin, duration, pausedAt = null, onSeek, label }: SeekBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [elapsed, setElapsed] = useState(0);
  // Position under the pointer while dragging, committed on release
  const [drag, setDrag] = useState<number | null>(null);

  // Own animation loop so only the bar re-renders, not the staff
  useEffect(() => {
    if (pausedAt !== null) return;
    let raf = 0;
    const tick = () => {
      setElapsed((performance.now() - origin) / 1000);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [origin, pausedAt]);

  const clamp = (s: number) => Math.min(duration, Math.max(0, s));
  const pos = clamp(drag ?? pausedAt ?? elapsed);
  const pct = duration > 0 ? (pos / duration) * 100 : 0;

  const timeAt = (clientX: number) => {
    const rect = trackRef.current!.getBoundingClientRect();
    return clamp(((clientX - rect.left) / rect.width) * duration);
  };

  return (
    <div className="flex items-center gap-2.5 flex-1 min-w-56">
      <span className="font-mono text-xs font-bold w-10 text-right">{formatTime(pos)}</span>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(pos)}
        aria-valuetext={formatTime(pos)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDrag(timeAt(e.clientX));
        }}
        onPointerMove={(e) => {
          if (drag !== null) setDrag(timeAt(e.clientX));
        }}
        onPointerUp={(e) => {
          if (drag === null) return;
          setDrag(null);
          onSeek(timeAt(e.clientX));
        }}
        onPointerCancel={() => setDrag(null)}
        onKeyDown={(e) => {
          const step = e.key === "ArrowRight" ? KEY_STEP : e.key === "ArrowLeft" ? -KEY_STEP : 0;
          if (!step) return;
          e.preventDefault();
          onSeek(clamp(pos + step));
        }}
        className="relative flex-1 h-3.5 border-2 border-ink rounded-full bg-card cursor-pointer touch-none"
      >
        <div className="absolute inset-0 rounded-full overflow-hidden">
          <div className="h-full bg-sun" style={{ width: `${pct}%` }} />
        </div>
        <div
          className="absolute top-1/2 w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-ink bg-card shadow-nb-sm"
          style={{ left: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs font-bold w-11">-{formatTime(duration - pos)}</span>
    </div>
  );
}
