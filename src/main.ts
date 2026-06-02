import { Game } from './game/Game';

document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('game-container');
  if (!container) {
    console.error('Game container #game-container not found');
    return;
  }

  try {
    const game = new Game(container);
    // Expose for debugging
    (window as any).__game = game;
  } catch (err) {
    console.error('Failed to initialize game:', err);
  }
});
