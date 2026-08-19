// Trumpet synthesizer using SoundFont samples (MusyngKite)
// Falls back to basic oscillators while samples are loading

import { Score, noteToFrequency, beatsToSeconds } from "./partitions";
import { Note, NOTE_TO_SEMITONE } from "./trumpet";

export interface SynthOptions {
  volume?: number; // 0-1, default 0.5
}

/** Convert a written Bb trumpet note to concert MIDI number */
function noteToMidiConcert(note: Note, octave: number): number {
  const semitone = NOTE_TO_SEMITONE[note];
  if (semitone === undefined) return 0;
  const midiWritten = (octave + 1) * 12 + semitone;
  return midiWritten - 2; // Bb transposition
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SoundfontInstrument = any;

let cachedInstrument: SoundfontInstrument | null = null;
let loadingPromise: Promise<SoundfontInstrument> | null = null;

async function loadInstrument(ac: AudioContext): Promise<SoundfontInstrument> {
  if (cachedInstrument) return cachedInstrument;
  if (loadingPromise) return loadingPromise;

  loadingPromise = import("soundfont-player").then((Soundfont) =>
    Soundfont.instrument(ac, "/soundfonts/trumpet-mp3.js" as never)
  );

  cachedInstrument = await loadingPromise;
  loadingPromise = null;
  return cachedInstrument;
}

export class TrumpetSynth {
  private ctx: AudioContext;
  private gainMaster: GainNode;
  private _playing = false;
  private onNoteChange?: (index: number) => void;
  private noteTimers: ReturnType<typeof setTimeout>[] = [];
  private scheduledNodes: { stop: () => void }[] = [];
  private instrument: SoundfontInstrument | null = null;

  constructor(ctx?: AudioContext) {
    this.ctx = ctx ?? new AudioContext();
    this.gainMaster = this.ctx.createGain();
    this.gainMaster.connect(this.ctx.destination);
    // Start loading samples eagerly
    loadInstrument(this.ctx).then((inst) => {
      this.instrument = inst;
    });
  }

  get playing() {
    return this._playing;
  }

  get context() {
    return this.ctx;
  }

  setOnNoteChange(cb: (index: number) => void) {
    this.onNoteChange = cb;
  }

  async playScore(score: Score, options?: SynthOptions) {
    this.stop();
    if (this.ctx.state === "suspended") await this.ctx.resume();

    const volume = options?.volume ?? 0.5;
    this.gainMaster.gain.setValueAtTime(volume, this.ctx.currentTime);
    this._playing = true;

    // Try to load instrument, fall back to oscillators if not ready
    if (!this.instrument) {
      try {
        this.instrument = await loadInstrument(this.ctx);
      } catch {
        // SoundFont failed to load — fall back to oscillators
      }
    }

    let currentTime = this.ctx.currentTime;

    score.notes.forEach((noteP, index) => {
      const restDuration = beatsToSeconds(noteP.rest ?? 0, score.tempo);
      const noteDuration = beatsToSeconds(noteP.duration, score.tempo);

      currentTime += restDuration;
      const start = currentTime;

      if (this.instrument) {
        const midi = noteToMidiConcert(noteP.note, noteP.octave);
        if (midi > 0) {
          const node = this.instrument.play(String(midi), start, {
            duration: noteDuration * 0.95,
            gain: volume * 2.4,
          });
          if (node) this.scheduledNodes.push(node);
        }
      } else {
        // Fallback: raw oscillators
        const freq = noteToFrequency(noteP.note, noteP.octave);
        if (freq > 0) {
          this.scheduleOscillatorNote(freq, start, noteDuration);
        }
      }

      // Notify note change callback
      const delayMs = (start - this.ctx.currentTime) * 1000;
      if (delayMs >= 0) {
        const timer = setTimeout(() => {
          if (this._playing) this.onNoteChange?.(index);
        }, delayMs);
        this.noteTimers.push(timer);
      }

      currentTime = start + noteDuration;
    });

    const totalDuration = currentTime - this.ctx.currentTime;

    // Auto-stop when playback ends
    const timer = setTimeout(() => {
      this._playing = false;
    }, totalDuration * 1000 + 100);
    this.noteTimers.push(timer);
  }

  /** Fallback oscillator-based note (used while SoundFont loads) */
  private scheduleOscillatorNote(freq: number, start: number, duration: number) {
    const noteGain = this.ctx.createGain();
    noteGain.connect(this.gainMaster);

    const attack = Math.min(0.04, duration * 0.1);
    const decay = Math.min(0.08, duration * 0.15);
    const sustainLevel = 0.7;
    const release = Math.min(0.06, duration * 0.1);
    const sustainTime = Math.max(0, duration - attack - decay - release);

    noteGain.gain.setValueAtTime(0, start);
    noteGain.gain.linearRampToValueAtTime(1.0, start + attack);
    noteGain.gain.linearRampToValueAtTime(sustainLevel, start + attack + decay);
    noteGain.gain.setValueAtTime(sustainLevel, start + attack + decay + sustainTime);
    noteGain.gain.linearRampToValueAtTime(0, start + duration);

    const harmonics = [
      { ratio: 1, gain: 1.0 },
      { ratio: 2, gain: 0.6 },
      { ratio: 3, gain: 0.3 },
    ];

    for (const h of harmonics) {
      const osc = this.ctx.createOscillator();
      const hGain = this.ctx.createGain();
      hGain.gain.setValueAtTime(h.gain / harmonics.length, start);
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq * h.ratio, start);
      osc.connect(hGain);
      hGain.connect(noteGain);
      osc.start(start);
      osc.stop(start + duration + 0.01);
      this.scheduledNodes.push(osc);
    }
  }

  stop() {
    this._playing = false;
    for (const node of this.scheduledNodes) {
      try { node.stop(); } catch {}
    }
    this.scheduledNodes = [];
    for (const t of this.noteTimers) clearTimeout(t);
    this.noteTimers = [];
  }

  dispose() {
    this.stop();
    if (this.ctx.state !== "closed") this.ctx.close();
  }
}
