import type { ChimeStyle } from "./types";

// Page-turn chimes are synthesized rather than shipped as files so the exact
// same sound is mixed into the story audio on the server and previewed in the
// browser. Each one is a soft, bell-like tone: inharmonic partials with
// exponential decay and a gentle attack, so it never startles a sleepy child.

type Partial = [ratio: number, amplitude: number, decaySeconds: number];

const BELL: Partial[] = [
  [1, 1, 1.4],
  [1.0035, 0.5, 1.2], // a slightly detuned twin gives the shimmer
  [2.0, 0.28, 0.7],
  [2.76, 0.22, 0.5],
  [5.4, 0.08, 0.22],
  [8.93, 0.03, 0.12],
];

const GLOCK: Partial[] = [
  [1, 1, 0.55],
  [2.76, 0.26, 0.18],
  [5.4, 0.08, 0.09],
];

const CHIME: Partial[] = [
  [1, 1, 1.1],
  [2.0, 0.18, 0.6],
  [3.01, 0.12, 0.4],
  [4.17, 0.06, 0.25],
];

interface Strike {
  at: number;
  freq: number;
  gain: number;
  partials: Partial[];
}

const STYLES: Record<ChimeStyle, { duration: number; strikes: Strike[] }> = {
  // A single "ding", like the classic read-along records.
  bell: {
    duration: 2.4,
    strikes: [{ at: 0, freq: 1046.5, gain: 1, partials: BELL }],
  },
  // A quick upward twinkle of a magic wand.
  sparkle: {
    duration: 1.9,
    strikes: [
      { at: 0, freq: 1318.5, gain: 0.7, partials: GLOCK },
      { at: 0.075, freq: 1568.0, gain: 0.7, partials: GLOCK },
      { at: 0.15, freq: 2093.0, gain: 0.75, partials: GLOCK },
      { at: 0.24, freq: 2637.0, gain: 0.6, partials: BELL },
    ],
  },
  // Two soft, low notes drifting in the breeze.
  windchime: {
    duration: 2.6,
    strikes: [
      { at: 0, freq: 783.99, gain: 0.85, partials: CHIME },
      { at: 0.32, freq: 1046.5, gain: 0.75, partials: CHIME },
      { at: 0.58, freq: 1174.7, gain: 0.35, partials: CHIME },
    ],
  },
};

const ATTACK = 0.006;

/** Render a chime as mono float samples in [-1, 1], peaking at `peak`. */
export function renderChime(style: ChimeStyle, sampleRate: number, peak = 0.5): Float32Array {
  const spec = STYLES[style] ?? STYLES.bell;
  const length = Math.ceil(spec.duration * sampleRate);
  const out = new Float32Array(length);

  for (const strike of spec.strikes) {
    const start = Math.floor(strike.at * sampleRate);
    for (const [ratio, amp, decay] of strike.partials) {
      const f = strike.freq * ratio;
      if (f >= sampleRate / 2) continue; // stay below Nyquist
      const w = (2 * Math.PI * f) / sampleRate;
      for (let i = start; i < length; i++) {
        const t = (i - start) / sampleRate;
        const env = (t < ATTACK ? t / ATTACK : 1) * Math.exp(-t / decay);
        if (env < 1e-5 && t > ATTACK) break;
        out[i] += strike.gain * amp * env * Math.sin(w * (i - start));
      }
    }
  }

  // Fade the last 120ms to silence so nothing clicks at the tail.
  const fade = Math.floor(0.12 * sampleRate);
  for (let i = 0; i < fade; i++) out[length - 1 - i] *= i / fade;

  let max = 0;
  for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(out[i]));
  if (max > 0) {
    const g = peak / max;
    for (let i = 0; i < length; i++) out[i] *= g;
  }
  return out;
}

export function chimeDuration(style: ChimeStyle): number {
  return (STYLES[style] ?? STYLES.bell).duration;
}
