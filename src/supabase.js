import { createClient } from '@supabase/supabase-js';
import { syncQueueService, generateUUID } from './services/syncQueueService';

// 1. Supabase Configuration Check
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasSupabaseKeys = !!supabaseUrl && supabaseUrl !== 'your_supabase_url_here' && !!supabaseAnonKey;

let supabase = null;
let useSupabase = false;

if (hasSupabaseKeys) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'runclash-supabase-auth'
      }
    });
    useSupabase = true;
    console.log("RunClash: Supabase client initialized successfully (Instance ID: single-instance-v1).");
  } catch (error) {
    console.error("RunClash: Supabase initialization failed. Falling back to LocalStorage.", error);
  }
} else {
  console.log("RunClash: No Supabase credentials found. Running in LocalStorage Fallback Mode.");
}

export { supabase, useSupabase };

// ----------------------------------------------------
// LOCALSTORAGE FALLBACK SERVICE IMPLEMENTATION
// ----------------------------------------------------

// 0. LOCALSTORAGE MIGRATION FOR PRE-ALPHA STABILIZATION
const migrateLocalStorage = () => {
  try {
    const oldUser = localStorage.getItem('runclash_mock_auth');
    if (oldUser) {
      if (!localStorage.getItem('clash_user')) {
        localStorage.setItem('clash_user', oldUser);
      }
      localStorage.removeItem('runclash_mock_auth');
    }

    const oldRuns = localStorage.getItem('runclash_runs');
    if (oldRuns) {
      if (!localStorage.getItem('clash_runs')) {
        localStorage.setItem('clash_runs', oldRuns);
      }
      localStorage.removeItem('runclash_runs');
    }

    const oldTerritories = localStorage.getItem('runclash_territories');
    if (oldTerritories) {
      if (!localStorage.getItem('clash_territories')) {
        localStorage.setItem('clash_territories', oldTerritories);
      }
      localStorage.removeItem('runclash_territories');
    }
    
    // Clean up other old developer/test keys
    localStorage.removeItem('clash_debug');
  } catch (e) {
    console.error("Local storage migration failed", e);
  }
};
migrateLocalStorage();

const listeners = new Set();
const triggerListeners = (data) => {
  listeners.forEach(cb => cb(data));
};

const mockAuthChangeListeners = new Set();
let mockCurrentUser = JSON.parse(localStorage.getItem('clash_user')) || null;

const getMockTerritories = () => {
  const data = localStorage.getItem('clash_territories');
  const initial = [
    {
      id: 'lm1',
      name: 'Fateh Sagar Lake Center',
      ownerId: 'landmark',
      ownerName: 'Official Landmark',
      clan: 'None',
      area: 'N/A',
      rate: 0,
      coords: [
        [24.6015, 73.6805]
      ],
      isLandmark: true
    },
    {
      id: 'lm2',
      name: 'Sajjan Garh Fort Sanctuary',
      ownerId: 'landmark',
      ownerName: 'Official Landmark',
      clan: 'None',
      area: 'N/A',
      rate: 0,
      coords: [
        [24.5900, 73.6620]
      ],
      isLandmark: true
    },
    {
      id: 'lm3',
      name: 'Gulab Bagh Botanical Garden',
      ownerId: 'landmark',
      ownerName: 'Official Landmark',
      clan: 'None',
      area: 'N/A',
      rate: 0,
      coords: [
        [24.5710, 73.7020]
      ],
      isLandmark: true
    }
  ];

  if (!data) {
    localStorage.setItem('clash_territories', JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(data);
    let migrated = false;
    
    // Filter out any legacy pre-generated unclaimed sectors (t1, t2, t3, t4)
    // Keep only landmarks and player-created territories
    const updated = parsed.filter(t => {
      if (!t) return false;
      if (t.isLandmark) return true;
      if (t.id === 't1' || t.id === 't2' || t.id === 't3' || t.id === 't4') {
        if (t.ownerId === 'unclaimed') {
          migrated = true;
          return false;
        }
      }
      return true;
    });

    initial.forEach(initItem => {
      if (!updated.some(t => t.id === initItem.id)) {
        updated.push(initItem);
        migrated = true;
      }
    });

    if (migrated) {
      localStorage.setItem('clash_territories', JSON.stringify(updated));
    }
    return updated;
  } catch (e) {
    console.error("Failed to parse local territories", e);
    return initial;
  }
};

// ----------------------------------------------------
// EXPORTED SERVICE INTERFACE
// ----------------------------------------------------

export const isFirebaseActive = () => useSupabase; // Named matching index.html display trigger

// 1. Authentication
export const subscribeToAuth = (callback) => {
  if (useSupabase) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        // Fetch user profiles data from Postgres
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        console.log(`[SUPABASE]\noperation: SELECT\ntable: profiles\nuser: ${session.user.id}\nstatus: ${error ? `error: ${error.message}` : 'success'}`);

        if (profile) {
          callback({
            uid: session.user.id,
            email: session.user.email,
            displayName: profile.display_name,
            clan: profile.clan_name,
            level: profile.level,
            xp: profile.xp,
            coins: profile.coins,
            premium: profile.premium
          });
        } else {
          callback({ uid: session.user.id, email: session.user.email, guest: true });
        }
      } else {
        callback(null);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  } else {
    mockAuthChangeListeners.add(callback);
    callback(mockCurrentUser);
    return () => {
      mockAuthChangeListeners.delete(callback);
    };
  }
};

