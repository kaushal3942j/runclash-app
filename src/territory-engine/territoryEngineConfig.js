export const TERRITORY_ENGINE_CONFIG = {
  // --- MASTER PLAN SPECIFICATIONS ---
  // We are migrating to these Master Plan values, but maintaining
  // documentation of the old production values (8 points, 80 sqm)
  // to report the conflict and ensure we can roll back if tests fail.
  MIN_LOOP_POINTS: 5,             // Old production: 8
  MIN_LOOP_AREA_SQM: 200,         // Old production: 80
  CLOSURE_THRESHOLD_METERS: 25,   // Master plan: 25 (dynamic in old prod: 12-22)
  MIN_PATH_DISTANCE_KM: 0.04,     // Master plan: 0.04
  MIN_LOOP_DURATION_SEC: 25       // Old production: 25 (kept for safety)
};
