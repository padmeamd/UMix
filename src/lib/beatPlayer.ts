// Procedurally generates a ~30s beat from remix metadata using Web Audio.
// Pure browser code — no audio files.

export interface BeatOptions {
  bpm: number;
  genre: string;
  energy: string; // low | medium | high | explosive
  durationSec?: number;
  voiceBlob?: Blob; // raw recorded audio to remix into the beat
}

type GenreProfile = {
  kickEvery: number; // in 16th notes
  snareOn: number[]; // 16th positions
  hatEvery: number;
  bassPattern: number[]; // semitone offsets per beat
  rootHz: number;
  pad: boolean;
};

const PROFILES: Record<string, GenreProfile> = {
  synthwave: { kickEvery: 4, snareOn: [4, 12], hatEvery: 2, bassPattern: [0, 0, 7, 5], rootHz: 65.41, pad: true },
  lofi: { kickEvery: 4, snareOn: [4, 12], hatEvery: 4, bassPattern: [0, 3, 5, 0], rootHz: 55, pad: true },
  house: { kickEvery: 4, snareOn: [4, 12], hatEvery: 2, bassPattern: [0, 0, 0, 0], rootHz: 65.41, pad: false },
  trap: { kickEvery: 8, snareOn: [4, 12], hatEvery: 1, bassPattern: [0, 0, -2, 3], rootHz: 49, pad: false },
  "drum-and-bass": { kickEvery: 8, snareOn: [4, 12], hatEvery: 1, bassPattern: [0, 7, 0, 5], rootHz: 49, pad: false },
  ambient: { kickEvery: 16, snareOn: [], hatEvery: 8, bassPattern: [0, 0, 5, 5], rootHz: 55, pad: true },
  techno: { kickEvery: 4, snareOn: [8], hatEvery: 2, bassPattern: [0, 0, 0, 0], rootHz: 55, pad: false },
  hyperpop: { kickEvery: 4, snareOn: [4, 10, 12], hatEvery: 1, bassPattern: [0, 7, 12, 5], rootHz: 73.42, pad: true },
};

function getProfile(genre: string): GenreProfile {
  const key = genre.toLowerCase().replace(/\s+/g, "-");
  return PROFILES[key] ?? PROFILES.synthwave;
}

export class BeatPlayer {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private timers: number[] = [];
  private stopAt = 0;
  private onEndCb?: () => void;

  async play(opts: BeatOptions, onEnd?: () => void) {
    this.stop();
    this.onEndCb = onEnd;
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;
    if (ctx.state === "suspended") await ctx.resume();

    // Decode voice blob before scheduling so the clock is still valid
    let voiceBuffer: AudioBuffer | null = null;
    if (opts.voiceBlob) {
      try {
        const ab = await opts.voiceBlob.arrayBuffer();
        voiceBuffer = await ctx.decodeAudioData(ab);
      } catch (e) {
        console.warn("Voice decode failed:", e);
      }
    }

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.1);
    master.connect(ctx.destination);
    this.master = master;

    const profile = getProfile(opts.genre);
    const bpm = Math.max(60, Math.min(200, opts.bpm || 120));
    const sixteenth = 60 / bpm / 4;
    const duration = opts.durationSec ?? 30;
    const energyGain = { low: 0.6, medium: 0.85, high: 1, explosive: 1.15 }[opts.energy] ?? 0.9;

    const totalSteps = Math.floor(duration / sixteenth);
    // Use currentTime AFTER async decode so events are never in the past
    const start = ctx.currentTime + 0.1;

    if (profile.pad) this.pad(ctx, master, profile.rootHz, duration);

    for (let i = 0; i < totalSteps; i++) {
      const t = start + i * sixteenth;
      const pos = i % 16;

      // Drop emphasis: 5s-25s = main groove, build before, outro after
      const phase = i * sixteenth;
      const inDrop = phase >= 5 && phase < 25;
      const inBuild = phase >= 3 && phase < 5;

      // Kick
      if (pos % profile.kickEvery === 0 && (inDrop || phase < 5 || phase >= 25)) {
        this.kick(ctx, master, t, energyGain);
      }
      // Snare
      if (profile.snareOn.includes(pos) && inDrop) {
        this.snare(ctx, master, t, energyGain * 0.7);
      }
      // Hat
      if (pos % profile.hatEvery === 0) {
        const open = inBuild && pos % 2 === 1;
        this.hat(ctx, master, t, open ? 0.05 : 0.02, open ? 0.18 : 0.04);
      }
      // Bass on quarter notes during drop
      if (pos % 4 === 0 && inDrop) {
        const beatIdx = Math.floor(pos / 4);
        const semi = profile.bassPattern[beatIdx % profile.bassPattern.length];
        this.bass(ctx, master, t, profile.rootHz * Math.pow(2, semi / 12), sixteenth * 4 * 0.9, energyGain);
      }
      // Build riser
      if (inBuild && pos === 0) {
        this.riser(ctx, master, t, 5 - phase);
      }
    }

    // Layer the recorded voice into the drop section
    if (voiceBuffer) {
      this.scheduleVoiceChops(ctx, master, voiceBuffer, start + 5, start + 25, sixteenth);
    }

