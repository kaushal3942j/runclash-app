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

const listeners = new Set();
const triggerListeners = (data) => {
  listeners.forEach(cb => cb(data));
};

const mockAuthChangeListeners = new Set();
let mockCurrentUser = JSON.parse(localStorage.getItem('runclash_mock_auth')) || null;

const getMockTerritories = () => {
  const data = localStorage.getItem('runclash_territories');
  if (!data) {
    const initial = [
      {
        id: 't1',
        name: 'Fateh Sagar Lake Shore',
        ownerId: 'mock_owner_1',
        ownerName: 'Lakshya',
        clan: 'Udaipur Racers',
        area: '24,800 m²',
        decayHours: 48,
        maxDecayHours: 72,
        rate: 8,
        coords: [
          [24.6042, 73.6805], [24.6015, 73.6762], [24.5975, 73.6750], 
          [24.5948, 73.6781], [24.5932, 73.6825], [24.5961, 73.6865], 
          [24.6010, 73.6870], [24.6030, 73.6845], [24.6042, 73.6805]
        ],
        color: '#00e5ff'
      },
      {
        id: 't2',
        name: 'Sajjan Garh Foothills Base',
        ownerId: 'mock_owner_2',
        ownerName: 'Sam',
        clan: 'GITS Runners',
        area: '18,200 m²',
        decayHours: 28,
        maxDecayHours: 72,
        rate: 5,
        coords: [
          [24.5920, 73.6620], [24.5890, 73.6580], [24.5840, 73.6600], 
          [24.5860, 73.6670], [24.5900, 73.6680], [24.5920, 73.6620]
        ],
        color: '#ff007f'
      },
      {
        id: 't3',
        name: 'Udaipur Castle Park Landmark',
        ownerId: 'unclaimed',
        ownerName: 'Unclaimed',
        clan: 'None',
        area: '12,500 m²',
        decayHours: 0,
        maxDecayHours: 72,
        rate: 15,
        coords: [
          [24.5780, 73.6920], [24.5750, 73.6900], [24.5730, 73.6930], 
          [24.5760, 73.6960], [24.5780, 73.6920]
        ],
        color: '#fffb00'
      }
    ];
    localStorage.setItem('runclash_territories', JSON.stringify(initial));
    return initial;
  }
  return JSON.parse(data);
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
      password
    });

    if (signUpError) throw signUpError;
    const user = authData.user;

    const profile = {
      id: user.id,
      display_name: name,
      clan_name: clan,
      level: 1,
      xp: 0,
      coins: 100,
      premium: false
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profile);

    if (profileError) throw profileError;

    return {
      uid: user.id,
      email: user.email,
      displayName: name,
      clan: clan,
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
      clan: clan,
      level: 1,
      xp: 0,
      coins: 100,
      premium: false
    };
    localStorage.setItem('runclash_mock_auth', JSON.stringify(profile));
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
      clan: 'Udaipur Racers',
      level: 4,
      xp: 1420,
      coins: 350,
      premium: false
    };
    localStorage.setItem('runclash_mock_auth', JSON.stringify(profile));
    mockCurrentUser = profile;
    mockAuthChangeListeners.forEach(cb => cb(profile));
    return profile;
  }
};

export const loginGuest = async (name, clan) => {
  if (useSupabase) {
    const { data: authData, error: guestError } = await supabase.auth.signInAnonymously();
    if (guestError) throw guestError;
    const user = authData.user;

    const profile = {
      id: user.id,
      display_name: name || 'Guest Runner',
      clan_name: clan || 'Udaipur Racers',
      level: 1,
      xp: 0,
      coins: 50,
      premium: false
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profile);

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
  } else {
    const profile = {
      uid: 'local_guest_' + Date.now(),
      displayName: name || 'Guest Runner',
      clan: clan || 'Udaipur Racers',
      level: 1,
      xp: 0,
      coins: 50,
      premium: false,
      isAnonymous: true
    };
    localStorage.setItem('runclash_mock_auth', JSON.stringify(profile));
    mockCurrentUser = profile;
    mockAuthChangeListeners.forEach(cb => cb(profile));
    return profile;
  }
};

