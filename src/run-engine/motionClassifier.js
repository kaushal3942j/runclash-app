/**
 * RunClash 2.0 — Consensus Motion Classifier
 * Robust time-window classification designed for real mobile hardware.
 * Handles Android coords.speed=0 unreliability, tight terrace curves, and stationary drift protection.
 */

import { RUN_ENGINE_CONFIG } from './runEngineConfig.js';
import { getDistanceInMeters, calculateDirectionEfficiency, calculateMedian } from './gpsMath.js';

/**
 * Classifies buffer of GPS fixes in WAITING_FOR_MOVEMENT state.
 * Evaluates whether physical movement has comfortably begun.
 * 
 * @param {Array} buffer Array of fix objects { lat, lng, accuracy, timestamp }
 * @param {Object} baseline Base position fix { lat, lng }
 * @returns {Object} { isMoving: boolean, armReason: string, windowStats: object }
 */
export function classifyWaitingBuffer(buffer, baseline) {
  if (!buffer || buffer.length < RUN_ENGINE_CONFIG.WAITING_MIN_POINTS || !baseline) {
    return { isMoving: false, armReason: 'Insufficient points', windowStats: null };
  }

  const latestFix = buffer[buffer.length - 1];
  const oldestFix = buffer[0];
  const windowSeconds = (latestFix.timestamp - oldestFix.timestamp) / 1000;

  let totalPathMeters = 0;
  const speeds = [];
  for (let i = 1; i < buffer.length; i++) {
    const dM = getDistanceInMeters(buffer[i - 1].lat, buffer[i - 1].lng, buffer[i].lat, buffer[i].lng);
    totalPathMeters += dM;
    const dtS = (buffer[i].timestamp - buffer[i - 1].timestamp) / 1000;
    if (dtS > 0) {
      speeds.push((dM / dtS) * 3.6);
    }
  }

  const netDisplacementMeters = getDistanceInMeters(oldestFix.lat, oldestFix.lng, latestFix.lat, latestFix.lng);
  const distFromBaselineMeters = getDistanceInMeters(baseline.lat, baseline.lng, latestFix.lat, latestFix.lng);
  const directionEfficiency = calculateDirectionEfficiency(netDisplacementMeters, totalPathMeters);
  const medianSpeedKmh = calculateMedian(speeds);

  const windowStats = {
    windowSeconds,
    totalPathMeters,
    netDisplacementMeters,
    distFromBaselineMeters,
    directionEfficiency,
    medianSpeedKmh,
    accuracy: latestFix.accuracy
  };

  // Primary Pass: Sustained coherent motion over rolling window
  const primaryPass =
    netDisplacementMeters >= RUN_ENGINE_CONFIG.WAITING_MIN_NET_DISPLACEMENT &&
    totalPathMeters >= RUN_ENGINE_CONFIG.WAITING_MIN_PATH_METERS &&
    directionEfficiency >= RUN_ENGINE_CONFIG.WAITING_MIN_EFFICIENCY &&
    medianSpeedKmh >= RUN_ENGINE_CONFIG.WAITING_MIN_SPEED_KMH &&
    distFromBaselineMeters >= 4.5;

  if (primaryPass) {
    return { isMoving: true, armReason: 'Primary multi-point motion window confirmed', windowStats };
  }

  // Fallback Pass: Rapid linear departure from baseline
  const fallbackPass =
    distFromBaselineMeters >= RUN_ENGINE_CONFIG.WAITING_FALLBACK_DISPLACEMENT &&
    directionEfficiency >= 0.50;

  if (fallbackPass) {
    return { isMoving: true, armReason: 'Fallback rapid baseline departure confirmed', windowStats };
  }

  return { isMoving: false, armReason: 'Stationary / Jitter', windowStats };
}

/**
 * Classifies rolling window of GPS fixes in TRACKING state using Consensus Logic.
 * Solves real device Android coords.speed=0 unreliability and tight terrace curves.
 * 
 * @param {Array} activeWindow Array of fix objects { lat, lng, accuracy, stepMeters, segmentSpeedKmh, coordsSpeedKmh, timestamp }
 * @param {number|null} latestCoordsSpeed Device coords.speed in km/h or null
 * @param {number} wAccuracy Current fix accuracy in meters
 * @returns {Object} { classification: 'MOVING'|'UNCERTAIN'|'STATIONARY', windowNetDisplacement, windowPathMeters, medianSpeed, directionEfficiency }
 */
