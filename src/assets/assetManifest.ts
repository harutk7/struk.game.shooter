export interface AssetEntry {
  name: string;
  url: string;
  license?: string;
}

export interface AssetManifest {
  /** GLTF weapon models (T7) */
  weapons: AssetEntry[];
  /** PBR texture maps — T8 registers the metal map; TODO T3: add additional PBR sets */
  textures: AssetEntry[];
  /** Environment maps — HDRI used as scene.environment for reflections (T4/T8) */
  environments?: AssetEntry[];
  /** Audio clips — TODO: add sound-effect entries here */
  audio: AssetEntry[];
}

export const assetManifest: AssetManifest = {
  // T7: CC0 low-poly weapon models (Quaternius "Ultimate Guns Pack").
  weapons: [
    { name: 'pistol',  url: '/assets/weapons/pistol.glb',  license: 'CC0 1.0 (Quaternius)' },
    { name: 'rifle',   url: '/assets/weapons/rifle.glb',   license: 'CC0 1.0 (Quaternius)' },
    { name: 'shotgun', url: '/assets/weapons/shotgun.glb', license: 'CC0 1.0 (Quaternius)' },
    { name: 'sniper',  url: '/assets/weapons/sniper.glb',  license: 'CC0 1.0 (Quaternius)' },
  ],
  textures: [
    {
      name: 'concrete_floor_diff',
      url: '/assets/concrete_floor_02_diff_1k.jpg',
      license: 'CC0',
    },
    // T8: PBR diffuse map used for the metal weapon parts (Poly Haven, CC0).
    { name: 'metal_plate', url: '/assets/metal_plate_diff_1k.jpg', license: 'CC0 1.0 (Poly Haven)' },
  ],
  // T8: HDRI environment map installed as scene.environment (see EnvironmentMap.ts).
  environments: [
    { name: 'kiara_9_dusk', url: '/assets/kiara_9_dusk_1k.hdr', license: 'CC0 1.0 (Poly Haven)' },
  ],
  audio: [],
};
