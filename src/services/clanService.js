import { supabase, useSupabase } from '../supabase';

export const createClan = async (name, description, isPublic, logoUrl) => {
  if (!useSupabase) return { success: false, error: 'Supabase disabled' };
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Check if user already belongs to a clan
  const { data: existingMembership } = await supabase
    .from('clan_members')
    .select('clan_id')
    .eq('user_id', user.id)
    .limit(1);

  if (existingMembership && existingMembership.length > 0) {
    return { success: false, error: 'You must leave your current clan before creating a new one.' };
  }

  // Check if name taken
  const { data: existing } = await supabase.from('clans').select('id').ilike('name', name.trim()).limit(1);
  if (existing && existing.length > 0) return { success: false, error: 'Clan name already taken' };

  // Generate invite code
  const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();

  // Insert clan
  const { data: clan, error: clanError } = await supabase.from('clans').insert({
    name: name.trim(),
    description,
    is_public: isPublic,
    logo_url: logoUrl,
    invite_code: inviteCode,
    owner_id: user.id
  }).select().single();

  if (clanError) return { success: false, error: clanError.message };

  // Ensure owner is present in clan_members idempotently (in case trigger was not applied or raced)
  try {
    await supabase.from('clan_members').upsert({
      clan_id: clan.id,
      user_id: user.id,
      role: 'owner'
    }, { onConflict: 'clan_id,user_id' });
  } catch (err) {
    console.warn('[ClanService] Owner membership guarantee notice:', err);
  }

  // Synchronize profile clan_name
  await supabase.from('profiles').update({ clan_name: clan.name }).eq('id', user.id);

  return { success: true, data: clan };
};

export const updateClan = async (clanId, updates) => {
  if (!useSupabase) return { success: false };
  const { data, error } = await supabase.from('clans').update(updates).eq('id', clanId).select().single();
  if (error) return { success: false, error: error.message };
  
  // If name changed, synchronize all clan members' profile clan_names
  if (updates.name && updates.name.trim()) {
    try {
      const { data: members } = await supabase
        .from('clan_members')
        .select('user_id')
        .eq('clan_id', clanId);

      if (members && members.length > 0) {
        const memberUserIds = members.map(m => m.user_id);
        await supabase
          .from('profiles')
          .update({ clan_name: updates.name.trim() })
          .in('id', memberUserIds);
      }
    } catch (syncErr) {
      console.warn('[ClanService] Failed to synchronize profile clan names on rename:', syncErr);
    }
  }
  
  return { success: true, data };
};

export const joinClan = async (clanId, inviteCode = null) => {
  if (!useSupabase) return { success: false, error: 'Supabase disabled' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Get clan
  const { data: clan, error: clanError } = await supabase.from('clans').select('*').eq('id', clanId).single();
  if (clanError || !clan) return { success: false, error: 'Clan not found' };

  // 1. Check if user is already a member of this clan
  // Creating a clan automatically adds its owner to clan_members.
  // Treat repeat joins as success instead of surfacing the primary-key error.
  const { data: existingMemberThisClan, error: membershipCheckError } = await supabase
    .from('clan_members')
    .select('role')
    .eq('clan_id', clan.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipCheckError) {
    return { success: false, error: membershipCheckError.message };
  }

  if (existingMemberThisClan) {
    // Keep profile synchronized and return friendly already-member status
    await supabase.from('profiles').update({ clan_name: clan.name }).eq('id', user.id);
    return {
      success: true,
      status: 'already_member',
      role: existingMemberThisClan.role,
      message: `You are already a member of ${clan.name}.`
    };
  }

  // 2. Check if user is already in another clan
  const { data: existingMemberOtherClan, error: otherClanCheckError } = await supabase
    .from('clan_members')
    .select('clan_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (otherClanCheckError) {
    return { success: false, error: otherClanCheckError.message };
  }

  if (existingMemberOtherClan && existingMemberOtherClan.clan_id !== clan.id) {
    return { success: false, error: 'You are already in a clan. Leave your current clan before joining another.' };
  }

  if (clan.is_public || (inviteCode && clan.invite_code === inviteCode)) {
    // Join immediately
    const { error: memberError } = await supabase.from('clan_members').insert({
      clan_id: clan.id,
      user_id: user.id,
      role: 'member'
    });

    if (memberError) {
      // Handle race condition where user was inserted concurrently
      if (memberError.code === '23505' || memberError.message?.includes('clan_members_pkey') || memberError.message?.includes('duplicate key')) {
        await supabase.from('profiles').update({ clan_name: clan.name }).eq('id', user.id);
        return { success: true, status: 'already_member', role: 'member', message: `You are already a member of ${clan.name}.` };
      }
      return { success: false, error: memberError.message };
    }

    await supabase.from('profiles').update({ clan_name: clan.name }).eq('id', user.id);
    return { success: true, status: 'joined' };
  } else {
    // Check if pending request already exists
    const { data: existingReq } = await supabase
      .from('clan_join_requests')
      .select('id')
      .eq('clan_id', clan.id)
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingReq) {
      return { success: true, status: 'requested', message: 'Join request already submitted. Waiting for approval.' };
    }

    const { error: requestError } = await supabase.from('clan_join_requests').insert({
      clan_id: clan.id,
      user_id: user.id,
      status: 'pending'
    });

    if (requestError) {
      // Handle unique constraint race on join requests
      if (requestError.code === '23505' || requestError.message?.includes('duplicate key')) {
        return { success: true, status: 'requested', message: 'Join request already submitted. Waiting for approval.' };
      }
      return { success: false, error: requestError.message };
    }

    return { success: true, status: 'requested' };
  }
};

