import { describe, it, expect } from 'vitest';
import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';

describe('GameState', () => {
  it('starts in LOADING', () => {
    const gs = new GameState();
    expect(gs.phase).toBe('LOADING');
  });

  it('allows valid transitions', () => {
    const gs = new GameState();
    expect(gs.transition('MENU')).toBe(true);
    expect(gs.phase).toBe('MENU');
    expect(gs.transition('PLAYING')).toBe(true);
    expect(gs.phase).toBe('PLAYING');
    expect(gs.transition('PAUSED')).toBe(true);
    expect(gs.transition('PLAYING')).toBe(true);
    expect(gs.transition('GAME_OVER')).toBe(true);
    expect(gs.transition('MENU')).toBe(true);
  });

  it('rejects invalid transitions', () => {
    const gs = new GameState();
    gs._forceSet('MENU');
    expect(gs.transition('GAME_OVER')).toBe(false);
    expect(gs.phase).toBe('MENU');
  });

  it('notifies listeners', () => {
    const gs = new GameState();
    let called = false;
    gs.onChange((from, to) => {
      expect(from).toBe('LOADING');
      expect(to).toBe('MENU');
      called = true;
    });
    gs.transition('MENU');
    expect(called).toBe(true);
  });

  it('convenience getters work', () => {
    const gs = new GameState();
    expect(gs.isLoading).toBe(true);
    gs._forceSet('PLAYING');
    expect(gs.isPlaying).toBe(true);
    gs._forceSet('PAUSED');
    expect(gs.isPaused).toBe(true);
    gs._forceSet('GAME_OVER');
    expect(gs.isGameOver).toBe(true);
  });
});

describe('EventBus', () => {
  it('emits and receives events', () => {
    const bus = new EventBus<{ test: { value: number } }>();
    let received = 0;
    bus.on('test', (d) => { received = d.value; });
    bus.emit('test', { value: 42 });
    expect(received).toBe(42);
  });

  it('once fires only once', () => {
    const bus = new EventBus<{ test: { value: number } }>();
    let count = 0;
    bus.once('test', () => { count++; });
    bus.emit('test', { value: 1 });
    bus.emit('test', { value: 2 });
    expect(count).toBe(1);
  });

  it('unsubscribes correctly', () => {
    const bus = new EventBus<{ test: { value: number } }>();
    let count = 0;
    const unsub = bus.on('test', () => { count++; });
    bus.emit('test', { value: 1 });
    unsub();
    bus.emit('test', { value: 2 });
    expect(count).toBe(1);
  });

  it('clears events', () => {
    const bus = new EventBus<{ test: { value: number } }>();
    let count = 0;
    bus.on('test', () => { count++; });
    bus.clear('test');
    bus.emit('test', { value: 1 });
    expect(count).toBe(0);
  });

  it('tracks listener count', () => {
    const bus = new EventBus<{ a: {}; b: {} }>();
    expect(bus.listenerCount).toBe(0);
    bus.on('a', () => {});
    bus.on('b', () => {});
    expect(bus.listenerCount).toBe(2);
  });
});
