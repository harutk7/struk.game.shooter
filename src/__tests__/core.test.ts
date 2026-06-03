import { describe, it, expect } from 'vitest';
import { GameState } from '../core/GameState';
import { EventBus } from '../core/EventBus';

describe('GameState', () => {
  it('starts in LOADING', () => {
    const gs = new GameState();
    expect(gs.phase).toBe('LOADING');
    expect(gs.isLoading).toBe(true);
  });

  it('LOADING → MENU is valid', () => {
    const gs = new GameState();
    expect(gs.transition('MENU')).toBe(true);
    expect(gs.phase).toBe('MENU');
    expect(gs.isMenu).toBe(true);
  });

  it('MENU → PLAYING is valid', () => {
    const gs = new GameState();
    gs._forceSet('MENU');
    expect(gs.transition('PLAYING')).toBe(true);
    expect(gs.isPlaying).toBe(true);
  });

  it('PLAYING → PAUSED is valid', () => {
    const gs = new GameState();
    gs._forceSet('PLAYING');
    expect(gs.transition('PAUSED')).toBe(true);
    expect(gs.isPaused).toBe(true);
  });

  it('PAUSED → PLAYING is valid', () => {
    const gs = new GameState();
    gs._forceSet('PAUSED');
    expect(gs.transition('PLAYING')).toBe(true);
  });

  it('PLAYING → GAME_OVER is valid', () => {
    const gs = new GameState();
    gs._forceSet('PLAYING');
    expect(gs.transition('GAME_OVER')).toBe(true);
    expect(gs.isGameOver).toBe(true);
  });

  it('GAME_OVER → MENU is valid', () => {
    const gs = new GameState();
    gs._forceSet('GAME_OVER');
    expect(gs.transition('MENU')).toBe(true);
  });

  it('PAUSED → MENU is valid', () => {
    const gs = new GameState();
    gs._forceSet('PAUSED');
    expect(gs.transition('MENU')).toBe(true);
  });

  it('MENU → GAME_OVER is invalid', () => {
    const gs = new GameState();
    gs._forceSet('MENU');
    expect(gs.transition('GAME_OVER')).toBe(false);
    expect(gs.phase).toBe('MENU');
  });

  it('LOADING → PLAYING is invalid', () => {
    const gs = new GameState();
    expect(gs.transition('PLAYING')).toBe(false);
    expect(gs.phase).toBe('LOADING');
  });

  it('GAME_OVER → PLAYING is invalid', () => {
    const gs = new GameState();
    gs._forceSet('GAME_OVER');
    expect(gs.transition('PLAYING')).toBe(false);
  });

  it('PLAYING → MENU is invalid', () => {
    const gs = new GameState();
    gs._forceSet('PLAYING');
    expect(gs.transition('MENU')).toBe(false);
  });

  it('LOADING → GAME_OVER is invalid', () => {
    const gs = new GameState();
    expect(gs.transition('GAME_OVER')).toBe(false);
  });

  it('notifies listeners on transition', () => {
    const gs = new GameState();
    let fromPhase = '';
    let toPhase = '';
    gs.onChange((from, to) => { fromPhase = from; toPhase = to; });
    gs.transition('MENU');
    expect(fromPhase).toBe('LOADING');
    expect(toPhase).toBe('MENU');
  });

  it('does not notify on invalid transition', () => {
    const gs = new GameState();
    let called = false;
    gs.onChange(() => { called = true; });
    gs.transition('PLAYING');
    expect(called).toBe(false);
  });

  it('unsubscribe works', () => {
    const gs = new GameState();
    let count = 0;
    const unsub = gs.onChange(() => { count++; });
    gs.transition('MENU');
    expect(count).toBe(1);
    unsub();
    gs._forceSet('LOADING');
    gs.transition('MENU');
    expect(count).toBe(1);
  });

  it('multiple listeners all fire', () => {
    const gs = new GameState();
    let a = 0, b = 0;
    gs.onChange(() => { a++; });
    gs.onChange(() => { b++; });
    gs.transition('MENU');
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('listener error does not block other listeners', () => {
    const gs = new GameState();
    let called = false;
    gs.onChange(() => { throw new Error('boom'); });
    gs.onChange(() => { called = true; });
    gs.transition('MENU');
    expect(called).toBe(true);
  });

  it('_forceSet bypasses validation', () => {
    const gs = new GameState();
    gs._forceSet('GAME_OVER');
    expect(gs.phase).toBe('GAME_OVER');
  });

  it('reset returns to LOADING', () => {
    const gs = new GameState();
    gs._forceSet('PLAYING');
    gs.reset();
    expect(gs.phase).toBe('LOADING');
  });
});

describe('EventBus', () => {
  it('emits and receives', () => {
    const bus = new EventBus<{ test: { value: number } }>();
    let received = 0;
    bus.on('test', (d) => { received = d.value; });
    bus.emit('test', { value: 42 });
    expect(received).toBe(42);
  });

  it('multiple listeners receive same event', () => {
    const bus = new EventBus<{ test: { value: number } }>();
    let a = 0, b = 0;
    bus.on('test', (d) => { a = d.value; });
    bus.on('test', (d) => { b = d.value; });
    bus.emit('test', { value: 7 });
    expect(a).toBe(7);
    expect(b).toBe(7);
  });

  it('once fires only once', () => {
    const bus = new EventBus<{ test: { value: number } }>();
    let count = 0;
    bus.once('test', () => { count++; });
    bus.emit('test', { value: 1 });
    bus.emit('test', { value: 2 });
    expect(count).toBe(1);
  });

  it('unsubscribe removes listener', () => {
    const bus = new EventBus<{ test: { value: number } }>();
    let count = 0;
    const unsub = bus.on('test', () => { count++; });
    bus.emit('test', { value: 1 });
    unsub();
    bus.emit('test', { value: 2 });
    expect(count).toBe(1);
  });

  it('clear specific event removes all listeners', () => {
    const bus = new EventBus<{ a: {}; b: {} }>();
    let aCount = 0, bCount = 0;
    bus.on('a', () => { aCount++; });
    bus.on('b', () => { bCount++; });
    bus.clear('a');
    bus.emit('a', {});
    bus.emit('b', {});
    expect(aCount).toBe(0);
    expect(bCount).toBe(1);
  });

  it('clear all removes everything', () => {
    const bus = new EventBus<{ a: {}; b: {} }>();
    let count = 0;
    bus.on('a', () => { count++; });
    bus.on('b', () => { count++; });
    bus.clear();
    bus.emit('a', {});
    bus.emit('b', {});
    expect(count).toBe(0);
  });

  it('emit with no listeners does not throw', () => {
    const bus = new EventBus<{ test: {} }>();
    expect(() => bus.emit('test', {})).not.toThrow();
  });

  it('listenerCount tracks correctly', () => {
    const bus = new EventBus<{ a: {}; b: {} }>();
    expect(bus.listenerCount).toBe(0);
    const u1 = bus.on('a', () => {});
    expect(bus.listenerCount).toBe(1);
    const u2 = bus.on('b', () => {});
    expect(bus.listenerCount).toBe(2);
    u1();
    expect(bus.listenerCount).toBe(1);
    u2();
    expect(bus.listenerCount).toBe(0);
  });

  it('handler error does not block other handlers', () => {
    const bus = new EventBus<{ test: {} }>();
    let called = false;
    bus.on('test', () => { throw new Error('boom'); });
    bus.on('test', () => { called = true; });
    bus.emit('test', {});
    expect(called).toBe(true);
  });

  it('multiple event types are independent', () => {
    const bus = new EventBus<{ a: { v: number }; b: { v: number } }>();
    let aVal = 0, bVal = 0;
    bus.on('a', (d) => { aVal = d.v; });
    bus.on('b', (d) => { bVal = d.v; });
    bus.emit('a', { v: 1 });
    bus.emit('b', { v: 2 });
    expect(aVal).toBe(1);
    expect(bVal).toBe(2);
  });
});