export const getClanDetails = async (clanId) => {
  if (!useSupabase) return { success: false };
  const { data: clanData, error } = await supabase
    .from('clans')
    .select(`
      *,
      clan_members(user_id, role, joined_at),
      clan_join_requests(id, user_id, status, created_at)
    `)
    .eq('id', clanId)
    .single();
      
  if (error || !clanData) return { success: false, error: error?.message || 'Not found' };
  
  // Filter out non-pending requests
  if (clanData.clan_join_requests) {
    clanData.clan_join_requests = clanData.clan_join_requests.filter(r => r.status === 'pending');
  }

  // Collect all user IDs to fetch profiles manually
  const userIds = [
    ...(clanData.clan_members?.map(m => m.user_id) || []),
    ...(clanData.clan_join_requests?.map(r => r.user_id) || [])
  ];
  
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', userIds);
      
    if (profiles) {
      const profileMap = {};
      profiles.forEach(p => { profileMap[p.id] = p; });
      
      clanData.clan_members?.forEach(m => {
        m.profiles = profileMap[m.user_id] || { display_name: 'Unknown', avatar_url: null };
      });
      
      clanData.clan_join_requests?.forEach(r => {
        r.profiles = profileMap[r.user_id] || { display_name: 'Unknown', avatar_url: null };
      });
    }
  }
  
  return { success: true, data: clanData };
};

