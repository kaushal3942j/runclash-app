import { supabase, useSupabase } from '../supabase.js';
import { isValidAuthenticatedUser } from './authService.js';

// Helper: 10-second Network Timeout Wrapper
const withTimeout = (promise, ms = 10000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timed out.')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

export const isDefaultName = (name) => {
  if (!name || typeof name !== 'string') return true;
  const lower = name.trim().toLowerCase();
  return lower === '' || lower === 'runner' || lower === 'guest runner' || lower === 'guest' || lower === 'offline runner';
};

// Validate clan referential integrity against real public.clans table
export const validateClanIntegrity = async (userUuid, rawClanName) => {
  if (!rawClanName || rawClanName === 'None' || rawClanName === 'null') {
    return 'None';
  }

  if (!useSupabase || !userUuid) return 'None';

  try {
    const { data: matchingClan, error } = await withTimeout(
      supabase
        .from('clans')
        .select('id, name')
        .eq('name', rawClanName)
        .maybeSingle(),
      8000
    );

    if (error || !matchingClan) {
      await supabase
        .from('profiles')
        .update({ clan_name: 'None', updated_at: new Date().toISOString() })
        .eq('id', userUuid);

      return 'None';
    }

    return matchingClan.name;
  } catch (err) {
    console.warn('[CLAN INTEGRITY] Notice:', err.message);
    return 'None';
  }
};

export const getOwnProfile = async () => {
  if (!useSupabase) {
    return { success: false, data: null, error: 'Supabase client disabled.' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, data: null, error: 'Not authenticated' };
    }

    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single(),
      10000
    );

    if (error) {
      return { success: false, data: null, error: error.message };
    }

    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const getPublicProfile = async (targetUserId) => {
  if (!useSupabase || !targetUserId) {
    return { success: false, data: null, error: 'Target user ID is required.' };
  }

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, bio, country, state, city, clan_name, level, xp, coins, premium, is_profile_public, show_activity, allow_friend_requests, created_at, last_active_at')
        .eq('id', targetUserId)
        .maybeSingle(),
      10000
    );

    if (error) {
      return { success: false, data: null, error: error.message };
    }

    if (!data) {
      return { success: false, data: null, error: 'Profile not found.' };
    }

    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const checkUsernameAvailability = async (username) => {
  if (!username || typeof username !== 'string') {
    return { available: false, error: 'Username must be a valid string' };
  }

  const normalized = username.trim().toLowerCase();
  const usernameRegex = /^[a-z0-9_]{3,20}$/;
  if (!usernameRegex.test(normalized)) {
    return { available: false, error: '3–20 characters, lowercase letters, numbers & underscores only.' };
  }

  if (!useSupabase) {
    return { available: true, normalized, error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .select('id')
        .eq('username', normalized)
        .maybeSingle(),
      8000
    );

    if (error) {
      return { available: false, error: error.message };
    }

    if (data && data.id !== currentUserId) {
      return { available: false, error: 'Username is already taken.' };
    }

    return { available: true, normalized, error: null };
  } catch (err) {
    return { available: false, error: err.message };
  }
};

export const updateProfile = async (patch) => {
  if (!useSupabase) {
    return { success: false, data: null, error: 'Supabase disabled.' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: false, data: null, error: 'Not authenticated.' };
    }
    const userId = session.user.id;

    const mapped = { updated_at: new Date().toISOString() };

    if (patch.displayName !== undefined) mapped.display_name = patch.displayName;
    if (patch.username !== undefined) {
      if (patch.username && patch.username.trim()) {
        const availCheck = await checkUsernameAvailability(patch.username);
        if (!availCheck.available) {
          return { success: false, data: null, error: availCheck.error };
        }
        mapped.username = availCheck.normalized;
      } else {
        mapped.username = null;
      }
    }
    if (patch.bio !== undefined) mapped.bio = patch.bio;
    if (patch.avatarUrl !== undefined) mapped.avatar_url = patch.avatarUrl;
    if (patch.country !== undefined) mapped.country = patch.country;
    if (patch.state !== undefined) mapped.state = patch.state;
    if (patch.city !== undefined) mapped.city = patch.city;
    if (patch.isProfilePublic !== undefined) mapped.is_profile_public = patch.isProfilePublic;
    if (patch.showActivity !== undefined) mapped.show_activity = patch.showActivity;
    if (patch.allowFriendRequests !== undefined) mapped.allow_friend_requests = patch.allowFriendRequests;
    if (patch.clan !== undefined) {
      mapped.clan_name = await validateClanIntegrity(userId, patch.clan);
    }

    const { data, error } = await withTimeout(
      supabase
        .from('profiles')
        .update(mapped)
        .eq('id', userId)
        .select()
        .single(),
      10000
    );

    if (error) {
      return { success: false, data: null, error: error.message };
    }

    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const searchProfiles = async (query, filters = {}) => {
  if (!useSupabase) {
    return { success: true, data: [], error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    let req = supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, clan_name, level, xp, country, city, is_profile_public')
      .eq('is_profile_public', true)
      .limit(30);

    if (currentUserId) {
      req = req.neq('id', currentUserId);
    }

    if (query && query.trim()) {
      const q = query.trim().toLowerCase();
      req = req.or(`display_name.ilike.%${q}%,username.ilike.%${q}%`);
    }

    if (filters.country) {
      req = req.eq('country', filters.country);
    }
    if (filters.city) {
      req = req.eq('city', filters.city);
    }

    const { data, error } = await withTimeout(req, 10000);

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    return { success: true, data: data || [], error: null };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};

export const loadProfileStats = async (targetUserId) => {
  const emptyStats = {
    totalDistanceKm: 0,
    totalRuns: 0,
    longestRunKm: 0,
    fastestPaceSec: 0,
    avgPaceSec: 0,
    territoriesOwned: 0,
    totalTerritoriesCaptured: 0,
    totalControlledAreaM2: 0,
    biggestTerritoryM2: 0
  };

  if (!targetUserId) {
    return { success: true, data: emptyStats, error: null };
  }

  try {
    let cloudRuns = [];
    let cloudTerritories = [];

    if (useSupabase) {
      const runsPromise = supabase
        .from('runs')
        .select('distance_km, duration_seconds, pace_seconds_per_km')
        .eq('user_id', targetUserId);

      const terrPromise = supabase
        .from('territories')
        .select('id, area_sqm, area')
        .eq('owner_id', targetUserId);

      const [rRes, tRes] = await Promise.allSettled([
        withTimeout(runsPromise, 10000),
        withTimeout(terrPromise, 10000)
      ]);

      if (rRes.status === 'fulfilled' && !rRes.value.error) {
        cloudRuns = rRes.value.data || [];
      }
      if (tRes.status === 'fulfilled' && !tRes.value.error) {
        cloudTerritories = tRes.value.data || [];
      }
    }

    // Merge with local runs cache (clash_runs) for immediate responsiveness
    const localRunsRaw = localStorage.getItem('clash_runs');
    const localRuns = localRunsRaw ? JSON.parse(localRunsRaw) : [];
    const userLocalRuns = localRuns.filter(r => r.userId === targetUserId || r.user_id === targetUserId);

    // Merge run lists by operation ID
    const runMap = new Map();
    cloudRuns.forEach(r => {
      runMap.set(r.operation_id || r.id, {
        distance: Number(r.distance_km || 0),
        duration: Number(r.duration_seconds || 0),
        pace: Number(r.pace_seconds_per_km || 0)
      });
    });

    userLocalRuns.forEach(r => {
      const opId = r.operationId || r.operation_id || r.id;
      if (!runMap.has(opId)) {
        let paceVal = Number(r.pace) || 0;
        if (typeof r.pace === 'string' && r.pace.includes(':')) {
          const [m, s] = r.pace.split(':').map(Number);
          if (!isNaN(m) && !isNaN(s)) paceVal = m * 60 + s;
        }
        runMap.set(opId, {
          distance: Number(r.distance || r.distanceKm || 0),
          duration: Number(r.duration || r.durationSeconds || 0),
          pace: paceVal
        });
      }
    });

    const combinedRuns = Array.from(runMap.values());
    const totalRuns = combinedRuns.length;
    const totalDistanceKm = combinedRuns.reduce((acc, r) => acc + r.distance, 0);
    const longestRunKm = combinedRuns.reduce((max, r) => Math.max(max, r.distance), 0);

    const validPaces = combinedRuns.map(r => r.pace).filter(p => p > 0);
    const fastestPaceSec = validPaces.length ? Math.min(...validPaces) : 0;
    const avgPaceSec = validPaces.length ? Math.round(validPaces.reduce((a, b) => a + b, 0) / validPaces.length) : 0;

    // Merge territories
    const localTerrRaw = localStorage.getItem('clash_territories');
    const localTerr = localTerrRaw ? JSON.parse(localTerrRaw) : [];
    const userLocalTerr = localTerr.filter(t => t.ownerId === targetUserId || t.owner_id === targetUserId);

    const terrMap = new Map();
    cloudTerritories.forEach(t => {
      const areaVal = Number(t.area_sqm || (typeof t.area === 'number' ? t.area : parseFloat(String(t.area).replace(/[^\d.]/g, ''))) || 0);
      terrMap.set(t.id, areaVal);
    });

    userLocalTerr.forEach(t => {
      const tid = t.claimId || t.id;
      if (!terrMap.has(tid)) {
        const areaVal = Number(typeof t.area === 'number' ? t.area : parseFloat(String(t.area).replace(/[^\d.]/g, '')) || 0);
        terrMap.set(tid, areaVal);
      }
    });

    const combinedTerr = Array.from(terrMap.values());
    const territoriesOwned = combinedTerr.length;
    const totalControlledAreaM2 = combinedTerr.reduce((acc, a) => acc + a, 0);
    const biggestTerritoryM2 = combinedTerr.reduce((max, a) => Math.max(max, a), 0);

    return {
      success: true,
      data: {
        totalDistanceKm: parseFloat(totalDistanceKm.toFixed(2)),
        totalRuns,
        longestRunKm: parseFloat(longestRunKm.toFixed(2)),
        fastestPaceSec,
        avgPaceSec,
        territoriesOwned,
        totalTerritoriesCaptured: territoriesOwned,
        totalControlledAreaM2: Math.round(totalControlledAreaM2),
        biggestTerritoryM2: Math.round(biggestTerritoryM2)
      },
      error: null
    };
  } catch (err) {
    console.warn('[LOAD PROFILE STATS] Error:', err.message);
    return { success: false, data: emptyStats, error: err.message };
  }
};

export const ensureProfile = async (user, preferredDisplayName = 'Guest Runner', legacyData = null) => {
  if (!useSupabase || !isValidAuthenticatedUser(user)) {
    return { success: false, data: null, error: 'User must be a valid authenticated Supabase identity.' };
  }

  try {
    const customPreferred = (!isDefaultName(preferredDisplayName) ? preferredDisplayName : (legacyData?.displayName && !isDefaultName(legacyData.displayName) ? legacyData.displayName : null)) || null;

    const { data: existing } = await withTimeout(
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(),
      8000
    );

    if (existing) {
      const validClan = await validateClanIntegrity(user.id, existing.clan_name);
      existing.clan_name = validClan;

      if (customPreferred && isDefaultName(existing.display_name)) {
        const { data: updated } = await supabase
          .from('profiles')
          .update({ display_name: customPreferred, updated_at: new Date().toISOString() })
          .eq('id', user.id)
          .select()
          .single();

        if (updated) {
          return { success: true, data: updated, created: false, error: null };
        }
        existing.display_name = customPreferred;
      }

      return { success: true, data: existing, created: false, error: null };
    }

    const legacyClanCandidate = legacyData?.clan || legacyData?.clan_name || 'None';
    const validClan = await validateClanIntegrity(user.id, legacyClanCandidate);

    const profilePayload = {
      id: user.id,
      display_name: customPreferred || legacyData?.displayName || preferredDisplayName || 'Guest Runner',
      level: legacyData?.level || 1,
      xp: legacyData?.xp || 0,
      coins: legacyData?.coins || 0,
      premium: legacyData?.premium || false,
      clan_name: validClan,
      updated_at: new Date().toISOString()
    };

    const { data: newProfile, error: upsertError } = await withTimeout(
      supabase
        .from('profiles')
        .upsert(profilePayload)
        .select()
        .single(),
      10000
    );

    if (upsertError) {
      return { success: false, data: null, error: upsertError.message };
    }

    return { success: true, data: newProfile, created: true, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};
