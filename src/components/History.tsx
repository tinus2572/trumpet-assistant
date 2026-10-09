"use client";

import { useCallback, useState } from "react";
import { Recording, evaluatePitch } from "@/lib/trumpet";
import { useI18n } from "@/lib/i18n";
import Staff from "./Staff";
import AudioTrimmer from "./AudioTrimmer";

interface HistoryProps {
  recordings: Recording[];
  audioUrls: Record<string, string>;
  onSelect: (e: Recording) => void;
  onDelete: (id: string) => void;
  onTrim: (id: string, start: number, end: number) => Promise<void>;
  selectionId: string | null;
  onPlaybackTime: (t: number | null) => void;
  replayNoteIndex: number | null;
}

export default function History({
  recordings,
  audioUrls,
  onSelect,
  onDelete,
  onTrim,
  selectionId,
  onPlaybackTime,
  replayNoteIndex,
}: HistoryProps) {
  const { t, dn } = useI18n();
  const [trimId, setTrimId] = useState<string | null>(null);
  const [trimming, setTrimming] = useState(false);

  const handleTimeUpdate = useCallback(
    (ev: React.SyntheticEvent<HTMLAudioElement>) => {
      onPlaybackTime(ev.currentTarget.currentTime);
    },
    [onPlaybackTime]
  );

  const handleEnded = useCallback(() => {
    onPlaybackTime(null);
  }, [onPlaybackTime]);

  const handleTrimConfirm = useCallback(
    async (id: string, start: number, end: number) => {
      setTrimming(true);
      await onTrim(id, start, end);
      setTrimId(null);
      setTrimming(false);
    },
    [onTrim]
  );

  if (recordings.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed border-ink rounded-nb bg-paper">
        <p className="font-bold">🎙️ {t("history.empty1")}</p>
        <p className="text-sm mt-1 text-ink/60">{t("history.empty2")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {recordings.map((e) => {
        const selected = selectionId === e.id;
        const isTrimming = trimId === e.id;
        const hasAudio = !!audioUrls[e.id];

        return (
          <div
            key={e.id}
            onClick={() => onSelect(e)}
            className={`p-3 rounded-nb cursor-pointer transition-all border-2 border-ink ${
              selected
                ? "bg-paper shadow-nb-sm"
                : "bg-card hover:shadow-nb-sm hover:-translate-x-px hover:-translate-y-px"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-bold">{e.date}</p>
                <p className="text-xs font-medium text-ink/60 mt-1">
                  {e.summary.totalNotes} {e.summary.totalNotes > 1 ? t("note.plural") : t("note.singular")} {t("history.detected")}
                  {" · "}
                  {t("history.duration")} : {Math.round(e.duration)}s
                </p>
                <p className="text-xs mt-1.5 flex items-center gap-1.5">
                  <span className="font-medium text-ink/60">{t("history.avgPitch")} :</span>
                  <span
                    className={`font-mono font-bold px-1.5 border-2 border-ink rounded-md ${
                      Math.abs(e.summary.avgPitchOffset) <= 10
                        ? "bg-mint"
                        : Math.abs(e.summary.avgPitchOffset) <= 25
                        ? "bg-sun"
                        : "bg-tomato"
                    }`}
                  >
                    {e.summary.avgPitchOffset > 0 ? "+" : ""}
                    {e.summary.avgPitchOffset} cents
                  </span>
                </p>
              </div>
              <button
                onClick={(ev) => {
                  ev.stopPropagation();
                  onDelete(e.id);
                }}
                className="nb-btn bg-card hover:bg-tomato w-7 h-7 text-xs"
                title={t("history.delete")}
              >
                &#10005;
              </button>
            </div>
            {selected && (
              <div className="mt-3 pt-3 border-t-2 border-ink" onClick={(ev) => ev.stopPropagation()}>
                {/* Replay staff */}
                {e.notes.length > 0 && (
                  <div className="mb-3">
                    <Staff
                      notes={e.notes}
                      noteActiveIndex={replayNoteIndex}
                      mode="replay"
                    />
                  </div>
                )}

                {/* Note badges */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {e.notes.map((n, i) => {
                    const j = evaluatePitch(n.note.centsOffset);
                    const isReplayActive = i === replayNoteIndex;
                    return (
                      <span
                        key={i}
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border-2 border-ink transition-all ${
                          isReplayActive ? "scale-110 shadow-nb-sm" : ""
                        }`}
                        style={{ backgroundColor: isReplayActive ? j.color : "#fff" }}
                        title={`${n.note.centsOffset > 0 ? "+" : ""}${n.note.centsOffset} cents · Pistons: ${n.note.fingeringLabel}`}
                      >
                        {dn(n.note.writtenNote)}{n.note.writtenOctave}
                      </span>
                    );
                  })}
                </div>

                {/* Trimmer or audio player */}
                {hasAudio && (
                  isTrimming ? (
                    <AudioTrimmer
                      audioUrl={audioUrls[e.id]}
                      duration={e.duration}
                      onConfirm={(s, end) => handleTrimConfirm(e.id, s, end)}
                      onCancel={() => setTrimId(null)}
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <audio
                        controls
                        src={audioUrls[e.id]}
                        className="flex-1 h-8"
                        onPlay={handleTimeUpdate}
                        onTimeUpdate={handleTimeUpdate}
                        onEnded={handleEnded}
                      />
                      <button
                        onClick={() => setTrimId(e.id)}
                        disabled={trimming}
                        className="nb-btn bg-card px-2.5 py-1 text-xs shrink-0"
                        title={t("history.trim")}
                      >
                        {t("history.trim")}
                      </button>
                    </div>
                  )
                )}

                {trimming && trimId === e.id && (
                  <p className="text-xs font-bold mt-2 animate-pulse">{t("history.trimming")}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
