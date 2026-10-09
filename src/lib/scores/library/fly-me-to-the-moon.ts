import { Note } from "../../trumpet";
import { Score } from "../types";

const { C, D, E, F, G, Gs, A, B } = Note;

const flyMeToTheMoon: Score = {
  id: "fly-me-to-the-moon",
  title: "Fly Me to the Moon",
  composer: "Bart Howard",
  tags: ["jazz"],
  difficulty: "hard",
  tempo: 100,
  signature: [4, 4],
  notes: [
    // "Fly me to the"
    { note: C, octave: 5, duration: 1 },
    { note: B, octave: 4, duration: 1 },
    { note: A, octave: 4, duration: 1.5 },
    { note: G, octave: 4, duration: 0.5 },
    // "moon, let me play"
    { note: F, octave: 4, duration: 1.5 },
    { note: G, octave: 4, duration: 0.5 },
    { note: A, octave: 4, duration: 1 },
    { note: C, octave: 5, duration: 1 },
    // "among the"
    { note: B, octave: 4, duration: 1.5 },
    { note: A, octave: 4, duration: 0.5 },
    { note: G, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    // "stars"
    { note: E, octave: 4, duration: 4 },
    // "Let me see what"
    { note: A, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1.5 },
    { note: E, octave: 4, duration: 0.5 },
    // "spring is like on"
    { note: D, octave: 4, duration: 1.5 },
    { note: E, octave: 4, duration: 0.5 },
    { note: F, octave: 4, duration: 1 },
    { note: A, octave: 4, duration: 1 },
    // "Jupiter and"
    { note: Gs, octave: 4, duration: 1.5 },
    { note: F, octave: 4, duration: 0.5 },
    { note: E, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    // "Mars"
    { note: C, octave: 4, duration: 4 },
    // "In other words"
    { note: D, octave: 4, duration: 2 },
    { note: E, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    // "hold my hand"
    { note: A, octave: 4, duration: 2 },
    { note: G, octave: 4, duration: 2 },
    // (hold)
    { note: E, octave: 4, duration: 4 },
    // "In other words"
    { note: D, octave: 4, duration: 2 },
    { note: E, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    // "darling, kiss me"
    { note: Gs, octave: 4, duration: 2 },
    { note: B, octave: 4, duration: 2 },
    { note: A, octave: 4, duration: 4 },
  ],
};

export default flyMeToTheMoon;
