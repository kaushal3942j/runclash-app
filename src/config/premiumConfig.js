/**
 * RunClash Free and Premium Feature Registry
 * Single Source of Truth for Feature Permissions.
 */

export const FEATURE_KEYS = {
  // Free Features
  GPS_RUN_TRACKING: 'GPS_RUN_TRACKING',
  TERRITORY_CAPTURE: 'TERRITORY_CAPTURE',
  SOLO_MAP: 'SOLO_MAP',
  BASIC_CLAN_MAP: 'BASIC_CLAN_MAP',
  DAILY_MISSIONS: 'DAILY_MISSIONS',
  LOCAL_LEADERBOARD: 'LOCAL_LEADERBOARD',
  RECENT_HISTORY: 'RECENT_HISTORY',
  BASIC_ACHIEVEMENTS: 'BASIC_ACHIEVEMENTS',
  BASIC_PROFILE: 'BASIC_PROFILE',
  
  // Premium Features
  AI_COACH: 'AI_COACH',
  ADVANCED_ANALYTICS: 'ADVANCED_ANALYTICS',
  UNLIMITED_HISTORY: 'UNLIMITED_HISTORY',
  SMART_ROUTE_GENERATOR: 'SMART_ROUTE_GENERATOR',
  TERRITORY_RADAR: 'TERRITORY_RADAR',
  ADVANCED_CLAN_MAP: 'ADVANCED_CLAN_MAP',
  FOG_OF_WAR_OVERLAY: 'FOG_OF_WAR_OVERLAY',
  ROUTE_REPLAY: 'ROUTE_REPLAY',
  CUSTOM_THEMES: 'CUSTOM_THEMES',
  PREMIUM_PROFILE_FRAME: 'PREMIUM_PROFILE_FRAME'
};

export const FEATURE_REGISTRY = {
  [FEATURE_KEYS.GPS_RUN_TRACKING]: { isPremium: false, name: 'GPS Run Tracking' },
  [FEATURE_KEYS.TERRITORY_CAPTURE]: { isPremium: false, name: 'Territory Capture' },
  [FEATURE_KEYS.SOLO_MAP]: { isPremium: false, name: 'Solo Map' },
  [FEATURE_KEYS.BASIC_CLAN_MAP]: { isPremium: false, name: 'Basic Clan Map' },
  [FEATURE_KEYS.DAILY_MISSIONS]: { isPremium: false, name: 'Daily Missions' },
  [FEATURE_KEYS.LOCAL_LEADERBOARD]: { isPremium: false, name: 'Leaderboard' },

  [FEATURE_KEYS.AI_COACH]: { isPremium: true, name: 'Tactical AI Coach', description: 'Rule-based strategic recommendations and pace analysis.' },
  [FEATURE_KEYS.ADVANCED_ANALYTICS]: { isPremium: true, name: 'Advanced Run Analytics', description: 'Deep breakdown of pace, active duration, and territory area.' },
  [FEATURE_KEYS.UNLIMITED_HISTORY]: { isPremium: true, name: 'Unlimited Run History', description: 'Complete lifetime activity cloud history.' },
  [FEATURE_KEYS.SMART_ROUTE_GENERATOR]: { isPremium: true, name: 'Smart Route Generator', description: 'Generate optimal loop routes for maximum area capture.' },
  [FEATURE_KEYS.TERRITORY_RADAR]: { isPremium: true, name: 'Territory Radar Overlay', description: 'Live HUD overlay indicating nearby weak or expiring sectors.' },
  [FEATURE_KEYS.FOG_OF_WAR_OVERLAY]: { isPremium: true, name: 'Tactical Fog of War', description: 'Visual map exploration overlay.' },
  [FEATURE_KEYS.ROUTE_REPLAY]: { isPremium: true, name: 'Route Replay', description: 'Animate and review recorded run trajectories.' }
};
