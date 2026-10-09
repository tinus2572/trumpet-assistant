"use client";

import { useI18n } from "@/lib/i18n";

interface SegmentedProps<T extends string> {
  options: { value: T; label: string; title?: string }[];
  value: T;
  onChange: (value: T) => void;
}

function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="inline-flex border-2 border-ink rounded-nb overflow-hidden shadow-nb-sm bg-card text-xs font-bold">
      {options.map((o, i) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          title={o.title}
          className={`px-2.5 py-1.5 transition-colors ${i > 0 ? "border-l-2 border-ink" : ""} ${
            value === o.value ? "bg-sun" : "hover:bg-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function LangSwitch() {
  const { lang, setLang, notation, setNotation, t } = useI18n();

  return (
    <div className="flex items-center gap-2">
      <Segmented
        value={notation}
        onChange={setNotation}
        options={[
          { value: "letter", label: "C D E", title: t("notation.letter") },
          { value: "solfege", label: "Do Ré Mi", title: t("notation.solfege") },
        ]}
      />
      <Segmented
        value={lang}
        onChange={setLang}
        options={[
          { value: "fr", label: "FR" },
          { value: "en", label: "EN" },
        ]}
      />
    </div>
  );
}