export const registerUser = async (email, password, name, clan) => {
  if (useSupabase) {
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: name,
          clan_name: clan || 'None'
        }
      }
    });

    if (signUpError) throw signUpError;
    const user = authData.user;

    const profile = {
      id: user.id,
      display_name: name,
      clan_name: clan || 'None',
      level: 1,
      xp: 0,
      coins: 100,
      premium: false
    };

    // Use upsert to be robust against trigger presence or latency
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profile);

    console.log(`[SUPABASE]\noperation: UPSERT\ntable: profiles\nuser: ${user.id}\nstatus: ${profileError ? `error: ${profileError.message}` : 'success'}`);

    if (profileError) throw profileError;

    return {
      uid: user.id,
      email: user.email,
      displayName: name,
      clan: clan || 'None',
      level: 1,
      xp: 0,
      coins: 100,
      premium: false
    };
  } else {
    const profile = {
      uid: 'local_' + Date.now(),
      email: email,
      displayName: name,
      clan: clan || 'None',
      level: 1,
      xp: 0,
      coins: 100,
      premium: false
    };
    localStorage.setItem('clash_user', JSON.stringify(profile));
    mockCurrentUser = profile;
    mockAuthChangeListeners.forEach(cb => cb(profile));
    return profile;
  }
};

export const loginUser = async (email, password) => {
  if (useSupabase) {
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) throw signInError;
    const user = authData.user;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log(`[SUPABASE]\noperation: SELECT\ntable: profiles\nuser: ${user.id}\nstatus: ${profileError ? `error: ${profileError.message}` : 'success'}`);

    if (profileError) throw profileError;

    return {
      uid: user.id,
      email: user.email,
      displayName: profile.display_name,
      clan: profile.clan_name,
      level: profile.level,
      xp: profile.xp,
      coins: profile.coins,
      premium: profile.premium
    };
  } else {
    const profile = {
      uid: 'local_user',
      email: email,
      displayName: email.split('@')[0],
      clan: 'None',
      level: 1,
      xp: 0,
      coins: 0,
      premium: false
    };
    localStorage.setItem('clash_user', JSON.stringify(profile));
    mockCurrentUser = profile;
    mockAuthChangeListeners.forEach(cb => cb(profile));
    return profile;
  }
};

