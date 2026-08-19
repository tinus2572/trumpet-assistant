"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { type Note, type Notation, displayNote } from "./trumpet";

export type Lang = "fr" | "en";

const translations = {
  // Header
  "app.title": { fr: "Assistant Trompette", en: "Trumpet Assistant" },
  "app.subtitle": {
    fr: "Analyseur de justesse pour trompette en Si\u266D",
    en: "Pitch analyzer for B\u266D trumpet",
  },

  // Mic & recording controls
  "mic.enable": { fr: "Activer le micro", en: "Enable mic" },
  "mic.disable": { fr: "Couper le micro", en: "Disable mic" },
  "mic.error": {
    fr: "Impossible d'acc\u00E9der au microphone. V\u00E9rifiez les permissions.",
    en: "Cannot access microphone. Check permissions.",
  },
  "rec.start": { fr: "Enregistrer", en: "Record" },
  "rec.stop": { fr: "Arr\u00EAter l'enregistrement", en: "Stop recording" },

  // Mute
  "mute.label": { fr: "Sourdine", en: "Mute comp." },

  // Fingering
  "fingering.title": { fr: "Doigt\u00E9", en: "Fingering" },
  "fingering.open": { fr: "Ouvert", en: "Open" },
  "fingering.concert": { fr: "Concert", en: "Concert" },

  // Pitch quality
  "pitch.excellent": { fr: "Excellent", en: "Excellent" },
  "pitch.veryGood": { fr: "Tr\u00E8s bien", en: "Very good" },
  "pitch.good": { fr: "Bien", en: "Good" },
  "pitch.acceptable": { fr: "Acceptable", en: "Acceptable" },
  "pitch.toFix": { fr: "\u00C0 corriger", en: "Needs work" },

  // Chromatic scale
  "range.title": { fr: "Tessiture", en: "Range" },

  // Staff
  "staff.title": { fr: "Port\u00E9e", en: "Staff" },
  "staff.playing": { fr: "Lecture", en: "Playing" },
  "staff.emptyLive": { fr: "Les notes appara\u00EEtront ici...", en: "Notes will appear here..." },
  "staff.emptyReplay": { fr: "Aucune note", en: "No notes" },

  // History
  "history.title": { fr: "Historique des sessions", en: "Session history" },
  "history.clearAll": { fr: "Tout effacer", en: "Clear all" },
  "history.empty1": { fr: "Aucun enregistrement pour le moment.", en: "No recordings yet." },
  "history.empty2": {
    fr: "Commencez \u00E0 jouer pour cr\u00E9er votre historique !",
    en: "Start playing to build your history!",
  },
  "history.detected": { fr: "d\u00E9tect\u00E9e(s)", en: "detected" },
  "history.duration": { fr: "Dur\u00E9e", en: "Duration" },
  "history.avgPitch": { fr: "Justesse moy.", en: "Avg. pitch" },
  "history.delete": { fr: "Supprimer", en: "Delete" },
  "history.trim": { fr: "D\u00E9couper", en: "Trim" },
  "history.trimming": { fr: "D\u00E9coupage en cours...", en: "Trimming..." },

  // Audio trimmer
  "trim.title": { fr: "D\u00E9couper l'audio", en: "Trim audio" },
  "trim.selected": { fr: "s\u00E9lectionn\u00E9", en: "selected" },
  "trim.start": { fr: "D\u00E9but", en: "Start" },
  "trim.end": { fr: "Fin", en: "End" },
  "trim.preview": { fr: "Aper\u00E7u", en: "Preview" },
  "trim.cancel": { fr: "Annuler", en: "Cancel" },
  "trim.apply": { fr: "Appliquer", en: "Apply" },

  // Score player
  "scores.title": { fr: "Partitions", en: "Scores" },
  "scores.search": { fr: "Rechercher une partition...", en: "Search for a score..." },
  "scores.none": {
    fr: "Aucune partition trouv\u00E9e. Demandez-moi d'en ajouter une !",
    en: "No score found. Ask me to add one!",
  },
  "scores.listen": { fr: "\u00C9couter", en: "Listen" },
  "scores.stop": { fr: "Arr\u00EAter", en: "Stop" },
  "scores.muted": { fr: "Muet", en: "Muted" },
  "scores.sound": { fr: "Son", en: "Sound" },
  "scores.micActive": { fr: "Micro actif", en: "Mic active" },
  "scores.micEnable": { fr: "Activer micro", en: "Enable mic" },
  "scores.change": { fr: "Changer", en: "Change" },
  "scores.howTo": { fr: "Comment jouer :", en: "How to play:" },
  "scores.instructions": {
    fr: "\u00C9coutez d'abord la partition, puis activez le micro et rejouez par-dessus. Coupez le son pour jouer sans guide et comparer votre justesse.",
    en: "Listen to the score first, then enable the mic and play along. Mute the sound to play without a guide and compare your pitch.",
  },

  // Notes
  "note.singular": { fr: "note", en: "note" },
  "note.plural": { fr: "notes", en: "notes" },

  // Notation switch
  "notation.letter": { fr: "Lettres (C, D, E)", en: "Letters (C, D, E)" },
  "notation.solfege": { fr: "Solf\u00E8ge (Do, R\u00E9, Mi)", en: "Solf\u00E8ge (Do, R\u00E9, Mi)" },
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
  notation: Notation;
  setNotation: (n: Notation) => void;
  dn: (note: Note) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: "fr",
  setLang: () => {},
  t: (key) => translations[key]?.fr ?? key,
  notation: "solfege",
  setNotation: () => {},
  dn: (note) => displayNote(note, "solfege"),
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "fr";
    return (localStorage.getItem("trumpet-lang") as Lang) ?? "fr";
  });

  const [notation, setNotationState] = useState<Notation>(() => {
    if (typeof window === "undefined") return "solfege";
    return (localStorage.getItem("trumpet-notation") as Notation) ?? "solfege";
  });

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem("trumpet-lang", l);
  }, []);

  const setNotation = useCallback((n: Notation) => {
    setNotationState(n);
    localStorage.setItem("trumpet-notation", n);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[key]?.[lang] ?? key,
    [lang]
  );

  const dn = useCallback(
    (note: Note) => displayNote(note, notation),
    [notation]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, notation, setNotation, dn }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
