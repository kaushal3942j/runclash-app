import { getDistanceInMeters } from '../run-engine/gpsMath.js';
import { TERRITORY_ENGINE_CONFIG } from './territoryEngineConfig.js';

/**
 * Calculates the area of a polygon defined by GPS coordinates using the Shoelace formula.
 * @param {Array<[number, number]>} points - Array of [lat, lng] coordinates
 * @returns {number} Area in square meters
 */
export function getPolygonArea(points) {
  if (!points || points.length < 3) return 0;
  let area = 0;
  const latRef = points[0][0];
  const lonRef = points[0][1];

  // Convert GPS coordinates to local Cartesian coordinates (meters)
  const meters = points.map(p => {
    const y = (p[0] - latRef) * 111139;
    const x = (p[1] - lonRef) * 111139 * Math.cos(latRef * Math.PI / 180);
    return [x, y];
  });

  const len = meters.length;
  for (let i = 0; i < len; i++) {
    const curr = meters[i];
    const next = meters[(i + 1) % len];
    area += (curr[0] * next[1]) - (next[0] * curr[1]);
  }
  return Math.round(Math.abs(area / 2));
}

/**
 * Checks if a point is inside a polygon using Ray-Casting algorithm.
 * @param {[number, number]} point - [lat, lng]
 * @param {Array<[number, number]>} polygon - Array of [lat, lng]
 * @returns {boolean}
 */
export function isPointInPolygon(point, polygon) {
  if (!polygon || polygon.length < 3) return false;
  const lat = point[0];
  const lng = point[1];
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const latI = polygon[i][0];
    const lngI = polygon[i][1];
    const latJ = polygon[j][0];
    const lngJ = polygon[j][1];

    const intersect = ((lngI > lng) !== (lngJ > lng))
        && (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI) + latI);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

/**
 * Checks if two line segments intersect.
 */
export function doSegmentsIntersect(p1, q1, p2, q2) {
  const orientation = (p, q, r) => {
    const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
    if (Math.abs(val) < 1e-9) return 0; // collinear
    return val > 0 ? 1 : 2; // clock or counterclock
  };
  const onSegment = (p, q, r) => {
    return q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) &&
           q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]);
  };
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(p1, p2, q1)) return true;
  if (o2 === 0 && onSegment(p1, q2, q1)) return true;
  if (o3 === 0 && onSegment(p2, p1, q2)) return true;
  if (o4 === 0 && onSegment(p2, q1, q2)) return true;
  return false;
}

/**
 * Checks if a path loops on itself (either by proximity of first/last points or self-intersection).
 * @returns {boolean}
 */
export function findLoopClosure(path, config = TERRITORY_ENGINE_CONFIG) {
  if (!path || path.length < 4) return false;
  
  // 1. Check self-intersection explicitly
  const n = path.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue; // Adjacent first and last segments
      if (doSegmentsIntersect(path[i], path[i + 1], path[j], path[j + 1])) {
        return true;
      }
    }
  }

  // 2. Check proximity closure (end to start)
  const firstP = path[0];
  const lastP = path[path.length - 1];
  const distEndToStart = getDistanceInMeters(lastP[0], lastP[1], firstP[0], firstP[1]);
  
  if (distEndToStart <= config.CLOSURE_THRESHOLD_METERS) {
    return true;
  }

  return false;
}

/**
 * Checks if the most recent path segment intersects any previous segments.
 * Returns the index of the intersected segment, or null if no intersection.
 * @param {Array<[number, number]>} path
 * @returns {number|null}
 */
export function checkPathSelfIntersection(path) {
  if (!path || path.length < 5) return null;
  const lastIdx = path.length - 1;
  const p1 = path[lastIdx - 1];
  const q1 = path[lastIdx];

  // Check last segment against all previous segments
  for (let i = 0; i < lastIdx - 3; i++) {
    const p2 = path[i];
    const q2 = path[i + 1];
    if (doSegmentsIntersect(p1, q1, p2, q2)) {
      return i;
    }
  }
  return null;
}

/**
 * Master validation for territory capture.
 * @param {Array<[number, number]>} path
 * @param {Object} config
 * @returns {Object} Structured validation result
 */
export function validateTerritoryCapture(path, config = TERRITORY_ENGINE_CONFIG) {
  const result = {
    valid: false,
    reason: null,
    areaSqM: 0,
    pathDistanceKm: 0,
    closureDistanceMeters: 0,
    pointCount: path ? path.length : 0,
    normalizedPath: null
  };

  if (!path || path.length < config.MIN_LOOP_POINTS) {
    result.reason = 'INSUFFICIENT_POINTS';
    return result;
  }

  // Calculate total path distance
  let totalDistanceMeters = 0;
  for (let i = 1; i < path.length; i++) {
    totalDistanceMeters += getDistanceInMeters(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1]);
  }
  result.pathDistanceKm = totalDistanceMeters / 1000;

  if (result.pathDistanceKm < config.MIN_PATH_DISTANCE_KM) {
    result.reason = 'PATH_TOO_SHORT';
    return result;
  }

  const firstP = path[0];
  const lastP = path[path.length - 1];
  result.closureDistanceMeters = getDistanceInMeters(lastP[0], lastP[1], firstP[0], firstP[1]);

  const hasClosure = findLoopClosure(path, config);
  
  if (!hasClosure) {
    result.reason = 'LOOP_NOT_CLOSED';
    return result;
  }

  // Normalize closed polygon for area calculation (always ensure first/last are same)
  let normalizedPath = [...path];
  if (result.closureDistanceMeters > 0) {
    normalizedPath.push(firstP);
  }
  result.normalizedPath = normalizedPath;

  const areaSqM = getPolygonArea(normalizedPath);
  result.areaSqM = areaSqM;

  if (areaSqM < config.MIN_LOOP_AREA_SQM) {
    result.reason = 'AREA_TOO_SMALL';
    return result;
  }

  result.valid = true;
  return result;
}
