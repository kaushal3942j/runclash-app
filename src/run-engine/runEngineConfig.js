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
  WAITING_MIN_NET_DISPLACEMENT: 5.0,// Net meters required from baseline (armed at 5m)
  WAITING_MIN_PATH_METERS: 5.0,     // Total path meters in window (armed at 5m)
  WAITING_MIN_EFFICIENCY: 0.40,     // Direction efficiency ratio (net / path)
  WAITING_MIN_SPEED_KMH: 0.8,       // Min calculated speed (km/h) for slow walking
  WAITING_FALLBACK_DISPLACEMENT: 10.0, // Absolute displacement fallback for fast start

  // Tracking State Motion Classifier Thresholds
  TRACKING_WINDOW_SEC: 8,           // 8-second rolling active motion window
  TRACKING_MIN_STEP_METERS: 0.5,    // Min step meters between fixes to register distance
  TRACKING_MAX_STEP_METERS: 60.0,   // Max plausible step distance per fix (teleport filter)
  TRACKING_MAX_SPEED_KMH: 30.0,     // Max plausible human running speed (speed spike filter)

  // Motion Classifier Evidence Thresholds
  MOVING_NET_DISPLACEMENT: 1.8,     // Net displacement over 8s window
  MOVING_MIN_PATH_METERS: 2.5,      // Minimum cumulative path meters in window
  MOVING_MIN_SPEED_KMH: 0.7,        // Minimum window median calculated speed or coords.speed
  MOVING_MIN_EFFICIENCY: 0.25,      // Minimum translation coherence (supports curved terrace loops)

  // Auto-Pause & Resume Thresholds
  AUTO_PAUSE_STATIONARY_TIMEOUT_SEC: 15, // Sustained stationary duration before auto-pause
  RESUME_CANDIDATE_COUNT: 3,         // Sequential candidate fixes in paused state to confirm resume
  RESUME_MIN_DISPLACEMENT: 4.5,      // Final displacement meters from pause anchor to trigger resume
  RESUME_MIN_PROGRESSION: 2.5,       // Progressive distance away from pause anchor over candidate window
  RESUME_MAX_SPEED_KMH: 14.0,       // Max allowed speed for resume candidate (rejects jitter jumps)

  // Loop Geometry Thresholds
  MIN_LOOP_POINTS: 8,
  MIN_LOOP_DISTANCE_KM: 0.04        // 40 meters
};