export const loginGuest = async (name, clan) => {
  if (useSupabase) {
    try {
      const { data: authData, error: guestError } = await supabase.auth.signInAnonymously({
        options: {
          data: {
            display_name: name || 'Guest Runner',
            clan_name: clan || 'None'
          }
        }
      });
      if (guestError) throw guestError;
      const user = authData.user;

      const profile = {
        id: user.id,
        display_name: name || 'Guest Runner',
        clan_name: clan || 'None',
        level: 1,
        xp: 0,
        coins: 50,
        premium: false
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert(profile);

      console.log(`[SUPABASE]\noperation: UPSERT\ntable: profiles\nuser: ${user.id}\nstatus: ${profileError ? `error: ${profileError.message}` : 'success'}`);

      if (profileError) throw profileError;

      return {
        uid: user.id,
        displayName: profile.display_name,
        clan: profile.clan_name,
        level: 1,
        xp: 0,
        coins: 50,
        premium: false,
        isAnonymous: true
      };
    } catch (err) {
      console.warn("Supabase anonymous auth failed/disabled. Falling back to local offline guest mode:", err);
      const profile = {
        uid: 'local_guest_' + Date.now(),
        displayName: name || 'Guest Runner',
        clan: clan || 'None',
        level: 1,
        xp: 0,
        coins: 50,
        premium: false,
        isAnonymous: true,
        offlineFallback: true
      };
      localStorage.setItem('clash_user', JSON.stringify(profile));
      mockCurrentUser = profile;
      mockAuthChangeListeners.forEach(cb => cb(profile));
      return profile;
    }
  } else {
    const profile = {
      uid: 'local_guest_' + Date.now(),
      displayName: name || 'Guest Runner',
      clan: clan || 'None',
      level: 1,
      xp: 0,
      coins: 50,
      premium: false,
      isAnonymous: true
    };
    localStorage.setItem('clash_user', JSON.stringify(profile));
    mockCurrentUser = profile;
    mockAuthChangeListeners.forEach(cb => cb(profile));
    return profile;
  }
};

export const logout = async () => {
  if (useSupabase) {
    await supabase.auth.signOut();
  } else {
    localStorage.removeItem('clash_user');
    mockCurrentUser = null;
    mockAuthChangeListeners.forEach(cb => cb(null));
  }
};

// 2. User Stats Sync
export const syncUserStats = async (profile) => {
  if (!profile || !profile.uid) return;
  const isLocalGuest = profile.uid.startsWith('local_');
  if (useSupabase && !isLocalGuest) {
    const { error } = await supabase
      .from('profiles')
      .update({
        level: profile.level,
        xp: profile.xp,
        coins: profile.coins,
        premium: profile.premium
      })
      .eq('id', profile.uid);

    console.log(`[SUPABASE]\noperation: UPDATE\ntable: profiles\nuser: ${profile.uid}\nstatus: ${error ? `error: ${error.message}` : 'success'}`);
  } else {
    const localUser = JSON.parse(localStorage.getItem('clash_user'));
    if (localUser && localUser.uid === profile.uid) {
      const updated = { ...localUser, ...profile };
      localStorage.setItem('clash_user', JSON.stringify(updated));
      mockCurrentUser = updated;
    }
  }
};

export const updateUserProfile = async (updates, profileUid) => {
  if (useSupabase && profileUid && !profileUid.startsWith('local_')) {
    const mapped = {};
    if (updates.clan !== undefined) mapped.clan_name = updates.clan;
    if (updates.displayName !== undefined) mapped.display_name = updates.displayName;
    if (updates.level !== undefined) mapped.level = updates.level;
    if (updates.xp !== undefined) mapped.xp = updates.xp;
    if (updates.coins !== undefined) mapped.coins = updates.coins;

    const { error } = await supabase
      .from('profiles')
      .update(mapped)
      .eq('id', profileUid);

    console.log(`[SUPABASE]\noperation: UPDATE\ntable: profiles\nuser: ${profileUid}\nstatus: ${error ? `error: ${error.message}` : 'success'}`);
  } else {
    const localUser = JSON.parse(localStorage.getItem('clash_user'));
    if (localUser) {
      const updated = { ...localUser, ...updates };
      localStorage.setItem('clash_user', JSON.stringify(updated));
      mockCurrentUser = updated;
    }
  }
};


let activeLoadTerritories = null;

// 3. Territories Database & Realtime
export const subscribeToTerritories = (onUpdate) => {
  if (useSupabase) {
    // 1. Initial load
    const loadTerritories = async () => {
      const { data, error } = await supabase
        .from('territories')
        .select('*');

      console.log(`[SUPABASE]\noperation: SELECT\ntable: territories\nuser: public\nstatus: ${error ? `error: ${error.message}` : 'success'}`);

      let list = [];
      if (data) {
        list = data.map(t => {
          // Calculate remaining decay hours dynamically based on expires_at
          const expires = t.expires_at ? new Date(t.expires_at) : new Date(new Date(t.created_at).getTime() + 72 * 3600000);
          const now = new Date();
          const diffMs = expires - now;
          const decayHours = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));

          return {
            id: t.id,
            name: t.name,
            ownerId: t.owner_id,
            ownerName: t.owner_name || 'Unclaimed',
            clan: t.clan_name,
            area: t.area_sqm + ' m²',
            decayHours: decayHours,
            maxDecayHours: t.max_decay_hours || 72,
            rate: t.rate,
            coords: t.coords
          };
        });
      }

      // Merge local guest-mode territories from LocalStorage
      try {
        const localData = localStorage.getItem('clash_territories');
        if (localData) {
          const locals = JSON.parse(localData);
          locals.forEach(loc => {
            if (!list.some(t => t.id === loc.id)) {
              list.push(loc);
            }
          });
        }
      } catch (e) {
        console.warn("Failed to parse local territories", e);
      }

      onUpdate(list);
    };
    
    activeLoadTerritories = loadTerritories;
    loadTerritories();

    // 2. Setup realtime subscription channel
    const channel = supabase.channel('db-territories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'territories' }, () => {
        loadTerritories(); // Reload from db on changes
      })
      .subscribe();

    return () => {
      activeLoadTerritories = null;
      supabase.removeChannel(channel);
    };
  } else {
    listeners.add(onUpdate);
    const current = getMockTerritories();
    onUpdate(current);
    return () => {
      listeners.delete(onUpdate);
    };
  }
};

