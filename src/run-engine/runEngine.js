/**
 * RunClash 2.0 — Run Engine Core
 * Canonical lifecycle state machine, GPS fix dispatcher, and event emitter.
 * Includes Stationary Anchor Protection, Consensus Resume, Trace Recording, and Atomic UI Synchronization.
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
    this.pausedCandidateWindow = [];
    this.lastPoint = null;
    this.lastMovementTimestamp = null;
    this.stationarySince = null;
    this.pauseAnchorPoint = null;
    this.stationaryAnchorPoint = null;
    this.resumeCandidatesCount = 0;
    this.frozenSnapshot = null;
    this.fullGpsTraceBuffer = [];

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
        this.pausedCandidateWindow = [];
        this.lastPoint = null;
        this.stationarySince = null;
        this.pauseAnchorPoint = null;
        this.stationaryAnchorPoint = null;
        this.resumeCandidatesCount = 0;
        this.frozenSnapshot = null;
        break;

      case 'acquiring':
        this.metrics.reset();
        this.waitingBuffer = [];
        this.waitingBaseline = null;
        this.stationarySince = null;
        break;

      case 'waiting':
        this.metrics.reset();
        this.waitingBuffer = [];
        this.activeMovementWindow = [];
        this.pausedCandidateWindow = [];
        this.stationarySince = null;
        this.metrics.assertInvariants('waiting');
        break;

      case 'tracking':
        if (prevState === 'waiting') {
          this.metrics.reset();
          this.metrics.startTrackingSegment(timestamp);
          this.activeMovementWindow = [];
          this.pausedCandidateWindow = [];
          this.lastMovementTimestamp = timestamp;
          this.stationarySince = null;
          this.stationaryAnchorPoint = null;
        } else if (prevState === 'paused') {
          this.metrics.startTrackingSegment(timestamp);
          this.activeMovementWindow = [];
          this.pausedCandidateWindow = [];
          this.lastMovementTimestamp = timestamp;
          this.stationarySince = null;
          this.resumeCandidatesCount = 0;
          this.pauseAnchorPoint = null;
          this.stationaryAnchorPoint = null;
        }
        break;

      case 'paused':
        // Accumulate active tracking segment up to lastMovementTimestamp (excluding 15s auto-pause confirmation window)
        this.metrics.pauseTrackingSegment(this.stationarySince || this.lastMovementTimestamp || timestamp);
        this.metrics.freezeStationarySpeed();
        this.pausedCandidateWindow = [];
        this.stationarySince = null;
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

    // ATOMIC UI MIRRORING: Notify listeners immediately on state change
    this.notifyListeners('STATE_CHANGE', { prevState, nextState, reason, timestamp });
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

    // Trace buffer recording (PART 1)
    this.fullGpsTraceBuffer.push({
      timestamp: fixTime,
      engineState: this.state,
      lat: wLat,
      lng: wLng,
      accuracy: wAccuracy,
      speed: fix.speed
    });
    if (this.fullGpsTraceBuffer.length > 500) this.fullGpsTraceBuffer.shift();

    switch (this.state) {
      case 'acquiring':
        this._handleAcquiringFix(fix, newPoint, wAccuracy, fixTime);
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
  _handleAcquiringFix(fix, newPoint, wAccuracy, fixTime) {
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
      this.lastPoint = newPoint;
      this.transitionTo('tracking', classification.armReason, fixTime);
      this.notifyListeners('FIX_PROCESSED', { decision: 'WAITING_ARMED', classification });
      return;
    }

    this.notifyListeners('FIX_PROCESSED', { decision: 'WAITING_HELD', classification });
  }

  /**
   * STATE HANDLER: TRACKING
   * Executes motion classifier and monotonic distance commitment ONLY for MOVING fixes.
   * Manages stationary anchor protection and stationarySince countdown timer with hysteresis.
   */
  _handleTrackingFix(fix, newPoint, wAccuracy, fixTime) {
    if (this.state !== 'tracking') {
      console.error('[HARD ERROR] Tracking fix processed outside tracking state');
      return;
    }

    const prevPoint = this.lastPoint || newPoint;
    const stepMeters = getDistanceInMeters(prevPoint[0], prevPoint[1], newPoint[0], newPoint[1]);
    const dtSeconds = (fixTime - (this.lastMovementTimestamp || fixTime)) / 1000;
    const segmentSpeedKmh = calculateSpeedKmh(stepMeters, Math.max(0.5, dtSeconds));

    // Teleport & Speed Spike Filter (TEST 8)
    if (stepMeters > RUN_ENGINE_CONFIG.TRACKING_MAX_STEP_METERS || segmentSpeedKmh > RUN_ENGINE_CONFIG.TRACKING_MAX_SPEED_KMH) {
      console.warn('[GPS TELEPORT REJECTED]', { stepMeters, segmentSpeedKmh });
      this.metrics.rejectedFixesCount++;
      this.notifyListeners('FIX_PROCESSED', { decision: 'TELEPORT_REJECTED', stepMeters });
      return;
    }

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

    // ACTIVE WINDOW STALE-WALK CHECK (SECTION 6):
    // When device speed is 0 or step is stationary, prune old walking points older than 3s
    const activeMaxAge = (coordsSpeedKmh === 0 || stepMeters < 0.3) ? 3000 : RUN_ENGINE_CONFIG.TRACKING_WINDOW_SEC * 1000;
    this.activeMovementWindow = this.activeMovementWindow.filter(p => fixTime - p.timestamp <= RUN_ENGINE_CONFIG.TRACKING_WINDOW_SEC * 1000);

    // 1. Run Tracking Consensus Motion Classifier (PART 5 & PART 6)
    const motion = classifyTrackingWindow(this.activeMovementWindow, coordsSpeedKmh, wAccuracy);

    // 2. STATIONARY ANCHOR PROTECTION OVERRIDE FIRST
    if (motion.classification === 'STATIONARY') {
      if (!this.stationaryAnchorPoint) {
        this.stationaryAnchorPoint = prevPoint;
        this.stationaryDepartCount = 0;
      }
    }

    if (this.stationaryAnchorPoint) {
      const distFromStationaryAnchor = getDistanceInMeters(this.stationaryAnchorPoint[0], this.stationaryAnchorPoint[1], newPoint[0], newPoint[1]);
      if (distFromStationaryAnchor <= 3.5) {
        this.stationaryDepartCount = 0;
        motion.classification = 'STATIONARY';
      } else {
        this.stationaryDepartCount = (this.stationaryDepartCount || 0) + 1;
        if (this.stationaryDepartCount >= 2 || (coordsSpeedKmh !== null && coordsSpeedKmh >= 1.5)) {
          this.stationaryAnchorPoint = null;
          this.stationaryDepartCount = 0;
        } else {
          motion.classification = 'STATIONARY';
        }
      }
    }

    // 3. STATIONARY TIMER & HYSTERESIS OWNERSHIP (SECTION 4 & 5)
    const isStationaryCandidate =
      motion.classification === 'STATIONARY' ||
      (motion.classification === 'UNCERTAIN' && motion.windowNetDisplacement < 1.5);

    if (isStationaryCandidate) {
      if (this.stationarySince === null) {
        this.stationarySince = fixTime;
      }
      this.metrics.freezeStationarySpeed();
    } else if (motion.classification === 'MOVING') {
      if (!this.stationaryAnchorPoint) {
        this.stationarySince = null;
        this.lastMovementTimestamp = fixTime;
      }
    }

    if (motion.classification === 'MOVING') {
      // Distance write protection: MOVING && stepMeters >= 0.5m && accuracy <= 25m
      if (stepMeters >= 0.5 && wAccuracy <= RUN_ENGINE_CONFIG.GPS_ACCURACY_THRESHOLD) {
        this.metrics.commitMovingStep(stepMeters, newPoint, segmentSpeedKmh, fixTime);
        this.lastPoint = newPoint;
        this.notifyListeners('FIX_PROCESSED', { decision: 'DISTANCE_ACCEPTED', stepMeters, motion });
      } else {
        this.notifyListeners('FIX_PROCESSED', { decision: 'MOVING_MICRO_STEP_HELD', stepMeters, motion });
      }
    } else {
      // STATIONARY OR UNCERTAIN: Official distance is 100% frozen
      const stationarySeconds = this.stationarySince ? (fixTime - this.stationarySince) / 1000 : 0;

      // Auto-Pause Check: Sustained stationary for >= 15 seconds (SECTION 4 & 5)
      if (
        this.stationarySince !== null &&
        stationarySeconds >= RUN_ENGINE_CONFIG.AUTO_PAUSE_STATIONARY_TIMEOUT_SEC &&
        motion.classification !== 'MOVING'
      ) {
        this.pauseAnchorPoint = newPoint;
        const confirmSec = stationarySeconds.toFixed(1);
        this.stationarySince = null;
        this.transitionTo('paused', `Stationary timeout confirmed (${confirmSec}s)`, fixTime);
        return;
      }

      this.notifyListeners('FIX_PROCESSED', { decision: motion.classification === 'STATIONARY' ? 'STATIONARY_FROZEN' : 'UNCERTAIN_HELD', motion });
    }
  }

  /**
   * STATE HANDLER: PAUSED
   * Checks resume criteria using Progressive Translation Consensus (PART 7).
   * Distance & duration remain strictly frozen. Stationary drift excursions CANNOT trigger resume.
   */
  _handlePausedFix(fix, newPoint, wAccuracy, fixTime) {
    console.log('[PAUSED FIX RECEIVED]', { lat: newPoint[0], lng: newPoint[1], accuracy: wAccuracy, fixTime });

    if (wAccuracy > RUN_ENGINE_CONFIG.GPS_ACCURACY_THRESHOLD) {
      return; // Ignore poor accuracy fixes while paused
    }

    const anchor = this.pauseAnchorPoint || newPoint;
    const distFromAnchor = getDistanceInMeters(anchor[0], anchor[1], newPoint[0], newPoint[1]);

    if (!this.pausedCandidateWindow) {
      this.pausedCandidateWindow = [];
    }

    // Check if current fix shows progressive departure away from pause anchor relative to previous candidate fix
    let isProgressiveDeparture = true;
    if (this.pausedCandidateWindow.length > 0) {
      const prevCand = this.pausedCandidateWindow[this.pausedCandidateWindow.length - 1];
      const prevDistFromAnchor = getDistanceInMeters(anchor[0], anchor[1], prevCand.lat, prevCand.lng);
      if (distFromAnchor < prevDistFromAnchor - 0.5) {
        isProgressiveDeparture = false;
      }
    }

    if (distFromAnchor >= 2.0 && isProgressiveDeparture) {
      this.pausedCandidateWindow.push({
        lat: newPoint[0],
        lng: newPoint[1],
        distFromAnchor,
        timestamp: fixTime
      });

      console.log('[PAUSED RESUME CANDIDATE]', {
        candidateCount: this.pausedCandidateWindow.length,
        distFromAnchor: distFromAnchor.toFixed(1)
      });

      const oldestCand = this.pausedCandidateWindow[0];
      const newestCand = this.pausedCandidateWindow[this.pausedCandidateWindow.length - 1];
      const windowTimeSec = (newestCand.timestamp - oldestCand.timestamp) / 1000;
      const netCandDisplacement = getDistanceInMeters(oldestCand.lat, oldestCand.lng, newestCand.lat, newestCand.lng);
      const candSpeedKmh = windowTimeSec > 0 ? (netCandDisplacement / windowTimeSec) * 3.6 : 0;
      const distProgressed = newestCand.distFromAnchor - oldestCand.distFromAnchor;

      // PAUSED RESUME CONSENSUS REQUIREMENT (PART 7):
      // 1. At least 3 candidate fixes spanning >= 3.0 seconds
      // 2. Progressive distance away from pause anchor >= 2.5m (rejects back-and-forth jitter around 4m)
      // 3. Final net displacement from pause anchor >= 4.5m
      // 4. Candidate speed is human walking/running speed (>= 0.8 km/h and <= 14.0 km/h)
      const hasMinTime = windowTimeSec >= 3.0;
      const hasMinPoints = this.pausedCandidateWindow.length >= 3;
      const hasProgression = distProgressed >= RUN_ENGINE_CONFIG.RESUME_MIN_PROGRESSION;
      const hasMinDisplacement = newestCand.distFromAnchor >= RUN_ENGINE_CONFIG.RESUME_MIN_DISPLACEMENT;
      const hasValidSpeed = candSpeedKmh >= 0.8 && candSpeedKmh <= RUN_ENGINE_CONFIG.RESUME_MAX_SPEED_KMH;

      if (hasMinPoints && hasMinTime && hasProgression && hasMinDisplacement && hasValidSpeed) {
        console.log('[PAUSED RESUME CONFIRMED]', { candidates: this.pausedCandidateWindow.length, speedKmh: candSpeedKmh.toFixed(1) });
        // RESUME CONFIRMED: Transition to TRACKING
        this.lastPoint = newPoint;
        this.pausedCandidateWindow = [];
        this.resumeCandidatesCount = 0;
        this.transitionTo('tracking', 'Consensus progressive motion resumed from pause', fixTime);
      }
    } else {
      // Single drift excursion back towards anchor INSTANTLY RESETS candidates!
      this.pausedCandidateWindow = [];
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
      snap.distance = 0.0;
      snap.duration = 0;
      snap.speed = 0.0;
      snap.pace = '--:--';
      snap.path = [];
    } else if (this.state === 'paused') {
      snap.speed = 0.0;
    }
    return snap;
  }

  /**
   * Exports full recorded trace buffer for real-device reproduction tests (PART 1).
   */
  exportGpsTraceJson() {
    return JSON.stringify(this.fullGpsTraceBuffer, null, 2);
  }
}

// Global Singleton Instance
export const runEngine = new RunEngine();
