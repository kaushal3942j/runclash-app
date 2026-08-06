import { supabase, useSupabase } from '../supabase.js';

const withTimeout = (promise, ms = 10000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timed out.')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

export const getActivityFeed = async (filter = 'friends', limitCount = 20, beforeTimestamp = null) => {
  if (!useSupabase) {
    return { success: true, data: [], error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUserId = session?.user?.id;

    let query = supabase
      .from('activity_feed')
      .select('id, actor_id, activity_type, run_id, territory_id, clan_id, source_type, source_id, metadata, visibility, created_at')
      .order('created_at', { ascending: false })
      .limit(limitCount);

    if (beforeTimestamp) {
      query = query.lt('created_at', beforeTimestamp);
    }

    if (filter === 'mine') {
      if (!currentUserId) return { success: true, data: [], error: null };
      query = query.eq('actor_id', currentUserId);
    } else if (filter === 'friends') {
      if (!currentUserId) return { success: true, data: [], error: null };

      const { data: friendships } = await withTimeout(
        supabase
          .from('friendships')
          .select('user_one_id, user_two_id')
          .or(`user_one_id.eq.${currentUserId},user_two_id.eq.${currentUserId}`),
        8000
      );

      const friendIds = (friendships || []).map(f => f.user_one_id === currentUserId ? f.user_two_id : f.user_one_id);
      const allowedActorIds = [currentUserId, ...friendIds];

      query = query.in('actor_id', allowedActorIds);
    } else {
      // Global feed
      query = query.eq('visibility', 'public');
    }

    const { data: activities, error: actErr } = await withTimeout(query, 10000);
    if (actErr) {
      return { success: false, data: [], error: actErr.message };
    }

    if (!activities || activities.length === 0) {
      return { success: true, data: [], error: null };
    }

    // Enrich actor profiles
    const actorIds = [...new Set(activities.map(a => a.actor_id))];
    const { data: actorProfiles } = await withTimeout(
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, clan_name, level')
        .in('id', actorIds),
      10000
    );

    const profileMap = new Map((actorProfiles || []).map(p => [p.id, p]));

    const enriched = activities.map(act => ({
      ...act,
      actor: profileMap.get(act.actor_id) || { id: act.actor_id, display_name: 'Runner', level: 1 }
    }));

    return { success: true, data: enriched, error: null };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};

export const createRunActivity = async (runData, sourceType = 'run', sourceId = null) => {
  if (!useSupabase || !runData) return { success: false };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return { success: false };

    const effectiveSourceId = sourceId || runData.operationId || runData.id || `run_${Date.now()}`;

    const { data, error } = await withTimeout(
      supabase
        .from('activity_feed')
        .upsert(
          {
            actor_id: session.user.id,
            activity_type: 'run_completed',
            run_id: runData.id || null,
            source_type: sourceType,
            source_id: effectiveSourceId,
            metadata: {
              distance: runData.distance,
              duration: runData.duration,
              pace: runData.pace,
              avgSpeed: runData.avgSpeed || runData.speed,
              calories: runData.calories
            },
            visibility: 'public'
          },
          { onConflict: 'actor_id,activity_type,source_type,source_id', ignoreDuplicates: true }
        )
        .select()
        .maybeSingle(),
      10000
    );

    if (error) {
      console.warn('[ACTIVITY SERVICE] Notice logging run activity:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const createTerritoryActivity = async (territoryData, sourceType = 'territory', sourceId = null) => {
  if (!useSupabase || !territoryData) return { success: false };

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) return { success: false };

    const effectiveSourceId = sourceId || territoryData.claimId || territoryData.id || `terr_${Date.now()}`;

    const { data, error } = await withTimeout(
      supabase
        .from('activity_feed')
        .upsert(
          {
            actor_id: session.user.id,
            activity_type: 'territory_claimed',
            territory_id: territoryData.id || null,
            source_type: sourceType,
            source_id: effectiveSourceId,
            metadata: {
              name: territoryData.name,
              area: territoryData.area
            },
            visibility: 'public'
          },
          { onConflict: 'actor_id,activity_type,source_type,source_id', ignoreDuplicates: true }
        )
        .select()
        .maybeSingle(),
      10000
    );

    if (error) {
      console.warn('[ACTIVITY SERVICE] Notice logging territory activity:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const subscribeToActivityFeed = (onActivity) => {
  if (!useSupabase) {
    return { unsubscribe: () => {} };
  }

  const channel = supabase
    .channel('public:activity_feed')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_feed'
      },
      (payload) => {
        if (payload.new && onActivity) {
          onActivity(payload.new);
        }
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    }
  };
};
