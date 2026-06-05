/**
 * Generate damage SFX for T16: player pain grunts, bot death thwacks and
 * bullet-impact-on-surface sounds.
 *
 * Same precedent as T13 (scripts/gen_placeholder_sounds.mjs) and T15
 * (scripts/gen_footstep_sounds.mjs): the build/CI environment has no OGG/Vorbis
 * encoder available and sourcing CC0 `.ogg` clips from freesound.org would
 * require a fragile authenticated network fetch at build time. So instead we
 * synthesize the damage sounds ourselves as small, uncompressed 16-bit PCM
 * **WAV** files. WAV is universally decodable by the Web Audio `decodeAudioData`
 * API, the files are only a few KB each, and because they are our own
 * procedurally generated work they are released into the public domain (CC0).
 * See CREDITS.md.
 *
 *   node scripts/gen_damage_sounds.mjs
 *
 * Outputs:
 *   public/sounds/player/pain_1..3.wav        — male "ugh/argh" pain grunts
 *   public/sounds/hit/death_1..3.wav          — guttural death thwacks
 *   public/sounds/impact/impact_concrete_1..2.wav — bullet on concrete (dull thud)
 *   public/sounds/impact/impact_metal_1..2.wav    — bullet on metal (bright clang)
 *
 * Multiple variants per pool feed the in-game non-repeating random picker so
 * consecutive hits never sound identical (repetition fatigue).
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SAMPLE_RATE = 22050;

/** Encode a Float32 [-1,1] mono sample array as a 16-bit PCM WAV buffer. */
function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const numFrames = samples.length;
  const bytesPerSample = 2;
  const dataSize = numFrames * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16); // fmt chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numFrames; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * bytesPerSample);
  }
  return buffer;
}

/** Deterministic LCG so committed files are byte-reproducible (no Math.random). */
function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Synthesize a vocal "grunt" — a short voiced burst with a formant-ish buzz
 * (summed harmonics of a low pitch) shaped by a fast attack / quick decay, with
 * a touch of breath noise. Used for both player pain and bot death (death is
 * lower, longer and grittier).
 *
 *  dur      total length in seconds
 *  pitch    fundamental frequency (Hz) — male voice ~90-140Hz
 *  bend     pitch glide over the grunt (multiplier at the end, e.g. 0.7 = drop)
 *  decay    amplitude envelope decay rate
 *  rasp     amount of nonlinear waveshaping (grit / guttural-ness, 0..1)
 *  breath   amount of breath noise mixed in (0..1)
 *  level    overall peak level
 */
function makeGrunt({ dur, pitch, bend, decay, rasp, breath, level, seed }) {
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const rand = makeRng(seed);
  let phase = 0;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const frac = t / dur;
    // Pitch glides from `pitch` to `pitch*bend` across the grunt.
    const f = pitch * (1 + (bend - 1) * frac);
    phase += (2 * Math.PI * f) / SAMPLE_RATE;
    // A few harmonics give it a voiced, vowel-like timbre.
    let v =
      Math.sin(phase) +
      0.5 * Math.sin(2 * phase) +
      0.3 * Math.sin(3 * phase) +
      0.18 * Math.sin(4 * phase);
    v *= 0.55;
    // Waveshaping for grit / rasp (tanh-like soft clip).
    if (rasp > 0) {
      const k = 1 + rasp * 6;
      v = Math.tanh(v * k) / Math.tanh(k);
    }
    // Breath noise, low-passed so it's airy not hissy.
    const noise = rand() * 2 - 1;
    lp += (noise - lp) * 0.25;
    v += lp * breath;
    // Fast attack (~8ms) then decay; a slight swell in the middle for a "uh".
    const attack = Math.min(1, t / 0.008);
    const shape = Math.sin(Math.PI * Math.min(1, frac)); // 0->1->0 vowel arc
    const env = attack * (0.4 + 0.6 * shape) * Math.exp(-t * decay);
    out[i] = v * env * level;
  }
  return out;
}

/**
 * Synthesize a bullet impact: a sharp noise transient (the strike) through a
 * resonant-ish band, layered over a short pitched "ring" for metal or a low
 * "thud" for concrete.
 *
 *  dur       total length in seconds
 *  ringFreq  frequency of the post-impact ring/thud
 *  ringAmt   how much ring to mix in vs the noise strike
 *  ringDecay decay of the ring tail (lower = longer ring, for metal)
 *  decay     decay of the overall noise strike
 *  lpAmount  low-pass on the noise (higher = duller — concrete)
 *  level     overall peak level
 */
