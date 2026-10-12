import { supabase, useSupabase } from '../supabase.js';

export const computeRanks = (list, metric = 'xp') => {
  if (!Array.isArray(list) || list.length === 0) return [];

  // Sort descending by primary metric, with deterministic secondary tie-breakers
  const sorted = [...list].sort((a, b) => {
    let diff;
    if (metric === 'distance') {
      diff = (Number(b.total_distance) || 0) - (Number(a.total_distance) || 0);
      if (diff === 0) diff = (Number(b.xp) || 0) - (Number(a.xp) || 0);
      if (diff === 0) diff = (Number(b.territories_owned) || 0) - (Number(a.territories_owned) || 0);
    } else if (metric === 'territories') {
      diff = (Number(b.territories_owned) || 0) - (Number(a.territories_owned) || 0);
      if (diff === 0) diff = (Number(b.xp) || 0) - (Number(a.xp) || 0);
      if (diff === 0) diff = (Number(b.total_distance) || 0) - (Number(a.total_distance) || 0);
    } else {
      // Default: 'xp'
      diff = (Number(b.xp) || 0) - (Number(a.xp) || 0);
      if (diff === 0) diff = (Number(b.total_distance) || 0) - (Number(a.total_distance) || 0);
      if (diff === 0) diff = (Number(b.territories_owned) || 0) - (Number(a.territories_owned) || 0);
    }
    return diff;
  });

  // Dense ranking policy: tied runners with identical primary metric values share rank
  let currentRank = 1;
  return sorted.map((player, idx) => {
    if (idx > 0) {
      const prev = sorted[idx - 1];
      let isTie;
      if (metric === 'distance') {
        isTie = Math.abs((Number(player.total_distance) || 0) - (Number(prev.total_distance) || 0)) < 0.0001;
      } else if (metric === 'territories') {
        isTie = (Number(player.territories_owned) || 0) === (Number(prev.territories_owned) || 0);
      } else {
        isTie = (Number(player.xp) || 0) === (Number(prev.xp) || 0);
      }

      if (!isTie) {
        currentRank++;
      }
    }

    return {
      ...player,
      rank: currentRank,
      total_distance: Number(player.total_distance) || 0,
      xp: Number(player.xp) || 0,
      territories_owned: Number(player.territories_owned) || 0
    };
  });
};

export const getLeaderboard = async (metric = 'xp', timePeriod = 'all_time', scope = 'global', limitCount = 100) => {
  if (!useSupabase) {
    return { success: false, data: [], error: 'Supabase client is not active.' };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    // Signed-out user selecting friends scope
    if (scope === 'friends' && !currentUserId) {
      return { success: true, data: [], error: null, isSignedOut: true };
    }

    // Call database RPC get_leaderboard_v2 for all scopes
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_leaderboard_v2', {
      p_metric: metric,
      p_time_period: timePeriod,
      p_scope: scope,
      p_limit_count: limitCount
    });

    if (rpcErr) {
      console.error('[LeaderboardService] RPC get_leaderboard_v2 error:', rpcErr);
      return { success: false, data: [], error: rpcErr.message || 'Failed to fetch leaderboard from database.' };
    }

    const rankedData = computeRanks(rpcData || [], metric);
    return { success: true, data: rankedData, error: null };
  } catch (err) {
    console.error('[LeaderboardService] Service exception:', err);
    return { success: false, data: [], error: err.message || 'An unexpected error occurred while fetching leaderboard.' };
  }
};
