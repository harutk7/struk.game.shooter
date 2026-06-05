// audit_credits.test.ts
//
// Audits CREDITS.md against the assets actually shipped with the game.
// Added by T12 (CREDITS.md audit and license normalization).
//
// Guarantees:
//   1. Every file under public/assets/ and public/sounds/ has a matching
//      CREDITS.md entry (matched by repo-relative path).
//   2. Every asset declared in scripts/fetch_assets.mjs (CC0 textures/HDRIs
//      that CI downloads instead of committing) also has a matching entry —
//      so the audit stays correct whether an asset is committed or fetched.
//   3. Every CREDITS.md entry declares a license from the allowed SPDX-ish set.
//
// Run via `npm test` (vitest). Pure filesystem + string checks, no network.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CREDITS_PATH = path.join(ROOT, 'CREDITS.md');
const ASSET_DIRS = ['public/assets', 'public/sounds'];
const FETCH_SCRIPT = path.join(ROOT, 'scripts', 'fetch_assets.mjs');

const ALLOWED_LICENSES = ['CC0', 'CC-BY', 'CC-BY-SA', 'MIT', 'Apache-2.0'];

// Files that are not real assets and should never need an attribution entry.
const IGNORED = new Set(['.gitkeep', '.DS_Store']);

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (IGNORED.has(name)) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

function creditsText(): string {
  return readFileSync(CREDITS_PATH, 'utf8');
}

// One entry per line beginning with "- ".
function entryLines(): string[] {
  return creditsText()
    .split('\n')
    .filter((l) => l.startsWith('- '));
}

// Asset basenames declared in fetch_assets.mjs (e.g. name: 'foo.hdr').
function manifestAssets(): string[] {
  if (!existsSync(FETCH_SCRIPT)) return [];
  const src = readFileSync(FETCH_SCRIPT, 'utf8');
  const names: string[] = [];
  const re = /name:\s*['"`]([^'"`]+)['"`]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) names.push(m[1]);
  return names;
}

describe('CREDITS.md audit', () => {
  it('exists at the repo root', () => {
    expect(existsSync(CREDITS_PATH)).toBe(true);
  });

  it('has a "How to add a new asset" guide', () => {
    expect(creditsText()).toMatch(/how to add a new asset/i);
  });

  it('credits every file under public/assets and public/sounds', () => {
    const text = creditsText();
    const files = ASSET_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
    const missing = files.filter((f) => {
      const rel = path.relative(ROOT, f).split(path.sep).join('/');
      const base = path.basename(f);
      // Match by full repo-relative path or, failing that, by basename.
      return !text.includes(rel) && !text.includes(base);
    });
    expect(missing, `Uncredited asset files: ${missing.join(', ')}`).toEqual([]);
  });

  it('credits every asset declared in fetch_assets.mjs', () => {
    const text = creditsText();
    const missing = manifestAssets().filter((name) => !text.includes(name));
    expect(
      missing,
      `Fetched assets missing from CREDITS.md: ${missing.join(', ')}`,
    ).toEqual([]);
  });

  it('keeps the entry count equal to the shipped asset file count', () => {
    const files = ASSET_DIRS.flatMap((d) => walk(path.join(ROOT, d)));
    // Only meaningful when assets are committed; skip the equality assertion
    // in a fetch-only checkout where the binaries are absent.
    if (files.length > 0) {
      expect(entryLines().length).toBe(files.length);
    } else {
      expect(entryLines().length).toBeGreaterThan(0);
    }
  });

  it('declares an allowed license for every entry', () => {
    const bad = entryLines().filter((line) => {
      // License token sits after "License:".
      const m = line.match(/License:\s*([A-Za-z0-9.\-]+)/);
      return !m || !ALLOWED_LICENSES.includes(m[1]);
    });
    expect(bad, `Entries with missing/disallowed license: ${bad.join(' | ')}`).toEqual([]);
  });
});
