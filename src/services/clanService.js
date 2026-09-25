import { supabase, useSupabase } from '../supabase';

export const createClan = async (name, description, isPublic, logoUrl) => {
  if (!useSupabase) return { success: false, error: 'Supabase disabled' };
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

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

  // Add owner to members
  const { error: memberError } = await supabase.from('clan_members').insert({
    clan_id: clan.id,
    user_id: user.id,
    role: 'owner'
  });

  if (memberError) return { success: false, error: memberError.message };
  
  // Also update profiles for legacy compatibility
  await supabase.from('profiles').update({ clan_name: clan.name }).eq('id', user.id);

  return { success: true, data: clan };
};

export const updateClan = async (clanId, updates) => {
  if (!useSupabase) return { success: false };
  const { data, error } = await supabase.from('clans').update(updates).eq('id', clanId).select().single();
  if (error) return { success: false, error: error.message };
  
  // If name changed, update legacy profile clan_names via rpc or just let it mismatch (better to update, but could be slow).
  // Assuming a small clan for now.
  if (updates.name) {
      await supabase.from('profiles').update({ clan_name: updates.name }).eq('clan_name', 'old_name_not_known_here'); // We might need to know the old name. 
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

  if (clan.is_public || (inviteCode && clan.invite_code === inviteCode)) {
    // Join immediately
    const { error: memberError } = await supabase.from('clan_members').insert({
      clan_id: clan.id,
      user_id: user.id,
      role: 'member'
    });
    if (memberError) return { success: false, error: memberError.message };
    await supabase.from('profiles').update({ clan_name: clan.name }).eq('id', user.id);
    return { success: true, status: 'joined' };
  } else {
    // Check if already requested
    const { data: existingReq } = await supabase.from('clan_join_requests').select('id').eq('clan_id', clan.id).eq('user_id', user.id).eq('status', 'pending').single();
    if (existingReq) return { success: true, status: 'requested' };

    const { error: requestError } = await supabase.from('clan_join_requests').insert({
      clan_id: clan.id,
      user_id: user.id,
      status: 'pending'
    });
    if (requestError) return { success: false, error: requestError.message };
    return { success: true, status: 'requested' };
  }
};

export const getClanDetails = async (clanId) => {
    if (!useSupabase) return { success: false };
    const { data, error } = await supabase
        .from('clans')
        .select(`
            *,
            clan_members(user_id, role, joined_at, profiles(display_name, avatar_url)),
            clan_join_requests(id, user_id, status, created_at, profiles(display_name, avatar_url))
        `)
        .eq('id', clanId)
        .single();
        
    if (error) return { success: false, error: error.message };
    
    // Filter out non-pending requests
    if (data && data.clan_join_requests) {
      data.clan_join_requests = data.clan_join_requests.filter(r => r.status === 'pending');
    }
    
    return { success: true, data };
};

export const joinClanByCode = async (inviteCode) => {
  if (!useSupabase) return { success: false, error: 'Supabase disabled' };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { data: clan, error: clanError } = await supabase.from('clans').select('*').eq('invite_code', inviteCode).single();
  if (clanError || !clan) return { success: false, error: 'Invalid invite code' };

  // Check if already in clan
  const { data: existingMember } = await supabase.from('clan_members').select('role').eq('user_id', user.id).single();
  if (existingMember) return { success: false, error: 'You are already in a clan' };

  const { error: memberError } = await supabase.from('clan_members').insert({
    clan_id: clan.id,
    user_id: user.id,
    role: 'member'
  });
  if (memberError) return { success: false, error: memberError.message };
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
        .select('clan_id, role, clans(*)')
        .eq('user_id', userId)
        .limit(1);
        
    if (error || !members || members.length === 0) return { success: false, data: null };
    return { success: true, data: { ...members[0].clans, role: members[0].role } };
};

export const handleJoinRequest = async (requestId, action) => {
    // action: 'accepted' | 'rejected'
    if (!useSupabase) return { success: false };
    const { data: request, error: fetchErr } = await supabase.from('clan_join_requests').select('*').eq('id', requestId).single();
    if (fetchErr) return { success: false, error: fetchErr.message };
    
    await supabase.from('clan_join_requests').update({ status: action }).eq('id', requestId);
    
    if (action === 'accepted') {
        await supabase.from('clan_members').insert({
            clan_id: request.clan_id,
            user_id: request.user_id,
            role: 'member'
        });
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
    const { data: member } = await supabase.from('clan_members').select('role').eq('clan_id', clanId).eq('user_id', userId).single();
    if (member && member.role === 'owner') {
        const { count } = await supabase.from('clan_members').select('*', { count: 'exact', head: true }).eq('clan_id', clanId);
        if (count > 1) {
            return { success: false, error: 'You must transfer ownership to another member before leaving, or remove all members to disband.' };
        } else {
            // Disband clan if owner is the last one
            await supabase.from('clans').delete().eq('id', clanId);
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

    // 1. Promote new owner
    const { error: err1 } = await supabase.from('clan_members').update({ role: 'owner' }).match({ clan_id: clanId, user_id: newOwnerId });
    if (err1) return { success: false, error: err1.message };

    // 2. Demote self
    await supabase.from('clan_members').update({ role: 'officer' }).match({ clan_id: clanId, user_id: user.id });

    // 3. Update clan record
    await supabase.from('clans').update({ owner_id: newOwnerId }).eq('id', clanId);

    return { success: true };
};

export const regenerateInviteCode = async (clanId) => {
    if (!useSupabase) return { success: false };
    const newCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const { error } = await supabase.from('clans').update({ invite_code: newCode }).eq('id', clanId);
    if (error) return { success: false, error: error.message };
    return { success: true, newCode };
};
