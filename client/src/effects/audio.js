// One shared Web Audio engine for the music player and the Santa intro.
// Music is synthesized live from note data (public-domain melodies, own arrangements), so nothing is
// downloaded and nothing plays until the visitor explicitly turns sound on (browser autoplay rules).
import { SONGS } from './songs.js';

const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const freqOf = (name) => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  const semis = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * 2 ** ((semis - 69) / 12);
};
const parseSeq = (s) => s.trim().split(/\s+/).map((tok) => {
  const [n, d] = tok.split(':');
  return { note: n, beats: Number(d) };
});
const CHORD_ROOT = (name) => /^([A-G][#b]?)/.exec(name)[1];
function chordFreqs(name) {
  const root = CHORD_ROOT(name);
  const minor = /^[A-G][#b]?m(?!aj)/.test(name);
  const seventh = /7$/.test(name);
  const base = freqOf(`${root}3`);
  const ints = [0, minor ? 3 : 4, 7, ...(seventh ? [10] : [])];
  return ints.map((i) => base * 2 ** (i / 12));
}

/** Total beats of a sequence (used by tests and to align chords with melody). */
export const seqBeats = (s) => parseSeq(s).reduce((a, n) => a + n.beats, 0);

class Engine {
  ctx = null;
  listeners = new Set();
  state = { playing: false, index: 0, volume: 0.6, muted: false, ready: false };
  #timer = null;
  #events = [];
  #cursor = 0;
  #startTime = 0;
  #endTime = 0;
  #voices = new Set();

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  #emit(patch) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  /** Must be called from a user gesture the first time. */
  async ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 64;
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.#impulse(2.6);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.28;
      this.musicBus.connect(this.master);
      this.musicBus.connect(this.reverb);
      // Intro effects are switched on explicitly by the visitor, so they bypass the music volume/mute.
      this.sfxBus.connect(this.ctx.destination);
      this.reverb.connect(wet).connect(this.master);
      this.master.connect(this.analyser).connect(this.ctx.destination);
      this.#applyVolume();
      this.#emit({ ready: true });
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    return true;
  }

  #impulse(seconds) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    return buf;
  }

  #applyVolume() {
    if (!this.master) return;
    const v = this.state.muted ? 0 : this.state.volume;
    this.master.gain.setTargetAtTime(v * 0.9, this.ctx.currentTime, 0.05);
  }

  setVolume(v) {
    this.#emit({ volume: Math.max(0, Math.min(1, v)) });
    this.#applyVolume();
  }

  setMuted(m) {
    this.#emit({ muted: m });
    this.#applyVolume();
  }

  // ───────── voices ─────────
  #track(node, stopAt) {
    this.#voices.add(node);
    node.onended = () => this.#voices.delete(node);
    node.stop(stopAt);
  }

  #lead(type, f, t, dur, vel = 1) {
    const c = this.ctx;
    const g = c.createGain();
    g.connect(this.musicBus);
    if (type === 'flute') {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = 5.2;
      lg.gain.value = f * 0.006;
      lfo.connect(lg).connect(o.frequency);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.16 * vel, t + 0.08);
      g.gain.setValueAtTime(0.14 * vel, t + Math.max(0.1, dur - 0.08));
      g.gain.linearRampToValueAtTime(0, t + dur + 0.25);
      o.connect(g);
      o.start(t);
      lfo.start(t);
      this.#track(o, t + dur + 0.3);
      this.#track(lfo, t + dur + 0.3);
      return;
    }
    // celesta / bell: inharmonic partials with fast attack and long exponential decay
    const partials = type === 'bell' ? [[1, 0.5], [2.01, 0.22], [3.02, 0.1], [4.2, 0.06]] : [[1, 0.55], [2, 0.18], [4, 0.05]];
    const decay = type === 'bell' ? 1.8 : 1.1;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + decay);
    for (const [mult, amp] of partials) {
      const o = c.createOscillator();
      const pg = c.createGain();
      o.type = 'sine';
      o.frequency.value = f * mult;
      pg.gain.value = amp;
      o.connect(pg).connect(g);
      o.start(t);
      this.#track(o, t + dur + decay + 0.05);
    }
  }

  #pad(freqs, t, dur) {
    const c = this.ctx;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.25);
    g.gain.setValueAtTime(0.05, t + Math.max(0.3, dur - 0.1));
    g.gain.linearRampToValueAtTime(0, t + dur + 0.4);
    filter.connect(g).connect(this.musicBus);
    for (const f of freqs.slice(0, 3)) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f * 2;
      o.detune.value = (Math.random() - 0.5) * 8;
      o.connect(filter);
      o.start(t);
      this.#track(o, t + dur + 0.5);
    }
  }

  #bass(f, t, dur) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = f / 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(dur, 1.4));
    o.connect(g).connect(this.musicBus);
    o.start(t);
    this.#track(o, t + Math.min(dur, 1.4) + 0.05);
  }

  /** A short sleigh-bell shake: filtered noise + bright metallic partials. */
  jingle(t = this.ctx?.currentTime ?? 0, amount = 1, bus = this.musicBus) {
    if (!this.ctx) return;
    const c = this.ctx;
    const len = Math.floor(c.sampleRate * 0.12);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 7500 + Math.random() * 1500;
    bp.Q.value = 2.5;
    const g = c.createGain();
    g.gain.value = 0.22 * amount;
    src.connect(bp).connect(g).connect(bus);
    src.start(t);
    for (const f of [2637, 3520, 4186]) {
      const o = c.createOscillator();
      const og = c.createGain();
      o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.02);
      og.gain.setValueAtTime(0.025 * amount, t);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
      o.connect(og).connect(bus);
      o.start(t);
      o.stop(t + 0.2);
    }
  }

  /** Sound effects for the intro (independent from music playback). */
  async sleighBells(seconds = 4) {
    if (!(await this.ensure())) return;
    const t0 = this.ctx.currentTime + 0.05;
    for (let i = 0; i < seconds * 6; i++) {
      const swell = Math.sin((i / (seconds * 6)) * Math.PI);
      this.jingle(t0 + i / 6 + (i % 2 ? 0.04 : 0), 0.4 + swell * 0.9, this.sfxBus);
    }
  }

  /** Fetch and decode a recorded sample once (e.g. the Santa laugh); resolves to null on failure. */
  loadSample(url) {
    this.samples ??= new Map();
    if (!this.samples.has(url)) {
      this.samples.set(url, (async () => {
        if (!(await this.ensure())) return null;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return this.ctx.decodeAudioData(await res.arrayBuffer());
      })().catch(() => null));
    }
    return this.samples.get(url);
  }

  /** Play a decoded sample on the effects bus. Returns the source node (or null). */
  playSample(buffer, { gain = 1, when = 0 } = {}) {
    if (!this.ctx || !buffer) return null;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buffer;
    g.gain.value = gain;
    src.connect(g).connect(this.sfxBus);
    src.start(this.ctx.currentTime + when);
    return src;
  }

  // ───────── sequencer ─────────
  #build(song) {
    const events = [];
    const spb = 60 / song.bpm;
    const melody = parseSeq(song.melody);
    const chords = parseSeq(song.chords);
    const total = melody.reduce((a, n) => a + n.beats, 0);
    const bpb = song.beatsPerBar ?? 4;
    for (let r = 0; r < (song.repeats ?? 1); r++) {
      const off = r * total;
      let b = 0;
      for (const n of melody) {
        const f = freqOf(n.note);
        if (f) events.push({ at: (off + b) * spb, kind: 'lead', f: r === 1 && song.lead !== 'flute' ? f * 2 : f, dur: n.beats * spb, vel: (off + b) % bpb === 0 ? 1 : 0.8 });
        b += n.beats;
      }
      let cb = 0;
      for (const ch of chords) {
        const fs = chordFreqs(ch.note);
        events.push({ at: (off + cb) * spb, kind: 'pad', fs, dur: ch.beats * spb });
        events.push({ at: (off + cb) * spb, kind: 'bass', f: fs[0], dur: ch.beats * spb });
        if (song.arpeggio) {
          for (let k = 0; k < ch.beats; k++) events.push({ at: (off + cb + k) * spb, kind: 'arp', f: fs[(k % 3)] * 4, dur: spb });
        }
        cb += ch.beats;
      }
      if (song.bells) for (let k = 0; k < total; k++) events.push({ at: (off + k) * spb, kind: 'jingle', amt: k % bpb === 0 ? 0.6 : 0.35 });
    }
    events.sort((a, b) => a.at - b.at);
    return { events, length: total * (song.repeats ?? 1) * spb + 2 };
  }

  #schedule = () => {
    const now = this.ctx.currentTime;
    while (this.#cursor < this.#events.length && this.#startTime + this.#events[this.#cursor].at < now + 0.2) {
      const e = this.#events[this.#cursor++];
      const t = Math.max(now, this.#startTime + e.at);
      if (e.kind === 'lead') this.#lead(SONGS[this.state.index].lead, e.f, t, e.dur, e.vel);
      else if (e.kind === 'pad') this.#pad(e.fs, t, e.dur);
      else if (e.kind === 'bass') this.#bass(e.f, t, e.dur);
      else if (e.kind === 'arp') this.#lead('celesta', e.f, t, e.dur * 0.5, 0.35);
      else if (e.kind === 'jingle') this.jingle(t, e.amt);
    }
    if (now >= this.#endTime) this.next(); // auto-advance to the next track
  };

  #stopVoices() {
    const t = this.ctx.currentTime;
    this.musicBus.gain.cancelScheduledValues(t);
    this.musicBus.gain.setValueAtTime(this.musicBus.gain.value, t);
    this.musicBus.gain.linearRampToValueAtTime(0, t + 0.15);
    const voices = [...this.#voices];
    this.#voices.clear();
    setTimeout(() => {
      voices.forEach((v) => { try { v.stop(); } catch { /* already stopped */ } });
      this.musicBus.gain.setValueAtTime(1, this.ctx.currentTime);
    }, 180);
  }

  async play(index = this.state.index) {
    if (!(await this.ensure())) return;
    if (this.#timer) clearInterval(this.#timer);
    if (this.state.playing) this.#stopVoices();
    const i = ((index % SONGS.length) + SONGS.length) % SONGS.length;
    const { events, length } = this.#build(SONGS[i]);
    this.#events = events;
    this.#cursor = 0;
    this.#startTime = this.ctx.currentTime + 0.25;
    this.#endTime = this.#startTime + length;
    this.#emit({ playing: true, index: i });
    this.#timer = setInterval(this.#schedule, 40);
  }

  pause() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = null;
    if (this.ctx && this.state.playing) this.#stopVoices();
    this.#emit({ playing: false });
  }

  toggle() {
    return this.state.playing ? this.pause() : this.play();
  }

  next() { return this.play(this.state.index + 1); }
  prev() { return this.play(this.state.index - 1); }

  /** 0..1 levels for the visualizer. */
  levels(n = 5) {
    if (!this.analyser || !this.state.playing) return Array(n).fill(0);
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(data);
    const step = Math.floor(data.length / (n + 1));
    return Array.from({ length: n }, (_, i) => data[(i + 1) * step] / 255);
  }
}

export const audio = new Engine();
export { SONGS };

// Dev-only handle for automated checks (stripped from production builds by Vite).
if (import.meta.env?.DEV) window.__mcAudio = audio;
