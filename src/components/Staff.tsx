"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  Note as TNote,
  PlayedNote,
  evaluatePitch,
} from "@/lib/trumpet";
import { Score } from "@/lib/scores";
import { useI18n } from "@/lib/i18n";
import {
  Renderer,
  Stave,
  StaveNote,
  Voice,
  VoiceMode,
  Formatter,
  Beam,
  Accidental,
  Annotation,
  Dot,
  GhostNote,
  StaveTie,
  Tuplet,
} from "vexflow";

// --- Helpers ---

const NOTE_COLOR = "#000000"; // black
const STAFF_LINE_COLOR = "#000000"; // black
const ACTIVE_HALO = "rgba(255,210,63,0.55)"; // sun yellow
const SVG_NS = "http://www.w3.org/2000/svg";

/** VexFlow note line for a pitch (E4 = 1 = bottom line of the treble staff, lines/spaces step by 0.5) */
function pitchToLine(note: TNote, octave: number): number {
  const diatonic = "CDEFGAB".indexOf(note[0]) + octave * 7;
  return (diatonic - 28) / 2;
}

/** Map our Note enum to a VexFlow key like "C/4" or "C#/4" */
function toVexKey(note: TNote, octave: number): string {
  return `${note}/${octave}`;
}

/** Does this note name contain a sharp? */
function isSharp(note: TNote): boolean {
  return note.includes("#");
}

/** Is this duration a triplet value (triplet quarter or triplet eighth)? */
function isTriplet(beats: number): boolean {
  return Math.abs(beats - 2 / 3) < 0.01 || Math.abs(beats - 1 / 3) < 0.01;
}

/** Map beat duration to VexFlow duration string + dot count */
function beatsToDur(beats: number): { dur: string; dots: number } {
  if (Math.abs(beats - 2 / 3) < 0.01) return { dur: "q", dots: 0 };
  if (Math.abs(beats - 1 / 3) < 0.01) return { dur: "8", dots: 0 };
  if (beats >= 4) return { dur: "w", dots: 0 };
  if (beats >= 3) return { dur: "h", dots: 1 };
  if (beats >= 2) return { dur: "h", dots: 0 };
  if (beats >= 1.5) return { dur: "q", dots: 1 };
  if (beats >= 1) return { dur: "q", dots: 0 };
  if (beats >= 0.75) return { dur: "8", dots: 1 };
  if (beats >= 0.5) return { dur: "8", dots: 0 };
  return { dur: "16", dots: 0 };
}

const REST_CHUNKS = [4, 2, 1, 0.5, 0.25];

/** Create a VexFlow rest of the given beat length */
function makeRest(beats: number): StaveNote {
  const { dur } = beatsToDur(beats);
  const rest = new StaveNote({ keys: ["b/4"], duration: `${dur}r` });
  rest.setStyle({ fillStyle: "rgba(0,0,0,0.8)", strokeStyle: "rgba(0,0,0,0.8)" });
  return rest;
}

// --- Measure splitting ---

interface TiePair {
  from: StaveNote; // last note of a measure
  to: StaveNote;   // first note of next measure
}

interface MeasureData {
  noteIndices: number[]; // indices into the original notes array
  vexNotes: StaveNote[];
  beamGroups: StaveNote[][];
  tupletGroups: StaveNote[][];
}

interface MeasureResult {
  measures: MeasureData[];
  ties: TiePair[];
}

type DisplayNoteFn = (note: TNote) => string;

/** Add note name annotation below the note */
function addNoteLabel(vn: StaveNote, pn: PlayedNote, dn: DisplayNoteFn) {
  const label = `${dn(pn.note.writtenNote)}${pn.note.writtenOctave}`;
  const annotation = new Annotation(label)
    .setVerticalJustification(Annotation.VerticalJustify.BOTTOM)
    .setJustification(Annotation.HorizontalJustify.CENTER);
  annotation.setStyle({ fillStyle: "#555555" }); // dark gray
  vn.addModifier(annotation);
}

/** Create a VexFlow StaveNote with styling and label */
function makeVexNote(
  key: string,
  beats: number,
  pn: PlayedNote,
  originalIndex: number,
  noteActiveIndex: number | null,
  mode: string,
  dn: DisplayNoteFn
): StaveNote {
  const { dur, dots } = beatsToDur(beats);
  const vn = new StaveNote({ keys: [key], duration: dur, dots, autoStem: true });

  if (isSharp(pn.note.writtenNote)) {
    vn.addModifier(new Accidental("#"));
  }
  for (let d = 0; d < dots; d++) {
    Dot.buildAndAttach([vn]);
  }

  applyNoteStyle(vn, originalIndex, noteActiveIndex, pn, mode);
  addNoteLabel(vn, pn, dn);
  return vn;
}