const UUID_REGEX = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
export const isValidUUID = (str) => {
  if (!str || typeof str !== 'string') return false;
  return UUID_REGEX.test(str);
};

const PENDING_CLAIMS_KEY = 'clash_pending_territories';

export const getPendingTerritoryClaims = () => {
  try {
    const raw = localStorage.getItem(PENDING_CLAIMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('[QUEUE] Error reading pending claims cache:', e);
    return [];
  }
};

export const enqueuePendingTerritoryClaim = (pendingItem) => {
  try {
    const current = getPendingTerritoryClaims();
    const filtered = current.filter(item => item.claimId !== pendingItem.claimId && item.territory?.name !== pendingItem.territory?.name);
    filtered.push(pendingItem);
    localStorage.setItem(PENDING_CLAIMS_KEY, JSON.stringify(filtered));
    console.log('[QUEUE] Territory claim saved to offline queue:', pendingItem.territory?.name);
  } catch (e) {
    console.error('[QUEUE] Error queueing pending territory claim:', e);
  }
};

export const syncOfflineTerritoryClaims = async () => {
  if (!useSupabase) return { success: false, syncedCount: 0 };

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const sessionUser = sessionData?.session?.user;
    if (!sessionUser || !isValidUUID(sessionUser.id)) {
      return { success: false, syncedCount: 0, reason: 'No active authenticated session' };
    }

    const pendingList = getPendingTerritoryClaims();
    if (pendingList.length === 0) return { success: true, syncedCount: 0 };

    console.log(`[QUEUE SYNC] Processing ${pendingList.length} offline territory claim(s)...`);
    let syncedCount = 0;
    const remainingPending = [];

    for (const item of pendingList) {
      const terr = item.territory;
      const claimId = item.claimId || `claim_${Date.now()}`;
      const areaVal = typeof terr.area === 'number'
        ? terr.area
        : parseFloat(String(terr.area).replace(/[^\d.]/g, '')) || 0;

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 72);

      const dbTerr = {
        claim_id: claimId,
        name: terr.name,
        owner_id: sessionUser.id, // Strictly authenticated user UUID!
        owner_name: terr.ownerName || 'Runner',
        clan_name: terr.clan || 'None',
        area_sqm: areaVal,
        decay_hours: terr.decayHours || 72,
        max_decay_hours: terr.maxDecayHours || 72,
        rate: terr.rate || 1.0,
        coords: terr.coords,
        expires_at: expiresAt.toISOString()
      };

      const { data, error } = await supabase
        .from('territories')
        .insert(dbTerr)
        .select()
        .single();

      if (!error || error.code === '23505') {
        syncedCount++;
        console.log(`[QUEUE SYNC] Successfully synced claim "${terr.name}" (Claim ID: ${claimId})`);
      } else {
        console.warn(`[QUEUE SYNC] Failed to sync claim "${terr.name}":`, error.message);
        remainingPending.push(item);
      }
    }

    localStorage.setItem(PENDING_CLAIMS_KEY, JSON.stringify(remainingPending));

    if (syncedCount > 0 && activeLoadTerritories) {
      activeLoadTerritories();
    }

    return { success: true, syncedCount, remainingCount: remainingPending.length };
  } catch (err) {
    console.error('[QUEUE SYNC] Exception syncing offline territory claims:', err);
    return { success: false, syncedCount: 0, error: err.message };
  }
};

