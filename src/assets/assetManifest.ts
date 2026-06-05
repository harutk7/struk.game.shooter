export interface AssetEntry {
  name: string;
  url: string;
  license?: string;
}

export interface AssetManifest {
  /** GLTF weapon models (T7) */
  weapons: AssetEntry[];
  /** PBR texture maps — TODO T2: add concrete/metal textures; TODO T3: add additional PBR sets */
  textures: AssetEntry[];
  /** Audio clips — TODO T8: add sound-effect entries here */
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
  ],
  audio: [],
};
