// Loads the built-in score library from YAML files (server only: uses fs).
// Each score is one file under ./library: drop a new <id>.yaml there and it shows up in the app.
// The format is documented in library/README.md.

import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { Note } from "../trumpet";
import { DIFFICULTIES, Difficulty, SCORE_TAGS, Score, ScoreNote, ScoreTag } from "./types";

const LIBRARY_DIR = path.join(process.cwd(), "src/lib/scores/library");

// Flats are accepted for convenience and stored as their sharp equivalent
const FLATS: Record<string, Note> = {
  Db: Note.Cs, Eb: Note.Ds, Gb: Note.Fs, Ab: Note.Gs, Bb: Note.As,
};
const NOTES = new Set<string>(Object.values(Note));

export function loadScores(): Score[] {
  return fs
    .readdirSync(LIBRARY_DIR)
    .filter((f) => /\.ya?ml$/.test(f))
    .sort()
    .map((f) => {
      const file = path.join(LIBRARY_DIR, f);
      const id = f.replace(/\.ya?ml$/, "");
      try {
        return parseScore(parse(fs.readFileSync(file, "utf8")), id);
      } catch (e) {
        throw new Error(`Invalid score ${f}: ${(e as Error).message}`);
      }
    });
}

function parseScore(raw: unknown, fileId: string): Score {
  const s = raw as Record<string, unknown>;
  if (!s || typeof s !== "object") throw new Error("expected a YAML mapping");
  const id = s.id ?? fileId;
  if (id !== fileId) throw new Error(`id "${id}" must match the file name`);
  const title = requireType(s.title, "string", "title");
  const tags = (s.tags ?? []) as ScoreTag[];
  if (!Array.isArray(tags) || tags.some((t) => !SCORE_TAGS.includes(t))) {
    throw new Error(`tags must be a list of: ${SCORE_TAGS.join(", ")}`);
  }
  const difficulty = s.difficulty as Difficulty;
  if (!DIFFICULTIES.includes(difficulty)) {
    throw new Error(`difficulty must be one of: ${DIFFICULTIES.join(", ")}`);
  }
  const signature = s.signature ?? [4, 4];
  if (!Array.isArray(signature) || signature.length !== 2 || !signature.every(Number.isInteger)) {
    throw new Error("signature must look like [4, 4]");
  }
  if (!Array.isArray(s.notes) || s.notes.length === 0) throw new Error("notes must be a non-empty list");

  return {
    id: fileId,
    title,
    ...(s.composer != null && { composer: String(s.composer) }),
    tags,
    difficulty,
    tempo: requireType(s.tempo, "number", "tempo"),
    signature: signature as [number, number],
    ...(s.pickup != null && { pickup: beats(s.pickup, "pickup") }),
    notes: s.notes.map((n, i) => {
      try {
        return parseNote(n);
      } catch (e) {
        throw new Error(`note #${i + 1}: ${(e as Error).message}`);
      }
    }),
  };
}

function parseNote(raw: unknown): ScoreNote {
  const n = raw as Record<string, unknown>;
  if (!n || typeof n !== "object") throw new Error("expected { note, octave, duration }");
  const name = String(n.note);
  const note = FLATS[name] ?? (NOTES.has(name) ? (name as Note) : undefined);
  if (!note) throw new Error(`unknown note "${name}" (use C, C#, Db, D… B)`);
  if (!Number.isInteger(n.octave)) throw new Error("octave must be a whole number");
  return {
    note,
    octave: n.octave as number,
    duration: beats(n.duration, "duration"),
    ...(n.rest != null && { rest: beats(n.rest, "rest") }),
    ...(n.lineBreak === true && { lineBreak: true }),
  };
}

// A beat count: a number (0.5, 1.5…) or a fraction string ("2/3" for triplets)
function beats(v: unknown, field: string): number {
  if (typeof v === "number" && v >= 0) return v;
  const m = typeof v === "string" && v.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/);
  if (m && Number(m[2]) > 0) return Number(m[1]) / Number(m[2]);
  throw new Error(`${field} must be a number of beats or a fraction like "2/3"`);
}

function requireType<T extends "string" | "number">(
  v: unknown, type: T, field: string,
): T extends "string" ? string : number {
  if (typeof v !== type) throw new Error(`${field} must be a ${type}`);
  return v as T extends "string" ? string : number;
}