export const saveNewTerritory = async (territory) => {
  const areaVal = typeof territory.area === 'number'
    ? territory.area
    : parseFloat(String(territory.area).replace(/[^\d.]/g, '')) || 0;
  
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 72);

  const rawOwnerId = territory.ownerId || territory.userId;
  const validOwnerId = isValidUUID(rawOwnerId) ? rawOwnerId : null;

  // STRICT AUTHENTICATION GUARD
  let authenticatedSessionUser = null;
  if (useSupabase && validOwnerId) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const sUser = sessionData?.session?.user;
      if (sUser && isValidUUID(sUser.id) && sUser.id === validOwnerId) {
        authenticatedSessionUser = sUser;
      }
    } catch (e) {
      console.warn('[AUTH GUARD] Error checking session for territory insert:', e);
    }
  }

  // Preserve or generate claim_id ONCE via generateUUID()
  const claimId = territory.claimId || territory.claim_id || generateUUID();
  let insertData = null;
  let insertError = null;
  let cloudSuccess = false;

  // Execute supabase.from('territories').insert ONLY when validOwnerId is non-null AND session is authenticated!
  if (useSupabase && validOwnerId && authenticatedSessionUser) {
    const dbTerr = {
      claim_id: claimId,
      name: territory.name,
      owner_id: authenticatedSessionUser.id, // GUARANTEED NON-NULL VALID AUTHENTICATED UUID
      owner_name: territory.ownerName || 'Runner',
      clan_name: territory.clan || 'None',
      area_sqm: areaVal,
      decay_hours: territory.decayHours || 72,
      max_decay_hours: territory.maxDecayHours || 72,
      rate: territory.rate || 1.0,
      coords: territory.coords,
      expires_at: expiresAt.toISOString()
    };

    try {
      const { data, error } = await supabase
        .from('territories')
        .insert(dbTerr)
        .select()
        .single();

      if (!error || error.code === '23505') {
        insertData = data;
        cloudSuccess = true;
        if (error?.code === '23505') {
          console.log(`[TERRITORY INSERT] Unique violation (23505) for claim ${claimId}. Marked as synced.`);
        }
      } else {
        insertError = error;
        cloudSuccess = false;
        syncQueueService.enqueueTerritory({ ...territory, claimId, ownerId: validOwnerId });
      }
    } catch (err) {
      insertError = err;
      cloudSuccess = false;
      syncQueueService.enqueueTerritory({ ...territory, claimId, ownerId: validOwnerId });
    }
  } else {
    // If authentication is unavailable or owner_id is unauthenticated/null, save to offline sync queue!
    console.log('[TERRITORY CLAIM] Unauthenticated or offline owner. Queueing claim to offline sync queue.');
    syncQueueService.enqueueTerritory({
      ...territory,
      claimId,
      ownerId: validOwnerId || rawOwnerId
    });
  }

  // Always mirror to LocalStorage for instant UI responsiveness
  const list = getMockTerritories();
  const newTerr = {
    ...territory,
    id: insertData ? insertData.id : (territory.id || `t_local_${Date.now()}`),
    claimId: claimId,
    ownerId: validOwnerId || rawOwnerId,
    synced: cloudSuccess
  };
  const updated = [...list.filter(t => (t.claimId || t.id) !== (newTerr.claimId || newTerr.id)), newTerr];
  localStorage.setItem('clash_territories', JSON.stringify(updated));
  triggerListeners(updated);
  if (activeLoadTerritories) activeLoadTerritories();

  if (!cloudSuccess) {
    return {
      success: true,
      queued: true,
      cloud: false,
      data: newTerr
    };
  }

  return {
    success: true,
    cloud: true,
    queued: false,
    data: insertData || newTerr
  };
};