export const joinClanByCode = async (inviteCode) => {
  if (!useSupabase) return { success: false, error: 'Supabase disabled' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: clan, error: clanError } = await supabase.from('clans').select('*').eq('invite_code', inviteCode.trim().toUpperCase()).maybeSingle();
  if (clanError || !clan) return { success: false, error: 'Invalid invite code.' };

  // Check if user is already a member of this clan
  const { data: existingMemberThisClan, error: membershipCheckError } = await supabase
    .from('clan_members')
    .select('role')
    .eq('clan_id', clan.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (membershipCheckError) {
    return { success: false, error: membershipCheckError.message };
  }

  if (existingMemberThisClan) {
    await supabase.from('profiles').update({ clan_name: clan.name }).eq('id', user.id);
    return {
      success: true,
      status: 'already_member',
      clanName: clan.name,
      role: existingMemberThisClan.role,
      message: `You are already a member of ${clan.name}.`
    };
  }

  // Check if user is already in another clan
  const { data: existingMemberOtherClan, error: otherClanCheckError } = await supabase
    .from('clan_members')
    .select('clan_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (otherClanCheckError) {
    return { success: false, error: otherClanCheckError.message };
  }

  if (existingMemberOtherClan && existingMemberOtherClan.clan_id !== clan.id) {
    return { success: false, error: 'You are already in a clan. Leave your current clan before joining another.' };
  }

  const { error: memberError } = await supabase.from('clan_members').insert({
    clan_id: clan.id,
    user_id: user.id,
    role: 'member'
  });

  if (memberError) {
    if (memberError.code === '23505' || memberError.message?.includes('clan_members_pkey') || memberError.message?.includes('duplicate key')) {
      await supabase.from('profiles').update({ clan_name: clan.name }).eq('id', user.id);
      return { success: true, status: 'already_member', clanName: clan.name, role: 'member', message: `You are already a member of ${clan.name}.` };
    }
    return { success: false, error: memberError.message };
  }

  await supabase.from('profiles').update({ clan_name: clan.name }).eq('id', user.id);
  return { success: true, clanName: clan.name };
};

export const getPublicClans = async () => {
  if (!useSupabase) return { success: false, data: [] };
  const { data, error } = await supabase.from('clans').select('*').order('created_at', { ascending: false });
  if (error) return { success: false, data: [], error: error.message };
  return { success: true, data };
};

export const getUserClan = async (userId) => {
  if (!useSupabase) return { success: false, data: null };
  const { data: members, error } = await supabase
    .from('clan_members')
    .select('clan_id, role')
    .eq('user_id', userId)
    .limit(1);
      
  if (error || !members || members.length === 0) return { success: false, data: null };
  
  const { data: clanData } = await supabase.from('clans').select('*').eq('id', members[0].clan_id).single();
  if (!clanData) return { success: false, data: null };
  
  return { success: true, data: { ...clanData, role: members[0].role } };
};

export const handleJoinRequest = async (requestId, action) => {
  // action: 'accepted' | 'rejected'
  if (!useSupabase) return { success: false };
  const { data: request, error: fetchErr } = await supabase.from('clan_join_requests').select('*').eq('id', requestId).single();
  if (fetchErr) return { success: false, error: fetchErr.message };
  
  await supabase.from('clan_join_requests').update({ status: action }).eq('id', requestId);
  
  if (action === 'accepted') {
    const { error: memberError } = await supabase.from('clan_members').insert({
      clan_id: request.clan_id,
      user_id: request.user_id,
      role: 'member'
    });

    if (memberError && memberError.code !== '23505' && !memberError.message?.includes('duplicate key')) {
      return { success: false, error: memberError.message };
    }

    const { data: clan } = await supabase.from('clans').select('name').eq('id', request.clan_id).single();
    if (clan) {
      await supabase.from('profiles').update({ clan_name: clan.name }).eq('id', request.user_id);
    }
  }
  return { success: true };
};

export const leaveClan = async (userId, clanId) => {
  if (!useSupabase) return { success: false };

  // Check if owner and alone
  const { data: member } = await supabase
    .from('clan_members')
    .select('role')
    .eq('clan_id', clanId)
    .eq('user_id', userId)
    .maybeSingle();

  if (member && member.role === 'owner') {
    const { count } = await supabase.from('clan_members').select('*', { count: 'exact', head: true }).eq('clan_id', clanId);
    if (count > 1) {
      return { success: false, error: 'You must transfer ownership to another member before leaving, or remove all members to disband.' };
    } else {
      // Disband clan if owner is the last one
      await supabase.from('clans').delete().eq('id', clanId);
      await supabase.from('clan_members').delete().match({ clan_id: clanId, user_id: userId });
      await supabase.from('profiles').update({ clan_name: 'None' }).eq('id', userId);
      return { success: true, disbanded: true };
    }
  }

  await supabase.from('clan_members').delete().match({ clan_id: clanId, user_id: userId });
  await supabase.from('profiles').update({ clan_name: 'None' }).eq('id', userId);
  return { success: true };
};

export const updateMemberRole = async (clanId, userId, newRole) => {
  if (!useSupabase) return { success: false };
  const { error } = await supabase.from('clan_members').update({ role: newRole }).match({ clan_id: clanId, user_id: userId });
  if (error) return { success: false, error: error.message };
  return { success: true };
};

export const removeMember = async (clanId, userId) => {
  if (!useSupabase) return { success: false };
  const { error } = await supabase.from('clan_members').delete().match({ clan_id: clanId, user_id: userId });
  if (error) return { success: false, error: error.message };
  await supabase.from('profiles').update({ clan_name: 'None' }).eq('id', userId);
  return { success: true };
};

export const transferOwnership = async (clanId, newOwnerId) => {
  if (!useSupabase) return { success: false };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // Update clan record (Database trigger will handle roles)
  const { error } = await supabase.from('clans').update({ owner_id: newOwnerId }).eq('id', clanId);
  if (error) return { success: false, error: error.message };

  return { success: true };
};

export const regenerateInviteCode = async (clanId) => {
  if (!useSupabase) return { success: false };
  const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
  const { error } = await supabase.from('clans').update({ invite_code: newCode }).eq('id', clanId);
  if (error) return { success: false, error: error.message };
  return { success: true, newCode };
};
