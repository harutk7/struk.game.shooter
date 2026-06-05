/**
 * Generate small, valid placeholder *bot voice* SFX for T19.
 *
 * Bots need short vocal callouts (spotted / reload / death / kill). The
 * build/CI environment has no network access and no OGG/Vorbis encoder, so —
 * exactly as for the T13 placeholders (`gen_placeholder_sounds.mjs`) — we
 * synthesize the clips ourselves as small, uncompressed 16-bit PCM WAV files.
 * WAV is universally decodable by the Web Audio `decodeAudioData` API.
 *
 * Because they are procedurally generated here they are our own work and are
 * released into the public domain (CC0). See CREDITS.md.
 *
 *   node scripts/gen_bot_voice_sounds.mjs
 *
 * Outputs 10 clips into public/sounds/bot_voice/:
 *   spotted_1..3, reload_1..2, death_1..3, kill_1..2
 *
 * The synthesis is a crude "vocal grunt": a buzzy sawtooth carrier at a
 * speech-range pitch, shaped by a couple of fixed formant resonances, a slow
 * "wobble" (vibrato) and a short attack/decay envelope, with a touch of breath
 * noise. It will never be mistaken for a real human, but it reads as a short
 * non-verbal shout and gives the 3D-positional voice system something real to
 * play. Swap for richer CC0 assets later via the asset pipeline.
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

/**
 * Synthesize a short "vocal grunt".
 *
 * @param {object} o
 * @param {number} o.seed     deterministic noise seed (per clip)
 * @param {number} o.dur      duration in seconds
 * @param {number} o.f0       base pitch (Hz)
 * @param {number} o.bend     pitch glide over the clip (Hz, +rise / -fall)
 * @param {number} o.attack   attack fraction (0..1) of duration
 * @param {number} o.gain     output gain
 */
function makeGrunt(o) {
  const n = Math.floor(o.dur * SAMPLE_RATE);
  const out = new Float32Array(n);

  // Deterministic LCG so committed files are reproducible (no Math.random).
  let seed = o.seed >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  // Two crude one-pole band emphases acting as pseudo-formants.
  let lp1 = 0;
  let lp2 = 0;
  let phase = 0;

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const frac = i / n;

    // Glide + a slow vibrato wobble give it a "voiced" character.
    const vibrato = Math.sin(2 * Math.PI * 6 * t) * 4;
    const freq = o.f0 + o.bend * frac + vibrato;
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;

    // Buzzy carrier: blend of sawtooth-ish harmonics.
    const saw =
      Math.sin(phase) +
      0.5 * Math.sin(2 * phase) +
      0.33 * Math.sin(3 * phase) +
      0.25 * Math.sin(4 * phase);

    // Breath noise.
    const noise = rand() * 2 - 1;
    let sample = saw * 0.8 + noise * 0.15;

    // Pseudo-formant shaping (resonant-ish low-pass smoothing).
    lp1 += (sample - lp1) * 0.5;
    lp2 += (lp1 - lp2) * 0.25;
    sample = lp1 * 0.7 + lp2 * 0.3;

    // Attack/decay envelope.
    let env;
    if (frac < o.attack) {
      env = frac / o.attack;
    } else {
      const d = (frac - o.attack) / (1 - o.attack);
      env = Math.exp(-d * 3.0);
    }

    out[i] = sample * env * o.gain;
  }
  return out;
}

// category -> array of synthesis params (one per clip).
const CLIPS = {
  // "Contact!" — short, higher, rising shout.
  spotted: [
    { seed: 101, dur: 0.42, f0: 180, bend: 90, attack: 0.05, gain: 0.55 },
    { seed: 102, dur: 0.38, f0: 210, bend: 60, attack: 0.04, gain: 0.55 },
    { seed: 103, dur: 0.46, f0: 160, bend: 120, attack: 0.06, gain: 0.55 },
  ],
  // "Reloading!" — mid, neutral, slightly longer.
  reload: [
    { seed: 201, dur: 0.55, f0: 150, bend: 10, attack: 0.08, gain: 0.5 },
    { seed: 202, dur: 0.6, f0: 140, bend: -10, attack: 0.08, gain: 0.5 },
  ],
  // Death groan — longer, lower, falling pitch.
  death: [
    { seed: 301, dur: 0.85, f0: 150, bend: -90, attack: 0.04, gain: 0.6 },
    { seed: 302, dur: 0.78, f0: 170, bend: -110, attack: 0.05, gain: 0.6 },
    { seed: 303, dur: 0.9, f0: 130, bend: -70, attack: 0.04, gain: 0.6 },
  ],
  // Kill bark — punchy, short, confident.
  kill: [
    { seed: 401, dur: 0.36, f0: 190, bend: 40, attack: 0.03, gain: 0.6 },
    { seed: 402, dur: 0.4, f0: 175, bend: 70, attack: 0.03, gain: 0.6 },
  ],
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'sounds', 'bot_voice');
mkdirSync(outDir, { recursive: true });

let count = 0;
for (const [category, variants] of Object.entries(CLIPS)) {
  variants.forEach((params, idx) => {
    const file = `${category}_${idx + 1}.wav`;
    writeFileSync(join(outDir, file), encodeWav(makeGrunt(params)));
    count++;
  });
}

console.log(`Wrote ${count} bot-voice clips to public/sounds/bot_voice/`);