/** Split score notes into measures using the time signature, with ties across bar lines */
function buildScoreMeasures(
  score: Score,
  notes: PlayedNote[],
  noteActiveIndex: number | null,
  mode: string,
  dn: DisplayNoteFn
): MeasureResult {
  const [beatsPerMeasure] = score.signature;
  const measures: MeasureData[] = [];
  const ties: TiePair[] = [];
  // A pickup measure starts partway through the bar
  let currentBeat = score.pickup ? beatsPerMeasure - score.pickup : 0;
  let measureNoteIndices: number[] = [];
  let measureVexNotes: StaveNote[] = [];
  let beamGroup: StaveNote[] = [];
  let beamGroups: StaveNote[][] = [];
  let tupletGroup: StaveNote[] = [];
  let tupletGroups: StaveNote[][] = [];

  const flushMeasure = () => {
    if (beamGroup.length >= 2) beamGroups.push([...beamGroup]);
    beamGroup = [];
    if (tupletGroup.length > 0) tupletGroups.push([...tupletGroup]);
    tupletGroup = [];
    measures.push({
      noteIndices: [...measureNoteIndices],
      vexNotes: [...measureVexNotes],
      beamGroups: [...beamGroups],
      tupletGroups: [...tupletGroups],
    });
    measureNoteIndices = [];
    measureVexNotes = [];
    beamGroups = [];
    tupletGroups = [];
  };

  const breakBeam = () => {
    if (beamGroup.length >= 2) beamGroups.push([...beamGroup]);
    beamGroup = [];
  };

  // Draw a rest, split into bar-aligned chunks and across bar lines
  const addRest = (beats: number) => {
    breakBeam();
    let left = beats;
    while (left > 0.001) {
      const remaining = beatsPerMeasure - currentBeat;
      const chunk = REST_CHUNKS.find(
        (c) => c <= left + 0.001 && c <= remaining + 0.001 && Math.abs(currentBeat / c - Math.round(currentBeat / c)) < 0.001
      ) ?? Math.min(left, remaining);
      measureNoteIndices.push(-1);
      measureVexNotes.push(makeRest(chunk));
      currentBeat += chunk;
      left -= chunk;
      if (currentBeat >= beatsPerMeasure - 0.001) {
        flushMeasure();
        currentBeat = 0;
      }
    }
  };

  for (let i = 0; i < score.notes.length; i++) {
    const sn = score.notes[i];
    const pn = notes[i];

    // Handle rest before note
    if (sn.rest && sn.rest > 0) {
      addRest(sn.rest);
    }

    const key = toVexKey(pn.note.writtenNote, pn.note.writtenOctave);
    const remaining = beatsPerMeasure - currentBeat;

    if (sn.duration > remaining + 0.001) {
      // Note crosses bar line — split with a tie
      const firstPart = makeVexNote(key, remaining, pn, i, noteActiveIndex, mode, dn);
      measureNoteIndices.push(i);
      measureVexNotes.push(firstPart);

      // Flush current measure
      if (beamGroup.length >= 2) beamGroups.push([...beamGroup]);
      beamGroup = [];
      flushMeasure();
      currentBeat = 0;

      // Second part in new measure
      const overflow = sn.duration - remaining;
      const secondPart = makeVexNote(key, overflow, pn, i, noteActiveIndex, mode, dn);
      measureNoteIndices.push(i);
      measureVexNotes.push(secondPart);

      ties.push({ from: firstPart, to: secondPart });

      currentBeat = overflow;
    } else {
      // Note fits in current measure
      const vn = makeVexNote(key, sn.duration, pn, i, noteActiveIndex, mode, dn);
      measureNoteIndices.push(i);
      measureVexNotes.push(vn);

      // Collect triplet groups (3 notes each)
      if (isTriplet(sn.duration)) {
        tupletGroup.push(vn);
        if (tupletGroup.length === 3) {
          tupletGroups.push([...tupletGroup]);
          tupletGroup = [];
        }
      }

      // Collect beam groups (eighth notes or shorter)
      if (sn.duration <= 0.5) {
        beamGroup.push(vn);
      } else {
        if (beamGroup.length >= 2) beamGroups.push([...beamGroup]);
        beamGroup = [];
      }

      currentBeat += sn.duration;
    }

    // End of measure?
    if (currentBeat >= beatsPerMeasure - 0.001) {
      flushMeasure();
      currentBeat = currentBeat - beatsPerMeasure;
    }
  }

  // Remaining notes
  if (measureVexNotes.length > 0) {
    flushMeasure();
  }

  return { measures, ties };
}

