/**
 * RunClash 2.0 — Motion Classifier
 * Pure evaluation logic for WAITING and TRACKING motion states using rolling time windows.
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

  // Primary Pass: Sustained coherent motion over 8s window
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
 * Classifies rolling window of GPS fixes in TRACKING state.
 * Evaluates whether movement is MOVING, UNCERTAIN, or STATIONARY.
 * 
 * @param {Array} activeWindow Array of fix objects { lat, lng, accuracy, stepMeters, segmentSpeedKmh, coordsSpeedKmh, timestamp }
 * @param {number|null} latestCoordsSpeed Device coords.speed in km/h or null
 * @param {number} wAccuracy Current fix accuracy in meters
 * @returns {Object} { classification: 'MOVING'|'UNCERTAIN'|'STATIONARY', windowNetDisplacement, windowPathMeters, medianSpeed, directionEfficiency }
 */
export function classifyTrackingWindow(activeWindow, latestCoordsSpeed, wAccuracy) {
  if (!activeWindow || activeWindow.length < 2) {
    // Single fix without history is treated as UNCERTAIN until window establishes
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

  // Recent 3-fix displacement (current motion check vs 8s window history)
  let recent3Displacement = windowNetDisplacement;
  if (activeWindow.length >= 3) {
    const pRecent = activeWindow[activeWindow.length - 3];
    recent3Displacement = getDistanceInMeters(pRecent.lat, pRecent.lng, latest.lat, latest.lng);
  }

  // PHYSICAL STOP PROTECTION: If device coords.speed < 0.6 km/h or recent 3 fixes show < 1.0m movement, classify STATIONARY immediately
  const isZeroSpeed = (latestCoordsSpeed !== null && latestCoordsSpeed < 0.6);
  const isRecentSlow = (activeWindow.length >= 3 && recent3Displacement < 1.0 && (latestCoordsSpeed === null || latestCoordsSpeed < 0.6));

  if ((isZeroSpeed || isRecentSlow) && wAccuracy <= RUN_ENGINE_CONFIG.GPS_STATIONARY_ACCURACY) {
    return {
      classification: 'STATIONARY',
      windowNetDisplacement,
      windowPathMeters,
      medianSpeed,
      directionEfficiency
    };
  }

  // Multi-Signal Evidence Evaluation:
  // 1. Displacement Evidence: Net displacement >= 2.5m AND accumulated path >= 3.0m
  const displacementEvidence =
    (windowNetDisplacement >= RUN_ENGINE_CONFIG.MOVING_NET_DISPLACEMENT) &&
    (windowPathMeters >= RUN_ENGINE_CONFIG.MOVING_MIN_PATH_METERS);

  // 2. Speed Evidence: Median window speed >= 1.0 km/h OR reliable coords.speed >= 1.0 km/h
  const speedEvidence =
    (medianSpeed >= RUN_ENGINE_CONFIG.MOVING_MIN_SPEED_KMH) ||
    (latestCoordsSpeed !== null && latestCoordsSpeed >= RUN_ENGINE_CONFIG.MOVING_MIN_SPEED_KMH);

  // 3. Translation Coherence Evidence: Direction efficiency >= 0.40 (progressive translation vs stationary jitter)
  const translationEvidence = directionEfficiency >= RUN_ENGINE_CONFIG.MOVING_MIN_EFFICIENCY;

  // MOVING requires displacementEvidence AND (speedEvidence OR translationEvidence)
  // CRITICAL SAFETY: 2.5m net displacement ALONE CANNOT classify MOVING!
  const isMovingCredible = displacementEvidence && (speedEvidence || translationEvidence);

  let classification = 'UNCERTAIN';

  if (isMovingCredible) {
    classification = 'MOVING';
  } else if (
    windowNetDisplacement < 1.2 &&
    (latestCoordsSpeed === null || latestCoordsSpeed < 0.6) &&
    medianSpeed < 0.8 &&
    wAccuracy <= RUN_ENGINE_CONFIG.GPS_STATIONARY_ACCURACY
  ) {
    classification = 'STATIONARY';
  }

  return {
    classification,
    windowNetDisplacement,
    windowPathMeters,
    medianSpeed,
    directionEfficiency
  };
}
