import { Note } from "../../trumpet";
import { Score } from "../types";

const { C, D, E, F, G, A, B } = Note;

const gammeDoMajeur: Score = {
  id: "gamme-do-majeur",
  title: "Gamme de Do Majeur",
  tags: ["exercise"],
  difficulty: "easy",
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
};

export default gammeDoMajeur;
