import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, useSupabase } from '../supabase';
import { getCurrentSession, createAnonymousSession } from '../services/authService';
import { ensureProfile } from '../services/profileService';
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

  // Synchronize and normalize cloud profile outside the auth lock
  const syncProfileForUser = useCallback(async (user) => {
    if (!user || !user.id) return { success: false, error: 'Invalid user' };

    // If already synchronized for this user UUID, ensure authenticated state and return
    if (profileSyncUserIdRef.current === user.id && currentProfile?.uid === user.id) {
      setIdentityMode('authenticated');
      setAuthErrorMessage(null);
      return { success: true, data: currentProfile };
    }
    profileSyncUserIdRef.current = user.id;

    try {
      const cached = getSafeCachedProfile();
      const isLegacyLocal = cached && typeof cached.uid === 'string' && cached.uid.startsWith('local_') && !localStorage.getItem('clash_identity_migrated_v1');

      if (isLegacyLocal) {
        setIdentityMode('migrating');
        setLegacyMigrationNeeded(true);
      }

      const profileRes = await ensureProfile(user, cached?.displayName || 'Guest Runner', isLegacyLocal ? cached : null);

      if (profileRes.success && profileRes.data) {
        const profile = profileRes.data;
        const normalizedProfile = {
          uid: profile.id,
          displayName: profile.display_name,
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
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // OPTIMIZATION 1: If cached profile exists, render UI INSTANTLY (<50ms)
    if (cachedProfile) {
      setCurrentProfile(cachedProfile);
      setIdentityMode('authenticated');
      setIsLoadingIdentity(false);
    } else {
      setIsLoadingIdentity(true);
    }

    setAuthErrorMessage(null);

    if (!useSupabase || !isOnline) {
      setIdentityMode('offline-local');
      if (!cachedProfile) {
        const fallback = {
          uid: 'local_offline_' + Date.now(),
          displayName: 'Offline Runner',
          level: 1,
          xp: 0,
          coins: 0,
          clan: 'None'
        };
        setCurrentProfile(fallback);
      }
      setIsLoadingIdentity(false);
      isInitializingRef.current = false;
      return;
    }

    // Fast fallback timer: Guarantee UI appears within 1.5s even if network is slow
    const fastFallbackTimer = setTimeout(() => {
      if (!cachedProfile) {
        console.warn('[AUTH] Slow network detected. Rendering local guest state while cloud completes.');
        setCurrentProfile({
          uid: 'local_guest_' + Date.now(),
          displayName: 'Guest Runner',
          level: 1,
          xp: 0,
          coins: 0,
          clan: 'None'
        });
        setIsLoadingIdentity(false);
      }
    }, 1500);

    try {
      // 1. Check existing active session
      const sessionRes = await getCurrentSession();
      let activeSession = sessionRes.success ? sessionRes.data : null;

      // 2. If no active session, attempt Anonymous Sign-In
      if (!activeSession || !activeSession.user) {
        const anonRes = await createAnonymousSession();

        if (anonRes.success) {
          activeSession = anonRes.data;
        } else {
          if (anonRes.error === 'anonymous_provider_disabled') {
            setAuthErrorMessage('Enable Supabase Dashboard → Authentication → Providers → Anonymous Sign-Ins');
            setIdentityMode('error');
          } else {
            setAuthErrorMessage(anonRes.message || 'Authentication error.');
            setIdentityMode('error');
          }

          if (!cachedProfile) {
            setCurrentProfile({
              uid: 'local_offline_' + Date.now(),
              displayName: 'Guest Runner',
              level: 1,
              xp: 0,
              coins: 0,
              clan: 'None'
            });
          }
          return;
        }
      }

      // 3. Valid authenticated UUID session received
      const user = activeSession.user;
      setAuthUser(user);

      // 4. Synchronize cloud profile for authenticated user
      await syncProfileForUser(user);
    } catch (err) {
      console.error('[IDENTITY] Initialization exception:', err);
      setAuthErrorMessage(err.message || 'Identity initialization error.');
      if (!cachedProfile) {
        setIdentityMode('error');
      }
    } finally {
      clearTimeout(fastFallbackTimer);
      setIsLoadingIdentity(false);
      isInitializingRef.current = false;
    }
  }, [syncProfileForUser]);

  useEffect(() => {
    initializeIdentity();

    if (!useSupabase) return;

    // Single Auth state listener: STRICTLY SYNCHRONOUS. No awaits inside callback!
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const user = session?.user ?? null;
      setAuthUser(user);

      if (event === 'SIGNED_OUT') {
        profileSyncUserIdRef.current = null;
        setAuthUser(null);
        setCurrentProfile(null);
        setIdentityMode('offline-local');
        return;
      }

      if (event === 'INITIAL_SESSION') {
        return;
      }

      if (event === 'TOKEN_REFRESHED') {
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && user) {
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
    refreshIdentity: () => {
      isInitializingRef.current = false;
      profileSyncUserIdRef.current = null;
      initializeIdentity();
    }
  };
};
