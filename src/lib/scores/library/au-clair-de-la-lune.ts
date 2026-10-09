import { Note } from "../../trumpet";
import { Score } from "../types";

const { C, D, E, G, A, B } = Note;

const auClairDeLaLune: Score = {
  id: "au-clair-de-la-lune",
  title: "Au Clair de la Lune",
  composer: "Jean-Baptiste Lully",
  tags: ["traditional"],
  difficulty: "easy",
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
};

export default auClairDeLaLune;
