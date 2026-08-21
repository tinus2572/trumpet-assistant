// Score system for Bb trumpet
// Notes are written in Bb trumpet notation (what the player reads)

import { Note, NOTE_TO_SEMITONE } from "./trumpet";

export interface ScoreNote {
  // Written note for Bb trumpet
  note: Note;
  // Written octave
  octave: number;
  // Duration in beats (1 = quarter, 0.5 = eighth, 2 = half, 4 = whole, etc.)
  duration: number;
  // Rest before the note (in beats), 0 by default
  rest?: number;
}

export interface Score {
  id: string;
  title: string;
  composer?: string;
  tempo: number; // BPM (quarter notes per minute)
  signature: [number, number]; // e.g. [4, 4]
  notes: ScoreNote[];
}

// Convert beat duration to seconds
export function beatsToSeconds(beatDuration: number, tempo: number): number {
  return (beatDuration * 60) / tempo;
}

// Total duration of a score in seconds
export function scoreDuration(score: Score): number {
  let total = 0;
  for (const n of score.notes) {
    total += (n.rest ?? 0) + n.duration;
  }
  return beatsToSeconds(total, score.tempo);
}

// Frequency of a written Bb trumpet note (in concert Hz)
// The Bb trumpet sounds 2 semitones lower than written
export function noteToFrequency(note: Note, octave: number): number {
  const semitone = NOTE_TO_SEMITONE[note];
  if (semitone === undefined) return 0;
  // MIDI of the written note
  const midiWritten = (octave + 1) * 12 + semitone;
  // Bb transposition: concert = written - 2
  const midiConcert = midiWritten - 2;
  // Frequency
  return 440 * Math.pow(2, (midiConcert - 69) / 12);
}

// Shorthand aliases for concise score definitions
const { C, Cs, D, Ds, E, F, Fs, G, Gs, A, As, B } = Note;

// --- Built-in scores ---

