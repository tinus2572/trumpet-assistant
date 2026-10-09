// Score system for Bb trumpet
// Notes are written in Bb trumpet notation (what the player reads)

import { Note } from "../trumpet";

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
  // Beats in an incomplete first measure (anacrusis), if any
  pickup?: number;
  notes: ScoreNote[];
}
