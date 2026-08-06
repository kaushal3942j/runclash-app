import { supabase, useSupabase } from '../supabase.js';

export const getLeaderboard = async (metric = 'xp', timePeriod = 'all_time', scope = 'global', limitCount = 100) => {
  if (!useSupabase) {
    return { success: true, data: [], error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    if (scope === 'friends') {
      if (!currentUserId) {
        return { success: true, data: [], error: null };
      }

      // Fetch user's friends
      const { data: friendships } = await supabase
        .from('friendships')
        .select('user_one_id, user_two_id')
        .or(`user_one_id.eq.${currentUserId},user_two_id.eq.${currentUserId}`);

      const friendIds = (friendships || []).map(f => f.user_one_id === currentUserId ? f.user_two_id : f.user_one_id);
      const allowedUserIds = [currentUserId, ...friendIds];

      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, clan_name, level, xp')
        .in('id', allowedUserIds);

      if (pErr) {
        return { success: false, data: [], error: pErr.message };
      }

      const list = (profiles || []).map((p, idx) => ({
        rank: idx + 1,
        id: p.id,
        display_name: p.display_name,
        username: p.username,
        avatar_url: p.avatar_url,
        clan_name: p.clan_name,
        level: p.level,
        xp: p.xp,
        total_distance: 0,
        territories_owned: 0
      })).sort((a, b) => b.xp - a.xp).map((p, idx) => ({ ...p, rank: idx + 1 }));

      return { success: true, data: list, error: null };
    }

    // Call RPC get_leaderboard_v2
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_leaderboard_v2', {
      p_metric: metric,
      p_time_period: timePeriod,
      p_scope: scope,
      p_limit_count: limitCount
    });

    if (!rpcErr && rpcData) {
      return { success: true, data: rpcData, error: null };
    }

    // Fallback directly to public.profiles query if RPC is not yet created in DB
    const { data: fallbackProfiles, error: fbErr } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, clan_name, level, xp')
      .eq('is_profile_public', true)
      .order('xp', { ascending: false })
      .limit(limitCount);

    if (fbErr) {
      return { success: false, data: [], error: fbErr.message };
    }

    const fallbackList = (fallbackProfiles || []).map((p, idx) => ({
      rank: idx + 1,
      id: p.id,
      display_name: p.display_name,
      username: p.username,
      avatar_url: p.avatar_url,
      clan_name: p.clan_name,
      level: p.level,
      xp: p.xp,
      total_distance: 0,
      territories_owned: 0
    }));

    return { success: true, data: fallbackList, error: null };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};