export const SCORES: Score[] = [
  {
    id: "gamme-do-majeur",
    title: "Gamme de Do Majeur",
    tempo: 80,
    signature: [4, 4],
    notes: [
      { note: C, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      { note: G, octave: 4, duration: 1 },
      { note: A, octave: 4, duration: 1 },
      { note: B, octave: 4, duration: 1 },
      { note: C, octave: 5, duration: 2 },
      { note: B, octave: 4, duration: 1 },
      { note: A, octave: 4, duration: 1 },
      { note: G, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 2 },
    ],
  },
  {
    id: "au-clair-de-la-lune-do",
    title: "Au Clair de la Lune (Do)",
    composer: "Jean-Baptiste Lully",
    tempo: 100,
    signature: [4, 4],
    notes: [
      { note: C, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 2 },
      { note: D, octave: 4, duration: 2 },
      { note: C, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 4 },
      { note: D, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: A, octave: 3, duration: 2 },
      { note: A, octave: 3, duration: 2 },
      { note: D, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: B, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 1 },
      { note: G, octave: 3, duration: 4 },
      { note: C, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 2 },
      { note: D, octave: 4, duration: 2 },
      { note: C, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 4 },
    ],
  },
  {
    id: "au-clair-de-la-lune-sol",
    title: "Au Clair de la Lune (Sol)",
    composer: "Jean-Baptiste Lully",
    tempo: 100,
    signature: [4, 4],
    notes: [
      { note: G, octave: 3, duration: 1 },
      { note: G, octave: 3, duration: 1 },
      { note: G, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 1 },
      { note: B, octave: 3, duration: 2 },
      { note: A, octave: 3, duration: 2 },
      { note: G, octave: 3, duration: 1 },
      { note: B, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 1 },
      { note: G, octave: 3, duration: 4 },
      { note: A, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 1 },
      { note: E, octave: 3, duration: 2 },
      { note: E, octave: 3, duration: 2 },
      { note: A, octave: 3, duration: 1 },
      { note: G, octave: 3, duration: 1 },
      { note: Fs, octave: 3, duration: 1 },
      { note: E, octave: 3, duration: 1 },
      { note: D, octave: 3, duration: 4 },
      { note: G, octave: 3, duration: 1 },
      { note: G, octave: 3, duration: 1 },
      { note: G, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 1 },
      { note: B, octave: 3, duration: 2 },
      { note: A, octave: 3, duration: 2 },
      { note: G, octave: 3, duration: 1 },
      { note: B, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 1 },
      { note: G, octave: 3, duration: 4 },
    ],
  },
  {
    id: "frere-jacques",
    title: "Frere Jacques",
    tempo: 120,
    signature: [4, 4],
    notes: [
      { note: C, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      { note: G, octave: 4, duration: 2 },
      { note: E, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      { note: G, octave: 4, duration: 2 },
      { note: G, octave: 4, duration: 0.5 },
      { note: A, octave: 4, duration: 0.5 },
      { note: G, octave: 4, duration: 0.5 },
      { note: F, octave: 4, duration: 0.5 },
      { note: E, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: G, octave: 4, duration: 0.5 },
      { note: A, octave: 4, duration: 0.5 },
      { note: G, octave: 4, duration: 0.5 },
      { note: F, octave: 4, duration: 0.5 },
      { note: E, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: G, octave: 3, duration: 1 },
      { note: C, octave: 4, duration: 2 },
      { note: C, octave: 4, duration: 1 },
      { note: G, octave: 3, duration: 1 },
      { note: C, octave: 4, duration: 2 },
    ],
  },
  {
    id: "ode-a-la-joie",
    title: "Ode a la Joie",
    composer: "Beethoven",
    tempo: 100,
    signature: [4, 4],
    notes: [
      { note: E, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      { note: G, octave: 4, duration: 1 },
      { note: G, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1.5 },
      { note: D, octave: 4, duration: 0.5 },
      { note: D, octave: 4, duration: 2 },
      { note: E, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      { note: G, octave: 4, duration: 1 },
      { note: G, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1.5 },
      { note: C, octave: 4, duration: 0.5 },
      { note: C, octave: 4, duration: 2 },
    ],
  },
  {
    id: "happy-birthday",
    title: "Happy Birthday",
    tempo: 100,
    signature: [3, 4],
    notes: [
      // Happy birth-
      { note: G, octave: 3, duration: 0.75 },
      { note: G, octave: 3, duration: 0.25 },
      // -day to you
      { note: A, octave: 3, duration: 1 },
      { note: G, octave: 3, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: B, octave: 3, duration: 2 },
      // Happy birth-
      { note: G, octave: 3, duration: 0.75 },
      { note: G, octave: 3, duration: 0.25 },
      // -day to you
      { note: A, octave: 3, duration: 1 },
      { note: G, octave: 3, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 2 },
      // Happy birth-
      { note: G, octave: 3, duration: 0.75 },
      { note: G, octave: 3, duration: 0.25 },
      // -day dear [name]
      { note: G, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: B, octave: 3, duration: 1 },
      { note: A, octave: 3, duration: 2 },
      // Happy birth-
      { note: F, octave: 4, duration: 0.75 },
      { note: F, octave: 4, duration: 0.25 },
      // -day to you
      { note: E, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      { note: C, octave: 4, duration: 2 },
    ],
  },
  {
    id: "fly-me-to-the-moon",
    title: "Fly Me to the Moon",
    composer: "Bart Howard",
    tempo: 100,
    signature: [4, 4],
    notes: [
      // "Fly me to the"
      { note: C, octave: 5, duration: 1 },
      { note: B, octave: 4, duration: 1 },
      { note: A, octave: 4, duration: 1.5 },
      { note: G, octave: 4, duration: 0.5 },
      // "moon, let me play"
      { note: F, octave: 4, duration: 1.5 },
      { note: G, octave: 4, duration: 0.5 },
      { note: A, octave: 4, duration: 1 },
      { note: C, octave: 5, duration: 1 },
      // "among the"
      { note: B, octave: 4, duration: 1.5 },
      { note: A, octave: 4, duration: 0.5 },
      { note: G, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      // "stars"
      { note: E, octave: 4, duration: 4 },
      // "Let me see what"
      { note: A, octave: 4, duration: 1 },
      { note: G, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1.5 },
      { note: E, octave: 4, duration: 0.5 },
      // "spring is like on"
      { note: D, octave: 4, duration: 1.5 },
      { note: E, octave: 4, duration: 0.5 },
      { note: F, octave: 4, duration: 1 },
      { note: A, octave: 4, duration: 1 },
      // "Jupiter and"
      { note: Gs, octave: 4, duration: 1.5 },
      { note: F, octave: 4, duration: 0.5 },
      { note: E, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      // "Mars"
      { note: C, octave: 4, duration: 4 },
      // "In other words"
      { note: D, octave: 4, duration: 2 },
      { note: E, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      // "hold my hand"
      { note: A, octave: 4, duration: 2 },
      { note: G, octave: 4, duration: 2 },
      // (hold)
      { note: E, octave: 4, duration: 4 },
      // "In other words"
      { note: D, octave: 4, duration: 2 },
      { note: E, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      // "darling, kiss me"
      { note: Gs, octave: 4, duration: 2 },
      { note: B, octave: 4, duration: 2 },
      { note: A, octave: 4, duration: 4 },
    ],
  },
  {
    id: "summertime",
    title: "Summertime",
    composer: "George Gershwin",
    tempo: 72,
    signature: [4, 4],
    notes: [
      // "Summertime"
      { note: E, octave: 4, duration: 2 },
      { note: A, octave: 4, duration: 2 },
      // "and the livin' is"
      { note: B, octave: 4, duration: 1 },
      { note: C, octave: 5, duration: 1 },
      { note: B, octave: 4, duration: 1 },
      { note: A, octave: 4, duration: 1 },
      // "easy"
      { note: A, octave: 4, duration: 2 },
      { note: E, octave: 4, duration: 2 },
      // (hold)
      { note: E, octave: 4, duration: 4 },
      // "Fish are jumpin'"
      { note: E, octave: 4, duration: 2 },
      { note: A, octave: 4, duration: 2 },
      // "and the cotton is"
      { note: B, octave: 4, duration: 1 },
      { note: C, octave: 5, duration: 1 },
      { note: B, octave: 4, duration: 1 },
      { note: A, octave: 4, duration: 1 },
      // "high"
      { note: A, octave: 4, duration: 4 },
      { note: G, octave: 4, duration: 4 },
      // "Oh your daddy's rich"
      { note: A, octave: 4, duration: 1 },
      { note: C, octave: 5, duration: 1 },
      { note: B, octave: 4, duration: 1 },
      { note: A, octave: 4, duration: 1 },
      // "and your ma is good lookin'"
      { note: G, octave: 4, duration: 1 },
      { note: F, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 1 },
      { note: D, octave: 4, duration: 1 },
      // "so hush little baby"
      { note: E, octave: 4, duration: 2 },
      { note: D, octave: 4, duration: 2 },
      // "don't you cry"
      { note: E, octave: 4, duration: 1 },
      { note: A, octave: 4, duration: 1 },
      { note: E, octave: 4, duration: 2 },
      // (ending)
      { note: A, octave: 3, duration: 4 },
    ],
  },
];

// Search by title (case-insensitive, accent-insensitive)
export function findScore(query: string): Score | undefined {
  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const r = normalize(query);
  return SCORES.find((p) => normalize(p.title).includes(r) || normalize(p.id).includes(r));
}
