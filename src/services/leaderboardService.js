import { supabase, useSupabase } from '../supabase.js';

const withTimeout = (promise, ms = 10000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timed out.')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

export const getLeaderboard = async (metric = 'xp', timePeriod = 'all_time', scope = 'global', limitCount = 100) => {
  if (!useSupabase) {
    return { success: true, data: [], error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    // Try RPC function first
    try {
      const { data, error } = await withTimeout(
        supabase.rpc('get_leaderboard_v2', {
          p_metric: metric,
          p_time_period: timePeriod,
          p_scope: scope,
          p_limit_count: limitCount
        }),
        10000
      );

      if (!error && Array.isArray(data)) {
        return { success: true, data, error: null };
      }
    } catch (rpcErr) {
      console.warn('[LEADERBOARD SERVICE] RPC fallback triggered:', rpcErr.message);
    }

    // Direct Table Fallback Query
    let query = supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, clan_name, level, xp')
      .eq('is_profile_public', true)
      .limit(limitCount);

    if (metric === 'level') {
      query = query.order('level', { ascending: false }).order('xp', { ascending: false });
    } else {
      query = query.order('xp', { ascending: false });
    }

    const { data: profiles, error } = await withTimeout(query, 10000);

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    const ranked = (profiles || []).map((p, idx) => ({
      rank: idx + 1,
      ...p,
      total_distance: 0,
      territories_owned: 0
    }));

    return { success: true, data: ranked, error: null };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};
