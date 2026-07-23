import { CLAN_PALETTE } from '../constants/appConstants';

/**
 * Dynamic Crew/Clan color assignment based on name hash
 */
export const getClanColor = (clanName) => {
  if (!clanName || clanName === 'None') return '#555555';
  let hash = 0;
  for (let i = 0; i < clanName.length; i++) {
    hash = clanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CLAN_PALETTE[Math.abs(hash) % CLAN_PALETTE.length];
};

/**
 * Converts speed in meters per second to pace string "MM:SS /km"
 */
export const formatPace = (speedMps) => {
  if (!speedMps || speedMps <= 0.1) return '--:--';
  const paceSeconds = 1000 / speedMps;
  if (!isFinite(paceSeconds) || paceSeconds > 3599) return '--:--';
  const mins = Math.floor(paceSeconds / 60);
  const secs = Math.floor(paceSeconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/**
 * Formats duration in seconds to "HH:MM:SS" or "MM:SS"
 */
export const formatDuration = (totalSeconds) => {
  if (!totalSeconds || isNaN(totalSeconds)) return '00:00';
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  
  if (hours > 0) {
    return `${hours}:${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

/**
 * Calculates user Level and progress XP based on total distance run in km
 */
export const calculateLevelAndXp = (totalDistanceKm) => {
  const xp = Math.floor((parseFloat(totalDistanceKm) || 0) * 100);
  const level = Math.floor(xp / 500) + 1;
  const currentLevelXp = xp % 500;
  const progressPercent = Math.min(100, Math.floor((currentLevelXp / 500) * 100));
  return { xp, level, currentLevelXp, progressPercent };
};
