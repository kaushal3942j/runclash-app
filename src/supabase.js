import { createClient } from '@supabase/supabase-js';

// 1. Supabase Configuration Check
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const hasSupabaseKeys = !!supabaseUrl && supabaseUrl !== 'your_supabase_url_here' && !!supabaseAnonKey;

let supabase = null;
let useSupabase = false;

if (hasSupabaseKeys) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    useSupabase = true;
    console.log("RunClash: Supabase client initialized successfully.");
  } catch (error) {
    console.error("RunClash: Supabase initialization failed. Falling back to LocalStorage.", error);
  }
} else {
  console.log("RunClash: No Supabase credentials found. Running in LocalStorage Fallback Mode.");
}

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
      level: 4,
      xp: 1420,
      coins: 350,
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

let activeLoadTerritories = null;

// 3. Territories Database & Realtime
export const subscribeToTerritories = (onUpdate) => {
  if (useSupabase) {
    // 1. Initial load
    const loadTerritories = async () => {
      const { data, error } = await supabase
        .from('territories')
        .select('*')
        .eq('is_active', true);

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

export const saveNewTerritory = async (territory) => {
  const isLocalGuest = !territory.ownerId || territory.ownerId.startsWith('local_');
  if (useSupabase && !isLocalGuest) {
    // Map frontend structure to SQL columns
    const areaVal = parseFloat(territory.area.replace(/[^\d.]/g, '')) || 0;
    
    // Set expires_at to 72 hours from now
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const dbTerr = {
      name: territory.name,
      owner_id: territory.ownerId,
      owner_name: territory.ownerName,
      clan_name: territory.clan,
      area_sqm: areaVal,
      decay_hours: territory.decayHours,
      max_decay_hours: territory.maxDecayHours,
      rate: territory.rate,
      coords: territory.coords,
      expires_at: expiresAt.toISOString()
    };

    const { error } = await supabase
      .from('territories')
      .insert(dbTerr);

    console.log(`[SUPABASE]\noperation: INSERT\ntable: territories\nuser: ${territory.ownerId}\nstatus: ${error ? `error: ${error.message}` : 'success'}`);

    if (error) console.error("RunClash: Supabase error inserting territory", error);
  } else {
    const list = getMockTerritories();
    const newTerr = {
      ...territory,
      id: territory.id || `t_local_${Date.now()}`
    };
    const updated = [...list, newTerr];
    localStorage.setItem('clash_territories', JSON.stringify(updated));
    triggerListeners(updated);
    if (activeLoadTerritories) {
      activeLoadTerritories();
    }
  }
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
        .select('display_name, clan_name, level, xp')
        .order('xp', { ascending: false })
        .limit(10);

      console.log(`[SUPABASE]\noperation: SELECT\ntable: profiles\nuser: public\nstatus: ${error ? `error: ${error.message}` : 'success'}`);
      
      if (error) throw error;
      
      return data.map(p => ({
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
    return [
      { displayName: 'Lakshya', clan: 'None', level: 12, xp: 5800 },
      { displayName: 'Sam', clan: 'None', level: 10, xp: 4500 },
      { displayName: 'Rohan', clan: 'None', level: 8, xp: 3200 },
      { displayName: 'Divya', clan: 'None', level: 7, xp: 2900 }
    ];
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
  const isLocalGuest = !runData.userId || runData.userId.startsWith('local_');
  if (useSupabase && !isLocalGuest) {
    try {
      const dbRun = {
        user_id: runData.userId,
        gps_path: runData.path,
        distance: runData.distance,
        duration: runData.duration,
        pace: runData.pace,
        speed: runData.speed,
        calories: runData.calories,
        start_time: runData.startTime,
        end_time: runData.endTime,
        summary_statistics: runData.summaryStatistics
      };

      const { data, error } = await supabase
        .from('runs')
        .insert(dbRun);

      console.log(`[SUPABASE]\noperation: INSERT\ntable: runs\nuser: ${runData.userId}\nstatus: ${error ? `error: ${error.message}` : 'success'}`);

      if (error) throw error;
      return { success: true, data };
    } catch (err) {
      console.warn("Supabase insert run failed, saving locally as fallback:", err.message);
    }
  }

  // Fallback to local storage
  try {
    const localRunsKey = 'clash_runs';
    const existingRuns = JSON.parse(localStorage.getItem(localRunsKey)) || [];
    const localRun = {
      id: `run_local_${Date.now()}`,
      ...runData,
      createdAt: new Date().toISOString()
    };
    existingRuns.push(localRun);
    localStorage.setItem(localRunsKey, JSON.stringify(existingRuns));
    console.log("Local Database: Run successfully saved locally.");
    return { success: true, local: true, data: localRun };
  } catch (err) {
    console.error("Local database save run failed:", err);
    return { success: false, error: err.message };
  }
};
