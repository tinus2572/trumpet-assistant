import { Note } from "../../trumpet";
import { Score } from "../types";

const { C, D, E, F, G, A, B } = Note;

const happyBirthday: Score = {
  id: "happy-birthday",
  title: "Happy Birthday",
  tempo: 100,
  signature: [3, 4],
  pickup: 1,
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
    { note: A, octave: 3, duration: 1 },
    // Happy birth-
    { note: F, octave: 4, duration: 0.75 },
    { note: F, octave: 4, duration: 0.25 },
    // -day to you
    { note: E, octave: 4, duration: 1 },
    { note: C, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: C, octave: 4, duration: 3 },
  ],
};

export default happyBirthday;
