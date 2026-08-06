import { supabase, useSupabase } from '../supabase.js';

const withTimeout = (promise, ms = 10000) => {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error('Request timed out.')), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
};

export const sendFriendRequest = async (targetUserId) => {
  if (!useSupabase || !targetUserId) {
    return { success: false, data: null, error: 'Target user ID is required.' };
  }

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('send_friend_request', { target_user_id: targetUserId }),
      10000
    );
    if (error) {
      return { success: false, data: null, error: error.message };
    }
    if (!data || !data.success) {
      return { success: false, data: null, error: data?.error || 'Failed to send friend request' };
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const acceptFriendRequest = async (requestId) => {
  if (!useSupabase || !requestId) {
    return { success: false, data: null, error: 'Request ID is required.' };
  }

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('respond_to_friend_request', {
        p_request_id: requestId,
        p_response: 'accept'
      }),
      10000
    );
    if (error) {
      return { success: false, data: null, error: error.message };
    }
    if (!data || !data.success) {
      return { success: false, data: null, error: data?.error || 'Failed to accept friend request' };
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const rejectFriendRequest = async (requestId) => {
  if (!useSupabase || !requestId) {
    return { success: false, data: null, error: 'Request ID is required.' };
  }

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('respond_to_friend_request', {
        p_request_id: requestId,
        p_response: 'reject'
      }),
      10000
    );
    if (error) {
      return { success: false, data: null, error: error.message };
    }
    if (!data || !data.success) {
      return { success: false, data: null, error: data?.error || 'Failed to reject friend request' };
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const cancelFriendRequest = async (requestId) => {
  if (!useSupabase || !requestId) {
    return { success: false, data: null, error: 'Request ID is required.' };
  }

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('cancel_friend_request', { p_request_id: requestId }),
      10000
    );
    if (error) {
      return { success: false, data: null, error: error.message };
    }
    if (!data || !data.success) {
      return { success: false, data: null, error: data?.error || 'Failed to cancel request' };
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const removeFriend = async (friendUserId) => {
  if (!useSupabase || !friendUserId) {
    return { success: false, data: null, error: 'Friend user ID is required.' };
  }

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('remove_friend', { friend_user_id: friendUserId }),
      10000
    );
    if (error) {
      return { success: false, data: null, error: error.message };
    }
    if (!data || !data.success) {
      return { success: false, data: null, error: data?.error || 'Failed to remove friend' };
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const blockUser = async (targetUserId) => {
  if (!useSupabase || !targetUserId) {
    return { success: false, data: null, error: 'Target user ID is required.' };
  }

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('block_user', { target_user_id: targetUserId }),
      10000
    );
    if (error) {
      return { success: false, data: null, error: error.message };
    }
    return { success: true, data: data || { success: true }, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const unblockUser = async (targetUserId) => {
  if (!useSupabase || !targetUserId) {
    return { success: false, data: null, error: 'Target user ID is required.' };
  }

  try {
    const { data, error } = await withTimeout(
      supabase.rpc('unblock_user', { target_user_id: targetUserId }),
      10000
    );
    if (error) {
      return { success: false, data: null, error: error.message };
    }
    return { success: true, data: data || { success: true }, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const updateLastActive = async () => {
  if (!useSupabase) return { success: true };
  try {
    await withTimeout(supabase.rpc('update_last_active'), 5000);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
};

export const getFriends = async () => {
  if (!useSupabase) {
    return { success: true, data: [], error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: true, data: [], error: null };
    }

    const userId = session.user.id;

    const { data: friendships, error: fErr } = await withTimeout(
      supabase
        .from('friendships')
        .select('user_one_id, user_two_id')
        .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`),
      10000
    );

    if (fErr) {
      return { success: false, data: [], error: fErr.message };
    }

    const friendIds = (friendships || []).map(f => f.user_one_id === userId ? f.user_two_id : f.user_one_id);

    if (friendIds.length === 0) {
      return { success: true, data: [], error: null };
    }

    const { data: friendProfiles, error: pErr } = await withTimeout(
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, clan_name, level, xp, last_active_at')
        .in('id', friendIds),
      10000
    );

    if (pErr) {
      return { success: false, data: [], error: pErr.message };
    }

    return { success: true, data: friendProfiles || [], error: null };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};

export const getIncomingRequests = async () => {
  if (!useSupabase) {
    return { success: true, data: [], error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: true, data: [], error: null };
    }

    const { data, error } = await withTimeout(
      supabase
        .from('friend_requests')
        .select('id, sender_id, created_at, status')
        .eq('receiver_id', session.user.id)
        .eq('status', 'pending'),
      10000
    );

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, data: [], error: null };
    }

    const senderIds = data.map(r => r.sender_id);
    const { data: senderProfiles } = await withTimeout(
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, clan_name, level')
        .in('id', senderIds),
      10000
    );

    const profileMap = new Map((senderProfiles || []).map(p => [p.id, p]));

    const enriched = data.map(req => ({
      ...req,
      sender: profileMap.get(req.sender_id) || { id: req.sender_id, display_name: 'Runner', level: 1 }
    }));

    return { success: true, data: enriched, error: null };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};

export const getOutgoingRequests = async () => {
  if (!useSupabase) {
    return { success: true, data: [], error: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { success: true, data: [], error: null };
    }

    const { data, error } = await withTimeout(
      supabase
        .from('friend_requests')
        .select('id, receiver_id, created_at, status')
        .eq('sender_id', session.user.id)
        .eq('status', 'pending'),
      10000
    );

    if (error) {
      return { success: false, data: [], error: error.message };
    }

    if (!data || data.length === 0) {
      return { success: true, data: [], error: null };
    }

    const receiverIds = data.map(r => r.receiver_id);
    const { data: receiverProfiles } = await withTimeout(
      supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, clan_name, level')
        .in('id', receiverIds),
      10000
    );

    const profileMap = new Map((receiverProfiles || []).map(p => [p.id, p]));

    const enriched = data.map(req => ({
      ...req,
      receiver: profileMap.get(req.receiver_id) || { id: req.receiver_id, display_name: 'Runner', level: 1 }
    }));

    return { success: true, data: enriched, error: null };
  } catch (err) {
    return { success: false, data: [], error: err.message };
  }
};

export const getRelationshipState = async (targetUserId) => {
  if (!useSupabase || !targetUserId) {
    return { state: 'self', requestId: null };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !session.user) {
      return { state: 'unauthenticated', requestId: null };
    }

    const currentUserId = session.user.id;
    if (currentUserId === targetUserId) {
      return { state: 'self', requestId: null };
    }

    // Check block
    const { data: block } = await withTimeout(
      supabase
        .from('blocks')
        .select('blocker_id')
        .or(`and(blocker_id.eq.${currentUserId},blocked_id.eq.${targetUserId}),and(blocker_id.eq.${targetUserId},blocked_id.eq.${currentUserId})`)
        .maybeSingle(),
      8000
    );

    if (block) {
      return { state: 'blocked', isBlocker: block.blocker_id === currentUserId, requestId: null };
    }

    // Check friendship
    const u1 = currentUserId < targetUserId ? currentUserId : targetUserId;
    const u2 = currentUserId < targetUserId ? targetUserId : currentUserId;

    const { data: friendship } = await withTimeout(
      supabase
        .from('friendships')
        .select('id')
        .eq('user_one_id', u1)
        .eq('user_two_id', u2)
        .maybeSingle(),
      8000
    );

    if (friendship) {
      return { state: 'friends', requestId: null };
    }

    // Check pending request
    const { data: pendingReq } = await withTimeout(
      supabase
        .from('friend_requests')
        .select('id, sender_id, receiver_id')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${currentUserId})`)
        .eq('status', 'pending')
        .maybeSingle(),
      8000
    );

    if (pendingReq) {
      if (pendingReq.sender_id === currentUserId) {
        return { state: 'outgoing_pending', requestId: pendingReq.id };
      } else {
        return { state: 'incoming_pending', requestId: pendingReq.id };
      }
    }

    return { state: 'none', requestId: null };
  } catch (err) {
    console.warn('[FRIEND SERVICE] Relationship state notice:', err.message);
    return { state: 'none', requestId: null };
  }
};

export const subscribeToFriendRequests = (userId, onUpdate) => {
  if (!useSupabase || !userId) {
    return { unsubscribe: () => {} };
  }

  const channel = supabase
    .channel(`public:friend_requests:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `receiver_id=eq.${userId}`
      },
      () => { if (onUpdate) onUpdate(); }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friend_requests',
        filter: `sender_id=eq.${userId}`
      },
      () => { if (onUpdate) onUpdate(); }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    }
  };
};

export const subscribeToFriendships = (userId, onUpdate) => {
  if (!useSupabase || !userId) {
    return { unsubscribe: () => {} };
  }

  const channel = supabase
    .channel(`public:friendships:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `user_one_id=eq.${userId}`
      },
      () => { if (onUpdate) onUpdate(); }
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'friendships',
        filter: `user_two_id=eq.${userId}`
      },
      () => { if (onUpdate) onUpdate(); }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      supabase.removeChannel(channel);
    }
  };
};
