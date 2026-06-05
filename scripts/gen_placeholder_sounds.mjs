/**
 * Generate small, valid placeholder SFX for the audio system (T13).
 *
 * The build/CI environment has no OGG/Vorbis encoder available, so instead of
 * shipping a fragile network fetch we synthesize the placeholders ourselves as
 * uncompressed 16-bit PCM WAV files. WAV is universally decodable by the Web
 * Audio `decodeAudioData` API and the files are only a few KB.
 *
 * Because they are procedurally generated here, they are our own work and are
 * released into the public domain (CC0). See CREDITS.md.
 *
 *   node scripts/gen_placeholder_sounds.mjs
 *
 * Outputs:
 *   public/sounds/ping.wav  — short bright sine "ping" (UI / hit confirm)
 *   public/sounds/tick.wav  — very short noise "tick" (empty-magazine click)
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

/** Bright decaying sine "ping". */
function makePing() {
  const dur = 0.28;
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  const freq = 880;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const env = Math.exp(-t * 14);
    out[i] = Math.sin(2 * Math.PI * freq * t) * env * 0.6;
  }
  return out;
}

/** Short filtered-noise "tick" (dry empty-magazine click). */
function makeTick() {
  const dur = 0.05;
  const n = Math.floor(dur * SAMPLE_RATE);
  const out = new Float32Array(n);
  // Deterministic LCG so the committed file is reproducible (no Math.random).
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const env = Math.exp(-i / (n * 0.18));
    const noise = rand() * 2 - 1;
    // simple high-pass: emphasize the transient
    const hp = noise - prev;
    prev = noise;
    out[i] = hp * env * 0.5;
  }
  return out;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, '..', 'public', 'sounds');
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, 'ping.wav'), encodeWav(makePing()));
writeFileSync(join(outDir, 'tick.wav'), encodeWav(makeTick()));

console.log('Wrote public/sounds/ping.wav and public/sounds/tick.wav');
