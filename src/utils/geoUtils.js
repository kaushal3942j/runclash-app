/**
 * Geolocation & Spatial Geometry Utilities for RunClash
 */

/**
 * Calculates distance between two coordinates in kilometers using Haversine formula
 */
export const calculateDistance = (lat1, lon1, lat2, lon2) => {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculates distance between two coordinates in meters
 */
export const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  return calculateDistance(lat1, lon1, lat2, lon2) * 1000;
};

/**
 * Calculates total cumulative distance of a path array [[lat, lng], ...] in kilometers
 */
export const calculatePathDistance = (path) => {
  if (!path || path.length < 2) return 0;
  let totalKm = 0;
  for (let i = 1; i < path.length; i++) {
    const p1 = path[i - 1];
    const p2 = path[i];
    totalKm += calculateDistance(p1[0], p1[1], p2[0], p2[1]);
  }
  return totalKm;
};

/**
 * Calculates area of a polygon defined by [[lat, lng], ...] coordinates in square meters
 * Uses Shoelace formula projected on spherical approximation
 */
export const calculatePolygonArea = (points) => {
  if (!points || points.length < 3) return 0;
  const R = 6378137; // Earth's radius in meters
  let area = 0;

  for (let i = 0; i < points.length; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % points.length];
    const p1RadLat = (p1[0] * Math.PI) / 180;
    const p2RadLat = (p2[0] * Math.PI) / 180;
    const p1RadLng = (p1[1] * Math.PI) / 180;
    const p2RadLng = (p2[1] * Math.PI) / 180;

    area += (p2RadLng - p1RadLng) * (2 + Math.sin(p1RadLat) + Math.sin(p2RadLat));
  }

  area = (Math.abs(area) * R * R) / 2;
  return area;
};

/**
 * Calculates centroid of a polygon [[lat, lng], ...]
 */
export const calculatePolygonCentroid = (points) => {
  if (!points || points.length === 0) return [0, 0];
  let sumLat = 0;
  let sumLng = 0;
  points.forEach((p) => {
    sumLat += p[0];
    sumLng += p[1];
  });
  return [sumLat / points.length, sumLng / points.length];
};

/**
 * Ray casting algorithm to check if point [lat, lng] is inside polygon [[lat, lng], ...]
 */
export const isPointInPolygon = (point, polygon) => {
  const x = point[0];
  const y = point[1];
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];

    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-10) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

/**
 * Helper to check if two line segments (p1-p2 and p3-p4) intersect
 */

const lineSegmentsIntersect = (p1, p2, p3, p4) => {
  const ccw = (A, B, C) => {
    return (C[1] - A[1]) * (B[0] - A[0]) > (B[1] - A[1]) * (C[0] - A[0]);
  };
  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
};

/**
 * Checks if a polyline/polygon path self-intersects (excluding adjacent segments)
 */
export const checkPolygonSelfIntersection = (points) => {
  if (!points || points.length < 4) return false;
  const n = points.length;

  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 2; j < n - 1; j++) {
      if (i === 0 && j === n - 2) continue; // skip first and last closing segment check
      if (lineSegmentsIntersect(points[i], points[i + 1], points[j], points[j + 1])) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Detects if a run path forms a valid closed loop for territory capture
 * Criteria:
 * 1. At least 5 coordinate points.
 * 2. Start point and end point are within closureThresholdMeters (default 35m).
 * 3. Total path distance (perimeter) >= minPerimeterMeters (default 50m).
 * 4. Calculated polygon area >= minAreaSqMeters (default 100m²).
 * 5. No self-intersections.
 */
export const detectLoopClosure = (
  path,
  closureThresholdMeters = 35,
  minPerimeterMeters = 50,
  minAreaSqMeters = 100
) => {
  if (!path || path.length < 5) {
    return { isLoop: false, reason: "Too few points recorded" };
  }

  const firstPoint = path[0];
  const lastPoint = path[path.length - 1];
  const closureDist = calculateDistanceMeters(
    firstPoint[0],
    firstPoint[1],
    lastPoint[0],
    lastPoint[1]
  );

  if (closureDist > closureThresholdMeters) {
    return { isLoop: false, reason: `Gap too wide (${Math.round(closureDist)}m > ${closureThresholdMeters}m)` };
  }

  const perimeterKm = calculatePathDistance(path);
  const perimeterMeters = perimeterKm * 1000;

  if (perimeterMeters < minPerimeterMeters) {
    return { isLoop: false, reason: `Loop perimeter too short (${Math.round(perimeterMeters)}m < ${minPerimeterMeters}m)` };
  }

  const areaSqM = calculatePolygonArea(path);
  if (areaSqM < minAreaSqMeters) {
    return { isLoop: false, reason: `Loop area too small (${Math.round(areaSqM)}m² < ${minAreaSqMeters}m²)` };
  }

  if (checkPolygonSelfIntersection(path)) {
    return { isLoop: false, reason: "Path has self-intersecting loops" };
  }

  return {
    isLoop: true,
    closureDistance: closureDist,
    perimeterMeters,
    areaSqMeters: areaSqM,
    closedPolygon: [...path, firstPoint]
  };
};
