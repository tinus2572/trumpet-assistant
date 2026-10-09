"use client";

import { useEffect, useMemo, useRef } from "react";
import { Score, beatsToSeconds } from "@/lib/scores";
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

// Neobrutalist palette (matches the theme tokens in globals.css)
const COLORS = {
  ink: "#121212",
  paper: "#fff6e5",
  card: "#ffffff",
  muted: "#f3ead6",
  sun: "#ffd23f",
  mint: "#7ee2a8",
  tomato: "#ff6b57",
  laneEdge: "rgba(18,18,18,0.12)",
  octaveEdge: "rgba(18,18,18,0.45)",
  measure: "rgba(18,18,18,0.3)",
};

/** One hue per pitch class, so each note keeps its color across octaves */
function noteHue(midi: number): number {
  return (((midi % 12) + 12) % 12) * 30 + 20;
}

/** Mini fingering diagram: three valves, pressed ones pushed down */
function drawValves(
  ctx: CanvasRenderingContext2D,
  cx: number,
  top: number,
  maxWidth: number,
  pistons: [boolean, boolean, boolean],
  onDark: boolean
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
    ctx.fillStyle = onDark ? "rgba(255,255,255,0.18)" : "rgba(18,18,18,0.1)";
    ctx.beginPath();
    ctx.roundRect(x, top, vw, vh, Math.min(2, vw / 3));
    ctx.fill();
    // Stem and cap
    const capY = top + (pressed ? travel : 0);
    ctx.fillStyle = pressed
      ? onDark ? COLORS.sun : COLORS.ink
      : onDark ? "rgba(255,255,255,0.5)" : "rgba(18,18,18,0.3)";
    ctx.fillRect(x + vw / 2 - Math.max(0.75, vw * 0.12), capY + capH, Math.max(1.5, vw * 0.24), vh - (capY - top) - capH);
    ctx.beginPath();
    ctx.roundRect(x, capY, vw, capH, [capH / 2, capH / 2, 1, 1]);
    ctx.fill();
  });
}

/** Flat box with ink border and hard offset shadow (pressed = no shadow, shifted) */
function drawBox(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  { radius = 6, shadow = 3, pressed = false, border = 2 } = {}
) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (!pressed && shadow > 0) {
    ctx.fillStyle = COLORS.ink;
    ctx.beginPath();
    ctx.roundRect(x + shadow, y + shadow, w, h, r);
    ctx.fill();
  }
  const ox = pressed ? shadow : 0;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x + ox, y + ox, w, h, r);
  ctx.fill();
  ctx.lineWidth = border;
  ctx.strokeStyle = COLORS.ink;
  ctx.stroke();
}

