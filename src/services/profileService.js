import { supabase, useSupabase } from '../supabase';
import { isValidAuthenticatedUser } from './authService';

export const loadProfile = async (userId) => {
  if (!useSupabase || !userId) {
    return { success: false, data: null, error: 'Invalid user or Supabase disabled.' };
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      return { success: false, data: null, error: error.message };
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const ensureProfile = async (user, preferredDisplayName = 'Guest Runner', legacyData = null) => {
  if (!useSupabase || !isValidAuthenticatedUser(user)) {
    return { success: false, data: null, error: 'User must be a valid authenticated Supabase identity.' };
  }

  try {
    // 1. Check if profile already exists in public.profiles
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) {
      return { success: true, data: existing, created: false, error: null };
    }

    // 2. Build safe profile payload
    const profilePayload = {
      id: user.id,
      display_name: legacyData?.displayName || preferredDisplayName || 'Guest Runner',
      level: legacyData?.level || 1,
      xp: legacyData?.xp || 0,
      coins: legacyData?.coins || 0,
      premium: legacyData?.premium || false,
      clan_name: legacyData?.clan || 'None',
      updated_at: new Date().toISOString()
    };

    // 3. Perform safe own-profile upsert
    const { data: newProfile, error: upsertError } = await supabase
      .from('profiles')
      .upsert(profilePayload)
      .select()
      .single();

    if (upsertError) {
      return { success: false, data: null, error: upsertError.message };
    }

    return { success: true, data: newProfile, created: true, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const updateOwnProfile = async (userId, activeSessionUserId, patch) => {
  if (!useSupabase) {
    return { success: false, data: null, error: 'Supabase disabled.' };
  }

  if (!userId || !activeSessionUserId || userId !== activeSessionUserId) {
    return { 
      success: false, 
      data: null, 
      error: 'Security Policy Error: Profile updates are strictly restricted to authenticated session owner.' 
    };
  }

  try {
    const mapped = { updated_at: new Date().toISOString() };
    if (patch.displayName !== undefined) mapped.display_name = patch.displayName;
    if (patch.clan !== undefined) mapped.clan_name = patch.clan;
    if (patch.level !== undefined) mapped.level = patch.level;
    if (patch.xp !== undefined) mapped.xp = patch.xp;
    if (patch.coins !== undefined) mapped.coins = patch.coins;
    if (patch.premium !== undefined) mapped.premium = patch.premium;

    const { data, error } = await supabase
      .from('profiles')
      .update(mapped)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { success: false, data: null, error: error.message };
    }

    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};
