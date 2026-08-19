// Basic trumpet synthesizer using Web Audio API
// Uses multiple oscillators + envelope to simulate a brassy sound

import { Score, noteToFrequency, beatsToSeconds } from "./partitions";

export interface SynthOptions {
  volume?: number; // 0-1, default 0.5
}

export class TrumpetSynth {
  private ctx: AudioContext;
  private gainMaster: GainNode;
  private scheduledNodes: { stop: () => void }[] = [];
  private _playing = false;
  private startTime = 0;
  private totalDuration = 0;
  private onNoteChange?: (index: number) => void;
  private noteTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(ctx?: AudioContext) {
    this.ctx = ctx ?? new AudioContext();
    this.gainMaster = this.ctx.createGain();
    this.gainMaster.connect(this.ctx.destination);
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
    this.startTime = this.ctx.currentTime;

    let currentTime = this.ctx.currentTime;

    score.notes.forEach((noteP, index) => {
      const restDuration = beatsToSeconds(noteP.rest ?? 0, score.tempo);
      const noteDuration = beatsToSeconds(noteP.duration, score.tempo);
      const freq = noteToFrequency(noteP.note, noteP.octave);

      currentTime += restDuration;
      const start = currentTime;

      if (freq > 0) {
        this.scheduleNote(freq, start, noteDuration);
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

    this.totalDuration = currentTime - this.startTime;

    // Auto-stop when playback ends
    const timer = setTimeout(() => {
      this._playing = false;
    }, this.totalDuration * 1000 + 100);
    this.noteTimers.push(timer);
  }

  private scheduleNote(freq: number, start: number, duration: number) {
    // Brassy sound: fundamental + harmonics
    const harmonics = [
      { ratio: 1, gain: 1.0 },
      { ratio: 2, gain: 0.6 },
      { ratio: 3, gain: 0.3 },
      { ratio: 4, gain: 0.15 },
      { ratio: 5, gain: 0.08 },
    ];

    const noteGain = this.ctx.createGain();
    noteGain.connect(this.gainMaster);

    // ADSR envelope
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
