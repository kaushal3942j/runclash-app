import { supabase, useSupabase } from '../supabase.js';

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

    return { success: true, data: rpcData || [], error: null };
  } catch (err) {
    console.error('[LeaderboardService] Service exception:', err);
    return { success: false, data: [], error: err.message || 'An unexpected error occurred while fetching leaderboard.' };
  }
};
