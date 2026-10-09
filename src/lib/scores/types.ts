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

export const SCORE_TAGS = ["jazz", "traditional", "classical", "exercise"] as const;
export type ScoreTag = (typeof SCORE_TAGS)[number];

export const DIFFICULTIES = ["easy", "medium", "hard", "impossible"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Score {
  id: string;
  title: string;
  composer?: string;
  tags: ScoreTag[];
  // Default difficulty; the player can override it (see score-prefs)
  difficulty: Difficulty;
  tempo: number; // BPM (quarter notes per minute)
  signature: [number, number]; // e.g. [4, 4]
  // Beats in an incomplete first measure (anacrusis), if any
  pickup?: number;
  notes: ScoreNote[];
}