export const updateTerritory = async (id, updates) => {
  if (useSupabase) {
    // Map properties
    const mapped = {};
    if (updates.ownerId !== undefined) mapped.owner_id = updates.ownerId;
    if (updates.ownerName !== undefined) mapped.owner_name = updates.ownerName;
    if (updates.clan !== undefined) mapped.clan_name = updates.clan;

    if (updates.decayHours !== undefined) {
      mapped.decay_hours = updates.decayHours;
      // Calculate new expires_at based on updates.decayHours
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + updates.decayHours);
      mapped.expires_at = expiresAt.toISOString();
    }

    const { error } = await supabase
      .from('territories')
      .update(mapped)
      .eq('id', id);

    console.log(`[SUPABASE]\noperation: UPDATE\ntable: territories\nuser: system\nstatus: ${error ? `error: ${error.message}` : 'success'}`);
  } else {
    const list = getMockTerritories();
    const updated = list.map(t => {
      if (t.id === id) {
        return { ...t, ...updates };
      }
      return t;
    });
    localStorage.setItem('clash_territories', JSON.stringify(updated));
    triggerListeners(updated);
  }
};

export const getLeaderboard = async () => {
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, clan_name, level, xp')
        .order('xp', { ascending: false })
        .limit(10);

      console.log(`[SUPABASE]\noperation: SELECT\ntable: profiles\nuser: public\nstatus: ${error ? `error: ${error.message}` : 'success'}`);
      
      if (error) throw error;
      
      return data.map(p => ({
        id: p.id,
        uid: p.id,
        displayName: p.display_name,
        clan: p.clan_name,
        level: p.level,
        xp: p.xp
      }));
    } catch (e) {
      console.error("Error fetching leaderboard:", e);
      return [];
    }
  } else {
    return [];
  }
};

export const reportError = async (message, stack = '', component = '', metadata = {}) => {
  console.error(`[${component}] Error: ${message}`, stack);
  if (useSupabase) {
    try {
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      const { error } = await supabase.from('error_logs').insert({
        user_id: sessionUser?.id || null,
        error_message: message,
        error_stack: stack,
        component: component,
        metadata: metadata
      });

      console.log(`[SUPABASE]\noperation: INSERT\ntable: error_logs\nuser: ${sessionUser?.id || 'anonymous'}\nstatus: ${error ? `error: ${error.message}` : 'success'}`);
    } catch (e) {
      console.warn("Failed to report error to Supabase:", e);
    }
  }
};

