"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  Note as TNote,
  PlayedNote,
  evaluatePitch,
} from "@/lib/trumpet";
import { Score } from "@/lib/partitions";
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
} from "vexflow";

// --- Helpers ---

const NOTE_COLOR = "#a1a1aa"; // zinc-400
const STAFF_LINE_COLOR = "#3f3f46"; // zinc-700
const ACTIVE_HALO = "rgba(245,158,11,0.18)"; // amber glow

/** Map our Note enum to a VexFlow key like "C/4" or "C#/4" */
function toVexKey(note: TNote, octave: number): string {
  return `${note}/${octave}`;
}

/** Does this note name contain a sharp? */
function isSharp(note: TNote): boolean {
  return note.includes("#");
}

/** Map beat duration to VexFlow duration string + dot count */
function beatsToDur(beats: number): { dur: string; dots: number } {
  if (beats >= 4) return { dur: "w", dots: 0 };
  if (beats >= 3) return { dur: "h", dots: 1 };
  if (beats >= 2) return { dur: "h", dots: 0 };
  if (beats >= 1.5) return { dur: "q", dots: 1 };
  if (beats >= 1) return { dur: "q", dots: 0 };
  if (beats >= 0.75) return { dur: "8", dots: 1 };
  if (beats >= 0.5) return { dur: "8", dots: 0 };
  return { dur: "16", dots: 0 };
}

// --- Measure splitting ---

interface MeasureData {
  noteIndices: number[]; // indices into the original notes array
  vexNotes: StaveNote[];
  beamGroups: StaveNote[][];
}

type DisplayNoteFn = (note: TNote) => string;

/** Add note name annotation below the note */
function addNoteLabel(vn: StaveNote, pn: PlayedNote, dn: DisplayNoteFn) {
  const label = `${dn(pn.note.writtenNote)}${pn.note.writtenOctave}`;
  const annotation = new Annotation(label)
    .setVerticalJustification(Annotation.VerticalJustify.BOTTOM)
    .setJustification(Annotation.HorizontalJustify.CENTER);
  annotation.setStyle({ fillStyle: "#71717a" }); // zinc-500
  vn.addModifier(annotation);
}

/** Split score notes into measures using the time signature */
function buildScoreMeasures(
  score: Score,
  notes: PlayedNote[],
  noteActiveIndex: number | null,
  mode: string,
  dn: DisplayNoteFn
): MeasureData[] {
  const [beatsPerMeasure] = score.signature;
  const measures: MeasureData[] = [];
  let currentBeat = 0;
  let measureNoteIndices: number[] = [];
  let measureVexNotes: StaveNote[] = [];
  let beamGroup: StaveNote[] = [];
  let beamGroups: StaveNote[][] = [];

  for (let i = 0; i < score.notes.length; i++) {
    const sn = score.notes[i];
    const pn = notes[i];

    // Handle rest before note
    if (sn.rest && sn.rest > 0) {
      currentBeat += sn.rest;
    }

    const { dur, dots } = beatsToDur(sn.duration);
    const key = toVexKey(pn.note.writtenNote, pn.note.writtenOctave);
    const vn = new StaveNote({ keys: [key], duration: dur, dots, autoStem: true });

    // Accidental
    if (isSharp(pn.note.writtenNote)) {
      vn.addModifier(new Accidental("#"));
    }

    // Dots
    for (let d = 0; d < dots; d++) {
      Dot.buildAndAttach([vn]);
    }

    // Style + label
    applyNoteStyle(vn, i, noteActiveIndex, pn, mode);
    addNoteLabel(vn, pn, dn);

    measureNoteIndices.push(i);
    measureVexNotes.push(vn);

    // Collect beam groups (eighth notes or shorter)
    if (sn.duration <= 0.5) {
      beamGroup.push(vn);
    } else {
      if (beamGroup.length >= 2) beamGroups.push([...beamGroup]);
      beamGroup = [];
    }

    currentBeat += sn.duration;

    // End of measure?
    if (currentBeat >= beatsPerMeasure - 0.001) {
      if (beamGroup.length >= 2) beamGroups.push([...beamGroup]);
      beamGroup = [];
      measures.push({
        noteIndices: [...measureNoteIndices],
        vexNotes: [...measureVexNotes],
        beamGroups: [...beamGroups],
      });
      measureNoteIndices = [];
      measureVexNotes = [];
      beamGroups = [];
      currentBeat = currentBeat - beatsPerMeasure;
    }
  }

  // Remaining notes
  if (measureVexNotes.length > 0) {
    if (beamGroup.length >= 2) beamGroups.push([...beamGroup]);
    measures.push({
      noteIndices: measureNoteIndices,
      vexNotes: measureVexNotes,
      beamGroups,
    });
  }

  return measures;
}

/** Build measures for live/replay mode (all quarter notes, 4 per measure) */
function buildLiveMeasures(
  notes: PlayedNote[],
  noteActiveIndex: number | null,
  mode: string,
  dn: DisplayNoteFn
): MeasureData[] {
  const NOTES_PER_MEASURE = 4;
  const measures: MeasureData[] = [];

  for (let start = 0; start < notes.length; start += NOTES_PER_MEASURE) {
    const end = Math.min(start + NOTES_PER_MEASURE, notes.length);
    const noteIndices: number[] = [];
    const vexNotes: StaveNote[] = [];

    for (let i = start; i < end; i++) {
      const pn = notes[i];
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

    measures.push({ noteIndices, vexNotes, beamGroups: [] });
  }

  return measures;
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
    const opacity = activeIndex !== null && mode === "replay" ? 0.35 : 0.7;
    const color = `rgba(161,161,170,${opacity})`; // zinc-400 with opacity
    vn.setStyle({ fillStyle: color, strokeStyle: color });
    vn.setStemStyle({ fillStyle: color, strokeStyle: color });
    vn.setFlagStyle({ fillStyle: color, strokeStyle: color });
  }
}

