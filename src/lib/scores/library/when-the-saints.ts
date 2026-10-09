import { Note } from "../../trumpet";
import { Score } from "../types";

const { C, D, E, F, G } = Note;

const whenTheSaints: Score = {
  id: "when-the-saints",
  title: "When the Saints Go Marching In",
  composer: "Traditional",
  tags: ["jazz", "traditional"],
  difficulty: "easy",
  tempo: 110,
  signature: [4, 4],
  pickup: 3,
  notes: [
    // Oh when the saints
    { note: C, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 4 },
    // go marching in
    { note: C, octave: 4, duration: 1, rest: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 4 },
    // Oh when the saints go marching in
    { note: C, octave: 4, duration: 1, rest: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 2 },
    { note: E, octave: 4, duration: 2 },
    { note: C, octave: 4, duration: 2 },
    { note: E, octave: 4, duration: 2 },
    { note: D, octave: 4, duration: 4 },
    // Oh Lord I want to be in that number
    { note: E, octave: 4, duration: 1, rest: 1 },
    { note: E, octave: 4, duration: 1 },
    { note: D, octave: 4, duration: 1 },
    { note: C, octave: 4, duration: 3 },
    { note: C, octave: 4, duration: 1 },
    { note: E, octave: 4, duration: 2 },
    { note: G, octave: 4, duration: 2 },
    { note: G, octave: 4, duration: 1 },
    { note: F, octave: 4, duration: 3 },
    // When the saints go marching in
    { note: E, octave: 4, duration: 1, rest: 2 },
    { note: F, octave: 4, duration: 1 },
    { note: G, octave: 4, duration: 2 },
    { note: E, octave: 4, duration: 2 },
    { note: C, octave: 4, duration: 2 },
    { note: D, octave: 4, duration: 2 },
    { note: C, octave: 4, duration: 4 },
  ],
};

export default whenTheSaints;
