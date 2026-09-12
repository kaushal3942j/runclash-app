import { supabase, useSupabase } from '../supabase.js';
import { Device } from '@capacitor/device';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidAuthenticatedUser = (user) => {
  return !!(user && user.id && UUID_REGEX.test(user.id));
};

export const getDeviceId = async () => {
  try {
    const info = await Device.getId();
    return info.identifier;
  } catch (e) {
    console.warn("Could not get device ID", e);
    let localId = localStorage.getItem('clash_web_device_id');
    if (!localId) {
      localId = 'web_' + Date.now() + '_' + Math.random().toString(36).substring(7);
      localStorage.setItem('clash_web_device_id', localId);
    }
    return localId;
  }
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

  // 1.5. Try to recover existing anonymous session from custom storage via device ID
  try {
    const deviceId = await getDeviceId();
    const savedToken = localStorage.getItem('clash_guest_refresh_token_' + deviceId);
    if (savedToken) {
      const { data, error } = await supabase.auth.setSession({ refresh_token: savedToken });
      if (!error && data?.session?.user) {
         console.log('[AUTH] Recovered persistent guest session for device:', deviceId);
         return { success: true, data: data.session, user: data.session.user, error: null };
      } else {
         localStorage.removeItem('clash_guest_refresh_token_' + deviceId);
      }
    }
  } catch(e) {
     console.warn('[AUTH] Error attempting to restore guest token:', e);
  }

  // 2. Single-flight request deduplication: reuse in-flight promise if active
  if (pendingAnonSessionPromise) {
    return await pendingAnonSessionPromise;
  }

  pendingAnonSessionPromise = (async () => {
    try {
      const deviceId = await getDeviceId();

      // Enforce Guest Limits (Max 3 per device)
      const { count, error: countError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('device_id', deviceId)
        .eq('is_guest', true);
        
      if (!countError && count >= 3) {
        return {
          success: false,
          data: null,
          error: 'guest_limit_reached',
          message: 'Maximum number of guest accounts reached for this device. Please verify your phone number or sign in.'
        };
      }

      const { data, error } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            device_id: deviceId
          }
        }
      });
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
      
      // Successfully created a new anonymous session. Store its refresh token securely.
      if (data?.session?.refresh_token) {
        try {
          const deviceId = await getDeviceId();
          localStorage.setItem('clash_guest_refresh_token_' + deviceId, data.session.refresh_token);
          console.log('[AUTH] Saved new guest refresh token for device:', deviceId);
        } catch (deviceErr) {
          console.warn('[AUTH] Could not save guest token:', deviceErr);
        }
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

export const requestPhoneOtp = async (phone) => {
  if (!useSupabase) {
    return { success: false, data: null, error: 'Supabase client disabled.' };
  }

  try {
    const { data, error } = await supabase.auth.updateUser({
      phone
    });

    if (error) {
      if (error.status === 400 || (error.message && error.message.toLowerCase().includes('provider is disabled')) || (error.message && error.message.toLowerCase().includes('sms provider'))) {
        return { success: false, data: null, error: 'unsupported_phone_provider' };
      }
      return { success: false, data: null, error: error.message };
    }
    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};

export const verifyPhoneOtp = async (phone, token) => {
  if (!useSupabase) {
    return { success: false, data: null, error: 'Supabase client disabled.' };
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'phone_change'
    });

    if (error) {
      return { success: false, data: null, error: error.message };
    }
    
    // Also update the profile with the verified phone
    if (data && data.user) {
      await supabase
        .from('profiles')
        .update({ 
          is_phone_verified: true,
          phone: phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', data.user.id);
    }

    return { success: true, data, error: null };
  } catch (err) {
    return { success: false, data: null, error: err.message };
  }
};
