import { Game } from './game/Game';
import { assetManifest } from './assets/assetManifest';
import { getAudioManager } from './audio/AudioManager';
import { getWeaponSFX } from './audio/WeaponSFX';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('Game container #game-container not found');
    return;
  }

  try {
    const game = new Game(container);
    // Kick off asset preloading; manifest is empty until later tasks populate it.
    game.assetLoader.preloadManifest(assetManifest);
    // Expose for debugging
    (window as any).__game = game;
  } catch (err) {
    console.error('Failed to initialize game:', err);
  }

  // The browser autoplay policy forbids creating/resuming an AudioContext
  // outside a user gesture, so we lazily initialize the AudioManager on the
  // first click or keypress and preload the placeholder SFX.
  let audioInitialized = false;
  const initAudio = () => {
    if (audioInitialized) return;
    audioInitialized = true;
    const audio = getAudioManager();
    const base = import.meta.env.BASE_URL ?? '/';
    void audio.resume();
    void audio.loadSound('tick', `${base}sounds/tick.wav`).catch(() => {});
    void audio.loadSound('ping', `${base}sounds/ping.wav`).catch(() => {});
    // Per-weapon gunfire + hit-marker SFX (T14).
    void getWeaponSFX().loadAll(base);
  };
  window.addEventListener('pointerdown', initAudio);
  window.addEventListener('keydown', initAudio);
});
