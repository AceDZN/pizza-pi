// Procedural WebAudio sound: no audio files. Starts only after the first user gesture.
import type { Cue } from './game';

export class Sound {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  music: GainNode | null = null;
  muted = false;
  private noise: AudioBuffer | null = null;
  private lastStretch = 0;
  private musicTimer = 0;
  private step = 0;
  private crackle: AudioBufferSourceNode | null = null;

  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.7;
    this.master.connect(this.ctx.destination);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.11;
    this.music.connect(this.master);
    const len = this.ctx.sampleRate * 1.5;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.musicTimer = window.setInterval(() => this.tickMusic(), 230);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.25, when = 0, slide?: number, dest?: AudioNode) {
    const c = this.ctx; if (!c || !this.master) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest ?? this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  private hiss(dur: number, freq: number, q = 1, vol = 0.3, when = 0, type: BiquadFilterType = 'bandpass', sweep?: number) {
    const c = this.ctx; if (!c || !this.master || !this.noise) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  click() { this.tone(900, 0.05, 'triangle', 0.12); }
  coin(n = 1) { for (let i = 0; i < Math.min(n, 8); i++) { this.tone(1320, 0.08, 'square', 0.05, i * 0.07); this.tone(1980, 0.12, 'square', 0.04, i * 0.07 + 0.04); } }

  handle(c: Cue) {
    if (!this.ctx) return;
    switch (c.kind) {
      case 'stretch': {
        const now = performance.now();
        if (now - this.lastStretch < 45) return;
        this.lastStretch = now;
        const r = Number(c.values?.r ?? 10);
        this.tone(140 + r * 9, 0.09, 'sine', 0.16, 0, 110 + r * 7);
        break;
      }
      case 'tray': this.tone(220, 0.5, 'triangle', 0.25, 0, 70); this.tone(330, 0.35, 'sine', 0.15, 0.08, 120); break;
      case 'squeeze': this.hiss(0.35, 500, 3, 0.4, 0, 'bandpass', 180); this.tone(160, 0.2, 'sine', 0.3, 0.2, 60); break;
      case 'overflow': this.hiss(0.8, 700, 2, 0.5, 0, 'bandpass', 150); for (let i = 0; i < 6; i++) this.tone(120 + Math.random() * 120, 0.12, 'sine', 0.25, 0.25 + i * 0.12, 60); break;
      case 'cut': this.hiss(0.12, 3000, 1, 0.5, 0, 'highpass'); this.tone(90, 0.18, 'sine', 0.45, 0.02, 45); [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', 0.08, 0.25 + i * 0.12)); break;
      case 'topping': this.tone(500 + Math.random() * 400, 0.07, 'triangle', 0.14, 0, 1200); break;
      case 'bake_start': this.hiss(1.2, 300, 0.6, 0.35, 0, 'lowpass', 1200); this.startCrackle(); break;
      case 'bake_done': this.stopCrackle(); this.tone(880, 0.1, 'sine', 0.2); this.tone(1320, 0.25, 'sine', 0.15, 0.08); break;
      case 'serve': {
        this.tone(1568, 1.2, 'sine', 0.22); this.tone(3136, 0.8, 'sine', 0.07);
        if (c.values?.outcome === 'fail') [392, 370, 349, 294].forEach((f, i) => this.tone(f, i === 3 ? 0.9 : 0.32, 'sawtooth', 0.09, 0.5 + i * 0.32, i === 3 ? 250 : undefined));
        else [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.13, 0.4 + i * 0.09));
        break;
      }
      case 'knead': for (let i = 0; i < 5; i++) this.tone(90 + i * 6, 0.12, 'sine', 0.3, i * 0.2, 60); break;
      case 'pour': if (c.values?.what === 'water') this.hiss(0.25, 1400, 4, 0.18, 0, 'bandpass', 900); else this.hiss(0.2, 4000, 0.5, 0.08, 0, 'lowpass'); break;
      case 'tear': this.hiss(0.4, 1200, 0.8, 0.45, 0, 'bandpass', 300); this.tone(300, 0.4, 'sawtooth', 0.08, 0.1, 90); break;
      case 'crack': for (let i = 0; i < 4; i++) this.hiss(0.05, 2500, 1, 0.4, i * 0.08, 'highpass'); break;
      case 'trash': this.tone(260, 0.3, 'triangle', 0.2, 0, 80); break;
      case 'station': this.hiss(0.18, 900, 0.7, 0.08, 0, 'bandpass', 400); break;
      case 'ticket': for (let i = 0; i < 5; i++) this.tone(2400, 0.02, 'square', 0.03, i * 0.04); break;
      case 'level_done': [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.24, 'triangle', 0.14, i * 0.12)); break;
      case 'shift_over': [392, 330, 262].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.13, i * 0.22)); break;
      case 'split': this.tone(400, 0.1, 'sine', 0.2, 0, 800); this.tone(400, 0.1, 'sine', 0.2, 0.1, 800); break;
      case 'stock_cap': this.tone(200, 0.15, 'square', 0.06); break;
      case 'say': this.tone(660, 0.05, 'sine', 0.06); this.tone(880, 0.05, 'sine', 0.05, 0.06); break;
    }
  }

  private startCrackle() {
    const c = this.ctx; if (!c || !this.master || !this.noise || this.crackle) return;
    const s = c.createBufferSource(); s.buffer = this.noise; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = c.createGain(); g.gain.value = 0.05;
    s.connect(f).connect(g).connect(this.master);
    s.start();
    this.crackle = s;
  }
  private stopCrackle() { try { this.crackle?.stop(); } catch { /* already stopped */ } this.crackle = null; }

  /** A gentle tarantella-ish loop: oom-pah bass and a sparse mandolin-like melody. */
  private tickMusic() {
    if (!this.ctx || !this.music || this.muted || document.hidden) return;
    const bar = Math.floor(this.step / 6) % 4;
    const beat = this.step % 6;
    const roots = [220, 196, 174.6, 196];
    const root = roots[bar];
    if (beat === 0) this.tone(root / 2, 0.22, 'triangle', 0.5, 0, undefined, this.music);
    if (beat === 3) this.tone(root * 0.75, 0.2, 'triangle', 0.35, 0, undefined, this.music);
    if (beat === 1 || beat === 2 || beat === 4 || beat === 5) this.tone(root * 1.5, 0.08, 'square', 0.08, 0, undefined, this.music);
    const melody = [0, 2, 4, 2, 0, -1, 0, 4, 5, 4, 2, 0];
    const scale = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8, 2];
    if (beat % 3 === 0 && Math.random() < 0.8) {
      const n = melody[(this.step / 3) % melody.length | 0];
      const f = 440 * (n < 0 ? 15 / 16 : scale[n]);
      this.tone(f, 0.16, 'triangle', 0.18, 0, undefined, this.music);
      this.tone(f, 0.08, 'triangle', 0.1, 0.06, undefined, this.music);
    }
    this.step++;
  }
}
