// Offline autotune processor — pitch-detects a recorded AudioBuffer and
// snaps it to the nearest note in a musical scale using linear-interpolation
// resampling.  No external dependencies; runs entirely in the browser.

// ─── Scales ──────────────────────────────────────────────────────────────────

export const SCALES: Record<string, number[]> = {
  minor:      [0, 2, 3, 5, 7, 8, 10],   // natural minor (darker, suits most vocals)
  major:      [0, 2, 4, 5, 7, 9, 11],
  pentatonic: [0, 2, 4, 7, 9],
  chromatic:  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

export type ScaleName = keyof typeof SCALES;

// ─── Pitch detection (autocorrelation) ───────────────────────────────────────

function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  // Analyse a 4096-sample window from the middle of the recording
  const WIN = 4096;
  const start = Math.max(0, Math.floor((samples.length - WIN) / 2));
  const buf   = samples.slice(start, start + WIN);

  // Silence gate
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / buf.length) < 0.01) return null;

  // Human voice range: 60 Hz – 700 Hz
  const minLag = Math.floor(sampleRate / 700);
  const maxLag = Math.floor(sampleRate / 60);
  const n      = WIN - maxLag;

  let bestLag = -1, bestCorr = -Infinity;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += buf[i] * buf[i + lag];
    if (sum > bestCorr) { bestCorr = sum; bestLag = lag; }
  }

  return bestLag > 0 && bestCorr > 0 ? sampleRate / bestLag : null;
}

// ─── Pitch snapping ───────────────────────────────────────────────────────────

function snapToScale(hz: number, scale: number[]): number {
  const C4      = 261.63;
  const semitone = 12 * Math.log2(hz / C4);

  let bestDist = Infinity, bestHz = hz;

  for (let oct = -3; oct <= 5; oct++) {
    for (const deg of scale) {
      const s    = oct * 12 + deg;
      const dist = Math.abs(semitone - s);
      if (dist < bestDist) {
        bestDist = dist;
        bestHz   = C4 * Math.pow(2, s / 12);
      }
    }
  }

  return bestHz;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Pitch-corrects `inputBuffer` to the nearest note in `scaleName`.
 * Uses linear-interpolation resampling with looping so the output length
 * matches the input — no tempo change.
 *
 * @param inputBuffer  Decoded AudioBuffer from the voice recording
 * @param ctx          AudioContext (used only to create the output buffer)
 * @param scaleName    Musical scale to snap to (default: "minor")
 * @returns            New AudioBuffer at corrected pitch, same length as input
 */
export function applyAutotune(
  inputBuffer: AudioBuffer,
  ctx: Pick<AudioContext, "createBuffer">,
  scaleName: ScaleName = "minor",
): AudioBuffer {
  const sr    = inputBuffer.sampleRate;
  const nCh   = inputBuffer.numberOfChannels;
  const len   = inputBuffer.length;
  const scale = SCALES[scaleName];

  // Build mono mix just for pitch detection
  const mono = new Float32Array(len);
  for (let c = 0; c < nCh; c++) {
    const ch = inputBuffer.getChannelData(c);
    for (let i = 0; i < len; i++) mono[i] += ch[i] / nCh;
  }

  const detectedHz = detectPitch(mono, sr);

  // If no clear pitch (spoken word, percussion, silence) return untouched
  if (!detectedHz) return inputBuffer;

  const targetHz   = snapToScale(detectedHz, scale);
  const ratio      = targetHz / detectedHz; // > 1 = pitch up, < 1 = pitch down

  // Skip if shift is less than ~10 cents (inaudible)
  if (Math.abs(ratio - 1) < 0.006) return inputBuffer;

  const output = ctx.createBuffer(nCh, len, sr);

  for (let c = 0; c < nCh; c++) {
    const inp  = inputBuffer.getChannelData(c);
    const outCh = output.getChannelData(c);
    const loopLen = inp.length;

    for (let i = 0; i < len; i++) {
      // Advance through the input at `ratio` speed; loop seamlessly to
      // preserve duration regardless of pitch direction.
      const srcPos = (i * ratio) % loopLen;
      const s0     = Math.floor(srcPos);
      const s1     = (s0 + 1) % loopLen;
      const frac   = srcPos - s0;
      outCh[i]     = inp[s0] * (1 - frac) + inp[s1] * frac;
    }
  }

  return output;
}
