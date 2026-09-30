"use client";

import { useEffect, useMemo, useRef } from "react";
import { Score, beatsToSeconds } from "@/lib/partitions";
import {
  NoteInfo,
  evaluatePitch,
  chromaticRange,
  noteToMidi,
  TRUMPET_LOW_MIDI,
  TRUMPET_HIGH_MIDI,
} from "@/lib/trumpet";
import { useI18n } from "@/lib/i18n";

/** Seconds a tile takes to fall from the top to the hit line (matches the 3…2…1… countdown) */
export const TILE_LOOKAHEAD = 3;

const HEIGHT = 420;
const KEY_HEIGHT = 66;
// Mic detection confirms a note ~100ms after it starts: accept hits slightly after the tile ends
const HIT_TOLERANCE = 0.15;
const POPUP_LIFE = 0.9; // seconds
const SPARK_LIFE = 0.5;

const COLORS = {
  bgTop: "#07070a",
  bgBottom: "#15151c",
  lane: "rgba(255,255,255,0.025)",
  laneEdge: "rgba(255,255,255,0.04)",
  octaveEdge: "rgba(255,255,255,0.1)",
  measure: "rgba(255,255,255,0.08)",
  hit: "#22c55e",
  good: "#eab308",
  miss: "#ef4444",
  accent: "#f59e0b",
  text: "#fafafa",
  textDim: "#a1a1aa",
  textFaint: "#52525b",
  pill: "rgba(9,9,11,0.7)",
  padNatural: ["#52525b", "#3f3f46"],
  padSharp: ["#27272a", "#1c1c21"],
};

/** One hue per pitch class, so each note keeps its color across octaves */
function noteHue(midi: number): number {
  return (((midi % 12) + 12) % 12) * 30 + 20;
}

/** Mini fingering diagram: three valves, pressed ones pushed down (like PistonDisplay) */
function drawValves(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  maxWidth: number,
  pistons: [boolean, boolean, boolean],
  onLight: boolean
) {
  const gap = Math.max(1.5, Math.min(3, maxWidth * 0.06));
  const vw = Math.max(3, Math.min(8, (maxWidth - 2 * gap) / 3));
  const vh = 16;
  const capH = Math.max(3, vw * 0.55);
  const travel = vh - capH - 5;
  const x0 = cx - (3 * vw + 2 * gap) / 2;
  pistons.forEach((pressed, i) => {
    const x = x0 + i * (vw + gap);
    // Casing
    ctx.fillStyle = onLight ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.roundRect(x, top, vw, vh, Math.min(2, vw / 3));
    ctx.fill();
    // Stem and cap
    const capY = top + (pressed ? travel : 0);
    const color = pressed
      ? onLight ? "#09090b" : COLORS.accent
      : onLight ? "rgba(0,0,0,0.35)" : "#71717a";
    ctx.fillStyle = color;
    ctx.fillRect(x + vw / 2 - Math.max(0.75, vw * 0.12), capY + capH, Math.max(1.5, vw * 0.24), vh - (capY - top) - capH);
    ctx.beginPath();
    ctx.roundRect(x, capY, vw, capH, [capH / 2, capH / 2, 1, 1]);
    ctx.fill();
  });
}

interface TimedNote {
  midi: number;
  start: number; // seconds from score start
  end: number;
}

interface Popup {
  x: number;
  text: string;
  color: string;
  born: number; // performance.now() seconds
}

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hue: number;
  born: number;
}

interface TileViewProps {
  score: Score;
  /** performance.now() timestamp at which the score's first beat reaches the hit line; null when idle */
  origin: number | null;
  liveNote: NoteInfo | null;
  micActive: boolean;
}

