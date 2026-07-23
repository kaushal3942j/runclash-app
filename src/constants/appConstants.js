// Configurable Constants for GPS tracking, pausing, and anti-cheat
export const GPS_CONFIG = {
  DRIFT_SPEED_THRESHOLD: 0.8,      // m/s (2.88 km/h) below which the runner is considered stationary
  AUTO_PAUSE_SPEED: 0.8,            // m/s below which we auto-pause after sustained time
  AUTO_RESUME_SPEED: 1.0,           // m/s above which we resume
  AUTO_PAUSE_DELAY: 4.0,            // seconds stationary before auto-pause triggers
  VEHICLE_SPEED_LIMIT: 7.0,         // m/s (25.2 km/h) maximum overall average speed allowed
  SUSTAINED_HIGH_SPEED_LIMIT: 8.0,  // m/s (28.8 km/h) instantaneous limit for flagging cheats
  SUSTAINED_HIGH_SPEED_MAX_DUR: 5,  // seconds allowed at sustained high speed before auto-invalidate
  JITTER_DISTANCE_FILTER: 0.002,    // km (2 meters) distance jumps to discard
  GPS_ACCURACY_THRESHOLD: 25.0,     // meters (discard points with poor accuracy)
  MIN_TIME_COMPUTATION_WINDOW: 1.0, // seconds (buffer coordinate updates to compute speed)
  MIN_WALK_SPEED_THRESHOLD: 0.2     // m/s (0.72 km/h) minimum speed to record walking movement
};

// Predefined Simulation Routes for Udaipur (Developer Mode)
export const SIMULATION_ROUTES = {
  lake: {
    name: "Fateh Sagar Lake Loop",
    distance: "3.2 km",
    points: [
      [24.6042, 73.6805],
      [24.6015, 73.6762],
      [24.5975, 73.6750],
      [24.5948, 73.6781],
      [24.5932, 73.6825],
      [24.5961, 73.6865],
      [24.6010, 73.6870],
      [24.6030, 73.6845],
      [24.6042, 73.6805]
    ]
  },
  foothills: {
    name: "Sajjan Garh Foothills Base",
    distance: "2.1 km",
    points: [
      [24.5920, 73.6620],
      [24.5890, 73.6580],
      [24.5840, 73.6600],
      [24.5860, 73.6670],
      [24.5900, 73.6680],
      [24.5920, 73.6620]
    ]
  },
  monument: {
    name: "Udaipur Castle Park",
    distance: "1.4 km",
    points: [
      [24.5780, 73.6920],
      [24.5750, 73.6900],
      [24.5730, 73.6930],
      [24.5760, 73.6960],
      [24.5780, 73.6920]
    ]
  },
  micro: {
    name: "Micro Loop (Too Small Test)",
    distance: "0.01 km",
    points: [
      [24.5950, 73.6800],
      [24.59501, 73.6800],
      [24.59501, 73.68001],
      [24.5950, 73.68001],
      [24.5950, 73.6800]
    ]
  }
};

// Database of default profiles for social discovery/search
export const INITIAL_PROFILES = [
  { id: 'user_lakshya', displayName: 'Lakshya', clan: 'None', level: 12, xp: 5800, distance: '112.5 km', territories: 5, bio: 'Conquering lake sectors one run at a time.', online: true, postsCount: 24, friendsCount: 31 },
  { id: 'user_sam', displayName: 'Sam', clan: 'None', level: 10, xp: 4500, distance: '74.8 km', territories: 3, bio: 'Pacing Sajjan Garh foothills daily.', online: false, postsCount: 15, friendsCount: 22 },
  { id: 'user_rohan', displayName: 'Rohan', clan: 'None', level: 8, xp: 3200, distance: '48.2 km', territories: 2, bio: 'Sprinting through the old city gates.', online: true, postsCount: 8, friendsCount: 14 },
  { id: 'user_divya', displayName: 'Divya', clan: 'None', level: 7, xp: 2900, distance: '1.4 km', territories: 1, bio: 'Run, capture, defend, repeat.', online: true, postsCount: 5, friendsCount: 19 },
  { id: 'user_arjun', displayName: 'Arjun', clan: 'None', level: 6, xp: 2300, distance: '28.1 km', territories: 0, bio: 'New to Udaipur, looking for run buddies.', online: false, postsCount: 2, friendsCount: 4 }
];

export const CLAN_PALETTE = ['#FC4C02', '#00F0FF', '#FF007A', '#39FF14', '#FFD700', '#8A2BE2'];
