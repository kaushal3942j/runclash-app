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

export const upgradeAnonymousAccount = async (email, password) => {
  if (!useSupabase) {
    return { success: false, data: null, error: 'Supabase client disabled.', message: 'Supabase client disabled.' };
  }

  // 1. Validate inputs
  const trimmedEmail = typeof email === 'string' ? email.trim() : '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
    return {
      success: false,
      data: null,
      error: 'invalid_email',
      message: 'Please enter a valid email address (e.g. runner@domain.com).'
    };
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    return {
      success: false,
      data: null,
      error: 'weak_password',
      message: 'Password must be at least 6 characters long.'
    };
  }

  // 2. Verify current active session and anonymous status
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session?.user) {
      return {
        success: false,
        data: null,
        error: 'no_session',
        message: 'No active session found. Please refresh or reopen the app.'
      };
    }

    const currentUser = sessionData.session.user;

    // Check if user is actually anonymous
    if (!currentUser.is_anonymous) {
      return {
        success: false,
        data: null,
        error: 'already_permanent',
        message: 'This account is already protected with a permanent sign-in method.'
      };
    }

    // Determine environment-aware redirect URL for email confirmation
    const getRedirectUrl = () => {
      if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.PROD) {
        return 'https://runclash.vercel.app/';
      }
      if (typeof window !== 'undefined' && window.location && window.location.origin) {
        return window.location.origin + '/';
      }
      return 'http://localhost:3000/';
    };

    const redirectUrl = getRedirectUrl();

    // 3. Upgrade existing anonymous user in-place (DO NOT call signUp())
    const { data: updateData, error: updateError } = await supabase.auth.updateUser(
      {
        email: trimmedEmail,
        password: password
      },
      {
        emailRedirectTo: redirectUrl
      }
    );

    if (updateError) {
      const errMsg = updateError.message || '';
      const isDuplicate = updateError.status === 422 ||
        errMsg.toLowerCase().includes('already registered') ||
        errMsg.toLowerCase().includes('already in use') ||
        errMsg.toLowerCase().includes('duplicate') ||
        errMsg.toLowerCase().includes('exists');

      if (isDuplicate) {
        return {
          success: false,
          data: null,
          error: 'email_taken',
          message: 'This email is already associated with another account. Please use a different email address.'
        };
      }

      return {
        success: false,
        data: null,
        error: updateError.code || 'upgrade_failed',
        message: updateError.message || 'Failed to update account credentials.'
      };
    }

    const updatedUser = updateData?.user || currentUser;

    // 4. Update profile is_guest flag in public.profiles while preserving user id
    try {
      await supabase
        .from('profiles')
        .update({
          is_guest: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);
    } catch (profileSyncErr) {
      console.warn('[AUTH] Warning updating profile guest status:', profileSyncErr?.message || profileSyncErr);
    }

    // 5. Determine whether email confirmation is required
    const requiresEmailConfirmation = Boolean(
      updatedUser.new_email ||
      !updatedUser.email_confirmed_at
    );

    const message = requiresEmailConfirmation
      ? `Confirmation email sent to ${trimmedEmail}. Please check your inbox and verify the link to finish linking your account.`
      : `Account successfully protected! Your progress is now linked to ${trimmedEmail}.`;

    return {
      success: true,
      data: updateData?.session || sessionData.session,
      user: updatedUser,
      requiresEmailConfirmation,
      message,
      error: null
    };
  } catch (err) {
    const isNetworkError = err instanceof TypeError || (err.message && err.message.toLowerCase().includes('network')) || (err.message && err.message.toLowerCase().includes('fetch'));
    return {
      success: false,
      data: null,
      error: isNetworkError ? 'network_error' : 'unexpected_error',
      message: isNetworkError
        ? 'Network error. Please check your internet connection and try again.'
        : (err.message || 'An unexpected error occurred while linking your account.')
    };
  }
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
