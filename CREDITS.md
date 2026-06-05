# Credits & Asset Licenses

This file tracks every third-party asset bundled with **struk.game.shooter**
and its license attribution. It is the single source of truth for asset
provenance and is verified automatically by `scripts/audit_credits.test.ts`.

All assets currently shipped are **CC0 1.0 Universal** (public domain
dedication) — see <https://creativecommons.org/publicdomain/zero/1.0/>.

---

## How to add a new asset

1. Place the file under `public/assets/` (textures, models, HDRIs) or
   `public/sounds/` (audio). Large CC0 textures/HDRIs may instead be declared
   in `scripts/fetch_assets.mjs` so CI downloads them before the build.
2. Add exactly **one** entry line to the matching `##` section below, starting
   with `- ` and following the **Entry format** template.
3. Include all five required fields: asset name, Source, Author, License, Added.
4. Use a license token from the allowed set: `CC0`, `CC-BY`, `CC-BY-SA`,
   `MIT`, `Apache-2.0`. Never ship an asset whose license is unknown.
5. Run `npm test` — `audit_credits.test.ts` fails the build if any file lacks a
   matching entry or uses a license outside the allowed set.

### Entry format

```
**<Asset Name>** — Source: <URL or "Quaternius Starter Kit Pro"> · Author: <Author> · License: <token> · Added: <YYYY-MM-DD> · Path: <repo-relative path> · Used in: <task IDs>
```

Each asset is one line beginning with `- ` so the entry count always equals the
number of files under `public/assets/` and `public/sounds/`.

---

## Environment Maps

- **Kiara 9 Dusk (1k HDR)** — Source: https://polyhaven.com/a/kiara_9_dusk · Author: Poly Haven · License: CC0 · Added: 2026-06-04 · Path: public/assets/kiara_9_dusk_1k.hdr · Used in: T1 (sample), T6 (skybox/IBL)

## Textures

- **Concrete Floor 02 — Diffuse 1k** — Source: https://polyhaven.com/a/concrete_floor_02 · Author: Poly Haven · License: CC0 · Added: 2026-06-04 · Path: public/assets/concrete_floor_02_diff_1k.jpg · Used in: T1 (sample), T2 (PBR floor)
- **Metal Plate — Diffuse 1k** — Source: https://polyhaven.com/a/metal_plate · Author: Poly Haven · License: CC0 · Added: 2026-06-04 · Path: public/assets/metal_plate_diff_1k.jpg · Used in: T1 (sample), T3 (PBR metal surfaces)

## Weapon Models

- **Pistol (glTF)** — Source: Quaternius Starter Kit Pro · Author: Quaternius · License: CC0 · Added: 2026-06-04 · Path: public/assets/weapons/pistol.glb · Used in: T7 (weapon glTF models)
- **Rifle (glTF)** — Source: Quaternius Starter Kit Pro · Author: Quaternius · License: CC0 · Added: 2026-06-04 · Path: public/assets/weapons/rifle.glb · Used in: T7 (weapon glTF models)
- **Shotgun (glTF)** — Source: Quaternius Starter Kit Pro · Author: Quaternius · License: CC0 · Added: 2026-06-04 · Path: public/assets/weapons/shotgun.glb · Used in: T7 (weapon glTF models)
- **Sniper (glTF)** — Source: Quaternius Starter Kit Pro · Author: Quaternius · License: CC0 · Added: 2026-06-04 · Path: public/assets/weapons/sniper.glb · Used in: T7 (weapon glTF models)

## Audio