export const saveCompletedRun = async (runData) => {
  const localRunsKey = 'clash_runs';
  const operationId = runData.operationId || runData.operation_id || generateUUID();
  const existingRuns = JSON.parse(localStorage.getItem(localRunsKey)) || [];

  const localRun = {
    id: 'run_local_' + Date.now(),
    operationId,
    ...runData,
    createdAt: new Date().toISOString()
  };

  const updatedRuns = [...existingRuns.filter(r => (r.operationId || r.operation_id) !== operationId), localRun];
  localStorage.setItem(localRunsKey, JSON.stringify(updatedRuns));
  console.log('Database: Run saved to local cache for instant UI rendering.');

  const userId = runData.userId;
  const isValidUser = isValidUUID(userId);

  // STRICT AUTHENTICATION GUARD
  let authenticatedSessionUser = null;
  if (useSupabase && isValidUser) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session && session.user && isValidUUID(session.user.id) && session.user.id === userId) {
        authenticatedSessionUser = session.user;
      }
    } catch (e) {
      console.warn('[AUTH GUARD] Error checking session for run insert:', e);
    }
  }

  if (useSupabase && isValidUser && authenticatedSessionUser) {
    try {
      const distanceKm = parseFloat(runData.distance) || parseFloat(runData.distanceKm) || 0;
      const durationSeconds = parseInt(runData.duration) || parseInt(runData.durationSeconds) || 0;
      const caloriesVal = parseInt(runData.calories) || 0;

      let paceVal = null;
      if (typeof runData.pace === 'number') paceVal = runData.pace;
      else if (typeof runData.paceSecondsPerKm === 'number') paceVal = runData.paceSecondsPerKm;
      else if (typeof runData.pace === 'string' && runData.pace.includes(':')) {
        const [m, s] = runData.pace.split(':').map(Number);
        if (!isNaN(m) && !isNaN(s)) paceVal = m * 60 + s;
      }

      let speedVal = parseFloat(runData.speed) || parseFloat(runData.averageSpeedKmh) || null;

      const dbRun = {
        operation_id: operationId,
        user_id: authenticatedSessionUser.id,
        distance_km: distanceKm,
        duration_seconds: durationSeconds,
        pace_seconds_per_km: paceVal,
        average_speed_kmh: speedVal,
        calories: caloriesVal,
        gps_path: runData.path || runData.gps_path || [],
        start_time: runData.startTime || new Date().toISOString(),
        end_time: runData.endTime || new Date().toISOString(),
        summary_statistics: runData.summaryStatistics || {}
      };

      const { data, error } = await supabase
        .from('runs')
        .insert(dbRun)
        .select()
        .single();

      if (!error || error.code === '23505') {
        console.log('[SUPABASE]\noperation: INSERT\ntable: runs\nuser: ' + userId + '\nstatus: ' + (error ? 'already synced (23505)' : 'success'));
        return { success: true, cloud: true, data: data || localRun };
      } else {
        console.warn('Supabase insert run warning:', error.message);
        syncQueueService.enqueueRun({ ...runData, operationId });
        return { success: true, cloud: false, queued: true, data: localRun };
      }
    } catch (err) {
      console.warn('Supabase insert run failed, queueing offline:', err.message);
      syncQueueService.enqueueRun({ ...runData, operationId });
      return { success: true, cloud: false, queued: true, data: localRun };
    }
  } else {
    console.log('[RUN SAVE] Unauthenticated or offline user. Queueing run to offline sync queue.');
    syncQueueService.enqueueRun({ ...runData, operationId });
    return { success: true, cloud: false, queued: true, data: localRun };
  }
};

export const fetchClans = async () => {
  if (useSupabase) {
    try {
      const { data, error } = await supabase
        .from('clans')
        .select('*')
        .order('created_at', { ascending: false });

      console.log(`[SUPABASE]\noperation: SELECT\ntable: clans\nstatus: ${error ? `error: ${error.message}` : 'success'}`);

      if (error) {
        return { success: false, data: [], error: error.message };
      }
      return { success: true, data: data || [], error: null };
    } catch (err) {
      console.error("fetchClans exception:", err);
      return { success: false, data: [], error: err.message };
    }
  }

  try {
    const stored = JSON.parse(localStorage.getItem('clash_clans')) || [];
    return { success: true, data: stored, error: null };
  } catch (e) {
    return { success: true, data: [], error: null };
  }
};