/** Build measures for live/replay mode (all quarter notes, 4 per measure) */
function buildLiveMeasures(
  notes: PlayedNote[],
  noteActiveIndex: number | null,
  mode: string,
  dn: DisplayNoteFn
): MeasureResult {
  const NOTES_PER_MEASURE = 4;
  const measures: MeasureData[] = [];

  for (let start = 0; start < notes.length; start += NOTES_PER_MEASURE) {
    const end = Math.min(start + NOTES_PER_MEASURE, notes.length);
    const noteIndices: number[] = [];
    const vexNotes: StaveNote[] = [];

    for (let i = start; i < end; i++) {
      const pn = notes[i];
      if (!pn.note.writtenNote) continue; // skip malformed notes
      const key = toVexKey(pn.note.writtenNote, pn.note.writtenOctave);
      const vn = new StaveNote({ keys: [key], duration: "q", autoStem: true });

      if (isSharp(pn.note.writtenNote)) {
        vn.addModifier(new Accidental("#"));
      }

      applyNoteStyle(vn, i, noteActiveIndex, pn, mode);
      addNoteLabel(vn, pn, dn);

      noteIndices.push(i);
      vexNotes.push(vn);
    }

    measures.push({ noteIndices, vexNotes, beamGroups: [], tupletGroups: [] });
  }

  return { measures, ties: [] };
}

/** Apply color styling to a note based on active state and pitch accuracy */
function applyNoteStyle(
  vn: StaveNote,
  index: number,
  activeIndex: number | null,
  pn: PlayedNote,
  mode: string
) {
  const isActive = index === activeIndex;
  const pitch = evaluatePitch(pn.note.centsOffset);

  if (isActive) {
    const color = pitch.color;
    vn.setStyle({ fillStyle: color, strokeStyle: color });
    vn.setStemStyle({ fillStyle: color, strokeStyle: color });
    vn.setFlagStyle({ fillStyle: color, strokeStyle: color });
  } else {
    const opacity = activeIndex !== null && mode === "replay" ? 0.3 : 0.8;
    const color = `rgba(0,0,0,${opacity})`; // black with opacity
    vn.setStyle({ fillStyle: color, strokeStyle: color });
    vn.setStemStyle({ fillStyle: color, strokeStyle: color });
    vn.setFlagStyle({ fillStyle: color, strokeStyle: color });
  }
}

// --- Constants ---
const STAVE_HEIGHT = 180;
const STAVE_Y = 20;
const LINE_SPACING = 160; // vertical distance between stave rows
const MEASURE_WIDTH = 180; // minimum width of a measure
const MEASURE_PADDING = 30; // stave space not available to notes
const FIRST_MEASURE_PADDING = 80; // extra room for clef + time sig
const LABEL_ROOM = 8; // per-note extra spacing so note-name labels don't collide

// --- Component ---

interface StaffProps {
  notes: PlayedNote[];
  noteActiveIndex: number | null;
  mode: "live" | "replay";
  score?: Score;
  /** Pitch currently heard on the mic: its staff line/space is highlighted */
  highlight?: { note: TNote; octave: number; color: string } | null;
}

interface StaveRow {
  stave: Stave; // first stave of the row, used for y geometry
  width: number;
}

