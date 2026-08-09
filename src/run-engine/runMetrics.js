/**
 * RunClash 2.0 — Run Metrics Manager
 * Single authoritative owner of official distance, active duration, official path,
 * live speed, and live pace. Enforces distance & duration monotonicity invariants.
 * Formats all UI metrics to clean, human-readable numbers at the snapshot boundary.
 */

import { calculateConsistentRunStats } from './gpsMath.js';

export class RunMetricsManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.officialDistanceKm = 0.0;
    this.officialPath = [];
    this.lastPoint = null;
    this.activeDurationAccumulated = 0;
    this.trackingSegmentStart = null;
    this.liveSpeedKmh = 0.0;
    this.livePace = '--:--';
    this.speedHistory = [];
    this.acceptedFixesCount = 0;
    this.rejectedFixesCount = 0;
  }

  /**
   * INVARIANT D & E ENFORCEMENT & DISTANCE MUTATION AUTHORITY
   * Official distance is written ONLY via this method during TRACKING + MOVING.
   */
  commitMovingStep(stepMeters, point, segmentSpeedKmh, nowTime) {
    if (stepMeters <= 0) return false;

    const stepKm = stepMeters / 1000;
    const newDistanceKm = this.officialDistanceKm + stepKm;

    // INVARIANT D: Distance MUST be monotonic.
    if (newDistanceKm < this.officialDistanceKm) {
      console.error('[RUN ENGINE INVARIANT VIOLATION: DISTANCE REGRESSION]', {
        previous: this.officialDistanceKm,
        attempted: newDistanceKm
      });
      throw new Error('[RUN ENGINE INVARIANT VIOLATION: DISTANCE REGRESSION]');
    }

    this.officialDistanceKm = newDistanceKm;
    this.officialPath.push(point);
    this.lastPoint = point;

    // Live speed calculation with rolling speed history for smooth responsive UI
    this.speedHistory.push({ speed: segmentSpeedKmh, time: nowTime });
    if (this.speedHistory.length > 5) this.speedHistory.shift();

    const avgSpeed = this.speedHistory.reduce((a, b) => a + b.speed, 0) / this.speedHistory.length;
    this.liveSpeedKmh = Number(avgSpeed.toFixed(1));

    const currentDuration = this.getDurationSeconds(nowTime);
    const stats = calculateConsistentRunStats(this.officialDistanceKm, currentDuration);
    this.livePace = stats.formattedPace;
    this.acceptedFixesCount++;

    return true;
  }

  /**
   * Freezes live speed to 0 and pace to '--:--' when confirmed STATIONARY.
   * Official distance remains strictly frozen.
   */
  freezeStationarySpeed() {
    this.liveSpeedKmh = 0.0;
    this.livePace = '--:--';
    this.speedHistory = [];
  }

  /**
   * Starts a new active tracking segment.
   */
  startTrackingSegment(startTimeMs = Date.now()) {
    this.trackingSegmentStart = startTimeMs;
  }

  /**
   * Pauses current active tracking segment and accumulates elapsed seconds.
   */
  pauseTrackingSegment(nowTimeMs = Date.now()) {
    if (this.trackingSegmentStart) {
      const elapsed = Math.max(0, Math.floor((nowTimeMs - this.trackingSegmentStart) / 1000));
      const prevAccumulated = this.activeDurationAccumulated;
      this.activeDurationAccumulated += elapsed;

      // INVARIANT E: Active duration MUST be monotonic.
      if (this.activeDurationAccumulated < prevAccumulated) {
        console.error('[RUN ENGINE INVARIANT VIOLATION: DURATION REGRESSION]', {
          previous: prevAccumulated,
          attempted: this.activeDurationAccumulated
        });
        throw new Error('[RUN ENGINE INVARIANT VIOLATION: DURATION REGRESSION]');
      }

      this.trackingSegmentStart = null;
    }
  }

  /**
   * Calculates total active duration in seconds (accumulated + current segment if active).
   * EXCLUDES waiting time, acquisition time, and paused time.
   */
  getDurationSeconds(nowTimeMs = Date.now()) {
    let currentSegment = 0;
    if (this.trackingSegmentStart) {
      currentSegment = Math.max(0, Math.floor((nowTimeMs - this.trackingSegmentStart) / 1000));
    }
    return this.activeDurationAccumulated + currentSegment;
  }

  /**
   * Generates an immutable snapshot of metrics for UI display or Stop & Claim finalization.
   * Formats all visible metrics to clean, human-readable numbers at the snapshot boundary.
   */
  getSnapshot(nowTimeMs = Date.now()) {
    const durationSec = this.getDurationSeconds(nowTimeMs);
    const stats = calculateConsistentRunStats(this.officialDistanceKm, durationSec);

    return {
      distance: Number(this.officialDistanceKm.toFixed(3)),
      duration: durationSec,
      speed: Number((this.liveSpeedKmh || 0).toFixed(1)),
      pace: this.livePace || '--:--',
      avgSpeed: Number((stats.averageSpeedKmh || 0).toFixed(1)),
      avgPace: stats.formattedPace || '--:--',
      path: [...this.officialPath],
      lastPoint: this.lastPoint ? [...this.lastPoint] : null,
      acceptedFixesCount: this.acceptedFixesCount,
      rejectedFixesCount: this.rejectedFixesCount
    };
  }

  /**
   * Verifies runtime invariants against current state.
   */
  assertInvariants(engineState) {
    if (engineState === 'waiting') {
      if (this.officialDistanceKm !== 0) throw new Error('[INVARIANT B VIOLATION] Distance > 0 in WAITING state');
      if (this.getDurationSeconds() !== 0) throw new Error('[INVARIANT B VIOLATION] Duration > 0 in WAITING state');
      if (this.officialPath.length !== 0) throw new Error('[INVARIANT B VIOLATION] Path not empty in WAITING state');
    }
  }
}
