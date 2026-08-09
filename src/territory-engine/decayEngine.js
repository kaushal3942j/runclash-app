/**
 * RunClash 2.0 — Decay Engine
 * Computes territory health and decay status based on timestamps.
 */

// Constants from Master Plan (Section 3.8)
export const DECAY_DURATION_HOURS = 72;
export const NEUTRAL_DURATION_HOURS = 24;
export const TOTAL_LIFESPAN_HOURS = DECAY_DURATION_HOURS + NEUTRAL_DURATION_HOURS; // 96 hours

/**
 * Calculates current sector health percentage (0-100).
 * Health decays linearly from 100% to 0% over 72 hours.
 * @param {Object} territory 
 * @param {number} nowMs - Current timestamp in milliseconds
 * @returns {number} Health percentage (0 to 100)
 */
export function calculateSectorHealth(territory, nowMs = Date.now()) {
  const rechargeMs = getRechargeTimestamp(territory);
  if (!rechargeMs) return 0; // Invalid/unknown timestamp means 0 health

  const elapsedMs = nowMs - rechargeMs;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  // Health calculation (linear)
  // Max health = 100, drops by 100/72 per hour
  const health = 100 - (elapsedHours * (100 / DECAY_DURATION_HOURS));

  return Math.max(0, Math.min(100, Math.round(health)));
}

/**
 * Gets the canonical recharge timestamp for a territory.
 * Falls back to created_at or expires_at if last_recharged_at is missing.
 */
function getRechargeTimestamp(territory) {
  if (territory.last_recharged_at) {
    return new Date(territory.last_recharged_at).getTime();
  }
  if (territory.created_at) {
    return new Date(territory.created_at).getTime();
  }
  if (territory.expires_at) {
    // Legacy fallback: expires_at was created_at + 72h
    return new Date(territory.expires_at).getTime() - (72 * 60 * 60 * 1000);
  }
  return null;
}

/**
 * Checks if a territory is completely decayed (health <= 0).
 */
export function isDecayed(territory, nowMs = Date.now()) {
  return calculateSectorHealth(territory, nowMs) <= 0;
}

/**
 * Gets the structured decay status of a territory.
 * Statuses: 'healthy', 'warning', 'critical', 'decayed', 'neutral', 'expired'
 */
export function getDecayStatus(territory, nowMs = Date.now()) {
  const rechargeMs = getRechargeTimestamp(territory);
  const health = calculateSectorHealth(territory, nowMs);

  if (!rechargeMs) {
    return {
      health: 0,
      hoursRemaining: 0,
      status: 'expired',
      decayed: true,
      lastRechargedAt: null,
      expiresAt: null
    };
  }

  const elapsedMs = nowMs - rechargeMs;
  const elapsedHours = elapsedMs / (1000 * 60 * 60);
  
  let hoursRemaining = Math.max(0, DECAY_DURATION_HOURS - elapsedHours);
  let status = 'healthy';
  let decayed = false;

  if (elapsedHours >= TOTAL_LIFESPAN_HOURS) {
    status = 'expired'; // Completely gone
    decayed = true;
  } else if (elapsedHours >= DECAY_DURATION_HOURS) {
    status = 'neutral'; // 24h Neutral State
    decayed = true;
    hoursRemaining = Math.max(0, TOTAL_LIFESPAN_HOURS - elapsedHours); // Show neutral window remaining
  } else if (health < 10) {
    status = 'critical';
  } else if (health < 25) {
    status = 'warning';
  }

  const expiresAtMs = rechargeMs + (DECAY_DURATION_HOURS * 60 * 60 * 1000);

  return {
    health,
    hoursRemaining: parseFloat(hoursRemaining.toFixed(1)),
    status,
    decayed,
    lastRechargedAt: new Date(rechargeMs).toISOString(),
    expiresAt: new Date(expiresAtMs).toISOString()
  };
}

/**
 * Pure function to locally mock recharging a territory.
 * In production, this data update is sent to the database.
 */
export function rechargeSector(territory, nowMs = Date.now()) {
  return {
    ...territory,
    last_recharged_at: new Date(nowMs).toISOString(),
    // Clear legacy flags to prefer the new system
    expires_at: new Date(nowMs + (DECAY_DURATION_HOURS * 60 * 60 * 1000)).toISOString() 
  };
}
