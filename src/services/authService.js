import { supabase, useSupabase } from '../supabase.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidAuthenticatedUser = (user) => {
  return !!(user && user.id && UUID_REGEX.test(user.id));
};

export const getCurrentSession = async () => {
  if (!useSupabase) {
    return { success: false, data: null, error: 'Supabase client disabled.' };
  }

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      return { success: false, data: null, error: error.message };
    }
    return { success: true, data: data?.session || null, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

let pendingAnonSessionPromise = null;

export const createAnonymousSession = async () => {
  if (!useSupabase) {
    return { success: false, data: null, error: 'Supabase client disabled.' };
  }

  // 1. Double check existing session first
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session?.user) {
      return { success: true, data: sessionData.session, user: sessionData.session.user, error: null };
    }
  } catch (e) {
    console.warn('[AUTH] Error checking session before anonymous sign-in:', e);
  }

  // 2. Single-flight request deduplication: reuse in-flight promise if active
  if (pendingAnonSessionPromise) {
    return await pendingAnonSessionPromise;
  }

  pendingAnonSessionPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        const isProviderDisabled = error.code === 'anonymous_provider_disabled' ||
                                   (error.message && error.message.toLowerCase().includes('anonymous'));

        return {
          success: false,
          data: null,
          error: isProviderDisabled ? 'anonymous_provider_disabled' : error.message,
          message: isProviderDisabled
            ? 'Enable Supabase Dashboard → Authentication → Providers → Anonymous Sign-Ins'
            : error.message
        };
      }
      return { success: true, data: data?.session || null, user: data?.user || null, error: null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    } finally {
      pendingAnonSessionPromise = null;
    }
  })();

  return await pendingAnonSessionPromise;
};

export const recoverSession = async () => {
  return await getCurrentSession();
};

export const signOut = async () => {
  if (!useSupabase) {
    return { success: true, data: null, error: null };
  }

  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { success: false, data: null, error: error.message };
    }
    return { success: true, data: null, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};
