/**
 * Pure utility functions for distance calculations and formatting.
 */

/**
 * Formats distance in kilometres into human-readable string:
 * - below 1 km: metres rounded to nearest whole metre (e.g., "420 m")
 * - 1 km or more: kilometres with two decimals (e.g., "1.26 km")
 * @param {number} distanceKm 
 * @returns {string}
 */
export const formatDisplayDistance = (distanceKm) => {
  if (distanceKm === null || distanceKm === undefined || isNaN(distanceKm)) return '0 m';
  const km = Number(distanceKm);
  if (km < 1.0) {
    const meters = Math.round(km * 1000);
    return `${meters} m`;
  }
  return `${km.toFixed(2)} km`;
};

/**
 * Calculates Vincenty/Haversine distance in metres between two GPS coordinates.
 */
export const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371000; // Radius of Earth in metres
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};
