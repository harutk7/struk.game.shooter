import { Game } from './game/Game';
import { assetManifest } from './assets/assetManifest';

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
});
