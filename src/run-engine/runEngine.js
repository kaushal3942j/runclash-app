/**
 * RunClash 2.0 — Run Engine Core
 * Canonical lifecycle state machine, GPS fix dispatcher, and event emitter.
 */

import { RUN_ENGINE_CONFIG } from './runEngineConfig.js';
import { getDistanceInMeters, calculateSpeedKmh } from './gpsMath.js';
import { classifyWaitingBuffer, classifyTrackingWindow } from './motionClassifier.js';
import { RunMetricsManager } from './runMetrics.js';

export class RunEngine {
  constructor() {
    this.state = 'idle'; // 'idle' | 'acquiring' | 'waiting' | 'tracking' | 'paused' | 'finalizing'
    this.metrics = new RunMetricsManager();
    this.listeners = new Set();

    // Internal engine state refs
    this.watchId = null;
    this.waitingBuffer = [];
    this.waitingBaseline = null;
    this.activeMovementWindow = [];
    this.lastPoint = null;
    this.lastMovementTimestamp = null;
    this.pauseAnchorPoint = null;
    this.resumeCandidatesCount = 0;
    this.frozenSnapshot = null;

    // Allowed transition map
    this.ALLOWED_TRANSITIONS = {
      idle: ['acquiring'],
      acquiring: ['waiting', 'idle'],
      waiting: ['tracking', 'idle'],
      tracking: ['paused', 'finalizing', 'idle'],
      paused: ['tracking', 'finalizing', 'idle'],
      finalizing: ['idle']
    };
  }

  /**
   * Subscribe to engine state/metrics updates.
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notifyListeners(eventType, payload = {}) {
    const data = {
      engineState: this.state,
      metrics: this.getMetricsSnapshot(),
      ...payload
    };
    this.listeners.forEach(fn => {
      try {
        fn(eventType, data);
      } catch (err) {
        console.error('[RUN ENGINE LISTENER ERROR]', err);
      }
    });
  }

  /**
   * Canonical State Transition Manager.
   * Validates allowed transitions, initializes state data, and notifies listeners.
   */
  transitionTo(nextState, reason = '', timestamp = Date.now()) {
    if (this.state === nextState) return true;

    const allowed = this.ALLOWED_TRANSITIONS[this.state];
    if (!allowed || !allowed.includes(nextState)) {
      const errorMsg = `[RUN ENGINE ILLEGAL TRANSITION] Attempted invalid transition from '${this.state}' to '${nextState}'. Reason: ${reason}`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`[RUN ENGINE TRANSITION] '${this.state}' -> '${nextState}' | Reason: ${reason}`);
    const prevState = this.state;
    this.state = nextState;

    // Transition-specific setup & invariant enforcement
    switch (nextState) {
      case 'idle':
        this.clearGpsWatch();
        this.metrics.reset();
        this.waitingBuffer = [];
        this.waitingBaseline = null;
        this.activeMovementWindow = [];
        this.lastPoint = null;
        this.pauseAnchorPoint = null;
        this.resumeCandidatesCount = 0;
        this.frozenSnapshot = null;
        break;

      case 'acquiring':
        this.metrics.reset();
        this.waitingBuffer = [];
        this.waitingBaseline = null;
        break;

      case 'waiting':
        this.metrics.reset();
        this.waitingBuffer = [];
        this.activeMovementWindow = [];
        this.metrics.assertInvariants('waiting');
        break;

      case 'tracking':
        if (prevState === 'waiting') {
          this.metrics.reset();
          this.metrics.startTrackingSegment(timestamp);
          this.activeMovementWindow = [];
          this.lastMovementTimestamp = timestamp;
        } else if (prevState === 'paused') {
          this.metrics.startTrackingSegment(timestamp);
          this.activeMovementWindow = [];
          this.lastMovementTimestamp = timestamp;
          this.resumeCandidatesCount = 0;
          this.pauseAnchorPoint = null;
        }
        break;

      case 'paused':
        // Accumulate active tracking segment up to lastMovementTimestamp (excluding 15s auto-pause confirmation window)
        this.metrics.pauseTrackingSegment(this.lastMovementTimestamp || timestamp);
        this.metrics.freezeStationarySpeed();
        this.resumeCandidatesCount = 0;
        break;

      case 'finalizing':
        if (prevState === 'tracking') {
          this.metrics.pauseTrackingSegment(timestamp);
        }
        this.clearGpsWatch();
        this.frozenSnapshot = this.metrics.getSnapshot(timestamp);
        break;
    }

    this.notifyListeners('STATE_CHANGE', { prevState, nextState, reason });
    return true;
  }