// --- Constants ---
const STAVE_HEIGHT = 180;
const STAVE_Y = 20;
const FIRST_MEASURE_WIDTH = 220; // wider for clef + time sig
const MEASURE_WIDTH = 180;

// --- Component ---

interface StaffProps {
  notes: PlayedNote[];
  noteActiveIndex: number | null;
  mode: "live" | "replay";
  score?: Score;
}

export default function Staff({ notes, noteActiveIndex, mode, score }: StaffProps) {
  const { t, dn } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const render = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous render
    container.innerHTML = "";

    if (notes.length === 0) {
      // Empty state: render a single empty stave with clef
      const svgW = 400;
      const renderer = new Renderer(container, Renderer.Backends.SVG);
      renderer.resize(svgW, STAVE_HEIGHT);
      const ctx = renderer.getContext();

      const stave = new Stave(0, STAVE_Y, svgW - 10);
      stave.addClef("treble");
      stave.setStyle({ fillStyle: STAFF_LINE_COLOR, strokeStyle: STAFF_LINE_COLOR });
      stave.setContext(ctx).draw();

      // Empty state text
      const svg = container.querySelector("svg");
      if (svg) {
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
        text.setAttribute("x", String(svgW / 2));
        text.setAttribute("y", String(STAVE_Y + 45));
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("font-size", "12");
        text.setAttribute("fill", "#52525b");
        text.textContent = mode === "live" ? t("staff.emptyLive") : t("staff.emptyReplay");
        svg.appendChild(text);
      }
      return;
    }

    // Build measures
    const measures = score
      ? buildScoreMeasures(score, notes, noteActiveIndex, mode, dn)
      : buildLiveMeasures(notes, noteActiveIndex, mode, dn);

    // Calculate total width
    const totalWidth = measures.reduce(
      (acc, _, i) => acc + (i === 0 ? FIRST_MEASURE_WIDTH : MEASURE_WIDTH),
      40 // right padding
    );

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(totalWidth, STAVE_HEIGHT);
    const ctx = renderer.getContext();

    let x = 0;
    let activeMeasureX = 0;
    let activeNoteLocalIdx = 0;

    measures.forEach((measure, mi) => {
      const isFirst = mi === 0;
      const isLast = mi === measures.length - 1;
      const w = isFirst ? FIRST_MEASURE_WIDTH : MEASURE_WIDTH;

      const stave = new Stave(x, STAVE_Y, w);
      stave.setStyle({ fillStyle: STAFF_LINE_COLOR, strokeStyle: STAFF_LINE_COLOR });

      if (isFirst) {
        stave.addClef("treble");
        if (score) {
          stave.setTimeSignature(`${score.signature[0]}/${score.signature[1]}`);
        }
      }

      stave.setContext(ctx).draw();

      // Voice
      const voice = new Voice(
        score
          ? { numBeats: score.signature[0], beatValue: score.signature[1] }
          : { numBeats: 4, beatValue: 4 }
      );
      voice.setMode(VoiceMode.SOFT);
      voice.addTickables(measure.vexNotes);

      new Formatter().joinVoices([voice]).format([voice], w - (isFirst ? 80 : 30));

      // Beams
      const beams = measure.beamGroups.map((group) => new Beam(group));

      voice.draw(ctx, stave);
      beams.forEach((b) => b.setContext(ctx).draw());

      // Track active note position for scrolling
      if (noteActiveIndex !== null) {
        const localIdx = measure.noteIndices.indexOf(noteActiveIndex);
        if (localIdx !== -1) {
          activeMeasureX = x;
          activeNoteLocalIdx = localIdx;
        }
      }

      x += w;
    });

    // Draw active note halo as SVG overlay
    if (noteActiveIndex !== null) {
      const svg = container.querySelector("svg");
      if (svg) {
        // Find the active note's bounding box by looking at the rendered note heads
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
              // Insert behind notes
              svg.insertBefore(halo, svg.firstChild);
            }
            globalIdx++;
          }
        }
      }
    }
  }, [notes, noteActiveIndex, mode, score, t, dn]);

  useEffect(() => {
    render();
  }, [render]);

  // Auto-scroll to active note
  useEffect(() => {
    if (noteActiveIndex === null || !scrollRef.current) return;

    // Find the rendered active note element and scroll to it
    const container = scrollRef.current;
    const noteEls = container.querySelectorAll(".vf-stavenote");
    if (noteEls[noteActiveIndex]) {
      const el = noteEls[noteActiveIndex] as HTMLElement;
      const elRect = el.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const scrollTarget = container.scrollLeft + (elRect.left - containerRect.left) - container.clientWidth / 2 + elRect.width / 2;
      container.scrollTo({
        left: scrollTarget,
        behavior: mode === "live" ? "smooth" : "auto",
      });
    }
  }, [noteActiveIndex, mode, notes, score]);

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          {t("staff.title")}
        </h2>
        {mode === "replay" && noteActiveIndex !== null && (
          <span className="text-[10px] text-amber-500/70 bg-amber-500/10 px-1.5 py-0.5 rounded">
            {t("staff.playing")}
          </span>
        )}
      </div>
      <div ref={scrollRef} className="overflow-x-auto px-2 pb-3">
        <div ref={containerRef} />
      </div>
    </div>
  );
}