    this.stopAt = start + duration;
    const stopId = window.setTimeout(() => this.stop(), duration * 1000 + 200);
    this.timers.push(stopId);
  }

  stop() {
    if (!this.ctx) return;
    try {
      this.master?.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master?.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
      const ctx = this.ctx;
      window.setTimeout(() => ctx.close().catch(() => {}), 200);
    } catch {}
    this.ctx = null;
    this.master = null;
    this.timers.forEach((t) => window.clearTimeout(t));
    this.timers = [];
    this.onEndCb?.();
    this.onEndCb = undefined;
  }

  isPlaying() {
    return !!this.ctx;
  }

  // --- Voices ---
  private kick(ctx: AudioContext, dest: AudioNode, t: number, gain: number) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.1 * gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.4);
  }

  private snare(ctx: AudioContext, dest: AudioNode, t: number, gain: number) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6 * gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    noise.connect(hp).connect(g).connect(dest);
    noise.start(t);
    noise.stop(t + 0.22);
  }

  private hat(ctx: AudioContext, dest: AudioNode, t: number, gain: number, decay: number) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    noise.connect(hp).connect(g).connect(dest);
    noise.start(t);
    noise.stop(t + decay + 0.02);
  }

  private bass(ctx: AudioContext, dest: AudioNode, t: number, freq: number, dur: number, gain: number) {
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.value = freq;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(800, t);
    lp.frequency.exponentialRampToValueAtTime(200, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4 * gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(lp).connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private pad(ctx: AudioContext, dest: AudioNode, root: number, dur: number) {
    const start = ctx.currentTime + 0.05;
    [0, 7, 12].forEach((semi, idx) => {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = root * 4 * Math.pow(2, semi / 12);
      const detune = ctx.createOscillator();
      detune.frequency.value = 0.3 + idx * 0.1;
      const detuneGain = ctx.createGain();
      detuneGain.gain.value = 6;
      detune.connect(detuneGain).connect(osc.detune);
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1200;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.05, start + 1.5);
      g.gain.setValueAtTime(0.05, start + dur - 2);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(lp).connect(g).connect(dest);
      osc.start(start);
      detune.start(start);
      osc.stop(start + dur);
      detune.stop(start + dur);
    });
  }

  // Chop, loop, pitch-shift, and reverb the recorded voice into the drop.
  private scheduleVoiceChops(
    ctx: AudioContext,
    dest: AudioNode,
    voiceBuffer: AudioBuffer,
    dropStart: number,
    dropEnd: number,
    sixteenth: number,
  ) {
    const beatLen = sixteenth * 4;
    const voiceDur = voiceBuffer.duration;
    if (voiceDur < 0.05) return;

    // Build a simple two-tap delay reverb shared across all voice chops
    const delay1 = ctx.createDelay(0.5);
    delay1.delayTime.value = 0.09;
    const delay2 = ctx.createDelay(0.5);
    delay2.delayTime.value = 0.17;
    const fbGain = ctx.createGain();
    fbGain.gain.value = 0.32;
    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = 2800;
    delay1.connect(delay2);
    delay2.connect(lpf).connect(fbGain).connect(delay1);
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.38;
    delay1.connect(wetGain).connect(dest);

    // Helper: play one voice chop with fade envelope
    const playChop = (t: number, offset: number, len: number, pitch: number, vol: number) => {
      const safeOffset = offset % Math.max(voiceDur, 0.01);
      const src = ctx.createBufferSource();
      src.buffer = voiceBuffer;
      src.playbackRate.value = pitch;
      const g = ctx.createGain();
      const fadeIn = Math.min(0.015, len * 0.08);
      const fadeOut = Math.min(0.06, len * 0.2);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + fadeIn);
      g.gain.setValueAtTime(vol, t + len - fadeOut);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(g);
      g.connect(dest);
      g.connect(delay1);
      src.start(t, safeOffset);
      src.stop(t + len + 0.05);
    };

    // Pitch pattern: unison, unison, minor-3rd-up, unison, minor-3rd-down, unison, 5th-up, octave-down
    const pitchPattern = [1, 1, 1.189, 1, 0.794, 1, 1.498, 0.5];

    // Main chops every 2 beats, cycling through the voice sample
    let chopIdx = 0;
    for (let t = dropStart; t < dropEnd - beatLen * 2; t += beatLen * 2) {
      const chopLen = Math.min(beatLen * 1.8, voiceDur);
      const offset = (chopIdx * beatLen * 0.65) % Math.max(0.01, voiceDur - chopLen * 0.5);
      playChop(t, offset, chopLen, pitchPattern[chopIdx % pitchPattern.length], 0.65);
      chopIdx++;
    }

    // Stutter fill: 8 rapid-fire slices 60% through the drop for tension
    const stutterT = dropStart + (dropEnd - dropStart) * 0.6;
    for (let i = 0; i < 8; i++) {
      const t = stutterT + i * sixteenth;
      const offset = (i / 8) * Math.min(voiceDur, 0.8);
      const pitch = i % 3 === 2 ? 1.498 : 1.0;
      playChop(t, offset, sixteenth * 0.88, pitch, 0.5);
    }
  }

  private riser(ctx: AudioContext, dest: AudioNode, t: number, dur: number) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(8000, t + dur);
    bp.Q.value = 4;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.25, t + dur * 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(bp).connect(g).connect(dest);
    noise.start(t);
    noise.stop(t + dur);
  }
}
