"use client";

import { useSyncExternalStore } from "react";
import { Difficulty, Score } from "./scores";

/**
 * A value persisted in localStorage and shared by every component that reads it.
 * Rendered with the fallback on the server and before hydration, so there is no mismatch.
 */
function createStoredValue<T>(key: string, fallback: T) {
  let cache: T | undefined;
  const listeners = new Set<() => void>();

  const read = (): T => {
    if (cache !== undefined) return cache;
    try {
      const raw = localStorage.getItem(key);
      cache = raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      cache = fallback;
    }
    return cache;
  };

  const write = (value: T) => {
    cache = value;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage unavailable (private mode, quota): keep the value for this session only
    }
    listeners.forEach((l) => l());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const useValue = () => useSyncExternalStore(subscribe, read, () => fallback);

  return { read, write, useValue };
}

// --- Difficulty overrides (score id -> difficulty chosen by the player) ---

const NO_OVERRIDES: Record<string, Difficulty> = {};
const difficultyStore = createStoredValue("trumpet-assistant-difficulty", NO_OVERRIDES);

export const useDifficultyOverrides = difficultyStore.useValue;

export function setDifficultyOverride(scoreId: string, difficulty: Difficulty | null) {
  const next = { ...difficultyStore.read() };
  if (difficulty === null) delete next[scoreId];
  else next[scoreId] = difficulty;
  difficultyStore.write(next);
}

export function effectiveDifficulty(score: Score, overrides: Record<string, Difficulty>): Difficulty {
  return overrides[score.id] ?? score.difficulty;
}

// --- Library panel folded or not ---

const libraryFoldedStore = createStoredValue("trumpet-assistant-library-folded", false);

export const useLibraryFolded = libraryFoldedStore.useValue;
export const setLibraryFolded = libraryFoldedStore.write;