function makeImpact({ dur, ringFreq, ringAmt, ringDecay, decay, lpAmount, level, seed }) {
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const rand = makeRng(seed);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const attack = Math.min(1, t / 0.001); // very sharp ~1ms attack
    const strikeEnv = attack * Math.exp(-t * decay);
    const noise = rand() * 2 - 1;
    lp += (noise - lp) * (1 - lpAmount);
    const strike = lp * strikeEnv;
    const ring = Math.sin(2 * Math.PI * ringFreq * t) * Math.exp(-t * ringDecay) * attack;
    out[i] = (strike * (1 - ringAmt) + ring * ringAmt) * level;
  }
  return out;
}

// Player pain grunts: higher, shorter, less grit (a clenched "ugh!"). Three
// variants with slightly different pitch/bend so they don't all sound the same.
const PAINS = [
  { dur: 0.32, pitch: 142, bend: 0.78, decay: 9, rasp: 0.35, breath: 0.25, level: 0.85 },
  { dur: 0.28, pitch: 128, bend: 0.7, decay: 11, rasp: 0.45, breath: 0.3, level: 0.85 },
  { dur: 0.36, pitch: 155, bend: 0.72, decay: 8, rasp: 0.3, breath: 0.22, level: 0.85 },
];

// Bot death thwacks: lower, longer, grittier — a guttural death groan. Distinct
// from T19's "got the kill" voice callout; this is the death scream itself.
const DEATHS = [
  { dur: 0.55, pitch: 104, bend: 0.55, decay: 5.5, rasp: 0.7, breath: 0.32, level: 0.9 },
  { dur: 0.48, pitch: 92, bend: 0.6, decay: 6, rasp: 0.8, breath: 0.28, level: 0.9 },
  { dur: 0.6, pitch: 118, bend: 0.5, decay: 5, rasp: 0.65, breath: 0.35, level: 0.9 },
];

// Bullet impacts. Concrete = dull, low thud, heavy low-pass, short ring.
// Metal = bright clang, long-ringing high partial, less low-pass.
const IMPACTS = {
  impact_concrete: [
    { dur: 0.16, ringFreq: 180, ringAmt: 0.3, ringDecay: 40, decay: 55, lpAmount: 0.78, level: 0.7 },
    { dur: 0.14, ringFreq: 150, ringAmt: 0.28, ringDecay: 45, decay: 60, lpAmount: 0.82, level: 0.7 },
  ],
  impact_metal: [
    { dur: 0.3, ringFreq: 2100, ringAmt: 0.6, ringDecay: 14, decay: 70, lpAmount: 0.25, level: 0.62 },
    { dur: 0.34, ringFreq: 1650, ringAmt: 0.62, ringDecay: 12, decay: 75, lpAmount: 0.2, level: 0.62 },
  ],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'public', 'sounds');
const playerDir = join(root, 'player');
const hitDir = join(root, 'hit');
const impactDir = join(root, 'impact');
mkdirSync(playerDir, { recursive: true });
mkdirSync(hitDir, { recursive: true });
mkdirSync(impactDir, { recursive: true });

const written = [];
let seed = 0xda11;

PAINS.forEach((preset, i) => {
  seed = (seed * 22695477 + 1) >>> 0;
  const samples = makeGrunt({ ...preset, seed });
  writeFileSync(join(playerDir, `pain_${i + 1}.wav`), encodeWav(samples));
  written.push(`player/pain_${i + 1}.wav`);
});

DEATHS.forEach((preset, i) => {
  seed = (seed * 22695477 + 1) >>> 0;
  const samples = makeGrunt({ ...preset, seed });
  writeFileSync(join(hitDir, `death_${i + 1}.wav`), encodeWav(samples));
  written.push(`hit/death_${i + 1}.wav`);
});

for (const [name, presets] of Object.entries(IMPACTS)) {
  presets.forEach((preset, i) => {
    seed = (seed * 22695477 + 1) >>> 0;
    const samples = makeImpact({ ...preset, seed });
    writeFileSync(join(impactDir, `${name}_${i + 1}.wav`), encodeWav(samples));
    written.push(`impact/${name}_${i + 1}.wav`);
  });
}

console.log('Wrote damage SFX:\n  ' + written.map((w) => `public/sounds/${w}`).join('\n  '));
