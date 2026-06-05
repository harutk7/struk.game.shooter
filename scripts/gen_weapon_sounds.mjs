/**
 * Generate per-weapon gunfire SFX + a hit-marker "ding" for T14.
 *
 * Like the T13 placeholders (see scripts/gen_placeholder_sounds.mjs), the
 * build/CI environment has no OGG/Vorbis encoder available (no ffmpeg / oggenc
 * / sox / JS encoder), and sourcing CC0 `.ogg` files from freesound.org would
 * require a fragile authenticated network fetch at build time. So instead we
 * synthesize the gunshots ourselves as small, uncompressed 16-bit PCM **WAV**
 * files. WAV is universally decodable by the Web Audio `decodeAudioData` API,
 * the files are only a few KB each, and because they are our own procedurally
 * generated work they are released into the public domain (CC0). See CREDITS.md.
 *
 *   node scripts/gen_weapon_sounds.mjs
 *
 * Outputs (public/sounds/weapons/ + public/sounds/):
 *   pistol_1.wav  pistol_2.wav   — short, bright mid crack
 *   rifle_1.wav   rifle_2.wav    — snappy assault-rifle report
 *   shotgun_1.wav shotgun_2.wav  — boomy low-end blast
 *   sniper_1.wav  sniper_2.wav   — loud, deep boom with long tail
 *   hitmarker.wav                — short metallic two-tone ding
 *
 * Two variants per weapon (seeded differently) give the in-game random picker
 * enough material to avoid repetition fatigue.
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
 * Synthesize a gunshot: a sharp noise transient shaped by a one-pole low-pass
 * (darker = bigger gun) layered over a short low-frequency "body" thump.
 *
 *  dur      total length in seconds
 *  decay    env decay rate (higher = snappier / shorter)
 *  lpAmount 0..1 low-pass strength (higher = darker / boomier)
 *  bodyFreq frequency of the low sine thump
 *  bodyAmt  how much body thump to mix in
 *  level    overall peak level
 */
function makeGunshot({ dur, decay, lpAmount, bodyFreq, bodyAmt, level, seed }) {
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const rand = makeRng(seed);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    // Fast attack (~2ms) then exponential decay.
    const attack = Math.min(1, t / 0.002);
    const env = attack * Math.exp(-t * decay);
    // White noise through a one-pole low-pass for the "air"/crack.
    const noise = rand() * 2 - 1;
    lp += (noise - lp) * (1 - lpAmount);
    // Low-frequency body thump (decays faster than the crack).
    const body = Math.sin(2 * Math.PI * bodyFreq * t) * Math.exp(-t * decay * 1.6);
    out[i] = (lp * (1 - bodyAmt) + body * bodyAmt) * env * level;
  }
  return out;
}

/** Short metallic two-tone "ding" hit-marker. */
function makeHitMarker() {
  const dur = 0.13;
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const f1 = 1250;
  const f2 = 1875; // ~perfect fifth above -> bright metallic ring
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 38);
    const s = Math.sin(2 * Math.PI * f1 * t) * 0.6 + Math.sin(2 * Math.PI * f2 * t) * 0.4;
    out[i] = s * env * 0.55;
  }
  return out;
}

// Per-weapon voice presets. Two seeds each => two distinct variants.
const WEAPONS = {
  pistol: { dur: 0.18, decay: 26, lpAmount: 0.55, bodyFreq: 180, bodyAmt: 0.35, level: 0.85 },
  rifle: { dur: 0.16, decay: 30, lpAmount: 0.5, bodyFreq: 150, bodyAmt: 0.3, level: 0.9 },
  shotgun: { dur: 0.34, decay: 13, lpAmount: 0.78, bodyFreq: 95, bodyAmt: 0.5, level: 0.95 },
  sniper: { dur: 0.42, decay: 10, lpAmount: 0.7, bodyFreq: 80, bodyAmt: 0.45, level: 1.0 },
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..', 'public', 'sounds');
const weaponsDir = join(root, 'weapons');
mkdirSync(weaponsDir, { recursive: true });

const written = [];
let seed = 0xc0ffee;
for (const [name, preset] of Object.entries(WEAPONS)) {
  for (let v = 1; v <= 2; v++) {
    seed = (seed * 22695477 + 1) >>> 0; // distinct seed per variant
    const samples = makeGunshot({ ...preset, seed });
    const file = join(weaponsDir, `${name}_${v}.wav`);
    writeFileSync(file, encodeWav(samples));
    written.push(`weapons/${name}_${v}.wav`);
  }
}

writeFileSync(join(root, 'hitmarker.wav'), encodeWav(makeHitMarker()));
written.push('hitmarker.wav');

console.log('Wrote per-weapon SFX:\n  ' + written.map((w) => `public/sounds/${w}`).join('\n  '));
