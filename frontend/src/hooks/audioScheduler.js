/**
 * Pure audio scheduling logic — extracted from useStreamingAudio for testability.
 *
 * Manages a gapless playback timeline: tracks active source count, next scheduled
 * time, and fires start/end callbacks with a configurable grace period.
 */

export const DEFAULT_GRACE_MS = 500;

export class AudioScheduler {
  constructor({ graceMs = DEFAULT_GRACE_MS, onStart, onEnd } = {}) {
    this.graceMs = graceMs;
    this._onStart = onStart || (() => {});
    this._onEnd = onEnd || (() => {});
    this.nextTime = 0;
    this.activeCount = 0;
    this.playing = false;
    this._graceTimer = null;
    // Bind to globalThis so calling this._setTimeout(...) doesn't lose window context
    this._setTimeout = typeof setTimeout !== 'undefined' ? (...a) => setTimeout(...a) : null;
    this._clearTimeout = typeof clearTimeout !== 'undefined' ? (...a) => clearTimeout(...a) : null;
  }

  /**
   * Schedule a chunk for playback.
   * @param {number} currentTime - AudioContext.currentTime equivalent
   * @param {number} duration - Buffer duration in seconds
   * @returns {{ startAt: number }} When this chunk should start playing
   */
  scheduleChunk(currentTime, duration) {
    const startAt = Math.max(currentTime, this.nextTime);
    this.nextTime = startAt + duration;
    this.activeCount++;

    // Cancel any pending end signal — more audio is coming
    if (this._graceTimer !== null) {
      this._clearTimeout(this._graceTimer);
      this._graceTimer = null;
    }

    if (!this.playing) {
      this.playing = true;
      this._onStart();
    }

    return { startAt };
  }

  /**
   * Called when a scheduled source finishes playing.
   * If no more sources are active, starts the grace period before signaling end.
   */
  onSourceEnded() {
    this.activeCount = Math.max(0, this.activeCount - 1);

    if (this.activeCount <= 0) {
      // Start grace period — if no new chunks arrive, signal playback end
      this._graceTimer = this._setTimeout(() => {
        this._graceTimer = null;
        if (this.activeCount <= 0 && this.playing) {
          this.playing = false;
          this._onEnd();
        }
      }, this.graceMs);
    }
  }

  /**
   * Immediately stop all playback.
   */
  stop() {
    if (this._graceTimer !== null) {
      this._clearTimeout(this._graceTimer);
      this._graceTimer = null;
    }
    this.activeCount = 0;
    this.nextTime = 0;
    if (this.playing) {
      this.playing = false;
      this._onEnd();
    }
  }

  /**
   * Reset the scheduling timeline without stopping.
   * Used when switching to a new response stream.
   */
  reset() {
    this.nextTime = 0;
  }
}