export const createClanInCloud = async (clanName, userUid) => {
  if (!clanName || !clanName.trim()) {
    return { success: false, data: null, error: "Clan name is required." };
  }

  const nameTrimmed = clanName.trim();

  if (useSupabase && userUid && !userUid.startsWith('local_')) {
    try {
      const { data: existing } = await supabase
        .from('clans')
        .select('id, name')
        .ilike('name', nameTrimmed)
        .limit(1);

      if (existing && existing.length > 0) {
        return { success: false, data: null, error: `Clan name '${nameTrimmed}' is already taken.` };
      }

      const { data: newClan, error: insertError } = await supabase
        .from('clans')
        .insert({ name: nameTrimmed, domain_percentage: 0 })
        .select()
        .single();

      console.log(`[SUPABASE]\noperation: INSERT\ntable: clans\nstatus: ${insertError ? `error: ${insertError.message}` : 'success'}`);

      if (insertError) {
        return { success: false, data: null, error: insertError.message };
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ clan_name: nameTrimmed })
        .eq('id', userUid);

      console.log(`[SUPABASE]\noperation: UPDATE\ntable: profiles\nuser: ${userUid}\nstatus: ${profileError ? `error: ${profileError.message}` : 'success'}`);

      if (profileError) {
        await supabase.from('clans').delete().eq('id', newClan.id);
        return { success: false, data: null, error: `Profile update failed: ${profileError.message}` };
      }

      return { success: true, data: newClan, error: null };
    } catch (err) {
      console.error("createClanInCloud exception:", err);
      return { success: false, data: null, error: err.message };
    }
  }

  try {
    const existingList = JSON.parse(localStorage.getItem('clash_clans')) || [];
    if (existingList.some(c => c.name.toLowerCase() === nameTrimmed.toLowerCase())) {
      return { success: false, data: null, error: `Clan name '${nameTrimmed}' is already taken.` };
    }
    const newClan = {
      id: 'clan_' + Date.now(),
      name: nameTrimmed,
      domain_percentage: 0,
      created_at: new Date().toISOString()
    };
    const updated = [newClan, ...existingList];
    localStorage.setItem('clash_clans', JSON.stringify(updated));

    const localUser = JSON.parse(localStorage.getItem('clash_user'));
    if (localUser) {
      localUser.clan = nameTrimmed;
      localStorage.setItem('clash_user', JSON.stringify(localUser));
    }

    return { success: true, data: newClan, error: null };
  } catch (e) {
    return { success: false, data: null, error: e.message };
  }
};

export const joinClanInCloud = async (clanName, userUid) => {
  if (!clanName || !clanName.trim()) {
    return { success: false, data: null, error: "Clan name is required." };
  }

  const nameTrimmed = clanName.trim();

  if (useSupabase && userUid && !userUid.startsWith('local_')) {
    try {
      const { data: clanData, error: clanSearchError } = await supabase
        .from('clans')
        .select('*')
        .ilike('name', nameTrimmed)
        .single();

      if (clanSearchError || !clanData) {
        return { success: false, data: null, error: `Clan '${nameTrimmed}' does not exist.` };
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ clan_name: clanData.name })
        .eq('id', userUid);

      console.log(`[SUPABASE]\noperation: UPDATE\ntable: profiles\nuser: ${userUid}\nstatus: ${profileError ? `error: ${profileError.message}` : 'success'}`);

      if (profileError) {
        return { success: false, data: null, error: profileError.message };
      }

      return { success: true, data: clanData, error: null };
    } catch (err) {
      console.error("joinClanInCloud exception:", err);
      return { success: false, data: null, error: err.message };
    }
  }

  const localUser = JSON.parse(localStorage.getItem('clash_user'));
  if (localUser) {
    localUser.clan = nameTrimmed;
    localStorage.setItem('clash_user', JSON.stringify(localUser));
  }
  return { success: true, data: { name: nameTrimmed }, error: null };
};

export const leaveClanInCloud = async (userUid) => {
  if (useSupabase && userUid && !userUid.startsWith('local_')) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ clan_name: 'None' })
        .eq('id', userUid);

      console.log(`[SUPABASE]\noperation: UPDATE\ntable: profiles\nuser: ${userUid}\nstatus: ${error ? `error: ${error.message}` : 'success'}`);

      if (error) {
        return { success: false, error: error.message };
      }
      return { success: true, error: null };
    } catch (err) {
      console.error("leaveClanInCloud exception:", err);
      return { success: false, error: err.message };
    }
  }

  const localUser = JSON.parse(localStorage.getItem('clash_user'));
  if (localUser) {
    localUser.clan = 'None';
    localStorage.setItem('clash_user', JSON.stringify(localUser));
  }
  return { success: true, error: null };
};
