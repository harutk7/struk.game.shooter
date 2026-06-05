/**
 * Generate player/bot footstep SFX + a low ambient soundscape for T15.
 *
 * Same precedent as T13 (scripts/gen_placeholder_sounds.mjs) and T14
 * (scripts/gen_weapon_sounds.mjs): the build/CI environment has no OGG/Vorbis
 * encoder available and sourcing CC0 `.ogg` files from freesound.org would
 * require a fragile authenticated network fetch at build time. So instead we
 * synthesize the footsteps + ambient ourselves as small, uncompressed 16-bit
 * PCM **WAV** files. WAV is universally decodable by the Web Audio
 * `decodeAudioData` API, the files are only a few KB each, and because they are
 * our own procedurally generated work they are released into the public domain
 * (CC0). See CREDITS.md.
 *
 *   node scripts/gen_footstep_sounds.mjs
 *
 * Outputs:
 *   public/sounds/footsteps/concrete_1..4.wav — sharp, bright boot-on-concrete
 *   public/sounds/footsteps/dirt_1..4.wav     — soft, dull boot-on-dirt/gravel
 *   public/sounds/ambient/ambient_hum.wav     — low distant hum bed (loopable)
 *   public/sounds/ambient/ambient_wind.wav    — soft low wind bed (loopable)
 *
 * Four variants per surface give the in-game random picker enough material to
 * avoid repetition fatigue while walking.
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
 * Synthesize a single footstep: a short noise transient (the "scuff") shaped by
 * a one-pole low-pass, layered over a brief low-frequency "thud" (the impact).
 *
 *  dur       total length in seconds
 *  decay     env decay rate (higher = snappier / shorter)
 *  lpAmount  0..1 low-pass strength (higher = duller / softer — dirt)
 *  thudFreq  frequency of the low impact thump
 *  thudAmt   how much impact thump to mix in
 *  level     overall peak level
 */
function makeFootstep({ dur, decay, lpAmount, thudFreq, thudAmt, level, seed }) {
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const rand = makeRng(seed);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Fast attack (~3ms) then exponential decay.
    const attack = Math.min(1, t / 0.003);
    const env = attack * Math.exp(-t * decay);
    // White noise through a one-pole low-pass for the scuff / surface texture.
    const noise = rand() * 2 - 1;
    lp += (noise - lp) * (1 - lpAmount);
    // Low-frequency impact thud (decays faster than the scuff).
    const thud = Math.sin(2 * Math.PI * thudFreq * t) * Math.exp(-t * decay * 2.2);
    out[i] = (lp * (1 - thudAmt) + thud * thudAmt) * env * level;
  }
  return out;
}

/**
 * Synthesize a low, loopable ambient bed: a couple of quiet sine "hum"
 * partials (frequencies chosen to complete whole cycles over the loop so the
 * seam is click-free) plus slow band-limited noise gently amplitude-modulated
 * by an LFO for "air"/wind movement.
 *
 *  dur     loop length in seconds
 *  hums    array of { freq, amp } low partials
 *  noiseAmt overall noise level
 *  lpAmount low-pass strength on the noise (higher = darker)
 *  lfoHz    amplitude-modulation rate for the noise
 *  level   overall peak level (kept low — this sits under everything)
 */
function makeAmbient({ dur, hums, noiseAmt, lpAmount, lfoHz, level, seed }) {
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const rand = makeRng(seed);
  let lp = 0;
  // Quantize hum + lfo frequencies to whole cycles per loop for a seamless seam.
  const q = (f) => Math.max(1, Math.round(f * dur)) / dur;
  const qHums = hums.map((h) => ({ freq: q(h.freq), amp: h.amp }));
  const qLfo = q(lfoHz);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    let s = 0;
    for (const h of qHums) s += Math.sin(2 * Math.PI * h.freq * t) * h.amp;
    const noise = rand() * 2 - 1;
    lp += (noise - lp) * (1 - lpAmount);
    const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * qLfo * t);
    s += lp * noiseAmt * lfo;
    out[i] = s * level;
  }
  return out;
}

// Per-surface voice presets. Four seeds each => four distinct variants.
const SURFACES = {
  // Boot on concrete: short, bright, a crisp click with a tight thud.
  concrete: { dur: 0.16, decay: 32, lpAmount: 0.4, thudFreq: 130, thudAmt: 0.4, level: 0.7 },
  // Boot on dirt/gravel: duller, softer, a touch longer, more low-pass.
  dirt: { dur: 0.2, decay: 26, lpAmount: 0.72, thudFreq: 95, thudAmt: 0.5, level: 0.6 },
};

const AMBIENTS = {
  // Distant low hum bed (like a far HVAC / city rumble).
  ambient_hum: {
    dur: 4.0,
    hums: [{ freq: 60, amp: 0.5 }, { freq: 90, amp: 0.28 }, { freq: 120, amp: 0.16 }],
    noiseAmt: 0.18,
    lpAmount: 0.95,
    lfoHz: 0.15,
    level: 0.5,
    seed: 0x5eed01,
  },
  // Soft low wind bed (band-limited noise, slow swell).
  ambient_wind: {
    dur: 4.0,
    hums: [{ freq: 50, amp: 0.22 }],
    noiseAmt: 0.5,
    lpAmount: 0.9,
    lfoHz: 0.22,
    level: 0.42,
    seed: 0x5eed02,
  },
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'public', 'sounds');
const footstepsDir = join(root, 'footsteps');
const ambientDir = join(root, 'ambient');
mkdirSync(footstepsDir, { recursive: true });
mkdirSync(ambientDir, { recursive: true });

const written = [];
let seed = 0xf007;
for (const [name, preset] of Object.entries(SURFACES)) {
  for (let v = 1; v <= 4; v++) {
    seed = (seed * 22695477 + 1) >>> 0; // distinct seed per variant
    const samples = makeFootstep({ ...preset, seed });
    const file = join(footstepsDir, `${name}_${v}.wav`);
    writeFileSync(file, encodeWav(samples));
    written.push(`footsteps/${name}_${v}.wav`);
  }
}

for (const [name, preset] of Object.entries(AMBIENTS)) {
  const samples = makeAmbient(preset);
  const file = join(ambientDir, `${name}.wav`);
  writeFileSync(file, encodeWav(samples));
  written.push(`ambient/${name}.wav`);
}

console.log('Wrote footstep + ambient SFX:\n  ' + written.map((w) => `public/sounds/${w}`).join('\n  '));