export const logout = async () => {
  if (useSupabase) {
    await supabase.auth.signOut();
  } else {
    localStorage.removeItem('runclash_mock_auth');
    mockCurrentUser = null;
    mockAuthChangeListeners.forEach(cb => cb(null));
  }
};

// 2. User Stats Sync
export const syncUserStats = async (profile) => {
  if (!profile || !profile.uid) return;
  if (useSupabase) {
    await supabase
      .from('profiles')
      .update({
        level: profile.level,
        xp: profile.xp,
        coins: profile.coins,
        premium: profile.premium
      })
      .eq('id', profile.uid);
  } else {
    const localUser = JSON.parse(localStorage.getItem('runclash_mock_auth'));
    if (localUser && localUser.uid === profile.uid) {
      const updated = { ...localUser, ...profile };
      localStorage.setItem('runclash_mock_auth', JSON.stringify(updated));
      mockCurrentUser = updated;
    }
  }
};

// 3. Territories Database & Realtime
export const subscribeToTerritories = (onUpdate) => {
  if (useSupabase) {
    // 1. Initial load
    const loadTerritories = async () => {
      const { data, error } = await supabase
        .from('territories')
        .select('*');
      if (data) {
        const list = data.map(t => ({
          id: t.id,
          name: t.name,
          ownerId: t.owner_id,
          ownerName: t.owner_name || 'Unclaimed',
          clan: t.clan_name,
          area: t.area_sqm + ' m²',
          decayHours: t.decay_hours,
          maxDecayHours: t.max_decay_hours,
          rate: t.rate,
          coords: t.coords
        }));
        onUpdate(list);
      }
    };
    loadTerritories();

    // 2. Setup realtime subscription channel
    const channel = supabase.channel('db-territories-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'territories' }, () => {
        loadTerritories(); // Reload from db on changes
      })
      .subscribe();

    return () => {
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
  if (useSupabase) {
    // Map frontend structure to SQL columns
    const areaVal = parseFloat(territory.area.replace(/[^\d.]/g, '')) || 0;
    const dbTerr = {
      name: territory.name,
      owner_id: territory.ownerId,
      owner_name: territory.ownerName,
      clan_name: territory.clan,
      area_sqm: areaVal,
      decay_hours: territory.decayHours,
      max_decay_hours: territory.maxDecayHours,
      rate: territory.rate,
      coords: territory.coords
    };

    const { error } = await supabase
      .from('territories')
      .insert(dbTerr);

    if (error) console.error("Supabase error inserting territory", error);
  } else {
    const list = getMockTerritories();
    const newTerr = {
      ...territory,
      id: territory.id || `t_local_${Date.now()}`
    };
    const updated = [...list, newTerr];
    localStorage.setItem('runclash_territories', JSON.stringify(updated));
    triggerListeners(updated);
  }
};

export const updateTerritory = async (id, updates) => {
  if (useSupabase) {
    // Map properties
    const mapped = {};
    if (updates.decayHours !== undefined) mapped.decay_hours = updates.decayHours;
    if (updates.ownerId !== undefined) mapped.owner_id = updates.ownerId;
    if (updates.ownerName !== undefined) mapped.owner_name = updates.ownerName;
    if (updates.clan !== undefined) mapped.clan_name = updates.clan;

    await supabase
      .from('territories')
      .update(mapped)
      .eq('id', id);
  } else {
    const list = getMockTerritories();
    const updated = list.map(t => {
      if (t.id === id) {
        return { ...t, ...updates };
      }
      return t;
    });
    localStorage.setItem('runclash_territories', JSON.stringify(updated));
    triggerListeners(updated);
  }
};
