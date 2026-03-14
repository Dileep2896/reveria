import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioScheduler, DEFAULT_GRACE_MS } from '../audioScheduler';

describe('AudioScheduler', () => {
  let onStart, onEnd, scheduler;

  beforeEach(() => {
    vi.useFakeTimers();
    onStart = vi.fn();
    onEnd = vi.fn();
    scheduler = new AudioScheduler({ graceMs: DEFAULT_GRACE_MS, onStart, onEnd });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Basic lifecycle ──

  it('fires onStart on first chunk', () => {
    scheduler.scheduleChunk(0, 0.5);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(scheduler.playing).toBe(true);
    expect(scheduler.activeCount).toBe(1);
  });

  it('does not fire onStart again on subsequent chunks', () => {
    scheduler.scheduleChunk(0, 0.5);
    scheduler.scheduleChunk(0.5, 0.5);
    scheduler.scheduleChunk(1.0, 0.5);
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(scheduler.activeCount).toBe(3);
  });

  it('fires onEnd after last source ends + grace period', () => {
    scheduler.scheduleChunk(0, 0.5);
    scheduler.onSourceEnded();

    // Should NOT fire immediately
    expect(onEnd).not.toHaveBeenCalled();
    expect(scheduler.playing).toBe(true);

    // Should fire after grace period
    vi.advanceTimersByTime(DEFAULT_GRACE_MS);
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(scheduler.playing).toBe(false);
  });

  // ── Gapless scheduling ──

  it('schedules chunks gaplessly back-to-back', () => {
    const r1 = scheduler.scheduleChunk(0, 0.5);
    expect(r1.startAt).toBe(0);
    expect(scheduler.nextTime).toBe(0.5);

    const r2 = scheduler.scheduleChunk(0.1, 0.3); // currentTime=0.1, but nextTime=0.5
    expect(r2.startAt).toBe(0.5); // scheduled after first chunk
    expect(scheduler.nextTime).toBeCloseTo(0.8);

    const r3 = scheduler.scheduleChunk(0.2, 0.4);
    expect(r3.startAt).toBeCloseTo(0.8);
    expect(scheduler.nextTime).toBeCloseTo(1.2);
  });

  it('uses currentTime when timeline is behind', () => {
    // If we haven't played anything and currentTime jumped ahead
    scheduler.nextTime = 0;
    const r = scheduler.scheduleChunk(5.0, 0.5);
    expect(r.startAt).toBe(5.0); // max(5.0, 0) = 5.0
    expect(scheduler.nextTime).toBe(5.5);
  });

  // ── Grace period behavior ──

  it('cancels grace period when new chunk arrives during grace', () => {
    scheduler.scheduleChunk(0, 0.5);
    scheduler.onSourceEnded(); // starts grace period

    // Halfway through grace, add another chunk
    vi.advanceTimersByTime(DEFAULT_GRACE_MS / 2);
    expect(onEnd).not.toHaveBeenCalled();

    scheduler.scheduleChunk(0.5, 0.3);
    // Grace should be cancelled — onEnd should never fire
    vi.advanceTimersByTime(DEFAULT_GRACE_MS);
    expect(onEnd).not.toHaveBeenCalled();
    expect(scheduler.playing).toBe(true);
  });

  it('handles multiple sources ending in sequence', () => {
    // Schedule 3 chunks
    scheduler.scheduleChunk(0, 0.3);
    scheduler.scheduleChunk(0.3, 0.3);
    scheduler.scheduleChunk(0.6, 0.3);
    expect(scheduler.activeCount).toBe(3);

    // First two end — grace should not start (activeCount > 0)
    scheduler.onSourceEnded();
    expect(scheduler.activeCount).toBe(2);
    scheduler.onSourceEnded();
    expect(scheduler.activeCount).toBe(1);

    // No grace timer yet
    vi.advanceTimersByTime(DEFAULT_GRACE_MS);
    expect(onEnd).not.toHaveBeenCalled();

    // Last one ends — grace starts
    scheduler.onSourceEnded();
    expect(scheduler.activeCount).toBe(0);
    vi.advanceTimersByTime(DEFAULT_GRACE_MS);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  // ── stop() ──

  it('stop() fires onEnd immediately without grace period', () => {
    scheduler.scheduleChunk(0, 0.5);
    scheduler.scheduleChunk(0.5, 0.5);
    expect(scheduler.playing).toBe(true);

    scheduler.stop();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(scheduler.playing).toBe(false);
    expect(scheduler.activeCount).toBe(0);
    expect(scheduler.nextTime).toBe(0);
  });

  it('stop() cancels pending grace timer', () => {
    scheduler.scheduleChunk(0, 0.5);
    scheduler.onSourceEnded(); // starts grace

    scheduler.stop(); // should fire onEnd immediately
    expect(onEnd).toHaveBeenCalledTimes(1);

    // Grace timer should not fire again
    vi.advanceTimersByTime(DEFAULT_GRACE_MS);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('stop() is no-op when not playing', () => {
    scheduler.stop();
    expect(onEnd).not.toHaveBeenCalled();
  });

  // ── reset() ──

  it('reset() clears timeline but keeps playing state', () => {
    scheduler.scheduleChunk(0, 0.5);
    expect(scheduler.nextTime).toBe(0.5);

    scheduler.reset();
    expect(scheduler.nextTime).toBe(0);
    expect(scheduler.playing).toBe(true); // still playing
    expect(scheduler.activeCount).toBe(1); // sources still active
  });

  // ── Edge cases ──

  it('activeCount never goes below 0', () => {
    scheduler.onSourceEnded();
    scheduler.onSourceEnded();
    expect(scheduler.activeCount).toBe(0);
  });

  it('works with custom grace period', () => {
    const fast = new AudioScheduler({ graceMs: 50, onStart, onEnd });
    fast.scheduleChunk(0, 0.5);
    fast.onSourceEnded();

    vi.advanceTimersByTime(49);
    expect(onEnd).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('rapid schedule-end-schedule does not double-fire onStart', () => {
    scheduler.scheduleChunk(0, 0.1);
    scheduler.onSourceEnded();
    // Grace started but not expired
    scheduler.scheduleChunk(0.1, 0.1);
    // onStart should only have been called once (still playing)
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it('re-fires onStart after full stop and new chunk', () => {
    scheduler.scheduleChunk(0, 0.5);
    scheduler.stop();
    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onEnd).toHaveBeenCalledTimes(1);

    // New stream
    scheduler.scheduleChunk(1.0, 0.5);
    expect(onStart).toHaveBeenCalledTimes(2);
  });
});