export function classifyTrackingWindow(activeWindow, latestCoordsSpeed, wAccuracy) {
  if (!activeWindow || activeWindow.length < 2) {
    return {
      classification: 'UNCERTAIN',
      windowNetDisplacement: 0,
      windowPathMeters: 0,
      medianSpeed: 0,
      directionEfficiency: 0
    };
  }

  const oldest = activeWindow[0];
  const latest = activeWindow[activeWindow.length - 1];
  const windowNetDisplacement = getDistanceInMeters(oldest.lat, oldest.lng, latest.lat, latest.lng);

  let windowPathMeters = 0;
  const speeds = [];
  for (let i = 1; i < activeWindow.length; i++) {
    const dM = getDistanceInMeters(activeWindow[i - 1].lat, activeWindow[i - 1].lng, activeWindow[i].lat, activeWindow[i].lng);
    windowPathMeters += dM;
    const dtS = (activeWindow[i].timestamp - activeWindow[i - 1].timestamp) / 1000;
    if (dtS > 0) {
      speeds.push((dM / dtS) * 3.6);
    }
  }

  const medianSpeed = calculateMedian(speeds);
  const directionEfficiency = calculateDirectionEfficiency(windowNetDisplacement, windowPathMeters);

  // Calculate median speed over last 3 fixes (current fix trend vs 8s history)
  let recent3MedianSpeed = medianSpeed;
  if (activeWindow.length >= 3) {
    const recent3 = activeWindow.slice(-3);
    const rSpeeds = [];
    for (let i = 1; i < recent3.length; i++) {
      const dM = getDistanceInMeters(recent3[i - 1].lat, recent3[i - 1].lng, recent3[i].lat, recent3[i].lng);
      const dtS = (recent3[i].timestamp - recent3[i - 1].timestamp) / 1000;
      if (dtS > 0) rSpeeds.push((dM / dtS) * 3.6);
    }
    recent3MedianSpeed = calculateMedian(rSpeeds);
  }

  // ==============================================================
  // PART 5 — STATIONARY STRONG CONSENSUS RULE
  // ==============================================================
  // STATIONARY requires CONSENSUS across parameters.
  // If recent 3 fixes show median speed < 0.6 km/h OR window net < 1.5m and path < 2.0m
  const isRecentSlow = (activeWindow.length >= 3 && recent3MedianSpeed < 0.6);
  const isLowNet = windowNetDisplacement < 1.5;
  const isLowPath = windowPathMeters < 2.0;
  const isLowMedianSpeed = medianSpeed < 0.8;
  const isGoodAccuracy = wAccuracy <= RUN_ENGINE_CONFIG.GPS_STATIONARY_ACCURACY;

  const isStationaryConsensus = (isRecentSlow || (isLowNet && isLowPath && isLowMedianSpeed)) && isGoodAccuracy;

  if (isStationaryConsensus) {
    return {
      classification: 'STATIONARY',
      windowNetDisplacement,
      windowPathMeters,
      medianSpeed,
      directionEfficiency
    };
  }

  // ==============================================================
  // PART 6 — MOVING STRONG CONSENSUS RULE
  // ==============================================================
  // Supports slow terrace walking and tight curved turns while rejecting back-and-forth jitter.
  // 1. Path Evidence: Accumulated path length >= 2.5m AND net displacement >= 1.5m AND median speed >= 0.7 km/h
  const pathEvidence = (windowPathMeters >= 2.5) && (windowNetDisplacement >= 1.5) && (medianSpeed >= 0.7);

  // 2. Net Displacement Evidence: Net displacement >= 1.8m AND directionEfficiency >= 0.25 AND median speed >= 0.7 km/h
  const displacementEvidence = (windowNetDisplacement >= 1.8) && (directionEfficiency >= 0.25) && (medianSpeed >= 0.7);

  // 3. Hardware Speed Evidence (if reliable): coords.speed >= 1.0 km/h AND windowPathMeters >= 1.5m
  const coordsSpeedEvidence = (latestCoordsSpeed !== null && latestCoordsSpeed >= 1.0) && (windowPathMeters >= 1.5);

  const isMovingConsensus = pathEvidence || displacementEvidence || coordsSpeedEvidence;

  if (isMovingConsensus) {
    return {
      classification: 'MOVING',
      windowNetDisplacement,
      windowPathMeters,
      medianSpeed,
      directionEfficiency
    };
  }

  // Weak or conflicting evidence (e.g. noisy jitter without consensus) -> UNCERTAIN
  // UNCERTAIN freezes official distance, does NOT advance stationary timeout, and does NOT trigger pause.
  return {
    classification: 'UNCERTAIN',
    windowNetDisplacement,
    windowPathMeters,
    medianSpeed,
    directionEfficiency
  };
}
