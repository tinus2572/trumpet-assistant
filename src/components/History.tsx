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
      <div className="text-center text-zinc-500 py-8">
        <p>{t("history.empty1")}</p>
        <p className="text-sm mt-1">{t("history.empty2")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {recordings.map((e) => {
        const selected = selectionId === e.id;
        const isTrimming = trimId === e.id;
        const hasAudio = !!audioUrls[e.id];

        return (
          <div
            key={e.id}
            onClick={() => onSelect(e)}
            className={`p-3 rounded-lg cursor-pointer transition-colors border ${
              selected
                ? "border-amber-500 bg-amber-500/10"
                : "border-zinc-700 bg-zinc-800/50 hover:bg-zinc-800"
            }`}
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-zinc-200">{e.date}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  {e.summary.totalNotes} {e.summary.totalNotes > 1 ? t("note.plural") : t("note.singular")} {t("history.detected")}
                  {" · "}
                  {t("history.duration")} : {Math.round(e.duration)}s
                </p>
                <p className="text-xs mt-1">
                  <span className="text-zinc-500">{t("history.avgPitch")} : </span>
                  <span
                    className={
                      Math.abs(e.summary.avgPitchOffset) <= 10
                        ? "text-green-400"
                        : Math.abs(e.summary.avgPitchOffset) <= 25
                        ? "text-yellow-400"
                        : "text-red-400"
                    }
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
                className="text-zinc-600 hover:text-red-400 transition-colors text-xs px-2 py-1"
                title={t("history.delete")}
              >
                &#10005;
              </button>
            </div>
            {selected && (
              <div className="mt-3 pt-3 border-t border-zinc-700" onClick={(ev) => ev.stopPropagation()}>
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
                        className={`text-xs px-2 py-0.5 rounded-full transition-all ${
                          isReplayActive
                            ? "ring-1 ring-offset-1 ring-offset-zinc-900 scale-110"
                            : ""
                        }`}
                        style={{
                          backgroundColor: isReplayActive ? j.color + "30" : "#3f3f46",
                          color: isReplayActive ? j.color : "#d4d4d8",
                          outlineColor: isReplayActive ? j.color : undefined,
                        }}
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
                        className="px-2 py-1 text-[10px] text-zinc-400 hover:text-amber-400 border border-zinc-700 hover:border-amber-500/50 rounded transition-colors shrink-0"
                        title={t("history.trim")}
                      >
                        {t("history.trim")}
                      </button>
                    </div>
                  )
                )}

                {trimming && trimId === e.id && (
                  <p className="text-xs text-amber-400 mt-2 animate-pulse">{t("history.trimming")}</p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
