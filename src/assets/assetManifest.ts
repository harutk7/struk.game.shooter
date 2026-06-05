export interface AssetEntry {
  name: string;
  url: string;
  license?: string;
}

export interface AssetManifest {
  /** GLTF weapon models — TODO T7: add weapon entries here */
  weapons: AssetEntry[];
  /** PBR texture maps — TODO T2: add concrete/metal textures; TODO T3: add additional PBR sets */
  textures: AssetEntry[];
  /** Audio clips — TODO T8: add sound-effect entries here */
  audio: AssetEntry[];
}

export const assetManifest: AssetManifest = {
  weapons: [],
  textures: [],
  audio: [],
};
