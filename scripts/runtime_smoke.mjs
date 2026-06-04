/**
 * Heavy runtime smoke: walk the dependency graph of src/main.ts and
 * ensure every module the game loads returns a valid (200) response
 * from Vite's dev server. This catches any "Internal server error" /
 * syntax error in the Vite transform pipeline.
 *
 * Run via: node /app/shooter/scripts/runtime_smoke.mjs
 */

import { setTimeout as wait } from "node:timers/promises";

const URL_BASE = "http://localhost:3000";

// We can't easily run a browser, so we walk the dependency graph
// from src/main.ts and ensure every module the game loads
// returns a valid (200) HTTP response from Vite.
async function fetchOk(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const text = await res.text();
  if (text.includes("Internal server error") || text.includes("SyntaxError")) {
    throw new Error(`Transform error in ${url}:\n${text.slice(0, 500)}`);
  }
  return text;
}

async function main() {
  let total = 0, errors = 0;
  // Fetch the main entry — Vite's dev server will return the transformed
  // module that pulls in all the others.
  console.log("Fetching main entry from Vite dev server...");
  const mainCode = await fetchOk(`${URL_BASE}/src/main.ts`);
  total++;
  console.log(`  ✓ src/main.ts (${mainCode.length} bytes)`);

  // Extract every import path from main.ts
  const importRe = /from\s+["']([^"']+)["']/g;
  const dynamicImportRe = /import\(\s*["']([^"']+)["']\s*\)/g;
  const imports = new Set();
  let m;
  while ((m = importRe.exec(mainCode))) imports.add(m[1]);
  while ((m = dynamicImportRe.exec(mainCode))) imports.add(m[1]);

  // Recursively fetch all imports. Track modules we've already fetched.
  const seen = new Set();
  const queue = [...imports];
  while (queue.length) {
    const path = queue.shift();
    if (seen.has(path)) continue;
    seen.add(path);
    // Skip node:* and bare specifiers
    if (!path.startsWith(".") && !path.startsWith("/") && !path.startsWith("@")) continue;
    const url = path.startsWith("/") ? URL_BASE + path : path;
    try {
      const code = await fetchOk(url);
      total++;
      // Recurse into this module's imports
      const sub = code.match(/from\s+["']([^"']+)["']/g) ?? [];
      for (const line of sub) {
        const target = line.match(/["']([^"']+)["']/)?.[1];
        if (target && !seen.has(target)) queue.push(target);
      }
    } catch (e) {
      errors++;
      console.error(`  ✗ ${url} — ${e.message}`);
    }
  }

  console.log(`\nFetched ${total} modules with ${errors} errors.`);
  if (errors > 0) process.exit(1);
}

main().catch((e) => {
  console.error("SMOKE FAILED:", e);
  process.exit(1);
});