/** Text filled with a color and outlined in ink, sticker style */
function stickerText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, fill: string, outline: number) {
  ctx.lineJoin = "round";
  ctx.lineWidth = outline;
  ctx.strokeStyle = COLORS.ink;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
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
    const displayFont =
      getComputedStyle(document.documentElement).getPropertyValue("--font-archivo-black").trim() || font;
    const setFont = (size: number, weight = 400) => {
      ctx.font = `${weight} ${size}px ${font}`;
    };
    const setDisplayFont = (size: number) => {
      ctx.font = `400 ${size}px ${displayFont}`;
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

    const pill = (x: number, y: number, text: string, fill: string, align: "left" | "right") => {
      setFont(12, 700);
      const w = ctx.measureText(text).width + 22;
      const px = align === "left" ? x : x - w - 2;
      drawBox(ctx, px, y, w, 26, fill, { radius: 13, shadow: 2 });
      ctx.fillStyle = COLORS.ink;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, px + w / 2, y + 13.5);
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
            ratio >= 0.8 ? [t("tiles.perfect"), COLORS.mint]
            : ratio >= 0.5 ? [t("tiles.good"), COLORS.sun]
            : [t("tiles.miss"), COLORS.tomato];
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

      // Background and lanes: white naturals, tinted sharps
      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(0, 0, width, HEIGHT);
      keys.forEach((k, i) => {
        const x = i * colW;
        ctx.fillStyle = k.natural ? COLORS.card : COLORS.muted;
        ctx.fillRect(x, 0, colW, hitY);
        const edge = k.name === "C" && i > 0;
        ctx.fillStyle = edge ? COLORS.octaveEdge : COLORS.laneEdge;
        ctx.fillRect(Math.round(x) - (edge ? 1 : 0), 0, edge ? 2 : 1, hitY);
      });

      // Lanes of the notes due now are tinted with their note color
      for (const midi of targets) {
        ctx.fillStyle = `hsla(${noteHue(midi)},90%,65%,${liveMidi === midi ? 0.45 : 0.2})`;
        ctx.fillRect(laneX(midi), 0, colW, hitY);
      }

      // Measure lines (dashed)
      ctx.strokeStyle = COLORS.measure;
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      for (const m of measureTimes) {
        const y = Math.round(hitY - (m - time) * pxPerSec) + 0.5;
        if (y <= 0 || y >= hitY) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      // Falling tiles, consumed as they cross the hit line; a tile being played well "presses down"
      notes.forEach((n) => {
        const bottom = Math.min(hitY - 3, hitY - (n.start - time) * pxPerSec - 2);
        const top = hitY - (n.end - time) * pxPerSec + 2;
        if (bottom <= top + 1 || bottom < 0 || top > hitY) return;
        const key = keys[n.midi - low];
        const lit = time >= n.start && time < n.end && liveMidi === n.midi;
        const pad = Math.min(4, colW * 0.12);
        drawBox(
          ctx,
          laneX(n.midi) + pad,
          top,
          colW - 2 * pad - 3,
          bottom - top,
          `hsl(${noteHue(n.midi)},85%,${key.natural ? 66 : 58}%)`,
          { radius: 6, shadow: 3, pressed: lit }
        );
      });

      // Confetti while the right note is held
      if (hitting && liveMidi !== null) {
        for (let s = 0; s < 2; s++) {
          sparks.push({
            x: laneX(liveMidi) + Math.random() * colW,
            y: hitY - 4,
            vx: (Math.random() - 0.5) * 110,
            vy: -80 - Math.random() * 150,
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
        sp.vy += 300 * frameDt;
        const size = 5 * (1 - age / SPARK_LIFE) + 2;
        ctx.fillStyle = `hsl(${sp.hue},90%,62%)`;
        ctx.fillRect(sp.x, sp.y, size, size);
        ctx.lineWidth = 1;
        ctx.strokeStyle = COLORS.ink;
        ctx.strokeRect(sp.x, sp.y, size, size);
      }

      // Hit line: a thick band, mint while the right note is held
      ctx.fillStyle = hitting ? COLORS.mint : COLORS.sun;
      ctx.fillRect(0, hitY - 4, width, 8);
      ctx.fillStyle = COLORS.ink;
      ctx.fillRect(0, hitY - 5, width, 2);
      ctx.fillRect(0, hitY + 3, width, 2);

      // Keys: white naturals, black sharps; due notes in yellow, the mic note in its pitch color
      ctx.fillStyle = COLORS.paper;
      ctx.fillRect(0, hitY + 5, width, KEY_HEIGHT);
      keys.forEach((k, i) => {
        const midi = low + i;
        const x = i * colW + 2;
        const w = colW - 6;
        const y = hitY + 9;
        const h = KEY_HEIGHT - 15;
        const isLive = midi === liveMidi && live !== null;
        const isTarget = targets.has(midi);
        const fill = isLive
          ? evaluatePitch(live.centsOffset).color
          : isTarget
          ? COLORS.sun
          : k.natural
          ? COLORS.card
          : COLORS.ink;
        const dark = fill === COLORS.ink;
        drawBox(ctx, x, y, w, h, fill, { radius: 5, shadow: 2, pressed: isLive });
        const ox = isLive ? 2 : 0;

        // Every note named; octave shown on Do and Sol only
        const withOctave = k.name === "C" || k.name === "G";
        const label = `${dn(k.name)}${withOctave ? k.octave : ""}`;
        const weight = withOctave || isLive ? 700 : 600;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = dark ? COLORS.card : COLORS.ink;
        let size = Math.max(9, Math.min(12, w * 0.2));
        setFont(size, weight);
        // Shrink to fit narrow columns (e.g. "Sol#" across the full trumpet range)
        while (size > 7 && ctx.measureText(label).width > w - 2) {
          size -= 0.5;
          setFont(size, weight);
        }
        ctx.fillText(label, x + ox + w / 2, y + ox + h - 9);
        drawValves(ctx, x + ox + w / 2, y + ox + 6, w - 4, k.pistons, dark);
      });

      // Judgement stickers floating up from the line
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
        setDisplayFont(13 + 5 * Math.min(1, age * 8));
        const px = Math.min(width - 40, Math.max(40, pop.x));
        stickerText(ctx, pop.text, px, hitY - 26 - k * 40, pop.color, 4);
      }
      ctx.globalAlpha = 1;

      // Progress bar
      if (running) {
        ctx.fillStyle = COLORS.card;
        ctx.fillRect(0, 0, width, 7);
        ctx.fillStyle = COLORS.sun;
        ctx.fillRect(0, 0, width * Math.max(0, Math.min(1, time / totalSec)), 7);
        ctx.fillStyle = COLORS.ink;
        ctx.fillRect(0, 7, width, 2);
      }

      // HUD pills
      const scored = notes.reduce((s, n, i) => (judged[i] ? s + (n.end - n.start) : s), 0);
      const hitTotal = hitSec.reduce((s, h) => s + h, 0);
      if (running && !finished && scored > 0) {
        pill(10, 18, `${t("tiles.accuracy")} ${Math.round((100 * hitTotal) / scored)}%`, COLORS.card, "left");
        if (combo >= 2) pill(width - 10, 18, `${t("tiles.combo")} ×${combo}`, COLORS.sun, "right");
      }
      if (!micRef.current) {
        pill(width - 10, running ? 52 : 14, t("tiles.micHint"), COLORS.tomato, "right");
      }

      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      if (!running) {
        // Idle: a card with the prompt, gently bobbing
        setFont(15, 700);
        const text = t("tiles.startHint");
        const w = ctx.measureText(text).width + 36;
        const bob = Math.sin(now * 2.5) * 3;
        drawBox(ctx, width / 2 - w / 2, hitY / 2 - 22 + bob, w, 44, COLORS.card, { radius: 10, shadow: 4 });
        ctx.fillStyle = COLORS.ink;
        ctx.fillText(text, width / 2, hitY / 2 + bob + 1);
      } else if (time < 0) {
        // Lead-in: big countdown numbers, each shrinking over its second
        const n = Math.ceil(-time);
        const frac = n + time; // 1 → 0 across the second
        setDisplayFont(70 + 40 * frac);
        ctx.fillStyle = COLORS.ink;
        ctx.fillText(String(n), width / 2 + 5, hitY / 2 + 5);
        stickerText(ctx, String(n), width / 2, hitY / 2, COLORS.sun, 6);
      } else if (finished) {
        const accuracy = Math.round((100 * hitTotal) / (totalNoteSec || 1));
        const stars = accuracy >= 90 ? 3 : accuracy >= 75 ? 2 : accuracy >= 50 ? 1 : 0;
        const color = stars >= 2 ? COLORS.mint : stars === 1 ? COLORS.sun : COLORS.tomato;
        const cy = hitY / 2;

        ctx.fillStyle = "rgba(255,246,229,0.75)";
        ctx.fillRect(0, 9, width, hitY - 14);
        const cw = Math.min(width - 32, 340);
        drawBox(ctx, width / 2 - cw / 2, cy - 112, cw, 218, COLORS.card, { radius: 12, shadow: 6, border: 3 });

        setDisplayFont(30);
        for (let s = 0; s < 3; s++) {
          stickerText(ctx, "★", width / 2 + (s - 1) * 40, cy - 72, s < stars ? COLORS.sun : COLORS.muted, 4);
        }
        setFont(12, 700);
        ctx.fillStyle = COLORS.ink;
        ctx.fillText(t("tiles.accuracy").toUpperCase(), width / 2, cy - 36);
        setDisplayFont(54);
        stickerText(ctx, `${accuracy}%`, width / 2, cy + 8, color, 6);
        setFont(13, 600);
        ctx.fillStyle = COLORS.ink;
        ctx.fillText(`${goodNotes} / ${notes.length} ${t("tiles.notesHit")}`, width / 2, cy + 56);
        ctx.fillText(`${t("tiles.bestCombo")} ×${bestCombo}`, width / 2, cy + 78);
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
    <div className="border-2 border-ink rounded-nb overflow-hidden">
      <div ref={wrapperRef} className="w-full">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
