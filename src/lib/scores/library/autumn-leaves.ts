import { Note } from "../../trumpet";
import { Score } from "../types";

const { C, D, E, F, Gs, A, B } = Note;

const autumnLeaves: Score = {
  id: "autumn-leaves",
  title: "Autumn Leaves",
  composer: "Joseph Kosma",
  tempo: 100,
  signature: [4, 4],
  pickup: 3,
  notes: [
    // A — The falling leaves drift by the window...
    { note: D, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: C, octave: 5, duration: 5 },
    { note: C, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: B, octave: 4, duration: 5 },
    { note: B, octave: 3, duration: 1 },
    { note: C, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: A, octave: 4, duration: 5 },
    { note: Gs, octave: 3, duration: 1 },
    { note: A, octave: 3, duration: 1 },
    { note: B, octave: 3, duration: 1 },
    { note: A, octave: 4, duration: 5 },
    // A
    { note: D, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: C, octave: 5, duration: 5 },
    { note: C, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: B, octave: 4, duration: 5 },
    { note: B, octave: 3, duration: 1 },
    { note: C, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: A, octave: 4, duration: 5 },
    { note: Gs, octave: 3, duration: 1 },
    { note: A, octave: 3, duration: 1 },
    { note: B, octave: 3, duration: 1 },
    { note: A, octave: 4, duration: 4 },
  ],
};

export default autumnLeaves;
