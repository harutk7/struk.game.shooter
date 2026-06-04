# Struk.Game.Shooter

A simple 3D browser-based first-person shooter game built with Three.js and TypeScript.

## Tech Stack
- Three.js - 3D rendering
- TypeScript - Type-safe JavaScript
- Vite - Build tool and dev server

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

## Game Features
- [x] First-person camera controls (realistic arms + body, head bob, crouch)
- [x] Player movement (WASD, sprint, crouch, jump)
- [x] Shooting mechanics (4 weapons, recoil, reload, weapon switch, empty click)
- [x] Two game modes: classic wave survival + deathmatch vs AI bots
- [x] Basic level/arena (AABB-collider scene)
- [x] Health system + invincibility frames
- [x] Score system (kills, KDR, combo)
- [x] Smart bot AI (patrol, investigate, engage, cover, reload, strafe)
- [x] Visual polish: weapon camo, blood splatter, hit marker, dynamic crosshair

## Controls
- WASD - Move
- Mouse - Look around
- Left Click - Shoot
- R - Reload
- Space - Jump
- Shift - Sprint
- Ctrl / C - Crouch
- 1 / 2 / 3 / 4 - Switch weapon (pistol / rifle / shotgun / sniper)
- Scroll - Cycle weapon
- Esc / P - Pause

## Game Modes
- **Waves (Classic)** — fight endless waves of enemies.
- **Deathmatch vs Bots** — 5 AI bots, first to 20 kills wins (5-minute time limit).

## Verification
```bash
npm run build           # tsc + vite build
node scripts/smoke.ts   # 33 pure-data model tests
node scripts/runtime_smoke.mjs   # fetches all 40 modules from the dev server
```