- **Ping SFX (placeholder)** — Source: Procedurally generated (scripts/gen_placeholder_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/ping.wav · Used in: T13 (AudioManager placeholder SFX)
- **Tick SFX (placeholder)** — Source: Procedurally generated (scripts/gen_placeholder_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/tick.wav · Used in: T13 (AudioManager empty-click)
- **Pistol gunshot 1** — Source: Procedurally generated (scripts/gen_weapon_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/weapons/pistol_1.wav · Used in: T14 (gunfire SFX)
- **Pistol gunshot 2** — Source: Procedurally generated (scripts/gen_weapon_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/weapons/pistol_2.wav · Used in: T14 (gunfire SFX)
- **Rifle gunshot 1** — Source: Procedurally generated (scripts/gen_weapon_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/weapons/rifle_1.wav · Used in: T14 (gunfire SFX)
- **Rifle gunshot 2** — Source: Procedurally generated (scripts/gen_weapon_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/weapons/rifle_2.wav · Used in: T14 (gunfire SFX)
- **Shotgun gunshot 1** — Source: Procedurally generated (scripts/gen_weapon_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/weapons/shotgun_1.wav · Used in: T14 (gunfire SFX)
- **Shotgun gunshot 2** — Source: Procedurally generated (scripts/gen_weapon_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/weapons/shotgun_2.wav · Used in: T14 (gunfire SFX)
- **Sniper gunshot 1** — Source: Procedurally generated (scripts/gen_weapon_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/weapons/sniper_1.wav · Used in: T14 (gunfire SFX)
- **Sniper gunshot 2** — Source: Procedurally generated (scripts/gen_weapon_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/weapons/sniper_2.wav · Used in: T14 (gunfire SFX)
- **Hit-marker ding** — Source: Procedurally generated (scripts/gen_weapon_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/hitmarker.wav · Used in: T14 (hit-marker ding)
- **Concrete footstep 1** — Source: Procedurally generated (scripts/gen_footstep_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/footsteps/concrete_1.wav · Used in: T15 (footsteps)
- **Concrete footstep 2** — Source: Procedurally generated (scripts/gen_footstep_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/footsteps/concrete_2.wav · Used in: T15 (footsteps)
- **Concrete footstep 3** — Source: Procedurally generated (scripts/gen_footstep_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/footsteps/concrete_3.wav · Used in: T15 (footsteps)
- **Concrete footstep 4** — Source: Procedurally generated (scripts/gen_footstep_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/footsteps/concrete_4.wav · Used in: T15 (footsteps)
- **Dirt footstep 1** — Source: Procedurally generated (scripts/gen_footstep_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/footsteps/dirt_1.wav · Used in: T15 (footsteps)
- **Dirt footstep 2** — Source: Procedurally generated (scripts/gen_footstep_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/footsteps/dirt_2.wav · Used in: T15 (footsteps)
- **Dirt footstep 3** — Source: Procedurally generated (scripts/gen_footstep_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/footsteps/dirt_3.wav · Used in: T15 (footsteps)
- **Dirt footstep 4** — Source: Procedurally generated (scripts/gen_footstep_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/footsteps/dirt_4.wav · Used in: T15 (footsteps)
- **Ambient hum bed** — Source: Procedurally generated (scripts/gen_footstep_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/ambient/ambient_hum.wav · Used in: T15 (ambient soundscape)
- **Ambient wind bed** — Source: Procedurally generated (scripts/gen_footstep_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/ambient/ambient_wind.wav · Used in: T15 (ambient soundscape)
- **Bot death 1** — Source: Procedurally generated (scripts/gen_damage_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/hit/death_1.wav · Used in: T16 (bot death SFX)
- **Bot death 2** — Source: Procedurally generated (scripts/gen_damage_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/hit/death_2.wav · Used in: T16 (bot death SFX)
- **Bot death 3** — Source: Procedurally generated (scripts/gen_damage_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/hit/death_3.wav · Used in: T16 (bot death SFX)
- **Impact concrete 1** — Source: Procedurally generated (scripts/gen_damage_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/impact/impact_concrete_1.wav · Used in: T16 (bullet impact SFX)
- **Impact concrete 2** — Source: Procedurally generated (scripts/gen_damage_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/impact/impact_concrete_2.wav · Used in: T16 (bullet impact SFX)
- **Impact metal 1** — Source: Procedurally generated (scripts/gen_damage_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/impact/impact_metal_1.wav · Used in: T16 (bullet impact SFX)
- **Impact metal 2** — Source: Procedurally generated (scripts/gen_damage_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/impact/impact_metal_2.wav · Used in: T16 (bullet impact SFX)
- **Player pain 1** — Source: Procedurally generated (scripts/gen_damage_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/player/pain_1.wav · Used in: T16 (player pain SFX)
- **Player pain 2** — Source: Procedurally generated (scripts/gen_damage_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/player/pain_2.wav · Used in: T16 (player pain SFX)
- **Player pain 3** — Source: Procedurally generated (scripts/gen_damage_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/player/pain_3.wav · Used in: T16 (player pain SFX)
- **Bot voice — death 1** — Source: Procedurally generated (scripts/gen_voice_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/bot_voice/death_1.wav · Used in: T19 (bot voice callouts)
- **Bot voice — death 2** — Source: Procedurally generated (scripts/gen_voice_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/bot_voice/death_2.wav · Used in: T19 (bot voice callouts)
- **Bot voice — death 3** — Source: Procedurally generated (scripts/gen_voice_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/bot_voice/death_3.wav · Used in: T19 (bot voice callouts)
- **Bot voice — kill 1** — Source: Procedurally generated (scripts/gen_voice_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/bot_voice/kill_1.wav · Used in: T19 (bot voice callouts)
- **Bot voice — kill 2** — Source: Procedurally generated (scripts/gen_voice_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/bot_voice/kill_2.wav · Used in: T19 (bot voice callouts)
- **Bot voice — reload 1** — Source: Procedurally generated (scripts/gen_voice_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/bot_voice/reload_1.wav · Used in: T19 (bot voice callouts)
- **Bot voice — reload 2** — Source: Procedurally generated (scripts/gen_voice_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/bot_voice/reload_2.wav · Used in: T19 (bot voice callouts)
- **Bot voice — spotted 1** — Source: Procedurally generated (scripts/gen_voice_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/bot_voice/spotted_1.wav · Used in: T19 (bot voice callouts)
- **Bot voice — spotted 2** — Source: Procedurally generated (scripts/gen_voice_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/bot_voice/spotted_2.wav · Used in: T19 (bot voice callouts)
- **Bot voice — spotted 3** — Source: Procedurally generated (scripts/gen_voice_sounds.mjs) · Author: struk.game.shooter · License: CC0 · Added: 2026-06-04 · Path: public/sounds/bot_voice/spotted_3.wav · Used in: T19 (bot voice callouts)

---

_Last audited: 2026-06-05 (T12; audio entries added during realism-v2 integration). Asset count: 48 — all CC0 1.0 Universal._