  /**
   * Starts run session from UI (idle -> acquiring).
   */
  startSession() {
    if (this.state !== 'idle') {
      console.warn('[RUN ENGINE] Cannot start session from state:', this.state);
      return;
    }
    this.transitionTo('acquiring', 'User initiated start run');
  }

  /**
   * Cancels run session from UI.
   */
  cancelSession(reason = 'User cancelled') {
    if (this.state === 'idle') return;
    this.transitionTo('idle', reason);
  }

  /**
   * Finalizes run for Stop & Claim (tracking/paused -> finalizing).
   */
  finalizeSession(reason = 'Stop & Claim') {
    if (this.state !== 'tracking' && this.state !== 'paused') {
      console.warn('[RUN ENGINE] Cannot finalize session from state:', this.state);
      return null;
    }
    this.transitionTo('finalizing', reason);
    return this.frozenSnapshot;
  }

  /**
   * GPS WATCH MANAGEMENT: Ensures exactly ONE navigator.geolocation.watchPosition instance.
   */
  registerGpsWatch(geolocationProvider = navigator.geolocation) {
    if (this.watchId !== null) {
      console.warn('[GPS ENGINE] Watch already registered. ID:', this.watchId);
      return;
    }

    if (!geolocationProvider || !geolocationProvider.watchPosition) {
      console.warn('[GPS ENGINE] Geolocation provider unavailable');
      return;
    }

    console.log('[GPS WATCH REGISTERED]');
    this.watchId = geolocationProvider.watchPosition(
      (pos) => {
        this.handleRawGpsFix({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy || 15,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp || Date.now()
        });
      },
      (err) => {
        console.error('[GPS WATCH ERROR]', err);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  clearGpsWatch(geolocationProvider = navigator.geolocation) {
    if (this.watchId !== null) {
      console.log('[GPS WATCH CLEARED] ID:', this.watchId);
      if (geolocationProvider && geolocationProvider.clearWatch) {
        geolocationProvider.clearWatch(this.watchId);
      }
      this.watchId = null;
    }
  }

  /**
   * HARD STATE ISOLATION DISPATCHER
   * Processes each GPS fix strictly according to the canonical state.
   */
  handleRawGpsFix(fix) {
    const fixTime = fix.timestamp || Date.now();
    const wLat = fix.latitude;
    const wLng = fix.longitude;
    const wAccuracy = fix.accuracy || 15;
    const newPoint = [wLat, wLng];

    switch (this.state) {
      case 'acquiring':
        this._handleAcquiringFix(fix, newPoint, wAccuracy);
        return;

      case 'waiting':
        this._handleWaitingFix(fix, newPoint, wAccuracy, fixTime);
        return;

      case 'tracking':
        this._handleTrackingFix(fix, newPoint, wAccuracy, fixTime);
        return;

      case 'paused':
        this._handlePausedFix(fix, newPoint, wAccuracy, fixTime);
        return;

      case 'idle':
      case 'finalizing':
      default:
        // HARD ISOLATION: Zero distance mutation, zero state changes
        return;
    }
  }

  /**
   * STATE HANDLER: ACQUIRING
   */
  _handleAcquiringFix(fix, newPoint, wAccuracy) {
    const fixTime = fix.timestamp || Date.now();
    if (wAccuracy <= 40) {
      this.waitingBaseline = { lat: newPoint[0], lng: newPoint[1], accuracy: wAccuracy };
      this.lastPoint = newPoint;
      this.transitionTo('waiting', 'Initial usable GPS fix acquired', fixTime);
    }
  }

  /**
   * STATE HANDLER: WAITING_FOR_MOVEMENT
   * Strictly enforces: distance = 0, duration = 0, speed = 0, pace = '--:--'.
   */
  _handleWaitingFix(fix, newPoint, wAccuracy, fixTime) {
    // Maintain rolling 8-second waiting buffer
    this.waitingBuffer.push({
      lat: newPoint[0],
      lng: newPoint[1],
      accuracy: wAccuracy,
      timestamp: fixTime
    });
    this.waitingBuffer = this.waitingBuffer.filter(p => fixTime - p.timestamp <= RUN_ENGINE_CONFIG.WAITING_BUFFER_WINDOW_SEC * 1000);

    const classification = classifyWaitingBuffer(this.waitingBuffer, this.waitingBaseline);

    if (classification.isMoving) {
      // Physical movement confirmed: Transition to TRACKING
      // Confirming point becomes the clean official baseline!
      this.lastPoint = newPoint;
      this.transitionTo('tracking', classification.armReason, fixTime);
      this.notifyListeners('FIX_PROCESSED', { decision: 'WAITING_ARMED', classification });
      return; // Return immediately; NEXT fix accumulates distance
    }

    this.notifyListeners('FIX_PROCESSED', { decision: 'WAITING_HELD', classification });
  }

  /**
   * STATE HANDLER: TRACKING
   * Executes motion classifier and monotonic distance commitment ONLY for MOVING fixes.
   */
  _handleTrackingFix(fix, newPoint, wAccuracy, fixTime) {
    // INVARIANT A: State MUST be tracking
    if (this.state !== 'tracking') {
      console.error('[HARD ERROR] Tracking fix processed outside tracking state');
      return;
    }

    const prevPoint = this.lastPoint || newPoint;
    const stepMeters = getDistanceInMeters(prevPoint[0], prevPoint[1], newPoint[0], newPoint[1]);
    const dtSeconds = (fixTime - (this.lastMovementTimestamp || fixTime)) / 1000;
    const segmentSpeedKmh = calculateSpeedKmh(stepMeters, Math.max(1, dtSeconds));

    // Teleport & Speed Spike Filter (TEST 8)
    if (stepMeters > RUN_ENGINE_CONFIG.TRACKING_MAX_STEP_METERS || segmentSpeedKmh > RUN_ENGINE_CONFIG.TRACKING_MAX_SPEED_KMH) {
      console.warn('[GPS TELEPORT REJECTED]', { stepMeters, segmentSpeedKmh });
      this.metrics.rejectedFixesCount++;
      this.notifyListeners('FIX_PROCESSED', { decision: 'TELEPORT_REJECTED', stepMeters });
      return;
    }

    // Maintain 8-second active movement window
    const coordsSpeedKmh = (fix.speed !== null && fix.speed !== undefined && !isNaN(fix.speed) && fix.speed >= 0)
      ? fix.speed * 3.6
      : null;

    this.activeMovementWindow.push({
      lat: newPoint[0],
      lng: newPoint[1],
      accuracy: wAccuracy,
      stepMeters,
      segmentSpeedKmh,
      coordsSpeedKmh,
      timestamp: fixTime
    });
    this.activeMovementWindow = this.activeMovementWindow.filter(p => fixTime - p.timestamp <= RUN_ENGINE_CONFIG.TRACKING_WINDOW_SEC * 1000);

    // Run Tracking Motion Classifier (PART 7)
    const motion = classifyTrackingWindow(this.activeMovementWindow, coordsSpeedKmh, wAccuracy);

    if (motion.classification === 'MOVING') {
      // Distance write protection: MOVING && stepMeters >= 0.8m && accuracy <= 25m
      if (stepMeters >= RUN_ENGINE_CONFIG.TRACKING_MIN_STEP_METERS && wAccuracy <= RUN_ENGINE_CONFIG.GPS_ACCURACY_THRESHOLD) {
        this.lastMovementTimestamp = fixTime; // Reset stationary timer ONLY on accepted moving step
        this.metrics.commitMovingStep(stepMeters, newPoint, segmentSpeedKmh, fixTime);
        this.lastPoint = newPoint;
        this.notifyListeners('FIX_PROCESSED', { decision: 'DISTANCE_ACCEPTED', stepMeters, motion });
      } else {
        this.notifyListeners('FIX_PROCESSED', { decision: 'MOVING_MICRO_STEP_HELD', stepMeters, motion });
      }
    } else {
      // STATIONARY OR UNCERTAIN: Official distance is 100% frozen
      if (motion.classification === 'STATIONARY') {
        this.metrics.freezeStationarySpeed();
      }

      const stationarySeconds = (fixTime - (this.lastMovementTimestamp || fixTime)) / 1000;

      // Auto-Pause Check: Stationary for >= 15 seconds (PART 10)
      if (motion.classification === 'STATIONARY' && stationarySeconds >= RUN_ENGINE_CONFIG.AUTO_PAUSE_STATIONARY_TIMEOUT_SEC) {
        this.pauseAnchorPoint = newPoint;
        this.transitionTo('paused', `Stationary timeout confirmed (${stationarySeconds.toFixed(1)}s)`, fixTime);
        return;
      }

      this.notifyListeners('FIX_PROCESSED', { decision: motion.classification === 'STATIONARY' ? 'STATIONARY_FROZEN' : 'UNCERTAIN_HELD', motion });
    }
  }

  /**
   * STATE HANDLER: PAUSED
   * Checks resume criteria against pause anchor. Distance & duration remain strictly frozen.
   */
  _handlePausedFix(fix, newPoint, wAccuracy, fixTime) {
    if (wAccuracy > RUN_ENGINE_CONFIG.GPS_ACCURACY_THRESHOLD) {
      return; // Ignore poor accuracy fixes while paused
    }

    const anchor = this.pauseAnchorPoint || newPoint;
    const distFromAnchor = getDistanceInMeters(anchor[0], anchor[1], newPoint[0], newPoint[1]);
    const coordsSpeedKmh = (fix.speed !== null && fix.speed !== undefined && !isNaN(fix.speed) && fix.speed >= 0)
      ? fix.speed * 3.6
      : null;

    const isMovingResume =
      (distFromAnchor >= RUN_ENGINE_CONFIG.RESUME_MIN_DISPLACEMENT) ||
      (coordsSpeedKmh !== null && coordsSpeedKmh >= RUN_ENGINE_CONFIG.RESUME_MIN_SPEED_KMH);

    if (isMovingResume) {
      this.resumeCandidatesCount++;
      if (this.resumeCandidatesCount >= RUN_ENGINE_CONFIG.RESUME_CANDIDATE_COUNT || distFromAnchor >= 4.5) {
        // RESUME CONFIRMED: Transition to TRACKING
        // Crucial: Set new location as official segment baseline. NO pause anchor jump distance!
        this.lastPoint = newPoint;
        this.transitionTo('tracking', 'Motion resumed from pause', fixTime);
      }
    } else {
      this.resumeCandidatesCount = 0;
    }
  }

  /**
   * Returns current canonical metrics snapshot.
   */
  getMetricsSnapshot(nowTimeMs = Date.now()) {
    if (this.state === 'finalizing' && this.frozenSnapshot) {
      return { ...this.frozenSnapshot };
    }
    const snap = this.metrics.getSnapshot(nowTimeMs);
    if (this.state === 'waiting' || this.state === 'acquiring' || this.state === 'idle') {
      snap.distance = 0;
      snap.duration = 0;
      snap.speed = 0;
      snap.pace = '--:--';
      snap.path = [];
    } else if (this.state === 'paused') {
      snap.speed = 0;
    }
    return snap;
  }
}

// Global Singleton Instance
export const runEngine = new RunEngine();
