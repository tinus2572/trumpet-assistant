import { Note } from "../../trumpet";
import { Score } from "../types";

const { D, E, G, A, B } = Note;

const amazingGrace: Score = {
  id: "amazing-grace",
  title: "Amazing Grace",
  composer: "John Newton",
  tempo: 80,
  signature: [3, 4],
  pickup: 1,
  notes: [
    // A-
    { note: D, octave: 4, duration: 1 },
    // -mazing grace, how sweet the sound
    { note: G, octave: 4, duration: 2 },
    { note: B, octave: 4, duration: 0.5 },
    { note: G, octave: 4, duration: 0.5 },
    { note: B, octave: 4, duration: 2 },
    { note: A, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 2 },
    { note: E, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 2 },
    { note: D, octave: 4, duration: 1 },
    // That saved a wretch like me
    { note: G, octave: 4, duration: 2 },
    { note: B, octave: 4, duration: 0.5 },
    { note: G, octave: 4, duration: 0.5 },
    { note: B, octave: 4, duration: 2 },
    { note: A, octave: 4, duration: 1 },
    { note: D, octave: 5, duration: 5 },
    { note: B, octave: 4, duration: 1 },
    // I once was lost, but now am found
    { note: D, octave: 5, duration: 2 },
    { note: B, octave: 4, duration: 0.5 },
    { note: G, octave: 4, duration: 0.5 },
    { note: B, octave: 4, duration: 2 },
    { note: A, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 2 },
    { note: E, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 2 },
    { note: D, octave: 4, duration: 1 },
    // Was blind, but now I see
    { note: G, octave: 4, duration: 2 },
    { note: B, octave: 4, duration: 0.5 },
    { note: G, octave: 4, duration: 0.5 },
    { note: B, octave: 4, duration: 2 },
    { note: A, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 3 },
  ],
};

export default amazingGrace;
