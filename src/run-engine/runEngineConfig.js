/**
 * RunClash 2.0 — Run Engine Configuration
 * Single authoritative source of truth for all GPS thresholds, time windows,
 * and state machine parameters.
 */
export const RUN_ENGINE_CONFIG = {
  // GPS Accuracy Thresholds (in meters)
  GPS_ACCURACY_THRESHOLD: 25,       // Max accuracy allowed for official distance fix
  GPS_STATIONARY_ACCURACY: 25,      // Max accuracy allowed for stationary classification

  // Waiting State Thresholds
  WAITING_BUFFER_WINDOW_SEC: 8,     // 8-second rolling window for waiting motion classification
  WAITING_MIN_POINTS: 4,            // Min points required in buffer to analyze
  WAITING_MIN_NET_DISPLACEMENT: 6.0,// Net meters required from baseline
  WAITING_MIN_PATH_METERS: 7.0,     // Total path meters in window
  WAITING_MIN_EFFICIENCY: 0.45,     // Direction efficiency ratio (net / path)
  WAITING_MIN_SPEED_KMH: 1.2,       // Min calculated speed (km/h)
  WAITING_FALLBACK_DISPLACEMENT: 14.0, // Absolute displacement fallback for fast start

  // Tracking State Motion Classifier Thresholds
  TRACKING_WINDOW_SEC: 8,           // 8-second rolling active motion window
  TRACKING_MIN_STEP_METERS: 0.8,    // Min step meters between fixes to register distance
  TRACKING_MAX_STEP_METERS: 60.0,   // Max plausible step distance per fix (teleport filter)
  TRACKING_MAX_SPEED_KMH: 30.0,     // Max plausible human running speed (speed spike filter)

  // Motion Classifier Evidence Thresholds
  MOVING_NET_DISPLACEMENT: 2.5,     // Net displacement over 8s window
  MOVING_MIN_PATH_METERS: 3.0,      // Minimum cumulative path meters in window
  MOVING_MIN_SPEED_KMH: 1.0,        // Minimum window median calculated speed or coords.speed
  MOVING_MIN_EFFICIENCY: 0.40,      // Minimum translation coherence (net / path)

  // Auto-Pause & Resume Thresholds
  AUTO_PAUSE_STATIONARY_TIMEOUT_SEC: 15, // Sustained stationary duration before auto-pause
  RESUME_CANDIDATE_COUNT: 2,         // Sequential moving fixes in paused state to confirm resume
  RESUME_MIN_DISPLACEMENT: 3.5,      // Displacement meters from pause anchor to trigger candidate
  RESUME_MIN_SPEED_KMH: 1.2,         // Speed threshold for resume candidate

  // Loop Geometry Thresholds
  MIN_LOOP_POINTS: 8,
  MIN_LOOP_DISTANCE_KM: 0.04        // 40 meters
};
