import { Note, NOTE_TO_SEMITONE } from "../trumpet";
import { Score } from "./types";

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
