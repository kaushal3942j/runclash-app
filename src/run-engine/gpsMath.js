/**
 * RunClash 2.0 — GPS Math Utilities
 * Pure functions for geographic distance calculation, speed, pace, and efficiency.
 */

/**
 * Calculates Haversine distance in meters between two lat/lng coordinates.
 */
export function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates speed in km/h from distance in meters and time delta in seconds.
 */
export function calculateSpeedKmh(distanceMeters, dtSeconds) {
  if (!dtSeconds || dtSeconds <= 0) return 0;
  return (distanceMeters / dtSeconds) * 3.6;
}

/**
 * Calculates direction efficiency (net displacement / total path meters).
 */
export function calculateDirectionEfficiency(netDisplacementMeters, totalPathMeters) {
  if (!totalPathMeters || totalPathMeters <= 0) return 0;
  return Math.min(1.0, Math.max(0.0, netDisplacementMeters / totalPathMeters));
}

/**
 * Calculates median value from an array of numbers.
 */
export function calculateMedian(numbers) {
  if (!numbers || numbers.length === 0) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Formats duration in seconds to MM:SS or HH:MM:SS.
 */
export function formatDurationText(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Formats pace in min/km string (e.g. "5:30" or "--:--").
 */
export function formatPaceText(paceSecondsPerKm) {
  if (!paceSecondsPerKm || !isFinite(paceSecondsPerKm) || paceSecondsPerKm <= 0 || paceSecondsPerKm > 3600) {
    return '--:--';
  }
  const mins = Math.floor(paceSecondsPerKm / 60);
  const secs = Math.floor(paceSecondsPerKm % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculates consistent run statistics (speed, formatted pace).
 */
export function calculateConsistentRunStats(distanceKm, durationSeconds) {
  if (!distanceKm || distanceKm <= 0.0001 || !durationSeconds || durationSeconds <= 0) {
    return {
      averageSpeedKmh: 0,
      paceSecondsPerKm: 0,
      formattedPace: '--:--'
    };
  }
  const avgSpeedKmh = parseFloat(((distanceKm * 3600) / durationSeconds).toFixed(1));
  const paceSecPerKm = Math.round(durationSeconds / distanceKm);
  const formattedPace = formatPaceText(paceSecPerKm);

  return {
    averageSpeedKmh: avgSpeedKmh,
    paceSecondsPerKm: paceSecPerKm,
    formattedPace: formattedPace
  };
}
