"use client";

import { useI18n } from "@/lib/i18n";

export default function LangSwitch() {
  const { lang, setLang, notation, setNotation, t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      {/* Notation toggle */}
      <div className="inline-flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
        <button
          onClick={() => setNotation("letter")}
          className={`px-2 py-1 font-medium transition-colors ${
            notation === "letter"
              ? "bg-amber-500 text-zinc-900"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
          title={t("notation.letter")}
        >
          C D E
        </button>
        <button
          onClick={() => setNotation("solfege")}
          className={`px-2 py-1 font-medium transition-colors ${
            notation === "solfege"
              ? "bg-amber-500 text-zinc-900"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
          title={t("notation.solfege")}
        >
          Do Ré Mi
        </button>
      </div>

      {/* Language toggle */}
      <div className="inline-flex rounded-lg border border-zinc-700 overflow-hidden text-xs">
        <button
          onClick={() => setLang("fr")}
          className={`px-2.5 py-1 font-medium transition-colors ${
            lang === "fr"
              ? "bg-amber-500 text-zinc-900"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          FR
        </button>
        <button
          onClick={() => setLang("en")}
          className={`px-2.5 py-1 font-medium transition-colors ${
            lang === "en"
              ? "bg-amber-500 text-zinc-900"
              : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
          }`}
        >
          EN
        </button>
      </div>
    </div>
  );
}
