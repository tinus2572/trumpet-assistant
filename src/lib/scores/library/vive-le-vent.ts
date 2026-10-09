import { Note } from "../../trumpet";
import { Score } from "../types";

const { C, D, E, F, G } = Note;

const viveLeVent: Score = {
  id: "vive-le-vent",
  title: "Vive le Vent",
  composer: "James Pierpont",
  tags: ["traditional"],
  difficulty: "medium",
  tempo: 120,
  signature: [4, 4],
  notes: [
    // "Vive le vent, vive le vent"
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 2 },
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 2 },
    // "vive le vent d'hiver"
    { note: E, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 1 },
    { note: C, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 4 },
    // "Boule de neige et jour de l'an"
    { note: F, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    // "et bonne année grand-mère"
    { note: E, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 2 },
    { note: G, octave: 4, duration: 2 },
    // "Vive le vent, vive le vent"
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 2 },
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 2 },
    // "vive le vent d'hiver"
    { note: E, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 1 },
    { note: C, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 4 },
    // "Boule de neige et jour de l'an"
    { note: F, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    // "et bonne année grand-mère"
    { note: G, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: C, octave: 4, duration: 4 },
  ],
};

export default viveLeVent;
