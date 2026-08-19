// Utilities for Bb trumpet
// The Bb trumpet sounds one whole step below written pitch.
// When the player reads a written C, the concert pitch heard is Bb.

// Note names stored as letter notation internally
export enum Note {
  C  = "C",
  Cs = "C#",
  D  = "D",
  Ds = "D#",
  E  = "E",
  F  = "F",
  Fs = "F#",
  G  = "G",
  Gs = "G#",
  A  = "A",
  As = "A#",
  B  = "B",
}

// Display notation preference
export type Notation = "letter" | "solfege";

const SOLFEGE: Record<Note, string> = {
  [Note.C]: "Do", [Note.Cs]: "Do#", [Note.D]: "Ré", [Note.Ds]: "Ré#",
  [Note.E]: "Mi", [Note.F]: "Fa", [Note.Fs]: "Fa#", [Note.G]: "Sol",
  [Note.Gs]: "Sol#", [Note.A]: "La", [Note.As]: "La#", [Note.B]: "Si",
};

export function displayNote(note: Note, notation: Notation): string {
  return notation === "solfege" ? SOLFEGE[note] : note;
}

const NOTE_NAMES: Note[] = [
  Note.C, Note.Cs, Note.D, Note.Ds, Note.E, Note.F,
  Note.Fs, Note.G, Note.Gs, Note.A, Note.As, Note.B,
];

// Reference: A4 = 440 Hz
const A4_FREQ = 440;
const A4_MIDI = 69;

export interface NoteInfo {
  // Concert pitch (what is actually heard)
  concertNote: Note;
  concertOctave: number;
  // Written note for Bb trumpet (what the player reads)
  writtenNote: Note;
  writtenOctave: number;
  // Accuracy
  frequency: number;
  centsOffset: number; // deviation in cents from the nearest in-tune note
  // Fingering
  pistons: [boolean, boolean, boolean]; // [1st, 2nd, 3rd]
  fingeringLabel: string;
}

export function frequencyToNote(
  frequency: number,
  compensationCents: number = 0
): NoteInfo | null {
  if (frequency <= 0) return null;

  // Apply mute compensation (shift perceived frequency)
  const correctedFreq =
    compensationCents !== 0
      ? frequency * Math.pow(2, -compensationCents / 1200)
      : frequency;

  // Compute MIDI number
  const midiExact = 12 * Math.log2(correctedFreq / A4_FREQ) + A4_MIDI;
  const midiRounded = Math.round(midiExact);
  const centsOffset = Math.round((midiExact - midiRounded) * 100);

  // Concert note
  const noteIndex = ((midiRounded % 12) + 12) % 12;
  const octave = Math.floor(midiRounded / 12) - 1;
  const concertNote = NOTE_NAMES[noteIndex];

  // Bb transposition: written note is 2 semitones above concert
  const midiWritten = midiRounded + 2;
  const writtenIndex = ((midiWritten % 12) + 12) % 12;
  const writtenOctave = Math.floor(midiWritten / 12) - 1;
  const writtenNote = NOTE_NAMES[writtenIndex];

  // Fingering based on written note (semitone within the octave)
  const pistons = getValves(writtenIndex);
  const fingeringLabel = formatValves(pistons);

  return {
    concertNote,
    concertOctave: octave,
    writtenNote,
    writtenOctave,
    frequency: correctedFreq,
    centsOffset,
    pistons,
    fingeringLabel,
  };
}

// Fingerings for Bb trumpet by semitone (written note)
// 0=C, 1=C#, 2=D, 3=D#, 4=E, 5=F, 6=F#, 7=G, 8=G#, 9=A, 10=A#, 11=B
export const FINGERINGS: Record<number, [boolean, boolean, boolean]> = {
  0: [false, false, false], // C  -> open
  1: [true, true, true],    // C# -> 1+2+3
  2: [true, false, true],   // D  -> 1+3
  3: [false, true, true],   // D# -> 2+3
  4: [true, true, false],   // E  -> 1+2
  5: [true, false, false],  // F  -> 1
  6: [false, true, false],  // F# -> 2
  7: [false, false, false], // G  -> open
  8: [false, true, true],   // G# -> 2+3
  9: [true, true, false],   // A  -> 1+2
  10: [true, false, false], // A# -> 1
  11: [false, true, false], // B  -> 2
};

// Semitone index for each note name
export const NOTE_TO_SEMITONE: Record<Note, number> = {
  [Note.C]: 0, [Note.Cs]: 1, [Note.D]: 2, [Note.Ds]: 3, [Note.E]: 4, [Note.F]: 5,
  [Note.Fs]: 6, [Note.G]: 7, [Note.Gs]: 8, [Note.A]: 9, [Note.As]: 10, [Note.B]: 11,
};

function getValves(semitone: number): [boolean, boolean, boolean] {
  return FINGERINGS[semitone] ?? [false, false, false];
}

export function formatValves(pistons: [boolean, boolean, boolean]): string {
  const active: number[] = [];
  if (pistons[0]) active.push(1);
  if (pistons[1]) active.push(2);
  if (pistons[2]) active.push(3);
  if (active.length === 0) return "Open";
  return active.join(" + ");
}

// Qualitative pitch accuracy evaluation (returns i18n keys)
export type PitchQualityKey = "pitch.excellent" | "pitch.veryGood" | "pitch.good" | "pitch.acceptable" | "pitch.toFix";

export function evaluatePitch(centsOffset: number): {
  labelKey: PitchQualityKey;
  color: string;
} {
  const abs = Math.abs(centsOffset);
  if (abs <= 5) return { labelKey: "pitch.excellent", color: "#22c55e" };
  if (abs <= 10) return { labelKey: "pitch.veryGood", color: "#84cc16" };
  if (abs <= 20) return { labelKey: "pitch.good", color: "#eab308" };
  if (abs <= 35) return { labelKey: "pitch.acceptable", color: "#f97316" };
  return { labelKey: "pitch.toFix", color: "#ef4444" };
}

export interface PlayedNote {
  note: NoteInfo;
  timestamp: number;
  duration: number;
  relativeTime?: number; // seconds since recording start
}

export interface RecordingSummary {
  totalNotes: number;
  avgPitchOffset: number;
  bestNote: string;
  worstNote: string;
}

export interface Recording {
  id: string;
  date: string;
  duration: number;
  notes: PlayedNote[];
  summary: RecordingSummary;
}

export function computeSummary(notes: PlayedNote[]): RecordingSummary {
  const centsTotal = notes.reduce((acc, n) => acc + Math.abs(n.note.centsOffset), 0);
  const avgPitchOffset = notes.length > 0 ? Math.round(centsTotal / notes.length) : 0;
  const sorted = [...notes].sort(
    (a, b) => Math.abs(a.note.centsOffset) - Math.abs(b.note.centsOffset)
  );
  return {
    totalNotes: notes.length,
    avgPitchOffset,
    bestNote: sorted.length > 0
      ? `${sorted[0].note.writtenNote}${sorted[0].note.writtenOctave}`
      : "-",
    worstNote: sorted.length > 0
      ? `${sorted[sorted.length - 1].note.writtenNote}${sorted[sorted.length - 1].note.writtenOctave}`
      : "-",
  };
}
