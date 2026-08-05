import { useState, useEffect, useCallback } from 'react';
import { supabase, useSupabase } from '../supabase';
import { getCurrentSession, createAnonymousSession, isValidAuthenticatedUser } from '../services/authService';
import { loadProfile, ensureProfile } from '../services/profileService';

export const useIdentity = () => {
  const [isLoadingIdentity, setIsLoadingIdentity] = useState(true);
  const [authUser, setAuthUser] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [identityMode, setIdentityMode] = useState('offline-local'); // 'authenticated' | 'offline-local' | 'migrating' | 'error'
  const [authErrorMessage, setAuthErrorMessage] = useState(null);
  const [legacyMigrationNeeded, setLegacyMigrationNeeded] = useState(false);

  // Core Identity Initialization Pipeline
  const initializeIdentity = useCallback(async () => {
    setIsLoadingIdentity(true);
    setAuthErrorMessage(null);

    // 1. Check navigator online status
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!useSupabase || !isOnline) {
      // Offline-local fallback mode
      setIdentityMode('offline-local');
      const cached = JSON.parse(localStorage.getItem('clash_user')) || {
        uid: 'local_offline_' + Date.now(),
        displayName: 'Offline Runner',
        level: 1,
        xp: 0,
        coins: 0,
        clan: 'None'
      };
      setCurrentProfile(cached);
      setIsLoadingIdentity(false);
      return;
    }

    try {
      // 2. Check existing session
      const sessionRes = await getCurrentSession();
      let activeSession = sessionRes.success ? sessionRes.data : null;

      // 3. If no active session, attempt Anonymous Sign-In
      if (!activeSession || !activeSession.user) {
        const anonRes = await createAnonymousSession();
        if (anonRes.success) {
          activeSession = anonRes.data;
        } else {
          // Check for disabled anonymous auth provider
          if (anonRes.error === 'anonymous_provider_disabled') {
            setAuthErrorMessage('Enable Supabase Dashboard → Authentication → Providers → Anonymous Sign-Ins');
            setIdentityMode('error');
          } else {
            setAuthErrorMessage(anonRes.message || 'Authentication error.');
            setIdentityMode('error');
          }

          // Preserve local cached profile so app doesn't break or render blank
          const localCached = JSON.parse(localStorage.getItem('clash_user')) || {
            uid: 'local_offline_' + Date.now(),
            displayName: 'Guest Runner',
            level: 1,
            xp: 0,
            coins: 0,
            clan: 'None'
          };
          setCurrentProfile(localCached);
          setIsLoadingIdentity(false);
          return;
        }
      }

      // 4. Session established: Valid UUID received
      const user = activeSession.user;
      setAuthUser(user);

      // 5. Check for legacy local_* profile migration
      const localUser = JSON.parse(localStorage.getItem('clash_user'));
      const isLegacyLocal = localUser && typeof localUser.uid === 'string' && localUser.uid.startsWith('local_') && !localStorage.getItem('clash_identity_migrated_v1');

      if (isLegacyLocal) {
        setIdentityMode('migrating');
        setLegacyMigrationNeeded(true);
      }

      // 6. Ensure profile exists in public.profiles
      const profileRes = await ensureProfile(user, localUser?.displayName || 'Guest Runner', isLegacyLocal ? localUser : null);

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

        if (isLegacyLocal) {
          localStorage.setItem('clash_identity_migrated_v1', new Date().toISOString());
          setLegacyMigrationNeeded(false);
        }
      } else {
        setAuthErrorMessage(profileRes.error || 'Failed to initialize cloud profile.');
        setIdentityMode('error');
      }
    } catch (err) {
      console.error('Identity initialization exception:', err);
      setAuthErrorMessage(err.message || 'Identity initialization error.');
      setIdentityMode('error');
    } finally {
      setIsLoadingIdentity(false);
    }
  }, []);

  useEffect(() => {
    initializeIdentity();

    if (!useSupabase) return;

    // Auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setAuthUser(session.user);
        const profileRes = await loadProfile(session.user.id);
        if (profileRes.success && profileRes.data) {
          const p = profileRes.data;
          const normalized = {
            uid: p.id,
            displayName: p.display_name,
            level: p.level,
            xp: p.xp,
            coins: p.coins,
            clan: p.clan_name || 'None',
            premium: p.premium || false
          };
          setCurrentProfile(normalized);
          localStorage.setItem('clash_user', JSON.stringify(normalized));
          setIdentityMode('authenticated');
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null);
        setIdentityMode('offline-local');
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [initializeIdentity]);

  return {
    isLoadingIdentity,
    authUser,
    currentProfile,
    setCurrentProfile,
    identityMode,
    authErrorMessage,
    legacyMigrationNeeded,
    refreshIdentity: initializeIdentity
  };
};
