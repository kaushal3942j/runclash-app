import { supabase, useSupabase } from '../supabase.js';
import { isValidAuthenticatedUser } from './authService.js';

// Validate clan referential integrity against real public.clans table
export const validateClanIntegrity = async (userUuid, rawClanName) => {
  if (!rawClanName || rawClanName === 'None' || rawClanName === 'null') {
    return 'None';
  }

  if (!useSupabase || !userUuid) return 'None';

  try {
    const { data: matchingClan, error } = await supabase
      .from('clans')
      .select('id, name')
      .eq('name', rawClanName)
      .maybeSingle();

    if (error || !matchingClan) {
      console.warn(`[CLAN INTEGRITY] Ghost clan "${rawClanName}" detected for user ${userUuid}. Repairing profile to "None".`);

      // Repair profile in public.profiles for authenticated user only
      await supabase
        .from('profiles')
        .update({ clan_name: 'None', updated_at: new Date().toISOString() })
        .eq('id', userUuid);

      return 'None';
    }

    return matchingClan.name;
  } catch (err) {
    console.error('[CLAN INTEGRITY] Error validating clan integrity:', err);
    return 'None';
  }
};

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

    // Validate clan referential integrity against public.clans
    const validClan = await validateClanIntegrity(userId, data.clan_name);
    data.clan_name = validClan;

    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const isDefaultName = (name) => {
  if (!name || typeof name !== 'string') return true;
  const lower = name.trim().toLowerCase();
  return lower === '' || lower === 'runner' || lower === 'guest runner' || lower === 'guest' || lower === 'offline runner';
};

export const ensureProfile = async (user, preferredDisplayName = 'Guest Runner', legacyData = null) => {
  if (!useSupabase || !isValidAuthenticatedUser(user)) {
    return { success: false, data: null, error: 'User must be a valid authenticated Supabase identity.' };
  }

  try {
    const customPreferred = (!isDefaultName(preferredDisplayName) ? preferredDisplayName : (legacyData?.displayName && !isDefaultName(legacyData.displayName) ? legacyData.displayName : null)) || null;

    // 1. Check if profile already exists in public.profiles
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (existing) {
      const validClan = await validateClanIntegrity(user.id, existing.clan_name);
      existing.clan_name = validClan;

      // RACE FIX: If existing name in DB is default ('Runner' / 'Guest Runner') AND we have a custom name, update Supabase!
      if (customPreferred && isDefaultName(existing.display_name)) {
        console.log(`[PROFILE RACE FIX] Overwriting default DB display_name "${existing.display_name}" with custom name "${customPreferred}" for user ${user.id}`);
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

    // 2. Build safe profile payload — validate clan first!
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
    if (patch.clan !== undefined) {
      mapped.clan_name = await validateClanIntegrity(userId, patch.clan);
    }
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
