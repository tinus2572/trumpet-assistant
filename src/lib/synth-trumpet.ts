// Trumpet synthesizer using SoundFont samples (MusyngKite)
// Falls back to basic oscillators while samples are loading

import { Score, noteToFrequency, beatsToSeconds } from "./scores";
import { Note, NOTE_TO_SEMITONE } from "./trumpet";

export interface SynthOptions {
  volume?: number; // 0-1, default 0.5
  from?: number; // start position in seconds, default 0
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

// One AudioContext shared by all players: the samples are decoded for it, so it is never closed
let sharedCtx: AudioContext | null = null;
let cachedInstrument: SoundfontInstrument | null = null;
let loadingPromise: Promise<SoundfontInstrument> | null = null;

function getAudioContext(): AudioContext {
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new AudioContext();
    cachedInstrument = null;
    loadingPromise = null;
  }
  return sharedCtx;
}

/** Call from a click or key handler: browsers only let audio start from a user gesture */
export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx.state === "suspended") void ctx.resume();
}

function loadInstrument(ac: AudioContext): Promise<SoundfontInstrument> {
  if (cachedInstrument) return Promise.resolve(cachedInstrument);
  // A failed load is retried on the next call
  loadingPromise ??= import("soundfont-player")
    .then((Soundfont) => Soundfont.instrument(ac, "/soundfonts/trumpet-mp3.js" as never))
    .then((inst) => (cachedInstrument = inst))
    .finally(() => (loadingPromise = null));
  return loadingPromise;
}

export class TrumpetSynth {
  private ctx: AudioContext;
  private gainMaster: GainNode;
  private _playing = false;
  private onNoteChange?: (index: number) => void;
  private noteTimers: ReturnType<typeof setTimeout>[] = [];
  private scheduledNodes: { stop: () => void }[] = [];
  private instrument: SoundfontInstrument | null = null;
  // Bumped by stop() so a playScore() still waiting on samples doesn't start afterwards
  private run = 0;

  constructor() {
    this.ctx = getAudioContext();
    this.gainMaster = this.ctx.createGain();
    this.gainMaster.connect(this.ctx.destination);
    // Start loading samples eagerly
    loadInstrument(this.ctx)
      .then((inst) => {
        this.instrument = inst;
      })
      .catch(() => {});
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
    const run = this.run;
    this._playing = true;
    if (this.ctx.state === "suspended") await this.ctx.resume();

    const volume = options?.volume ?? 0.5;
    this.gainMaster.gain.setValueAtTime(volume, this.ctx.currentTime);

    // Try to load instrument, fall back to oscillators if not ready
    if (!this.instrument) {
      try {
        this.instrument = await loadInstrument(this.ctx);
      } catch {
        // SoundFont failed to load — fall back to oscillators
      }
    }
    if (run !== this.run) return;

    const now = this.ctx.currentTime;
    // Context time at which the score's beat 0 falls (in the past when starting mid-score)
    let currentTime = now - (options?.from ?? 0);

    score.notes.forEach((noteP, index) => {
      const restDuration = beatsToSeconds(noteP.rest ?? 0, score.tempo);
      const fullDuration = beatsToSeconds(noteP.duration, score.tempo);

      currentTime += restDuration;
      const noteStart = currentTime;
      currentTime = noteStart + fullDuration;
      // Skip notes already over; a note cut by the start position plays its remaining part
      if (currentTime <= now) return;
      const start = Math.max(noteStart, now);
      const noteDuration = currentTime - start;

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
      const delayMs = Math.max(0, (start - this.ctx.currentTime) * 1000);
      const timer = setTimeout(() => {
        if (this._playing) this.onNoteChange?.(index);
      }, delayMs);
      this.noteTimers.push(timer);
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
    this.run++;
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
    this.gainMaster.disconnect();
  }
}