export default function TileView({ score, origin, liveNote, micActive }: TileViewProps) {
  const { t, dn } = useI18n();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Values read by the animation loop, kept in refs so prop changes don't restart it
  const liveRef = useRef(liveNote);
  const micRef = useRef(micActive);
  const labelsRef = useRef({ t, dn });
  useEffect(() => {
    liveRef.current = liveNote;
    micRef.current = micActive;
    labelsRef.current = { t, dn };
  }, [liveNote, micActive, t, dn]);

  const { notes, totalSec, measureTimes } = useMemo(() => {
    const notes: TimedNote[] = [];
    let beat = 0;
    for (const n of score.notes) {
      beat += n.rest ?? 0;
      notes.push({
        midi: noteToMidi(n.note, n.octave),
        start: beatsToSeconds(beat, score.tempo),
        end: beatsToSeconds(beat + n.duration, score.tempo),
      });
      beat += n.duration;
    }
    const [beatsPerMeasure] = score.signature;
    const measureTimes: number[] = [];
    for (let b = score.pickup ?? 0; b <= beat + 0.001; b += beatsPerMeasure) {
      measureTimes.push(beatsToSeconds(b, score.tempo));
    }
    return { notes, totalSec: beatsToSeconds(beat, score.tempo), measureTimes };
  }, [score]);

  // Columns: from the lowest to the highest note of the (transposed) score
  const columns = useMemo(() => {
    const midis = notes.map((n) => n.midi);
    const low = midis.length ? Math.min(...midis) : TRUMPET_LOW_MIDI;
    const high = midis.length ? Math.max(...midis) : TRUMPET_HIGH_MIDI;
    return { low, keys: chromaticRange(low, high) };
  }, [notes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const font = getComputedStyle(wrapper).fontFamily || "system-ui, sans-serif";
    const setFont = (size: number, weight = 400) => {
      ctx.font = `${weight} ${size}px ${font}`;
    };

    let width = 0;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      width = wrapper.clientWidth;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(HEIGHT * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${HEIGHT}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapper);

    // Seconds of each note played correctly while it was at the line
    const hitSec = new Float32Array(notes.length);
    const judged = new Uint8Array(notes.length);
    const totalNoteSec = notes.reduce((s, n) => s + (n.end - n.start), 0);
    let goodNotes = 0;
    let combo = 0;
    let bestCombo = 0;
    const popups: Popup[] = [];
    const sparks: Spark[] = [];
    let lastTime: number | null = null;
    let lastNow: number | null = null;
    let raf = 0;

    const pill = (x: number, y: number, text: string, color: string, align: "left" | "right") => {
      setFont(12, 600);
      const w = ctx.measureText(text).width + 20;
      const px = align === "left" ? x : x - w;
      ctx.fillStyle = COLORS.pill;
      ctx.beginPath();
      ctx.roundRect(px, y, w, 24, 12);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, px + w / 2, y + 12.5);
    };

    const draw = (nowMs: number) => {
      const now = nowMs / 1000;
      const frameDt = lastNow === null ? 0 : Math.min(0.1, now - lastNow);
      lastNow = now;

      const { keys, low } = columns;
      const colW = width / keys.length;
      const hitY = HEIGHT - KEY_HEIGHT;
      const pxPerSec = hitY / TILE_LOOKAHEAD;
      const running = origin !== null;
      const time = running ? (nowMs - origin) / 1000 : -TILE_LOOKAHEAD;
      const dt = lastTime === null ? 0 : Math.min(0.1, time - lastTime);
      lastTime = running ? time : null;
      const finished = running && time > totalSec + HIT_TOLERANCE;
      const live = liveRef.current;
      const liveMidi = live ? noteToMidi(live.writtenNote, live.writtenOctave) : null;
      const { t, dn } = labelsRef.current;
      const laneX = (midi: number) => (midi - low) * colW;

      // Scoring: accumulate time spent playing the note currently at the line, judge notes once past
      const targets = new Set<number>();
      notes.forEach((n, i) => {
        if (time >= n.start && time < n.end) targets.add(n.midi);
        if (!running || finished) return;
        if (time >= n.start && time < n.end + HIT_TOLERANCE && liveMidi === n.midi) {
          hitSec[i] = Math.min(n.end - n.start, hitSec[i] + dt);
        }
        if (!judged[i] && time >= n.end + HIT_TOLERANCE) {
          judged[i] = 1;
          const ratio = hitSec[i] / (n.end - n.start);
          const [text, color] =
            ratio >= 0.8 ? [t("tiles.perfect"), COLORS.hit]
            : ratio >= 0.5 ? [t("tiles.good"), COLORS.good]
            : [t("tiles.miss"), COLORS.miss];
          if (ratio >= 0.5) {
            goodNotes++;
            combo++;
            bestCombo = Math.max(bestCombo, combo);
          } else {
            combo = 0;
          }
          popups.push({ x: laneX(n.midi) + colW / 2, text, color, born: now });
        }
      });
      const hitting = running && !finished && liveMidi !== null && targets.has(liveMidi);

      // Background and lanes
      const bg = ctx.createLinearGradient(0, 0, 0, hitY);
      bg.addColorStop(0, COLORS.bgTop);
      bg.addColorStop(1, COLORS.bgBottom);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, HEIGHT);
      keys.forEach((k, i) => {
        const x = i * colW;
        if (k.natural) {
          ctx.fillStyle = COLORS.lane;
          ctx.fillRect(x, 0, colW, hitY);
        }
        ctx.fillStyle = k.name === "C" ? COLORS.octaveEdge : COLORS.laneEdge;
        ctx.fillRect(Math.round(x), 0, 1, hitY);
      });

      // Lane beams under the notes due now
      for (const midi of targets) {
        const hue = noteHue(midi);
        const on = liveMidi === midi;
        const beam = ctx.createLinearGradient(0, hitY, 0, hitY * 0.35);
        beam.addColorStop(0, `hsla(${hue},85%,60%,${on ? 0.45 : 0.18})`);
        beam.addColorStop(1, `hsla(${hue},85%,60%,0)`);
        ctx.fillStyle = beam;
        ctx.fillRect(laneX(midi), 0, colW, hitY);
      }

      // Measure lines
      ctx.fillStyle = COLORS.measure;
      for (const m of measureTimes) {
        const y = hitY - (m - time) * pxPerSec;
        if (y > 0 && y < hitY) ctx.fillRect(0, Math.round(y), width, 1);
      }

      // Falling tiles, consumed as they cross the hit line
      notes.forEach((n) => {
        const bottom = Math.min(hitY, hitY - (n.start - time) * pxPerSec - 1.5);
        const top = hitY - (n.end - time) * pxPerSec + 1.5;
        if (bottom <= top || bottom < 0 || top > hitY) return;
        const key = keys[n.midi - low];
        const hue = noteHue(n.midi);
        const x = laneX(n.midi) + 2;
        const w = colW - 4;
        const h = bottom - top;
        const lit = time >= n.start && time < n.end && liveMidi === n.midi;
        const light = key.natural ? 58 : 48;

        const grad = ctx.createLinearGradient(0, top, 0, bottom);
        grad.addColorStop(0, `hsl(${hue},80%,${light + 10}%)`);
        grad.addColorStop(1, `hsl(${hue},85%,${light - 6}%)`);
        ctx.shadowColor = lit ? "rgba(255,255,255,0.8)" : `hsla(${hue},90%,55%,0.55)`;
        ctx.shadowBlur = lit ? 18 : 10;
        ctx.fillStyle = lit ? `hsl(${hue},90%,72%)` : grad;
        ctx.beginPath();
        ctx.roundRect(x, top, w, h, Math.min(6, w / 3, h / 2));
        ctx.fill();
        ctx.shadowBlur = 0;

        // Gloss on the left edge
        ctx.fillStyle = "rgba(255,255,255,0.22)";
        ctx.fillRect(x + 2, top + 3, 2, Math.max(0, h - 6));
      });

      // Sparks while the right note is held
      if (hitting && liveMidi !== null) {
        for (let s = 0; s < 3; s++) {
          sparks.push({
            x: laneX(liveMidi) + Math.random() * colW,
            y: hitY,
            vx: (Math.random() - 0.5) * 90,
            vy: -60 - Math.random() * 140,
            hue: noteHue(liveMidi),
            born: now,
          });
        }
      }
      for (let s = sparks.length - 1; s >= 0; s--) {
        const sp = sparks[s];
        const age = now - sp.born;
        if (age > SPARK_LIFE) {
          sparks.splice(s, 1);
          continue;
        }
        sp.x += sp.vx * frameDt;
        sp.y += sp.vy * frameDt;
        sp.vy += 260 * frameDt;
        ctx.fillStyle = `hsla(${sp.hue},95%,75%,${1 - age / SPARK_LIFE})`;
        ctx.fillRect(sp.x - 1, sp.y - 1, 2.5, 2.5);
      }

      // Hit line
      const lineColor = hitting ? COLORS.hit : COLORS.accent;
      const line = ctx.createLinearGradient(0, 0, width, 0);
      line.addColorStop(0, "rgba(255,255,255,0)");
      line.addColorStop(0.15, lineColor);
      line.addColorStop(0.85, lineColor);
      line.addColorStop(1, "rgba(255,255,255,0)");
      ctx.shadowColor = lineColor;
      ctx.shadowBlur = hitting ? 16 : 8;
      ctx.fillStyle = line;
      ctx.fillRect(0, hitY - 1.5, width, 3);
      ctx.shadowBlur = 0;

      // Pads: mic note glows in its pitch color, target notes outlined in their tile color
      ctx.fillStyle = "#0c0c10";
      ctx.fillRect(0, hitY + 1.5, width, KEY_HEIGHT);
      keys.forEach((k, i) => {
        const midi = low + i;
        const x = i * colW + 1.5;
        const w = colW - 3;
        const y = hitY + 6;
        const h = KEY_HEIGHT - 10;
        const isLive = midi === liveMidi && live !== null;
        const isTarget = targets.has(midi);
        if (isLive) {
          const color = evaluatePitch(live.centsOffset).color;
          ctx.shadowColor = color;
          ctx.shadowBlur = 14;
          ctx.fillStyle = color;
        } else {
          const [c1, c2] = k.natural ? COLORS.padNatural : COLORS.padSharp;
          const pad = ctx.createLinearGradient(0, y, 0, y + h);
          pad.addColorStop(0, c1);
          pad.addColorStop(1, c2);
          ctx.fillStyle = pad;
        }
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 4);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (isTarget) {
          ctx.strokeStyle = `hsl(${noteHue(midi)},90%,65%)`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
        // Every note named; octave shown on Do and Sol only
        const withOctave = k.name === "C" || k.name === "G";
        const label = `${dn(k.name)}${withOctave ? k.octave : ""}`;
        const weight = withOctave || isLive ? 700 : 500;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = isLive ? "#09090b" : withOctave ? COLORS.text : k.natural ? COLORS.textDim : "#71717a";
        let size = Math.max(9, Math.min(12, w * 0.2));
        setFont(size, weight);
        // Shrink to fit narrow columns (e.g. "Sol#" across the full trumpet range)
        while (size > 7 && ctx.measureText(label).width > w - 2) {
          size -= 0.5;
          setFont(size, weight);
        }
        ctx.fillText(label, x + w / 2, y + h - 9);
        drawValves(ctx, x + w / 2, y + 6, w - 4, k.pistons, isLive);
      });

      // Judgement pop-ups floating up from the line
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let p = popups.length - 1; p >= 0; p--) {
        const pop = popups[p];
        const age = now - pop.born;
        if (age > POPUP_LIFE) {
          popups.splice(p, 1);
          continue;
        }
        const k = age / POPUP_LIFE;
        ctx.globalAlpha = 1 - k * k;
        ctx.fillStyle = pop.color;
        setFont(12 + 4 * Math.min(1, age * 8), 800);
        const px = Math.min(width - 30, Math.max(30, pop.x));
        ctx.fillText(pop.text, px, hitY - 22 - k * 40);
      }
      ctx.globalAlpha = 1;

      // Progress bar
      if (running) {
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(0, 0, width, 3);
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(0, 0, width * Math.max(0, Math.min(1, time / totalSec)), 3);
      }

      // HUD pills
      const scored = notes.reduce((s, n, i) => (judged[i] ? s + (n.end - n.start) : s), 0);
      const hitTotal = hitSec.reduce((s, h) => s + h, 0);
      if (running && !finished && scored > 0) {
        pill(10, 12, `${t("tiles.accuracy")} ${Math.round((100 * hitTotal) / scored)}%`, COLORS.text, "left");
        if (combo >= 2) pill(width - 10, 12, `${t("tiles.combo")} ×${combo}`, COLORS.accent, "right");
      }
      if (!micRef.current) {
        pill(width - 10, running ? 42 : 12, t("tiles.micHint"), COLORS.textDim, "right");
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!running) {
        // Idle: pulsing prompt
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now * 3);
        ctx.fillStyle = COLORS.textDim;
        setFont(15, 500);
        ctx.fillText(t("tiles.startHint"), width / 2, hitY / 2);
        ctx.globalAlpha = 1;
      } else if (time < 0) {
        // Lead-in: big countdown numbers, each shrinking and fading over its second
        const n = Math.ceil(-time);
        const frac = n + time; // 1 → 0 across the second
        ctx.globalAlpha = Math.min(1, frac * 1.6);
        ctx.fillStyle = COLORS.accent;
        ctx.shadowColor = COLORS.accent;
        ctx.shadowBlur = 24;
        setFont(64 + 36 * frac, 800);
        ctx.fillText(String(n), width / 2, hitY / 2);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      } else if (finished) {
        const accuracy = Math.round((100 * hitTotal) / (totalNoteSec || 1));
        const stars = accuracy >= 90 ? 3 : accuracy >= 75 ? 2 : accuracy >= 50 ? 1 : 0;
        const color = stars >= 2 ? COLORS.hit : stars === 1 ? COLORS.good : COLORS.miss;
        const cy = hitY / 2;

        ctx.fillStyle = "rgba(7,7,10,0.82)";
        ctx.fillRect(0, 0, width, hitY);

        setFont(26, 400);
        for (let s = 0; s < 3; s++) {
          ctx.fillStyle = s < stars ? COLORS.accent : COLORS.textFaint;
          ctx.fillText("★", width / 2 + (s - 1) * 34, cy - 70);
        }
        setFont(12, 600);
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(t("tiles.accuracy").toUpperCase(), width / 2, cy - 34);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        setFont(56, 800);
        ctx.fillText(`${accuracy}%`, width / 2, cy + 8);
        ctx.shadowBlur = 0;
        setFont(13, 500);
        ctx.fillStyle = COLORS.textDim;
        ctx.fillText(
          `${goodNotes} / ${notes.length} ${t("tiles.notesHit")}  ·  ${t("tiles.bestCombo")} ×${bestCombo}`,
          width / 2,
          cy + 52
        );
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [origin, notes, totalSec, measureTimes, columns]);

  return (
    <div className="rounded-xl overflow-hidden ring-1 ring-zinc-800 shadow-[0_0_40px_-12px_rgba(245,158,11,0.25)]">
      <div ref={wrapperRef} className="w-full">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
