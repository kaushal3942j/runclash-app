import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, useSupabase } from '../supabase';
import { getCurrentSession, createAnonymousSession } from '../services/authService';
import { ensureProfile, isDefaultName } from '../services/profileService';
import { updateLastActive } from '../services/friendService';
import { syncQueueService } from '../services/syncQueueService';

// Safe LocalStorage Cache Parser
const getSafeCachedProfile = () => {
  try {
    const raw = localStorage.getItem('clash_user');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === 'object' && parsed.uid) ? parsed : null;
  } catch (e) {
    console.warn('[IDENTITY] Malformed local clash_user cache cleared.', e);
    localStorage.removeItem('clash_user');
    return null;
  }
};

export const useIdentity = () => {
  const [isLoadingIdentity, setIsLoadingIdentity] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [identityMode, setIdentityMode] = useState('offline-local'); // 'authenticated' | 'offline-local' | 'migrating' | 'error'
  const [authErrorMessage, setAuthErrorMessage] = useState(null);
  const [legacyMigrationNeeded, setLegacyMigrationNeeded] = useState(false);

  const isInitializingRef = useRef(false);
  const profileSyncUserIdRef = useRef(null);
  const explicitLogoutRef = useRef(false);
  const pendingDisplayNameRef = useRef(null);

  // Canonical Guest Entry Pipeline with Immediate Display Name Guarantee
  const loginGuestUser = useCallback(async (rawName, clan = 'None') => {
    const enteredName = (typeof rawName === 'string' && rawName.trim()) ? rawName.trim() : 'Runner';
    pendingDisplayNameRef.current = enteredName;
    explicitLogoutRef.current = false;

    try {
      setIsLoadingIdentity(true);

      // 1. Sign in anonymously via canonical authService
      const anonRes = await createAnonymousSession();
      if (!anonRes.success || !anonRes.user) {
        throw new Error(anonRes.error || anonRes.message || 'Anonymous sign-in failed');
      }

      const user = anonRes.user;
      setAuthUser(user);

      // 2. Build immediate canonical profile object
      const immediateProfile = {
        uid: user.id,
        id: user.id,
        displayName: enteredName,
        display_name: enteredName,
        clan: clan || 'None',
        clan_name: clan || 'None',
        level: 1,
        xp: 0,
        coins: 100,
        premium: false,
        isAnonymous: true
      };

      // 3. Immediately set React state & localStorage BEFORE any cloud fetch or background upsert
      profileSyncUserIdRef.current = user.id;
      setCurrentProfile(immediateProfile);
      localStorage.setItem('clash_user', JSON.stringify(immediateProfile));
      setIdentityMode('authenticated');
      setAuthErrorMessage(null);

      // 4. Background single-flight profile upsert with exact entered name
      if (useSupabase) {
        supabase
          .from('profiles')
          .upsert({
            id: user.id,
            display_name: enteredName,
            clan_name: clan || 'None',
            level: 1,
            xp: 0,
            coins: 100,
            premium: false,
            updated_at: new Date().toISOString()
          })
          .select()
          .single()
          .then(({ data: cloudProfile, error: upsertErr }) => {
            if (upsertErr) {
              console.warn('[GUEST ENTRY] Background profile upsert warning:', upsertErr.message);
            } else if (cloudProfile && cloudProfile.display_name === enteredName) {
              console.log('[GUEST ENTRY] Profile confirmed in cloud as:', cloudProfile.display_name);
            }
          })
          .catch(err => console.warn('[GUEST ENTRY] Background upsert exception:', err))
          .finally(() => {
            // Clear pending displayName ref ONLY after background upsert completes
            pendingDisplayNameRef.current = null;
          });
      } else {
        pendingDisplayNameRef.current = null;
      }

      return { success: true, data: immediateProfile };
    } catch (err) {
      console.error('[GUEST ENTRY ERROR]', err);
      pendingDisplayNameRef.current = null;
      setAuthErrorMessage(err.message || 'Guest login failed');
      return { success: false, error: err.message };
    } finally {
      setIsLoadingIdentity(false);
    }
  }, []);

  // Synchronize and normalize cloud profile outside the auth lock
  const syncProfileForUser = useCallback(async (user) => {
    if (!user || !user.id) return { success: false, error: 'Invalid user' };

    // GUARD 1: If pendingDisplayNameRef.current is active for this user, protect currentProfile
    if (pendingDisplayNameRef.current) {
      if (currentProfile?.uid === user.id) {
        setIdentityMode('authenticated');
        setAuthErrorMessage(null);
        return { success: true, data: currentProfile };
      }
    }

    // GUARD 2: If already synchronized for this user UUID and profile has a non-default display name, return
    if (profileSyncUserIdRef.current === user.id && currentProfile?.uid === user.id && !isDefaultName(currentProfile?.displayName)) {
      setIdentityMode('authenticated');
      setAuthErrorMessage(null);
      return { success: true, data: currentProfile };
    }
    profileSyncUserIdRef.current = user.id;

    try {
      const cached = getSafeCachedProfile();
      const preferredName = pendingDisplayNameRef.current || (cached && !isDefaultName(cached.displayName) ? cached.displayName : null) || 'Guest Runner';

      const isLegacyLocal = cached && typeof cached.uid === 'string' && cached.uid.startsWith('local_') && !localStorage.getItem('clash_identity_migrated_v1');

      if (isLegacyLocal) {
        setIdentityMode('migrating');
        setLegacyMigrationNeeded(true);
      }

      const profileRes = await ensureProfile(user, preferredName, isLegacyLocal ? cached : null);

      if (profileRes.success && profileRes.data) {
        const profile = profileRes.data;
        const finalDisplayName = pendingDisplayNameRef.current || (profile.display_name && !isDefaultName(profile.display_name) ? profile.display_name : preferredName);

        const normalizedProfile = {
          uid: profile.id,
          displayName: finalDisplayName,
          level: profile.level,
          xp: profile.xp,
          coins: profile.coins,
          clan: profile.clan_name || 'None',
          premium: profile.premium || false
        };

        setCurrentProfile(normalizedProfile);
        localStorage.setItem('clash_user', JSON.stringify(normalizedProfile));
        setIdentityMode('authenticated');
        setAuthErrorMessage(null);
        console.log('[IDENTITY] profile resolved', normalizedProfile.displayName);
        setTimeout(() => syncQueueService.syncAll(), 3000);

        if (isLegacyLocal) {
          localStorage.setItem('clash_identity_migrated_v1', new Date().toISOString());
          setLegacyMigrationNeeded(false);
        }
        return { success: true, data: normalizedProfile };
      } else {
        setAuthErrorMessage(profileRes.error || 'Failed to initialize cloud profile.');
        setIdentityMode('error');
        if (cached) setCurrentProfile(cached);
        return { success: false, error: profileRes.error };
      }
    } catch (err) {
      console.error('[IDENTITY] Profile sync exception:', err);
      setAuthErrorMessage(err.message || 'Profile sync error.');
      setIdentityMode('error');
      const cached = getSafeCachedProfile();
      if (cached) setCurrentProfile(cached);
      return { success: false, error: err.message };
    }
  }, [currentProfile]);

  // Core Identity Initialization Pipeline (Owns initial page load)
  const initializeIdentity = useCallback(async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    const cachedProfile = getSafeCachedProfile();
    console.log('[IDENTITY] cache loaded', cachedProfile ? cachedProfile.displayName : 'none');
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // OPTIMIZATION: If cached profile exists and not explicitly logged out, render UI INSTANTLY (<50ms)
    if (cachedProfile && !explicitLogoutRef.current) {
      setCurrentProfile(cachedProfile);
      setIdentityMode('authenticated');
      setIsLoadingIdentity(false);
    } else {
      setIsLoadingIdentity(true);
    }

    setAuthErrorMessage(null);

    if (!useSupabase || !isOnline) {
      setIdentityMode('signed-out');
      setCurrentProfile(null);
      setIsLoadingIdentity(false);
      isInitializingRef.current = false;
      return;
    }

    // Fast fallback timer: Guarantee UI appears within 1.5s even if network is slow
    const fastFallbackTimer = setTimeout(() => {
      if (!cachedProfile) {
        setAuthUser(null);
        setCurrentProfile(null);
        setIdentityMode('signed-out');
        setIsLoadingIdentity(false);
      }
    }, 1500);

    try {
      // 1. Check existing active session
      const sessionRes = await getCurrentSession();
      let activeSession = sessionRes.success ? sessionRes.data : null;
      console.log('[IDENTITY] session resolved', activeSession?.user?.id || 'signed-out');

      // 2. If no active session, transition to 'signed-out' (DO NOT call signInAnonymously automatically)
      if (!activeSession || !activeSession.user) {
        setAuthUser(null);
        setCurrentProfile(null);
        setIdentityMode('signed-out');
        setIsLoadingIdentity(false);
        isInitializingRef.current = false;
        return;
      }

      // 3. Valid authenticated UUID session received
      const user = activeSession.user;
      setAuthUser(user);

      // 4. Synchronize cloud profile for authenticated user
      await syncProfileForUser(user);
    } catch (err) {
      console.error('[IDENTITY] Initialization exception:', err);
      setAuthErrorMessage(err.message || 'Identity initialization error.');
      setIdentityMode('signed-out');
      setCurrentProfile(null);
    } finally {
      clearTimeout(fastFallbackTimer);
      setIsLoadingIdentity(false);
      isInitializingRef.current = false;
    }
  }, [syncProfileForUser]);

  // Low-frequency last_active_at ping (every 4 minutes) for authenticated sessions
  useEffect(() => {
    if (identityMode !== 'authenticated' || !authUser?.id) return;

    updateLastActive().catch(() => {});

    const interval = setInterval(() => {
      updateLastActive().catch(() => {});
    }, 240000);

    return () => clearInterval(interval);
  }, [identityMode, authUser?.id]);

  // Canonical Sign Out Function (PART A & B)
  const signOutCurrentUser = useCallback(async () => {
    explicitLogoutRef.current = true;
    profileSyncUserIdRef.current = null;
    setIsLoadingIdentity(true);

    try {
      if (useSupabase) {
        await supabase.auth.signOut({ scope: 'local' });
      }

      // Clear device/session identity cache keys ONLY
      localStorage.removeItem('runclash-supabase-auth');
      localStorage.removeItem('clash_user');
      localStorage.removeItem('clash_identity_migrated_v1');

      // Preserve workout and sync data: clash_runs, clash_territories, clash_pending_runs, clash_pending_territories

      setAuthUser(null);
      setCurrentProfile(null);
      setIdentityMode('signed-out');
      setAuthErrorMessage(null);
      return { success: true };
    } catch (err) {
      console.error('[AUTH] Sign-out exception:', err);
      setAuthErrorMessage(err.message || 'Failed to sign out.');
      return { success: false, error: err.message };
    } finally {
      setIsLoadingIdentity(false);
      isInitializingRef.current = false;
    }
  }, []);

  useEffect(() => {
    initializeIdentity();

    if (!useSupabase) return;

    // Single Auth state listener: STRICTLY SYNCHRONOUS. No awaits inside callback!
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;

      if (event === 'SIGNED_OUT') {
        profileSyncUserIdRef.current = null;
        setAuthUser(null);
        setCurrentProfile(null);
        setIdentityMode('signed-out');
        setIsLoadingIdentity(false);
        return;
      }

      if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && user) {
        if (explicitLogoutRef.current) {
          // Explicit logout in progress; ignore SIGNED_IN event from local clearing
          return;
        }
        setAuthUser(user);
        setTimeout(() => {
          syncProfileForUser(user);
        }, 0);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [initializeIdentity, syncProfileForUser]);

  // Controlled 8-second safety timeout guard to guarantee loading completes
  useEffect(() => {
    let timeoutId;
    if (isLoadingIdentity) {
      timeoutId = setTimeout(() => {
        if (isLoadingIdentity) {
          console.warn('[AUTH] Initial identity setup timed out after 8s; clearing loading spinner.');
          setAuthErrorMessage(prev => prev || 'Connection timeout during identity verification.');
          setIsLoadingIdentity(false);
        }
      }, 8000);
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isLoadingIdentity]);

  return {
    isLoadingIdentity,
    authUser,
    currentProfile,
    setCurrentProfile,
    identityMode,
    authErrorMessage,
    legacyMigrationNeeded,
    signOutCurrentUser,
    loginGuestUser,
    refreshIdentity: () => {
      explicitLogoutRef.current = false;
      isInitializingRef.current = false;
      profileSyncUserIdRef.current = null;
      initializeIdentity();
    }
  };
};