export default function Staff({ notes, noteActiveIndex, mode, score, highlight }: StaffProps) {
  const { t, dn } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const rowsRef = useRef<StaveRow[]>([]);
  const overlayRef = useRef<SVGGElement | null>(null);
  const highlightRef = useRef(highlight);

  // Draw the mic pitch highlight in an overlay group behind the notes, without re-rendering VexFlow
  const drawHighlight = useCallback(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;
    overlay.replaceChildren();
    const hl = highlightRef.current;
    if (!hl) return;

    const line = pitchToLine(hl.note, hl.octave);
    const onLine = Number.isInteger(line);
    for (const { stave, width } of rowsRef.current) {
      const y = stave.getYForNote(line);
      const spacing = stave.getSpacingBetweenLines();
      const band = document.createElementNS(SVG_NS, "rect");
      band.setAttribute("x", "0");
      band.setAttribute("y", String(y - spacing / 2));
      band.setAttribute("width", String(width));
      band.setAttribute("height", String(spacing));
      band.setAttribute("fill", hl.color);
      band.setAttribute("fill-opacity", onLine ? "0.15" : "0.3");
      overlay.appendChild(band);
      if (onLine) {
        const stroke = document.createElementNS(SVG_NS, "line");
        stroke.setAttribute("x1", "0");
        stroke.setAttribute("x2", String(width));
        stroke.setAttribute("y1", String(y));
        stroke.setAttribute("y2", String(y));
        stroke.setAttribute("stroke", hl.color);
        stroke.setAttribute("stroke-width", "3");
        stroke.setAttribute("stroke-opacity", "0.8");
        overlay.appendChild(stroke);
      }
    }
  }, []);

  // Track wrapper width for multi-line layout
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const render = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    rowsRef.current = [];
    overlayRef.current = null;

    const availWidth = containerWidth || container.clientWidth || 600;

    if (notes.length === 0) {
      const svgW = Math.max(availWidth, 300);
      const renderer = new Renderer(container, Renderer.Backends.SVG);
      renderer.resize(svgW, STAVE_HEIGHT);
      const ctx = renderer.getContext();

      const stave = new Stave(0, STAVE_Y, svgW - 10);
      stave.addClef("treble");
      stave.setStyle({ fillStyle: STAFF_LINE_COLOR, strokeStyle: STAFF_LINE_COLOR });
      stave.setContext(ctx).draw();

      const svg = container.querySelector("svg");
      if (svg) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String(svgW / 2));
        text.setAttribute("y", String(STAVE_Y + 45));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "12");
        text.setAttribute("fill", "#999999");
        text.textContent = mode === "live" ? t("staff.emptyLive") : t("staff.emptyReplay");
        svg.appendChild(text);
      }
      return;
    }

    // Build measures
    const { measures, ties } = score
      ? buildScoreMeasures(score, notes, noteActiveIndex, mode, dn)
      : buildLiveMeasures(notes, noteActiveIndex, mode, dn);

    // Prepare each measure's voice, beams and tuplets, and measure how much room its notes need
    const prepared = measures.map((measure) => {
      const voice = new Voice(
        score
          ? { numBeats: score.signature[0], beatValue: score.signature[1] }
          : { numBeats: 4, beatValue: 4 }
      );
      voice.setMode(VoiceMode.SOFT);
      const tuplets = measure.tupletGroups.map((group) => new Tuplet(group));
      voice.addTickables(measure.vexNotes);
      // Beam eighths by beat (e.g. pairs in 4/4) rather than as one long run
      const beams = measure.beamGroups.flatMap((group) => Beam.generateBeams(group));
      const formatter = new Formatter().joinVoices([voice]);
      // Leave room for the note-name labels, which the formatter doesn't count
      const noteArea = Math.max(
        MEASURE_WIDTH - MEASURE_PADDING,
        formatter.preCalculateMinTotalWidth([voice]) + measure.vexNotes.length * LABEL_ROOM
      );
      return { voice, tuplets, beams, formatter, noteArea };
    });
    const measureWidth = (mi: number, firstInLine: boolean) =>
      prepared[mi].noteArea + (firstInLine ? FIRST_MEASURE_PADDING : MEASURE_PADDING);

    // Group measures into lines based on available width
    const lines: number[][] = [];
    let currentLine: number[] = [];
    let lineWidth = 0;
    for (let mi = 0; mi < measures.length; mi++) {
      const w = measureWidth(mi, currentLine.length === 0);
      if (lineWidth + w > availWidth && currentLine.length > 0) {
        lines.push(currentLine);
        currentLine = [mi];
        lineWidth = measureWidth(mi, true);
      } else {
        currentLine.push(mi);
        lineWidth += w;
      }
    }
    if (currentLine.length > 0) lines.push(currentLine);

    // Justify: stretch each line's note areas to fill the width (the last line only if mostly full)
    const stretch = lines.map((line, lineIdx) => {
      const natural = line.reduce((sum, mi, k) => sum + measureWidth(mi, k === 0), 0);
      const isLast = lineIdx === lines.length - 1;
      if (isLast && natural < availWidth * 0.7) return 1;
      const notes = line.reduce((sum, mi) => sum + prepared[mi].noteArea, 0);
      return Math.max(1, (notes + availWidth - natural - 1) / notes);
    });

    const totalHeight = STAVE_Y + lines.length * LINE_SPACING;
    const svgW = Math.max(availWidth, 300);

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(svgW, totalHeight);
    const ctx = renderer.getContext();

    lines.forEach((measureIndices, lineIdx) => {
      const y = STAVE_Y + lineIdx * LINE_SPACING;
      let x = 0;
      let rowStave: Stave | null = null;

      measureIndices.forEach((mi, localIdx) => {
        const measure = measures[mi];
        const isFirstInLine = localIdx === 0;
        const { voice, tuplets, beams, formatter } = prepared[mi];
        const noteArea = prepared[mi].noteArea * stretch[lineIdx];
        const w = noteArea + (isFirstInLine ? FIRST_MEASURE_PADDING : MEASURE_PADDING);

        const stave = new Stave(x, y, w);
        stave.setStyle({ fillStyle: STAFF_LINE_COLOR, strokeStyle: STAFF_LINE_COLOR });

        if (isFirstInLine) {
          stave.addClef("treble");
          if (lineIdx === 0 && score) {
            stave.setTimeSignature(`${score.signature[0]}/${score.signature[1]}`);
          }
        }

        stave.setContext(ctx).draw();
        rowStave ??= stave;

        formatter.format([voice], noteArea);
        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
        tuplets.forEach((tp) => tp.setContext(ctx).draw());

        measure.vexNotes.forEach((vn, li) => {
          const idx = measure.noteIndices[li];
          if (idx >= 0) vn.getSVGElement()?.setAttribute("data-note-index", String(idx));
        });

        x += w;
      });
      if (rowStave) rowsRef.current.push({ stave: rowStave, width: x });
    });

    // Draw ties (only when both notes are on the same line)
    for (const tie of ties) {
      const fromMi = measures.findIndex(m => m.vexNotes.includes(tie.from));
      const toMi = measures.findIndex(m => m.vexNotes.includes(tie.to));
      const fromLine = lines.findIndex(line => line.includes(fromMi));
      const toLine = lines.findIndex(line => line.includes(toMi));
      if (fromLine === toLine && fromLine !== -1) {
        const staveTie = new StaveTie({
          firstNote: tie.from,
          lastNote: tie.to,
          firstIndexes: [0],
          lastIndexes: [0],
        });
        staveTie.setStyle({ fillStyle: NOTE_COLOR, strokeStyle: NOTE_COLOR });
        staveTie.setContext(ctx).draw();
      }
    }

    // Draw active note halo
    if (noteActiveIndex !== null) {
      const svg = container.querySelector("svg");
      if (svg) {
        const noteElements = svg.querySelectorAll(".vf-stavenote");
        let globalIdx = 0;
        for (const measure of measures) {
          for (let li = 0; li < measure.vexNotes.length; li++) {
            if (measure.noteIndices[li] === noteActiveIndex && noteElements[globalIdx]) {
              const bbox = noteElements[globalIdx].getBoundingClientRect();
              const svgRect = svg.getBoundingClientRect();
              const cx = bbox.x - svgRect.x + bbox.width / 2;
              const cy = bbox.y - svgRect.y + bbox.height / 2;
              const halo = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
              halo.setAttribute("cx", String(cx));
              halo.setAttribute("cy", String(cy));
              halo.setAttribute("rx", "14");
              halo.setAttribute("ry", "12");
              halo.setAttribute("fill", ACTIVE_HALO);
              halo.setAttribute("stroke", "none");
              svg.insertBefore(halo, svg.firstChild);
            }
            globalIdx++;
          }
        }
      }
    }

    const svg = container.querySelector("svg");
    if (svg) {
      const overlay = document.createElementNS(SVG_NS, "g");
      svg.insertBefore(overlay, svg.firstChild);
      overlayRef.current = overlay;
      drawHighlight();
    }
  }, [notes, noteActiveIndex, mode, score, t, dn, containerWidth, drawHighlight]);

  // Declared before the render effect so the ref is current when the SVG is rebuilt
  const hlNote = highlight?.note;
  const hlOctave = highlight?.octave;
  const hlColor = highlight?.color;
  useEffect(() => {
    highlightRef.current =
      hlNote !== undefined && hlOctave !== undefined && hlColor !== undefined
        ? { note: hlNote, octave: hlOctave, color: hlColor }
        : null;
    drawHighlight();
  }, [hlNote, hlOctave, hlColor, drawHighlight]);

  useEffect(() => {
    render();
  }, [render]);

  return (
    <div className="bg-card border-2 border-ink rounded-nb overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <h2 className="nb-label">{t("staff.title")}</h2>
        {mode === "replay" && noteActiveIndex !== null && (
          <span className="text-[10px] font-bold bg-sun border-2 border-ink px-1.5 py-px rounded-md">
            {t("staff.playing")}
          </span>
        )}
      </div>
      <div ref={wrapperRef} className="px-2 pb-3">
        <div ref={containerRef} />
      </div>
    </div>
  );
}
