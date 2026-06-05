import { describe, it, expect, vi } from 'vitest';
import { AssetLoader } from '../assets/AssetLoader';
import type { TextureLoaderLike, AudioLoaderLike, GLTFLoaderLike } from '../assets/AssetLoader';
import type { GLTF } from '../assets/AssetLoader';

// Minimal texture stand-in
const makeTex = () => ({ isFallback: false }) as unknown as import('three').Texture;
const makeFallback = () => ({ isFallback: true }) as unknown as import('three').Texture;
const makeGroup = () => ({ isGroup: true }) as unknown as import('three').Group;

function makeSuccessTextureLoader(tex: import('three').Texture): TextureLoaderLike {
  return {
    load: (_url, onLoad) => { onLoad?.(tex); },
  };
}

function makeErrorTextureLoader(): TextureLoaderLike {
  return {
    load: (_url, _onLoad, _onProg, onError) => { onError?.(new Error('404 Not Found')); },
  };
}

function makeSuccessAudioLoader(buf: AudioBuffer): AudioLoaderLike {
  return {
    load: (_url, onLoad) => { onLoad?.(buf); },
  };
}

function makeErrorAudioLoader(): AudioLoaderLike {
  return {
    load: (_url, _onLoad, _onProg, onError) => { onError?.(new Error('404 Not Found')); },
  };
}

function makeSuccessGLTFLoader(gltf: GLTF): GLTFLoaderLike {
  return {
    load: (_url, onLoad) => { onLoad?.(gltf); },
  };
}

function makeErrorGLTFLoader(): GLTFLoaderLike {
  return {
    load: (_url, _onLoad, _onProg, onError) => { onError?.(new Error('404 Not Found')); },
  };
}

// ── Construction ─────────────────────────────────────────────────────────────

describe('AssetLoader — construction', () => {
  it('constructs with injected deps without throwing', () => {
    const loader = new AssetLoader({
      textureLoader: makeSuccessTextureLoader(makeTex()),
      audioLoader: makeSuccessAudioLoader({} as AudioBuffer),
      gltfLoader: makeSuccessGLTFLoader({ scene: makeGroup(), scenes: [] }),
    });
    expect(loader).toBeDefined();
    expect(loader).toBeInstanceOf(AssetLoader);
  });

  it('exposes loadTexture, loadGLTF, loadAudio, preloadManifest', () => {
    const loader = new AssetLoader({
      textureLoader: makeSuccessTextureLoader(makeTex()),
      audioLoader: makeSuccessAudioLoader({} as AudioBuffer),
      gltfLoader: makeSuccessGLTFLoader({ scene: makeGroup(), scenes: [] }),
    });
    expect(typeof loader.loadTexture).toBe('function');
    expect(typeof loader.loadGLTF).toBe('function');
    expect(typeof loader.loadAudio).toBe('function');
    expect(typeof loader.preloadManifest).toBe('function');
  });
});

// ── loadTexture — success ─────────────────────────────────────────────────────

describe('AssetLoader.loadTexture — success', () => {
  it('resolves with the loaded texture', async () => {
    const tex = makeTex();
    const loader = new AssetLoader({ textureLoader: makeSuccessTextureLoader(tex) });
    const result = await loader.loadTexture('http://example.com/tex.jpg');
    expect(result).toBe(tex);
  });
});

// ── loadTexture — fallback path on 404 ────────────────────────────────────────

describe('AssetLoader.loadTexture — fallback on URL failure', () => {
  it('returns blank fallback texture when URL errors (no fallback URL)', async () => {
    const fallback = makeFallback();
    const loader = new AssetLoader({
      textureLoader: makeErrorTextureLoader(),
      makeFallbackTexture: () => fallback,
    });
    const result = await loader.loadTexture('http://404.example.com/missing.jpg');
    expect(result).toBe(fallback);
  });

  it('tries the fallback URL when primary errors', async () => {
    const fallbackTex = makeFallback();
    let callCount = 0;
    const mixedLoader: TextureLoaderLike = {
      load: (_url, onLoad, _onProg, onError) => {
        callCount++;
        if (callCount === 1) {
          onError?.(new Error('primary 404'));
        } else {
          onLoad?.(fallbackTex);
        }
      },
    };
    const loader = new AssetLoader({
      textureLoader: mixedLoader,
      makeFallbackTexture: makeFallback,
    });
    const result = await loader.loadTexture('http://primary.example.com/tex.jpg', 'http://fallback.example.com/tex.jpg');
    expect(result).toBe(fallbackTex);
    expect(callCount).toBe(2);
  });

  it('returns blank fallback when both primary and fallback URL error', async () => {
    const blank = makeFallback();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const loader = new AssetLoader({
      textureLoader: makeErrorTextureLoader(),
      makeFallbackTexture: () => blank,
    });
    const result = await loader.loadTexture('http://404.example.com/a.jpg', 'http://404.example.com/b.jpg');
    expect(result).toBe(blank);
    warnSpy.mockRestore();
  });
});

// ── loadGLTF — fallback on 404 ────────────────────────────────────────────────

describe('AssetLoader.loadGLTF — fallback on URL failure', () => {
  it('returns empty scene group when URL errors', async () => {
    const fallbackScene = makeGroup();
    const loader = new AssetLoader({
      gltfLoader: makeErrorGLTFLoader(),
      makeFallbackScene: () => fallbackScene,
    });
    const result = await loader.loadGLTF('http://404.example.com/model.glb');
    expect(result.scene).toBe(fallbackScene);
    expect(result.scenes).toEqual([]);
  });
});

// ── loadAudio — rejects on 404 ───────────────────────────────────────────────

describe('AssetLoader.loadAudio — rejects on URL failure', () => {
  it('rejects with an Error when the URL fails', async () => {
    const loader = new AssetLoader({ audioLoader: makeErrorAudioLoader() });
    await expect(loader.loadAudio('http://404.example.com/sfx.ogg')).rejects.toThrow('404');
  });
});

// ── preloadManifest ───────────────────────────────────────────────────────────

describe('AssetLoader.preloadManifest', () => {
  it('resolves immediately when manifest is empty', async () => {
    const loader = new AssetLoader({
      textureLoader: makeSuccessTextureLoader(makeTex()),
      gltfLoader: makeSuccessGLTFLoader({ scene: makeGroup(), scenes: [] }),
    });
    await expect(loader.preloadManifest({ weapons: [], textures: [], audio: [] })).resolves.toBeUndefined();
  });

  it('loads all texture entries in the manifest', async () => {
    const loadedUrls: string[] = [];
    const trackingLoader: TextureLoaderLike = {
      load: (url, onLoad) => { loadedUrls.push(url); onLoad?.(makeTex()); },
    };
    const loader = new AssetLoader({
      textureLoader: trackingLoader,
      gltfLoader: makeSuccessGLTFLoader({ scene: makeGroup(), scenes: [] }),
    });
    await loader.preloadManifest({
      weapons: [],
      textures: [
        { name: 'concrete_diff', url: 'textures/concrete_diff.jpg' },
        { name: 'metal_diff', url: 'textures/metal_diff.jpg' },
      ],
      audio: [],
    });
    expect(loadedUrls).toEqual(['textures/concrete_diff.jpg', 'textures/metal_diff.jpg']);
  });
});
