/**
 * Scene environment map (T8 — consumes the T4 HDRI).
 *
 * Loads the CC0 "Kiara 9 Dusk" HDR equirectangular map fetched into
 * `public/assets/` and installs it as `scene.environment` via a PMREM prefilter.
 * Every `MeshStandardMaterial` with metalness > 0 — i.e. the weapon slides and
 * barrels assigned in WeaponModels — then reflects the sky, which is what makes
 * metal read as metal rather than flat grey.
 *
 * Best-effort and fully guarded: any failure (no WebGL context, 404, headless
 * test, parse error) leaves the scene unchanged and the game keeps running. The
 * heavy RGBELoader is dynamically imported so it never sits in the boot path.
 */

import * as THREE from 'three';

/** Default HDR fetched by `scripts/fetch_assets.mjs`. */
export const DEFAULT_HDR_URL = '/assets/kiara_9_dusk_1k.hdr';

export interface EnvironmentOptions {
  /** Override the HDR url. */
  url?: string;
  /** Also paint the HDR as the visible sky background. Default: false. */
  asBackground?: boolean;
}

/**
 * Load `url` and install it as the scene's environment map. Resolves once the
 * map is applied or once any failure has been swallowed — it never rejects.
 */
export function applyEnvironment(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  opts: EnvironmentOptions = {},
): Promise<void> {
  const url = opts.url ?? DEFAULT_HDR_URL;

  return import('three/examples/jsm/loaders/RGBELoader')
    .then(({ RGBELoader }) => new Promise<void>((resolve) => {
      let pmrem: THREE.PMREMGenerator | null = null;
      try {
        pmrem = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
      } catch {
        // No usable WebGL context (headless) — nothing to reflect into.
        resolve();
        return;
      }

      const cleanup = () => {
        try { pmrem?.dispose(); } catch { /* noop */ }
      };

      new RGBELoader().load(
        url,
        (hdr: THREE.Texture) => {
          try {
            hdr.mapping = THREE.EquirectangularReflectionMapping;
            const envTexture = pmrem!.fromEquirectangular(hdr).texture;
            scene.environment = envTexture;
            if (opts.asBackground) scene.background = envTexture;
            hdr.dispose();
          } catch {
            // Prefiltering failed — leave the scene without an env map.
          }
          cleanup();
          resolve();
        },
        undefined,
        () => {
          // 404 / parse error — game still works, just without reflections.
          cleanup();
          resolve();
        },
      );
    }))
    .catch(() => undefined);
}
