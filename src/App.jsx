import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  MapPin, Play, Square, Shield, Zap, Award, Users, Compass, 
  Coins, MessageSquare, Send, Sparkles, AlertCircle, RefreshCw, Trophy, Target,
  Lock, Mail, User, ShieldCheck, LogOut, CheckCircle, Navigation, Radio, Settings, Home,
  ChevronUp, ChevronDown, Clock, Check
} from 'lucide-react';
import { 
  isFirebaseActive, subscribeToAuth, registerUser, loginUser, loginGuest, logout,
  syncUserStats, subscribeToTerritories, saveNewTerritory, updateTerritory, getLeaderboard, reportError,
  saveCompletedRun
} from './supabase';

// Predefined Simulation Routes for Udaipur (Developer Mode)
const SIMULATION_ROUTES = {
  lake: {
    name: "Fateh Sagar Lake Loop",
    distance: "3.2 km",
    points: [
      [24.6042, 73.6805],
      [24.6015, 73.6762],
      [24.5975, 73.6750],
      [24.5948, 73.6781],
      [24.5932, 73.6825],
      [24.5961, 73.6865],
      [24.6010, 73.6870],
      [24.6030, 73.6845],
      [24.6042, 73.6805]
    ]
  },
  foothills: {
    name: "Sajjan Garh Foothills Base",
    distance: "2.1 km",
    points: [
      [24.5920, 73.6620],
      [24.5890, 73.6580],
      [24.5840, 73.6600],
      [24.5860, 73.6670],
      [24.5900, 73.6680],
      [24.5920, 73.6620]
    ]
  },
  monument: {
    name: "Udaipur Castle Park",
    distance: "1.4 km",
    points: [
      [24.5780, 73.6920],
      [24.5750, 73.6900],
      [24.5730, 73.6930],
      [24.5760, 73.6960],
      [24.5780, 73.6920]
    ]
  },
  micro: {
    name: "Micro Loop (Too Small Test)",
    distance: "0.01 km",
    points: [
      [24.5950, 73.6800],
      [24.59501, 73.6800],
      [24.59501, 73.68001],
      [24.5950, 73.68001],
      [24.5950, 73.6800]
    ]
  }
};

// Database of profiles for social system discovery/search
const INITIAL_PROFILES = [
  { id: 'user_lakshya', displayName: 'Lakshya', clan: 'Udaipur Racers', level: 12, xp: 5800, distance: '112.5 km', territories: 5, bio: 'Conquering lake sectors one run at a time.', online: true, postsCount: 24, friendsCount: 31 },
  { id: 'user_sam', displayName: 'Sam', clan: 'GITS Runners', level: 10, xp: 4500, distance: '74.8 km', territories: 3, bio: 'Pacing Sajjan Garh foothills daily.', online: false, postsCount: 15, friendsCount: 22 },
  { id: 'user_rohan', displayName: 'Rohan', clan: 'Udaipur Racers', level: 8, xp: 3200, distance: '48.2 km', territories: 2, bio: 'Sprinting through the old city gates.', online: true, postsCount: 8, friendsCount: 14 },
  { id: 'user_divya', displayName: 'Divya', clan: 'Udaipur Racers', level: 7, xp: 2900, distance: '35.4 km', territories: 1, bio: 'Run, capture, defend, repeat.', online: true, postsCount: 5, friendsCount: 19 },
  { id: 'user_arjun', displayName: 'Arjun', clan: 'GITS Runners', level: 6, xp: 2300, distance: '28.1 km', territories: 0, bio: 'New to Udaipur, looking for run buddies.', online: false, postsCount: 2, friendsCount: 4 }
];

export default function App() {
  // Auth & Session State
  const [currentUser, setCurrentUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login', 'signup', 'guest'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authClan, setAuthClan] = useState('Udaipur Racers');
  const [authError, setAuthError] = useState('');

  // Global App States
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'map', 'conquests', 'clans', 'coach'
  const [territories, setTerritories] = useState([]);
  const [inventory, setInventory] = useState({
    shields: 2,
    boots: 1,
    decoys: 0
  });

  // GPS Mode Toggles & Debug Flag
  const DEBUG_MODE = localStorage.getItem('clash_debug') === 'true';
  const [trackingMode, setTrackingMode] = useState(DEBUG_MODE ? 'sim' : 'gps'); // Default to 'gps' in production
  const [simulationRouteKey, setSimulationRouteKey] = useState('lake');
  const [isSearchingGps, setIsSearchingGps] = useState(false);
  
  // Tracking Run State
  const [runState, setRunState] = useState({
    status: 'idle', // 'idle', 'tracking', 'paused', 'finished'
    path: [],
    distance: 0,
    duration: 0,
    pace: '--:--',
    gpsAccuracy: null,
    speed: 0,
    avgSpeed: 0,
    avgPace: '--:--',
    calories: 0,
    isAutoPaused: false
  });

  const [completedRunData, setCompletedRunData] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Live Run Screen 2.0 States
  const [bottomHudState, setBottomHudState] = useState('medium'); // 'mini', 'medium', 'expanded'
  const [cameraSheetOpen, setCameraSheetOpen] = useState(false);
  const [activeBanner, setActiveBanner] = useState(null); // { type, sectorName }
  const [toastMessage, setToastMessage] = useState(null);
  const [showCameraFlash, setShowCameraFlash] = useState(false);
  
  const lastEnteredSectorIdRef = useRef(null);

  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  
  // Selected Territory State & Fade-in transition handler
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);
  const [isInspectingTransition, setIsInspectingTransition] = useState(false);
  const [renderedTerritory, setRenderedTerritory] = useState(null);

  useEffect(() => {
    setIsInspectingTransition(true);
    const timer = setTimeout(() => {
      const found = territories.find(t => t.id === selectedTerritoryId);
      setRenderedTerritory(found || null);
      setIsInspectingTransition(false);
    }, 150); // Matches .intel-content-transition 150ms delay
    return () => clearTimeout(timer);
  }, [selectedTerritoryId, territories]);

  // ==========================================
  // SPRINT 3: SOCIAL FOUNDATION STATE & HOOKS
  // ==========================================
  const [socialSubTab, setSocialSubTab] = useState('crew'); // 'crew' (clans) or 'network' (friends)
  const [friendsSearchQuery, setFriendsSearchQuery] = useState('');
  const [discoverSearchQuery, setDiscoverSearchQuery] = useState('');
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');

  // Persisted Social arrays
  const [friendsList, setFriendsList] = useState(() => {
    return JSON.parse(localStorage.getItem('clash_friends_list')) || ['user_rohan'];
  });
  const [friendRequestsReceived, setFriendRequestsReceived] = useState(() => {
    return JSON.parse(localStorage.getItem('clash_requests_received')) || ['user_sam'];
  });
  const [friendRequestsSent, setFriendRequestsSent] = useState(() => {
    return JSON.parse(localStorage.getItem('clash_requests_sent')) || [];
  });
  const [followersList, setFollowersList] = useState(() => {
    return JSON.parse(localStorage.getItem('clash_followers_list')) || ['user_lakshya', 'user_rohan'];
  });
  const [userBio, setUserBio] = useState(() => {
    return localStorage.getItem('clash_user_bio') || 'Strategic operative ready to claim territories.';
  });
  const [socialNotifications, setSocialNotifications] = useState(() => {
    return JSON.parse(localStorage.getItem('clash_social_notifications')) || [
      { id: 'n1', type: 'friend_request', senderName: 'Sam', timestamp: '2h ago', read: false },
      { id: 'n2', type: 'new_follower', senderName: 'Lakshya', timestamp: '5h ago', read: true }
    ];
  });

  // LocalStorage Synchronizers
  useEffect(() => {
    localStorage.setItem('clash_friends_list', JSON.stringify(friendsList));
  }, [friendsList]);
  useEffect(() => {
    localStorage.setItem('clash_requests_received', JSON.stringify(friendRequestsReceived));
  }, [friendRequestsReceived]);
  useEffect(() => {
    localStorage.setItem('clash_requests_sent', JSON.stringify(friendRequestsSent));
  }, [friendRequestsSent]);
  useEffect(() => {
    localStorage.setItem('clash_followers_list', JSON.stringify(followersList));
  }, [followersList]);
  useEffect(() => {
    localStorage.setItem('clash_user_bio', userBio);
  }, [userBio]);
  useEffect(() => {
    localStorage.setItem('clash_social_notifications', JSON.stringify(socialNotifications));
  }, [socialNotifications]);

  // Friendship Action Helpers
  const sendFriendRequest = (profileId) => {
    if (friendRequestsSent.includes(profileId)) return;
    setFriendRequestsSent(prev => [...prev, profileId]);
    const profileName = INITIAL_PROFILES.find(p => p.id === profileId)?.displayName || 'User';
    addLog(`Social: Sent friend request to ${profileName}.`);
  };

  const acceptFriendRequest = (profileId) => {
    setFriendRequestsReceived(prev => prev.filter(id => id !== profileId));
    if (!friendsList.includes(profileId)) {
      setFriendsList(prev => [...prev, profileId]);
    }
    if (!followersList.includes(profileId)) {
      setFollowersList(prev => [...prev, profileId]);
    }
    const profileName = INITIAL_PROFILES.find(p => p.id === profileId)?.displayName || 'User';
    const newNotif = {
      id: 'notif_' + Date.now(),
      type: 'friend_accepted',
      senderName: profileName,
      timestamp: 'Just now',
      read: false
    };
    setSocialNotifications(prev => [newNotif, ...prev]);
    addLog(`Social: Accepted friend request from ${profileName}.`);
  };

  const rejectFriendRequest = (profileId) => {
    setFriendRequestsReceived(prev => prev.filter(id => id !== profileId));
    const profileName = INITIAL_PROFILES.find(p => p.id === profileId)?.displayName || 'User';
    addLog(`Social: Rejected friend request from ${profileName}.`);
  };

  const removeFriend = (profileId) => {
    setFriendsList(prev => prev.filter(id => id !== profileId));
    const profileName = INITIAL_PROFILES.find(p => p.id === profileId)?.displayName || 'User';
    addLog(`Social: Removed ${profileName} from friends list.`);
  };

  const [mapAutoFollow, setMapAutoFollow] = useState(true);
  const mapAutoFollowRef = useRef(true);
  useEffect(() => {
    mapAutoFollowRef.current = mapAutoFollow;
  }, [mapAutoFollow]);
  const [leaderboard, setLeaderboard] = useState([]);
  
  const runStateRef = useRef(runState);
  useEffect(() => {
    runStateRef.current = runState;
  }, [runState]);

  const wakeLockRef = useRef(null);

  // Run Timing & Auto-Pause Refs
  const startTimeRef = useRef(null);
  const endTimeRef = useRef(null);
  const lowSpeedDurationRef = useRef(0);

  // Anti-Cheat References
  const cheatMetricsRef = useRef({ speedSpikes: 0, repeatedJumps: 0, unrealisticAcceleration: 0 });
  const lastPointTimeRef = useRef(null);
  const lastSpeedRef = useRef(0);

  const shopCosts = { shield: 80, boots: 120, decoy: 200 };

  // Logs and Chats
  const [consoleLogs, setConsoleLogs] = useState([
    `System: RunClash MVP started. DB: ${isFirebaseActive() ? 'Supabase Cloud' : 'LocalStorage Fallback'}`
  ]);
  const [coachInput, setCoachInput] = useState('');
  const [coachMessages, setCoachMessages] = useState([
    {
      id: 1,
      sender: 'coach',
      text: "Yo! Ready to touch grass and secure some real territory? Switch to 'Real GPS' mode and do a loop around your local block! 🏃🔥",
      time: '12:00 PM'
    }
  ]);
  const [clanInput, setClanInput] = useState('');
  const [clanMessages, setClanMessages] = useState([
    { id: 1, sender: 'Rohan', text: "Udaipur Racers assemble! We need to fortify the lake.", time: '12:05' },
    { id: 2, sender: 'Divya', text: "I'll go run it at 5:30 pace to lock it in.", time: '12:12' }
  ]);

  // Leaflet Refs
  const mapInstanceRef = useRef(null);
  const polylineRef = useRef(null);
  const runnerMarkerRef = useRef(null);
  const territoryPolygonsRef = useRef({});
  const watchIdRef = useRef(null);

  // Simulation Interval Refs
  const simIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Helper log function
  const addLog = (msg) => {
    setConsoleLogs(prev => [msg, ...prev.slice(0, 19)]);
  };

  // ----------------------------------------------------
  // Authentication & Database Subscriptions
  // ----------------------------------------------------
  useEffect(() => {
    // Global Crash Reporting setup
    const handleGlobalError = (event) => {
      reportError(event.message || 'Unknown runtime error', event.error?.stack || '', 'WindowGlobalError');
    };
    const handleRejection = (event) => {
      reportError(event.reason?.message || 'Unhandled Promise Rejection', event.reason?.stack || '', 'UnhandledRejection');
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleRejection);

    // 1. Subscribe to Auth Changes
    const unsubscribeAuth = subscribeToAuth((user) => {
      setCurrentUser(user);
      console.log(`[AUTH]\nauthenticated: ${!!user}\nuserId: ${user?.uid || 'null'}\nsession: ${user ? 'active' : 'null'}`);
      if (user) {
        addLog(`Auth: User ${user.displayName || 'Guest'} logged in.`);
      } else {
        addLog("Auth: No session found. Gate active.");
      }
    });

    // 2. Subscribe to Territories Database
    const unsubscribeTerritories = subscribeToTerritories((list) => {
      setTerritories(list);
    });

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleRejection);
      unsubscribeAuth();
      unsubscribeTerritories();
      if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
      if (simIntervalRef.current) {
        console.log(`[GPS Engine] Simulator interval cleared (unmount). ID: ${simIntervalRef.current}`);
        clearInterval(simIntervalRef.current);
      }
      clearInterval(timerIntervalRef.current);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(err => console.error("Unmount wake lock release error", err));
      }
    };
  }, []);

  // Fetch leaderboard when clans tab becomes active
  useEffect(() => {
    if (activeTab === 'clans') {
      const fetchLeaderboard = async () => {
        const board = await getLeaderboard();
        setLeaderboard(board);
      };
      fetchLeaderboard();
    }
  }, [activeTab]);

  // Center map on user location when entering Map tab in GPS mode
  useEffect(() => {
    if (activeTab === 'map' && trackingMode === 'gps' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([lat, lng], 15.5);
          }
        },
        (error) => {
          console.warn("[GPS] Initial tab-load locate failed:", error.message);
        },
        { enableHighAccuracy: false, timeout: 60000, maximumAge: 60000 }
      );
    }
  }, [activeTab, trackingMode]);

  // Sync user profile stats on changes
  useEffect(() => {
    if (currentUser) {
      syncUserStats(currentUser);
    }
  }, [currentUser]);

  // Handle Authentication actions
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        const profile = await loginUser(authEmail, authPassword);
        setCurrentUser(profile);
        console.log(`[AUTH]\nauthenticated: true\nuserId: ${profile.uid}\nsession: active`);
      } else if (authMode === 'signup') {
        if (!authName.trim()) throw new Error("Display name is required.");
        const profile = await registerUser(authEmail, authPassword, authName, authClan);
        setCurrentUser(profile);
        console.log(`[AUTH]\nauthenticated: true\nuserId: ${profile.uid}\nsession: active`);
      } else if (authMode === 'guest') {
        const name = authPassword.trim() || authName.trim() || `Runner_${Math.floor(1000 + Math.random() * 9000)}`;
        const profile = await loginGuest(name, authClan);
        setCurrentUser(profile);
        console.log(`[AUTH]\nauthenticated: true\nuserId: ${profile.uid}\nsession: active`);
      }
    } catch (err) {
      setAuthError(err.message || "Authentication failed.");
      addLog(`Auth Error: ${err.message}`);
      console.log(`[AUTH]\nauthenticated: false\nuserId: null\nsession: null\nerror: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    stopTracking();
    console.log(`[AUTH]\nauthenticated: false\nuserId: null\nsession: null`);
  };

  // ----------------------------------------------------
  // Leaflet Map Setup
  // ----------------------------------------------------
  useEffect(() => {
    if (currentUser && !mapInstanceRef.current) {
      // Setup map container DOM correction
      const container = L.DomUtil.get('map');
      if (container) {
        container._leaflet_id = null;
      }

      const map = L.map('map', {
        zoomControl: false,
        attributionControl: false
      }).setView([24.5950, 73.6800], 13.5);

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        maxZoom: 20
      }).addTo(map);

      mapInstanceRef.current = map;
      addLog("System: Leaflet Map loaded.");

      map.on('click', () => {
        setSelectedTerritoryId(null);
      });

      map.on('dragstart', () => {
        setMapAutoFollow(false);
      });
      
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }

    return () => {
      if (mapInstanceRef.current) {
        console.log("[Map Setup] Destroying map instance and clearing ref.");
        try {
          mapInstanceRef.current.remove();
        } catch (e) {
          console.error("Map removal error", e);
        }
        mapInstanceRef.current = null;
      }
      polylineRef.current = null;
      runnerMarkerRef.current = null;
      territoryPolygonsRef.current = {};
    };
  }, [currentUser]);

  // Resize map when tab changes back to map
  useEffect(() => {
    if (currentUser && activeTab === 'map' && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 100);
    }
  }, [activeTab, currentUser]);

  // Render territories onto the Leaflet map in real time
  useEffect(() => {
    if (!mapInstanceRef.current || !currentUser) return;

    // Clear old layers
    Object.values(territoryPolygonsRef.current).forEach(poly => {
      mapInstanceRef.current.removeLayer(poly);
    });
    territoryPolygonsRef.current = {};

    // Redraw list
    territories.forEach(terr => {
      const isOwner = terr.ownerId === currentUser.uid;
      const isTeammate = terr.clan === currentUser.clan && !isOwner;
      const isEnemy = terr.clan && terr.clan !== currentUser.clan && terr.ownerName !== 'Unclaimed';
      const isBonus = terr.rate >= 10 || (terr.name && terr.name.toLowerCase().includes('landmark'));
      
      let polyColor = '#888888'; // Neutral: Gray
      if (isBonus) {
        polyColor = '#EAB308'; // Bonus territory: Gold
      } else if (isOwner) {
        polyColor = '#FC4C02'; // Current player: Orange
      } else if (isTeammate) {
        polyColor = '#3B82F6'; // Clan teammate: Blue
      } else if (isEnemy) {
        polyColor = '#EF4444'; // Enemy clan: Red
      }

      const poly = L.polygon(terr.coords, {
        color: polyColor,
        fillColor: polyColor,
        fillOpacity: 0.08,
        weight: 2
      }).addTo(mapInstanceRef.current);

      // Select territory on click
      poly.on('click', (e) => {
        if (e.originalEvent) {
          e.originalEvent.stopPropagation();
        }
        setSelectedTerritoryId(terr.id);
        setIsBottomSheetExpanded(true);
      });

      territoryPolygonsRef.current[terr.id] = poly;
    });
  }, [territories, currentUser]);

  // ----------------------------------------------------
  // GEOLOCATION & TRACKING ENGINE (REAL GPS & SIMULATOR)
  // ----------------------------------------------------

  const requestWakeLock = async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        addLog("System: Screen wake lock active.");
      } catch (err) {
        console.warn("Screen wake lock request failed:", err);
      }
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        addLog("System: Screen wake lock released.");
      } catch (err) {
        console.error("Screen wake lock release failed:", err);
      }
    }
  };

  const togglePauseResume = () => {
    setRunState(prev => {
      const nextStatus = prev.status === 'tracking' ? 'paused' : prev.status === 'paused' ? 'tracking' : prev.status;
      console.log(`[TRACKING]\ntrackingMode: ${trackingMode}\nrunState: ${nextStatus}\nwatchId: ${watchIdRef.current || 'null'}`);
      
      if (prev.status === 'tracking') {
        addLog("System: Run paused.");
        return { ...prev, status: 'paused' };
      } else if (prev.status === 'paused') {
        addLog("System: Run resumed.");
        return { ...prev, status: 'tracking' };
      }
      return prev;
    });
  };

  // Helper to check if a point is inside a polygon (Ray-casting algorithm)
  const isPointInPolygon = (point, polygon) => {
    if (!polygon || polygon.length < 3) return false;
    const lat = point[0];
    const lng = point[1];
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const latI = polygon[i][0];
      const lngI = polygon[i][1];
      const latJ = polygon[j][0];
      const lngJ = polygon[j][1];
      
      const intersect = ((lngI > lng) !== (lngJ > lng))
          && (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI) + latI);
      if (intersect) isInside = !isInside;
    }
    return isInside;
  };

  // Helper to trigger territory banners
  const triggerTerritoryBanner = (type, sectorName) => {
    setActiveBanner({ type, sectorName });
    setTimeout(() => {
      setActiveBanner(prev => {
        if (prev && prev.type === type && prev.sectorName === sectorName) {
          return null;
        }
        return prev;
      });
    }, 4000);
  };

  const startTracking = () => {
    if (runState.status !== 'idle') return;

    requestWakeLock();

    // Reset timing reference timestamps
    startTimeRef.current = new Date();
    endTimeRef.current = null;
    lowSpeedDurationRef.current = 0;

    // Safety check: verify no simulator interval exists
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }

    // Reset Anti-Cheat metrics
    cheatMetricsRef.current = { speedSpikes: 0, repeatedJumps: 0, unrealisticAcceleration: 0 };
    lastPointTimeRef.current = null;
    lastSpeedRef.current = 0;
    
    // Clear drawing elements
    if (polylineRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(polylineRef.current);
    if (runnerMarkerRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(runnerMarkerRef.current);

    if (trackingMode === 'gps') {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser!");
        return;
      }

      setIsSearchingGps(true);
      addLog("GPS: Calibrating tracking device... Searching for GPS satellites...");

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          addLog(`GPS: Lock acquired. Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)} (Accuracy: ${Math.round(accuracy)}m).`);

          // Center the map on user position
          if (mapInstanceRef.current) {
            mapInstanceRef.current.setView([lat, lng], 15.5);
          }

          // Initial Path Polyline
          if (mapInstanceRef.current) {
            polylineRef.current = L.polyline([[lat, lng]], {
              color: '#FC4C02',
              weight: 4
            }).addTo(mapInstanceRef.current);

            const runnerIcon = L.divIcon({
              className: 'custom-runner-icon',
              html: `<div style="background-color: #FC4C02; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
              iconSize: [16, 16]
            });
            runnerMarkerRef.current = L.marker([lat, lng], { icon: runnerIcon }).addTo(mapInstanceRef.current);
          }

          setRunState({
            status: 'tracking',
            path: [[lat, lng]],
            distance: 0,
            duration: 0,
            pace: '--:--',
            gpsAccuracy: accuracy,
            speed: 0,
            avgSpeed: 0,
            avgPace: '--:--',
            calories: 0,
            isAutoPaused: false
          });

          // Start Clock timer
          timerIntervalRef.current = setInterval(() => {
            // Stationary fallback check: if no coordinate is received for > 8s, trigger auto-pause
            if (lastPointTimeRef.current !== null) {
              const timeSinceLastPoint = (Date.now() - lastPointTimeRef.current) / 1000;
              if (timeSinceLastPoint > 8 && !runStateRef.current.isAutoPaused) {
                setRunState(prev => {
                  if (prev.isAutoPaused) return prev;
                  addLog("GPS: Auto-paused (no movement detected).");
                  return { ...prev, isAutoPaused: true, speed: 0 };
                });
              }
            }

            setRunState(prev => {
              if (prev.status === 'paused' || prev.isAutoPaused) return prev;
              const newDuration = prev.duration + 1;
              const avgSpeed = prev.distance > 0 ? (prev.distance * 3600) / newDuration : 0;
              const avgPaceStr = calculatePaceStr(newDuration, prev.distance);
              return {
                ...prev,
                duration: newDuration,
                avgSpeed: parseFloat(avgSpeed.toFixed(1)),
                avgPace: avgPaceStr
              };
            });
          }, 1000);

          lastPointTimeRef.current = Date.now();
          setIsSearchingGps(false);

          // Now start watchPosition tracking
          const watchId = navigator.geolocation.watchPosition(
            (watchPos) => {
              if (runStateRef.current.status === 'paused') return;

              const wLat = watchPos.coords.latitude;
              const wLng = watchPos.coords.longitude;

              // Check territory transition
              const newCoord = [wLat, wLng];
              let currentEnteredTerritory = null;
              for (const t of territories) {
                if (t.coords && t.coords.length >= 3) {
                  if (isPointInPolygon(newCoord, t.coords)) {
                    currentEnteredTerritory = t;
                    break;
                  }
                }
              }

              if (currentEnteredTerritory) {
                if (lastEnteredSectorIdRef.current !== currentEnteredTerritory.id) {
                  lastEnteredSectorIdRef.current = currentEnteredTerritory.id;
                  let bannerType = 'entering_neutral';
                  if (currentEnteredTerritory.ownerId === currentUser.uid) {
                    bannerType = 'entering_friendly';
                  } else if (currentEnteredTerritory.ownerId) {
                    if (currentUser.clan && currentEnteredTerritory.clan === currentUser.clan) {
                      bannerType = 'entering_friendly';
                    } else {
                      bannerType = 'entering_enemy';
                    }
                  }
                  triggerTerritoryBanner(bannerType, currentEnteredTerritory.name);
                }
              } else {
                if (lastEnteredSectorIdRef.current !== null) {
                  const prevTerritory = territories.find(t => t.id === lastEnteredSectorIdRef.current);
                  lastEnteredSectorIdRef.current = null;
                  if (prevTerritory) {
                    triggerTerritoryBanner('leaving', prevTerritory.name);
                  }
                }
              }

              const wAccuracy = watchPos.coords.accuracy;
              const wTimestamp = watchPos.timestamp || Date.now();

              console.log(`[GPS]\nlatitude: ${wLat}\nlongitude: ${wLng}\naccuracy: ${wAccuracy}m\ntimestamp: ${wTimestamp}`);
              
              setRunState(prev => {
                if (prev.status === 'paused') return prev;

                // 1. Accuracy criteria
                if (wAccuracy > 25) {
                  addLog(`GPS: Poor signal accuracy (${Math.round(wAccuracy)}m). Discarding point.`);
                  return { ...prev, gpsAccuracy: wAccuracy };
                }

                const newPoint = [wLat, wLng];
                const nowTime = Date.now();
                
                let incrementalDist = 0;
                if (prev.path.length > 0) {
                  const lastPoint = prev.path[prev.path.length - 1];
                  incrementalDist = getGeodeticDistance(lastPoint[0], lastPoint[1], wLat, wLng);
                }

                // 2. Ignore GPS Jitter (drift under 2 meters)
                if (prev.path.length > 0 && incrementalDist < 0.002) {
                  return { ...prev, gpsAccuracy: wAccuracy };
                }

                // 3. Compute speed & acceleration metrics
                let dt = 0;
                let instantSpeedMS = 0;
                if (lastPointTimeRef.current !== null) {
                  dt = (nowTime - lastPointTimeRef.current) / 1000;
                }

                if (dt > 0.1) {
                  const distMeters = incrementalDist * 1000;
                  instantSpeedMS = distMeters / dt;
                  const wAcceleration = Math.abs(instantSpeedMS - lastSpeedRef.current) / dt;

                  // 4. Anti-Cheat spike validation (> 12 m/s / 43 km/h discarded)
                  if (instantSpeedMS > 12.0) {
                    cheatMetricsRef.current.speedSpikes += 1;
                    addLog(`GPS: Discarding GPS speed spike (${(instantSpeedMS * 3.6).toFixed(1)} km/h).`);
                    return { ...prev, gpsAccuracy: wAccuracy };
                  }

                  if (instantSpeedMS > 6.0) {
                    cheatMetricsRef.current.repeatedJumps += 1;
                  }

                  if (wAcceleration > 4.0) {
                    cheatMetricsRef.current.unrealisticAcceleration += 1;
                  }

                  lastSpeedRef.current = instantSpeedMS;
                }

                // 5. Automatic Pause & Resume detection
                let nextAutoPaused = prev.isAutoPaused;
                if (instantSpeedMS < 0.5) {
                  // Increment stationary low speed timer
                  lowSpeedDurationRef.current += dt || 1.5;
                  if (lowSpeedDurationRef.current >= 6 && !prev.isAutoPaused) {
                    nextAutoPaused = true;
                    addLog("GPS: Auto-paused (runner stopped).");
                  }
                } else if (instantSpeedMS >= 0.8) {
                  // Reset stationary timer and auto-resume
                  lowSpeedDurationRef.current = 0;
                  if (prev.isAutoPaused) {
                    nextAutoPaused = false;
                    addLog("GPS: Auto-resumed (runner restarted).");
                  }
                }

                lastPointTimeRef.current = nowTime;

                // Format current speed & pace
                const speedKmH = instantSpeedMS * 3.6;
                let currentPaceStr = '--:--';
                if (instantSpeedMS >= 0.3) {
                  const paceDec = 60 / speedKmH;
                  const pMins = Math.floor(paceDec);
                  const pSecs = Math.floor((paceDec - pMins) * 60);
                  if (pMins <= 30) {
                    currentPaceStr = `${pMins}:${pSecs.toString().padStart(2, '0')}`;
                  }
                }

                // If auto-paused, do NOT accumulate distance or path coordinates
                let updatedPath = prev.path;
                let updatedDistance = prev.distance;
                if (!nextAutoPaused) {
                  updatedPath = [...prev.path, newPoint];
                  updatedDistance = parseFloat((prev.distance + incrementalDist).toFixed(3));
                }

                const totalDuration = prev.duration || 1;
                const avgSpeed = (updatedDistance * 3600) / totalDuration;
                const avgPaceStr = calculatePaceStr(totalDuration, updatedDistance);
                const caloriesEst = Math.round(updatedDistance * 75 * 1.03);

                if (polylineRef.current && !nextAutoPaused) polylineRef.current.setLatLngs(updatedPath);
                if (runnerMarkerRef.current) runnerMarkerRef.current.setLatLng(newPoint);
                if (mapInstanceRef.current && mapAutoFollowRef.current) mapInstanceRef.current.panTo(newPoint);

                // Self-intersection check
                if (updatedPath.length >= 5 && updatedDistance > 0.05) {
                  const intersectIdx = checkPathSelfIntersection(updatedPath);
                  if (intersectIdx !== null) {
                    setTimeout(() => {
                      finishRealRun(updatedPath.slice(intersectIdx));
                    }, 200);
                  }
                }

                return {
                  ...prev,
                  path: updatedPath,
                  distance: updatedDistance,
                  gpsAccuracy: wAccuracy,
                  speed: parseFloat(speedKmH.toFixed(1)),
                  avgSpeed: parseFloat(avgSpeed.toFixed(1)),
                  avgPace: avgPaceStr,
                  calories: caloriesEst,
                  pace: currentPaceStr,
                  isAutoPaused: nextAutoPaused
                };
              });
            },
            (watchErr) => {
              console.error("GPS Watch Error", watchErr);
              addLog(`GPS Warning: 
${watchErr.message} (retrying)`);
            },
            { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
          );

          watchIdRef.current = watchId;
        },
        (error) => {
          setIsSearchingGps(false);
          console.error("GPS Initial Error", error);
          alert(`GPS Signal Acquisition Failed: ${error.message}. Please stand in an open area and try again.`);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      // DEVELOPER SIMULATION MODE
      addLog("GPS Sim: Initializing developer simulator walk...");
      const route = SIMULATION_ROUTES[simulationRouteKey];
      const startPoint = route.points[0];

      if (mapInstanceRef.current) {
        mapInstanceRef.current.setView(startPoint, 15.5);

        polylineRef.current = L.polyline([startPoint], {
          color: '#FC4C02',
          weight: 4
        }).addTo(mapInstanceRef.current);

        const runnerIcon = L.divIcon({
          className: 'custom-runner-icon',
          html: `<div style="background-color: #FC4C02; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
          iconSize: [16, 16]
            });
        runnerMarkerRef.current = L.marker(startPoint, { icon: runnerIcon }).addTo(mapInstanceRef.current);
      }

      setRunState({
        status: 'tracking',
        path: [startPoint],
        distance: 0,
        duration: 0,
        pace: '05:00',
        gpsAccuracy: 3,
        speed: 12.0,
        avgSpeed: 12.0,
        avgPace: '05:00',
        calories: 0,
        isAutoPaused: false
      });

      // Start Clock timer
      timerIntervalRef.current = setInterval(() => {
        setRunState(prev => {
          if (prev.status === 'paused' || prev.isAutoPaused) return prev;
          const newDuration = prev.duration + 1;
          const avgSpeed = prev.distance > 0 ? (prev.distance * 3600) / newDuration : 0;
          const avgPaceStr = calculatePaceStr(newDuration, prev.distance);
          return {
            ...prev,
            duration: newDuration,
            avgSpeed: parseFloat(avgSpeed.toFixed(1)),
            avgPace: avgPaceStr
          };
        });
      }, 1000);

      addLog(`GPS Sim: Starting developer walk on loop: ${route.name}`);
      let idx = 0;
      lastPointTimeRef.current = Date.now();

      const intervalId = setInterval(() => {
        if (runStateRef.current.status === 'paused') return;

        if (idx >= route.points.length) {
          clearInterval(intervalId);
          simIntervalRef.current = null;
          addLog("GPS: Simulator path completed.");
          return;
        }

        const point = route.points[idx];
        const timestamp = Date.now();

        // Check territory transition in simulator
        let currentEnteredTerritory = null;
        for (const t of territories) {
          if (t.coords && t.coords.length >= 3) {
            if (isPointInPolygon(point, t.coords)) {
              currentEnteredTerritory = t;
              break;
            }
          }
        }

        if (currentEnteredTerritory) {
          if (lastEnteredSectorIdRef.current !== currentEnteredTerritory.id) {
            lastEnteredSectorIdRef.current = currentEnteredTerritory.id;
            let bannerType = 'entering_neutral';
            if (currentEnteredTerritory.ownerId === currentUser.uid) {
              bannerType = 'entering_friendly';
            } else if (currentEnteredTerritory.ownerId) {
              if (currentUser.clan && currentEnteredTerritory.clan === currentUser.clan) {
                bannerType = 'entering_friendly';
              } else {
                bannerType = 'entering_enemy';
              }
            }
            triggerTerritoryBanner(bannerType, currentEnteredTerritory.name);
          }
        } else {
          if (lastEnteredSectorIdRef.current !== null) {
            const prevTerritory = territories.find(t => t.id === lastEnteredSectorIdRef.current);
            lastEnteredSectorIdRef.current = null;
            if (prevTerritory) {
              triggerTerritoryBanner('leaving', prevTerritory.name);
            }
          }
        }

        setRunState(prev => {
          if (prev.status === 'paused') return prev;

          let incrementalDist = 0;
          if (prev.path.length > 0) {
            const lastPoint = prev.path[prev.path.length - 1];
            incrementalDist = getGeodeticDistance(lastPoint[0], lastPoint[1], point[0], point[1]);
          }

          const updatedPath = [...prev.path, point];
          const updatedDistance = parseFloat((prev.distance + incrementalDist).toFixed(3));

          if (polylineRef.current) polylineRef.current.setLatLngs(updatedPath);
          if (runnerMarkerRef.current) runnerMarkerRef.current.setLatLng(point);
          if (mapInstanceRef.current && mapAutoFollowRef.current) mapInstanceRef.current.panTo(point);

          if (updatedPath.length >= 5 && updatedDistance > 0.05) {
            const intersectIdx = checkPathSelfIntersection(updatedPath);
            if (intersectIdx !== null) {
              clearInterval(intervalId);
              simIntervalRef.current = null;
              setTimeout(() => {
                finishRealRun(updatedPath.slice(intersectIdx));
              }, 200);
            }
          }

          const totalDuration = prev.duration || 1;
          const avgSpeed = (updatedDistance * 3600) / totalDuration;
          const avgPaceStr = calculatePaceStr(totalDuration, updatedDistance);
          const caloriesEst = Math.round(updatedDistance * 75 * 1.03);

          const currentSpeedSim = 12.5 + (Math.random() * 2 - 1);
          let currentPaceStr = '04:48';
          if (currentSpeedSim > 0.5) {
            const paceDec = 60 / currentSpeedSim;
            const pMins = Math.floor(paceDec);
            const pSecs = Math.floor((paceDec - pMins) * 60);
            currentPaceStr = `${pMins}:${pSecs.toString().padStart(2, '0')}`;
          }

          return {
            ...prev,
            path: updatedPath,
            distance: updatedDistance,
            speed: parseFloat(currentSpeedSim.toFixed(1)),
            avgSpeed: parseFloat(avgSpeed.toFixed(1)),
            avgPace: avgPaceStr,
            calories: caloriesEst,
            pace: currentPaceStr,
            gpsAccuracy: 3
          };
        });

        idx++;
      }, 1500);

      simIntervalRef.current = intervalId;
    }
  };

  const stopTracking = (reason = "Explicit User Request") => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (simIntervalRef.current) {
      console.log(`[GPS Engine] Simulator interval cleared (stop). Interval ID: ${simIntervalRef.current}`);
      addLog("GPS: Simulator interval cleared.");
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    clearInterval(timerIntervalRef.current);
    releaseWakeLock();

    // If the run has significant distance, show the summary modal instead of resetting immediately!
    if (reason === "Explicit User Request" && runState.distance >= 0.01) {
      const runSummary = {
        userId: currentUser.uid,
        path: runState.path,
        distance: runState.distance,
        duration: runState.duration,
        pace: runState.avgPace !== '--:--' ? runState.avgPace : runState.pace,
        speed: runState.avgSpeed || parseFloat((runState.distance > 0 ? (runState.distance * 3600) / runState.duration : 0).toFixed(1)),
        calories: runState.calories || Math.round(runState.distance * 75 * 1.03),
        startTime: startTimeRef.current ? startTimeRef.current.toISOString() : new Date().toISOString(),
        endTime: new Date().toISOString(),
        summaryStatistics: {
          maxSpeed: Math.round(cheatMetricsRef.current.maxSpeed || 0),
          averageAccuracy: runState.gpsAccuracy,
          originalTrackingMode: trackingMode
        }
      };
      setCompletedRunData(runSummary);
      setShowSummaryModal(true);
      addLog("System: Run completed. Summary modal opened.");
      return;
    }

    if (polylineRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(polylineRef.current);
    if (runnerMarkerRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(runnerMarkerRef.current);

    setRunState({
      status: 'idle',
      path: [],
      distance: 0,
      duration: 0,
      pace: '--:--',
      gpsAccuracy: null,
      speed: 0,
      avgSpeed: 0,
      avgPace: '--:--',
      calories: 0,
      isAutoPaused: false
    });
    addLog(`System: Run tracking halted. Reason: ${reason}`);
  };

  const recenterMap = () => {
    setMapAutoFollow(true);
    if (mapInstanceRef.current && runnerMarkerRef.current) {
      mapInstanceRef.current.setView(runnerMarkerRef.current.getLatLng(), 16.5);
      addLog("GPS: Centered map on user position.");
    } else if (mapInstanceRef.current && runState.path && runState.path.length > 0) {
      const path = runState.path;
      const lastCoord = path[path.length - 1];
      mapInstanceRef.current.setView(lastCoord, 16.5);
      addLog("GPS: Centered map on last known coordinate.");
    } else {
      addLog("GPS: Position not available for centering.");
    }
  };

  const finishRealRun = async (loopCoordinates) => {
    const areaSqM = calculatePolygonArea(loopCoordinates);
    const formattedArea = `${areaSqM.toLocaleString()} m²`;

    if (areaSqM < 200) {
      addLog(`GeoCalc: Loop area is too small (${formattedArea} < 200 m²). Territory not recorded.`);
      alert("Loop too small. Continue running to create a larger loop.");
      return;
    }

    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    if (simIntervalRef.current) {
      console.log(`[GPS Engine] Simulator interval cleared (finish). Interval ID: ${simIntervalRef.current}`);
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    clearInterval(timerIntervalRef.current);
    releaseWakeLock();

    console.log(`[TRACKING]\ntrackingMode: ${trackingMode}\nrunState: finished\nwatchId: null`);
    addLog("GPS: Closed loop verification verified.");

    // Anti-Cheat: Evaluate suspicion score
    if (trackingMode === 'gps') {
      const totalDuration = runState.duration || 1; // seconds
      const totalDistanceMeters = runState.distance * 1000;
      const overallAvgSpeed = totalDistanceMeters / totalDuration; // m/s

      // 1. Hard cutoff check: overall average speed > 8.0 m/s (28.8 km/h) is impossible for long loops
      if (overallAvgSpeed > 8.0) {
        addLog(`Anti-Cheat: Run invalidated. Unrealistic average speed (${(overallAvgSpeed * 3.6).toFixed(1)} km/h).`);
        reportError(
          `Anti-Cheat: Invalidation. Overall avg speed is too high (${(overallAvgSpeed * 3.6).toFixed(1)} km/h).`,
          '',
          'AntiCheat',
          { distance: runState.distance, duration: runState.duration, avgSpeed: overallAvgSpeed }
        );
        alert("Anti-Cheat Triggered: Average speed exceeds realistic running limits.");
        stopTracking("Anti-Cheat Average Speed Spike Cutoff");
        return;
      }

      // 2. Calculate dynamic suspicion score
      let suspicionScore = 0;
      suspicionScore += cheatMetricsRef.current.repeatedJumps * 15;
      suspicionScore += cheatMetricsRef.current.unrealisticAcceleration * 10;
      if (overallAvgSpeed > 5.5) {
        suspicionScore += 40; // High running average speed suspicion
      }

      if (suspicionScore >= 80) {
        addLog(`Anti-Cheat: Run invalidated. Suspicion Score: ${suspicionScore}/100.`);
        reportError(
          `Anti-Cheat: Invalidation. Suspicion Score: ${suspicionScore}/100. Metrics: ${JSON.stringify(cheatMetricsRef.current)}`,
          '',
          'AntiCheat',
          { suspicionScore, metrics: cheatMetricsRef.current, avgSpeed: overallAvgSpeed }
        );
        alert("Anti-Cheat Triggered: Unrealistic movement signals detected. Run was flagged.");
        stopTracking("Anti-Cheat High Suspicion Score Invalidation");
        return;
      }

      if (suspicionScore > 0) {
        addLog(`Anti-Cheat: Run verified with caution. Suspicion Score: ${suspicionScore}/100.`);
      }
    }

    const sectorName = trackingMode === 'gps' 
      ? `Sector_${Math.floor(100 + Math.random() * 900)}` 
      : SIMULATION_ROUTES[simulationRouteKey].name;

    addLog(`System: Submitting territory '${sectorName}' to cloud...`);

    const newTerritory = {
      name: sectorName,
      ownerId: currentUser.uid,
      ownerName: currentUser.displayName,
      clan: currentUser.clan,
      area: formattedArea,
      decayHours: 72,
      maxDecayHours: 72,
      rate: Math.ceil(areaSqM / 2000) || 5, // Yield based on size
      coords: loopCoordinates
    };

    // Save Completed Run History
    const runSummary = {
      userId: currentUser.uid,
      path: loopCoordinates,
      distance: runState.distance,
      duration: runState.duration,
      pace: runState.avgPace !== '--:--' ? runState.avgPace : runState.pace,
      speed: runState.avgSpeed,
      calories: runState.calories,
      startTime: startTimeRef.current ? startTimeRef.current.toISOString() : new Date().toISOString(),
      endTime: new Date().toISOString(),
      summaryStatistics: {
        conqueredTerritoryName: sectorName,
        originalTrackingMode: trackingMode
      }
    };
    await saveCompletedRun(runSummary);
    addLog(`System: Run history successfully saved.`);

    // Save to Database (Firestore / LocalStorage)
    await saveNewTerritory(newTerritory);
    addLog(`System: Conquest confirmed! Territory '${sectorName}' registered.`);

    // Reward Stats
    const coinReward = Math.ceil(areaSqM / 100) + 20;
    const xpReward = 150;
    
    setCurrentUser(prev => {
      const newXp = prev.xp + xpReward;
      const leveledUp = newXp >= prev.nextLevelXp;
      return {
        ...prev,
        coins: prev.coins + coinReward,
        xp: leveledUp ? newXp - prev.nextLevelXp : newXp,
        level: leveledUp ? prev.level + 1 : prev.level,
        nextLevelXp: leveledUp ? prev.nextLevelXp + 500 : prev.nextLevelXp
      };
    });

    addLog(`Economy: Gained +${coinReward} Coins and +${xpReward} XP.`);

    // Clean tracking layers
    if (polylineRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(polylineRef.current);
    if (runnerMarkerRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(runnerMarkerRef.current);

    console.log(`[TRACKING]\ntrackingMode: ${trackingMode}\nrunState: idle\nwatchId: null\nterminationReason: Successful Conquest Completion`);

    setRunState({
      status: 'idle',
      path: [],
      distance: 0,
      duration: 0,
      pace: '--:--',
      gpsAccuracy: null,
      speed: 0,
      avgSpeed: 0,
      avgPace: '--:--',
      calories: 0,
      isAutoPaused: false
    });

    // Notify Coach Chat
    setCoachMessages(prev => [
      ...prev,
      {
        id: Date.now(),
        sender: 'coach',
        text: `Insane run! 👑 You closed a path of ${formattedArea} and pocketed ${coinReward} coins. Go fortify it!`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  };

  // Line Intersection Checker
  const checkSegmentsIntersect = (p1, q1, p2, q2) => {
    const orientation = (p, q, r) => {
      const val = (q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]);
      if (Math.abs(val) < 1e-9) return 0; // collinear
      return val > 0 ? 1 : 2; // clock or counterclock
    };

    const onSegment = (p, q, r) => {
      return q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) &&
             q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]);
    };

    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);

    if (o1 !== o2 && o3 !== o4) return true;

    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;

    return false;
  };

  const checkPathSelfIntersection = (path) => {
    if (path.length < 5) return null;
    const lastIdx = path.length - 1;
    const p1 = path[lastIdx - 1];
    const q1 = path[lastIdx];

    // Check last segment against all previous segments
    for (let i = 0; i < lastIdx - 3; i++) {
      const p2 = path[i];
      const q2 = path[i + 1];
      if (checkSegmentsIntersect(p1, q1, p2, q2)) {
        return i;
      }
    }
    return null;
  };

  const getClanStandings = () => {
    const clanAreas = {
      'Udaipur Racers': 0,
      'GITS Runners': 0,
      'Delhi Marathon Club': 0
    };
    let totalArea = 0;

    territories.forEach(terr => {
      const areaVal = parseFloat(terr.area.replace(/[^\d.]/g, '')) || 0;
      if (clanAreas[terr.clan] !== undefined) {
        clanAreas[terr.clan] += areaVal;
        totalArea += areaVal;
      }
    });

    // Provide default initial non-zero standings if there are no territories yet
    if (totalArea === 0) {
      return [
        { name: 'Udaipur Racers', percentage: 34 },
        { name: 'GITS Runners', percentage: 33 },
        { name: 'Delhi Marathon Club', percentage: 33 }
      ];
    }

    return Object.keys(clanAreas).map(name => {
      const percentage = totalArea > 0 ? Math.round((clanAreas[name] / totalArea) * 100) : 0;
      return { name, percentage };
    }).sort((a, b) => b.percentage - a.percentage);
  };

  // Distance computation (Haversine formula in km)
  const getGeodeticDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Shoelace formula area computation
  const calculatePolygonArea = (points) => {
    if (points.length < 3) return 0;
    let area = 0;
    const latRef = points[0][0];
    const lonRef = points[0][1];

    const meters = points.map(p => {
      const y = (p[0] - latRef) * 111139;
      const x = (p[1] - lonRef) * 111139 * Math.cos(latRef * Math.PI / 180);
      return [x, y];
    });

    const len = meters.length;
    for (let i = 0; i < len; i++) {
      const curr = meters[i];
      const next = meters[(i + 1) % len];
      area += (curr[0] * next[1]) - (next[0] * curr[1]);
    }
    return Math.round(Math.abs(area / 2));
  };

  const calculatePaceStr = (elapsedSeconds, distanceKm) => {
    if (elapsedSeconds < 10 || !distanceKm || distanceKm < 0.02) {
      return '--:--';
    }

    const distanceMeters = distanceKm * 1000;
    const paceMinutesPerKm = (elapsedSeconds / 60) / (distanceMeters / 1000);

    const paceMin = Math.floor(paceMinutesPerKm);
    let paceSec = Math.round((paceMinutesPerKm - paceMin) * 60);

    let finalMin = paceMin;
    if (paceSec === 60) {
      finalMin += 1;
      paceSec = 0;
    }

    // Validate range: 2:00 min/km to 30:00 min/km
    if (finalMin < 2 || finalMin > 30 || (finalMin === 30 && paceSec > 0)) {
      return '--:--';
    }

    return `${finalMin}:${paceSec.toString().padStart(2, '0')}`;
  };

  // ----------------------------------------------------
  // Shop & Shield Purchases
  // ----------------------------------------------------
  const buyItem = (type, cost) => {
    if (currentUser.coins < cost) {
      alert("Insufficient coins!");
      return;
    }
    setCurrentUser(prev => ({ ...prev, coins: prev.coins - cost }));
    setInventory(prev => ({ ...prev, [type]: prev[type] + 1 }));
    addLog(`Shop: Bought 1x ${type}.`);
  };

  const useShield = async (territoryId) => {
    if (inventory.shields <= 0) {
      alert("Buy a shield from the shop first!");
      return;
    }
    
    const terr = territories.find(t => t.id === territoryId);
    if (!terr) return;

    setInventory(prev => ({ ...prev, shields: prev.shields - 1 }));
    const newDecay = Math.min(terr.decayHours + 24, terr.maxDecayHours || 72);
    
    await updateTerritory(territoryId, { decayHours: newDecay });
    addLog(`System: Fortified '${terr.name}' with Shield (+24 hours).`);
  };

  // ----------------------------------------------------
  // AI Coach Chat
  // ----------------------------------------------------
  const handleCoachSendMessage = (e, textOverride = '') => {
    if (e) e.preventDefault();
    const textToSend = textOverride || coachInput;
    if (!textToSend.trim()) return;
 
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
 
    setCoachMessages(prev => [...prev, userMsg]);
    const input = textToSend.toLowerCase();
    if (!textOverride) {
      setCoachInput('');
    }
 
    setTimeout(() => {
      let reply = "I am processing your pace index. Ask 'routes' for nearby targets.";
      if (input.includes('hi') || input.includes('hello') || input.includes('hey')) {
        reply = "What's good? 🫡 Stride calibrated. You ready to lock in some loops or defend your crew?";
      } else if (input.includes('route') || input.includes('target') || input.includes('where')) {
        reply = "I suggest doing a run in your local neighborhood. Ensure your loop is at least 200 square meters so the database validates the capture. Let's get it! 🏰";
      } else if (input.includes('gps') || input.includes('real')) {
        reply = "Switch to 'Real GPS' tracking in the sidebar, step outside, and start a run. When you cross your own path, the app auto-closes the loop and captures the sector! 🛰️";
      } else if (input.includes('pace') || input.includes('speed')) {
        reply = "Your target pace is 5:30 min/km. Maintain consistency to unlock the 'Speed Runner' dynamic trail.";
      }
      setCoachMessages(prev => [
        ...prev,
        { id: Date.now() + 1, sender: 'coach', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    }, 1000);
  };

  // ----------------------------------------------------
  // Clan Chat
  // ----------------------------------------------------
  const handleClanSendMessage = (e) => {
    e.preventDefault();
    if (!clanInput.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: `${currentUser.displayName} (You)`,
      text: clanInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setClanMessages(prev => [...prev, userMsg]);
    setClanInput('');

    setTimeout(() => {
      const responses = [
        "Let's push GITS out of Udaipur sector 4!",
        "Nice run, crew stats look cracked.",
        "Just saw your captured sector on the map. Dub!",
        "Defending the Lake next. Shields look solid."
      ];
      setClanMessages(prev => [
        ...prev,
        { id: Date.now() + 1, sender: 'Divya', text: responses[Math.floor(Math.random() * responses.length)], time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
      ]);
    }, 1200);
  };

  // ----------------------------------------------------
  // RENDER INTERFACE
  // ----------------------------------------------------

  // AUTH GATED VIEW
  if (!currentUser) {
    return (
      <div className="fade-in p-6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#0B0B0B' }}>
        <div className="clash-card p-8 gap-6" style={{ width: '420px', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ textAlign: 'center' }}>
            <span className="clash-label" style={{ color: '#FC4C02', letterSpacing: '3px' }}>RunClash // Sector Conquest</span>
            <h1 className="clash-hero" style={{ margin: '10px 0 0 0', fontSize: '32px', letterSpacing: '-1px' }}>RUNCLASH</h1>
            <p className="clash-body" style={{ marginTop: '8px', fontSize: '13px' }}>
              Connect your GPS to conquer real-world loops. Powered by {isFirebaseActive() ? 'Supabase Cloud' : 'LocalStorage persistence'}.
            </p>
          </div>

          {authError && (
            <div style={{ background: 'rgba(252, 76, 2, 0.05)', border: '1px solid #FC4C02', color: 'white', borderRadius: '12px', padding: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={15} style={{ color: '#FC4C02' }} />
              <span style={{ fontWeight: '500' }}>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="gap-4" style={{ display: 'flex', flexDirection: 'column' }}>
            {authMode !== 'guest' && (
              <div className="gap-2" style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="clash-label" style={{ fontSize: '9px' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--clash-text-secondary)' }} />
                  <input 
                    type="email" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)}
                    required
                    placeholder="email@provider.com"
                    className="cyber-input cyber-input-with-icon focus-ring"
                  />
                </div>
              </div>
            )}

            <div className="gap-2" style={{ display: 'flex', flexDirection: 'column' }}>
              <label className="clash-label" style={{ fontSize: '9px' }}>Password / Nickname</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--clash-text-secondary)' }} />
                <input 
                  type={authMode === 'guest' ? 'text' : 'password'}
                  value={authPassword} 
                  onChange={e => setAuthPassword(e.target.value)}
                  required={authMode !== 'guest'}
                  placeholder={authMode === 'guest' ? 'e.g. Lakshya' : '••••••••'}
                  className="cyber-input cyber-input-with-icon focus-ring"
                />
              </div>
            </div>

            {authMode === 'signup' && (
              <div className="gap-2" style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="clash-label" style={{ fontSize: '9px' }}>Display Name</label>
                <input 
                  type="text" 
                  value={authName} 
                  onChange={e => setAuthName(e.target.value)}
                  required
                  placeholder="e.g. Lakshya"
                  className="cyber-input focus-ring"
                />
              </div>
            )}

            {(authMode === 'signup' || authMode === 'guest') && (
              <div className="gap-2" style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="clash-label" style={{ fontSize: '9px' }}>Choose Crew / Clan</label>
                <select 
                  value={authClan} 
                  onChange={e => setAuthClan(e.target.value)}
                  className="cyber-select focus-ring"
                >
                  <option value="Udaipur Racers">Udaipur Racers (Orange)</option>
                  <option value="GITS Runners">GITS Runners (White)</option>
                  <option value="Delhi Marathon Club">Delhi Marathon Club (Gray)</option>
                </select>
              </div>
            )}

            <button type="submit" className="clash-btn-primary" style={{ marginTop: '12px' }}>
              {authMode === 'login' ? 'Access Sector' : authMode === 'signup' ? 'Create Account' : 'Enter Arena'}
            </button>
          </form>

          {/* Form Switching Toggles */}
          <div className="gap-2 text-base" style={{ display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--clash-border)', paddingTop: '20px', textAlign: 'center' }}>
            {authMode === 'login' ? (
              <>
                <div className="clash-body" style={{ fontSize: '11px' }}>New runner? <span style={{ cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline', color: '#FC4C02' }} onClick={() => setAuthMode('signup')}>Sign Up</span></div>
                <div className="clash-body" style={{ fontSize: '11px' }}>Just exploring? <span style={{ cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline', color: '#FC4C02' }} onClick={() => setAuthMode('guest')}>Enter as Guest</span></div>
              </>
            ) : authMode === 'signup' ? (
              <div className="clash-body" style={{ fontSize: '11px' }}>Already registered? <span style={{ cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline', color: '#FC4C02' }} onClick={() => setAuthMode('login')}>Sign In</span></div>
            ) : (
              <div className="clash-body" style={{ fontSize: '11px' }}>Want cloud account? <span style={{ cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline', color: '#FC4C02' }} onClick={() => setAuthMode('signup')}>Sign Up</span></div>
            )}
          </div>

        </div>
      </div>
    );
  }
  // ACTIVE GAMEPLAY DASHBOARD
  return (
    <div 
      className="sim-container fade-in"
      style={!DEBUG_MODE ? { display: 'flex', justifyContent: 'center', padding: '24px 0', minHeight: '100vh', alignItems: 'center' } : {}}
    >
      {DEBUG_MODE && (
        /* SIMULATOR / CONFIGURATION CONTROL PANEL */
        <div className="clash-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px', height: 'fit-content' }}>
          <div>
            <span className="clash-label" style={{ color: '#FC4C02', fontSize: '11px', letterSpacing: '2.5px' }}>Configuration Control</span>
            <h2 className="clash-title" style={{ margin: '6px 0 0 0', fontSize: '28px', letterSpacing: '-0.5px' }}>GPS Tracker Setup</h2>
            <p className="clash-body" style={{ fontSize: '13px', marginTop: '8px' }}>
              Choose your execution mode. Step outside and run in loops with <b>Real GPS</b>, or test closed loops from your computer with <b>Developer Sim</b>.
            </p>
          </div>

          {/* Tracking Mode selection */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label className="clash-label" style={{ fontSize: '10px' }}>Location Source Mode</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button 
                className={trackingMode === 'gps' ? 'clash-btn-primary' : 'clash-btn-secondary'}
                onClick={() => setTrackingMode('gps')}
                disabled={runState.status !== 'idle'}
                style={{ fontSize: '11px', gap: '6px', padding: '12px', borderRadius: '12px' }}
              >
                <Navigation size={13} style={{ transform: 'rotate(45deg)' }} /> Real GPS
              </button>
              <button 
                className={trackingMode === 'sim' ? 'clash-btn-primary' : 'clash-btn-secondary'}
                onClick={() => setTrackingMode('sim')}
                disabled={runState.status !== 'idle'}
                style={{ fontSize: '11px', gap: '6px', padding: '12px', borderRadius: '12px' }}
              >
                <Radio size={13} /> Developer Sim
              </button>
            </div>
          </div>

          {/* Predefined Simulator selection (Only shown if mode is sim) */}
          {trackingMode === 'sim' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label className="clash-label" style={{ fontSize: '10px' }}>Mock Simulator Loop</label>
              <select 
                value={simulationRouteKey}
                onChange={e => setSimulationRouteKey(e.target.value)}
                disabled={runState.status !== 'idle'}
                className="cyber-select"
              >
                <option value="lake">Fateh Sagar Lake Loop (3.2 km)</option>
                <option value="foothills">Sajjan Garh Foothills Base (2.1 km)</option>
                <option value="monument">Udaipur Castle Park (1.4 km)</option>
                <option value="micro">Micro Loop (Too Small Test)</option>
              </select>
            </div>
          )}

          {/* Control execution buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {runState.status === 'idle' ? (
              <button className="clash-btn-primary" onClick={startTracking} style={{ width: '100%', fontSize: '11px', padding: '12px' }}>
                <Play size={13} /> Start Tracking
              </button>
            ) : (
              <button className="clash-btn-secondary" onClick={stopTracking} style={{ width: '100%', borderColor: '#FC4C02', color: '#FC4C02', fontSize: '11px', padding: '12px' }}>
                <Square size={13} /> Stop Run
              </button>
            )}

            <button 
              className="clash-btn-secondary"
              onClick={handleLogout}
              style={{ width: '100%', fontSize: '11px', gap: '6px', padding: '12px' }}
            >
              <LogOut size={13} /> Sign Out
            </button>
          </div>

          {/* Collapsible Developer Console logs */}
          <details style={{ marginTop: '4px' }}>
            <summary className="clash-label" style={{ fontSize: '10px', cursor: 'pointer', outline: 'none' }}>
              Developer Tools
            </summary>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
              <span className="clash-label" style={{ fontSize: '9px' }}>GPS Engine Console logs</span>
              <div style={{
                background: '#0B0B0B',
                border: '1px solid var(--clash-border)',
                borderRadius: '12px',
                padding: '12px',
                height: '150px',
                overflowY: 'auto',
                fontFamily: 'var(--clash-font-family)',
                fontSize: '10px',
                color: 'white',
                display: 'flex',
                flexDirection: 'column-reverse',
                gap: '6px'
              }}>
                {consoleLogs.map((log, i) => (
                  <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                    <span style={{ color: '#FC4C02', fontWeight: 'bold' }}>[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span> {log}
                  </div>
                ))}
              </div>
            </div>
          </details>

          {/* Cloud database active details */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--clash-border)' }}>
            <ShieldCheck size={16} style={{ color: '#FC4C02' }} />
            <span className="clash-body" style={{ fontSize: '11px', fontWeight: '500' }}>
              Active Sync: <span style={{ color: 'white', fontWeight: '700' }}>{isFirebaseActive() ? 'Supabase Cloud (PostgreSQL)' : 'Local Offline Database'}</span>
            </span>
          </div>
        </div>
      )}      {/* MOBILE DEVICE FRAME SIMULATION */}
      <div className="phone-frame">
        <div className="phone-notch">
          <div className="phone-camera"></div>
        </div>

        <div className="app-screen">
          {isSearchingGps && (
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: '#0B0B0D',
              zIndex: 10000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '24px'
            }} className="fade-in">
              <div style={{ position: 'relative', width: '80px', height: '80px' }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  border: '3px solid rgba(252, 76, 2, 0.2)',
                  borderRadius: '50%'
                }}></div>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  border: '3px solid #FC4C02',
                  borderRadius: '50%',
                  animation: 'gps-pulse 1.5s infinite ease-in-out'
                }} className="gps-pulse"></div>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Compass size={32} style={{ color: '#FC4C02' }} className="intel-badge-pulse" />
                </div>
              </div>
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 20px' }}>
                <h3 className="clash-title" style={{ margin: 0, fontSize: '18px', color: 'white', fontWeight: '800', letterSpacing: '1px' }}>
                  LOCKING GPS
                </h3>
                <p className="clash-body" style={{ margin: 0, fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                  Acquiring tactical satellite lock. Please keep a clear view of the sky...
                </p>
              </div>
            </div>
          )}

          {/* Header */}
          <div style={{
            padding: '16px',
            borderBottom: '1px solid var(--border-color)',
            display: activeTab === 'map' ? 'none' : 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(10, 10, 20, 0.9)',
            backdropFilter: 'blur(10px)',
            zIndex: 100
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--neon-blue) 0%, var(--neon-purple) 100%)',
                border: '2px solid var(--neon-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: '800',
                fontSize: '13px',
                color: 'white',
                boxShadow: 'var(--glow-blue)'
              }}>
                {currentUser.displayName?.substring(0,1).toUpperCase() || 'U'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>{currentUser.displayName}</span>
                <span style={{ fontSize: '9px', color: 'var(--neon-blue)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{currentUser.clan}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 251, 0, 0.08)', border: '1px solid rgba(255, 251, 0, 0.15)', padding: '4px 8px', borderRadius: '20px', boxShadow: 'var(--glow-yellow)' }}>
                <Coins size={11} className="text-neon-yellow" />
                <span style={{ fontSize: '11px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: 'white' }}>{currentUser.coins}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>LVL {currentUser.level}</span>
                <div style={{ width: '45px', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${(currentUser.xp / (currentUser.nextLevelXp || 2500)) * 100}%`, height: '100%', background: 'var(--neon-pink)' }}></div>
                </div>
              </div>
              <button 
                onClick={() => setShowSettingsDrawer(prev => !prev)}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1.5px solid var(--border-color)',
                  borderRadius: '10px',
                  color: showSettingsDrawer ? 'var(--neon-pink)' : 'white',
                  cursor: 'pointer',
                  padding: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s ease'
                }}
                title="Settings"
              >
                <Settings size={14} style={{ transition: 'transform 0.3s ease', transform: showSettingsDrawer ? 'rotate(90deg)' : 'rotate(0)' }} />
              </button>
            </div>
          </div>

          {/* Active Tab Screen Content */}
          <div style={{ flex: 1, position: 'relative', overflowY: activeTab === 'map' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
            
            {/* COMPLETED RUN SUMMARY MODAL (Mission Complete Overlay) */}
            {showSummaryModal && completedRunData && (
              <div 
                className="fade-in" 
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: '#0B0B0B',
                  zIndex: 20000,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '24px',
                  overflowY: 'auto'
                }}
              >
                {/* Header */}
                <div style={{ textAlign: 'center', marginTop: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'rgba(252, 76, 2, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 8px auto'
                  }}>
                    <Trophy size={32} style={{ color: '#FC4C02' }} />
                  </div>
                  <h2 className="clash-title" style={{ fontSize: '24px', color: 'white', margin: 0, letterSpacing: '1px' }}>🏆 MISSION COMPLETE</h2>
                  <span className="clash-label" style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                    Tactical Operation Successful
                  </span>
                </div>

                {/* Primary Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                  <div style={{ background: '#151515', border: '1px solid #2A2A2A', padding: '16px', borderRadius: '16px' }}>
                    <span className="clash-label" style={{ fontSize: '8px', display: 'block', marginBottom: '4px' }}>Distance</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#FC4C02', fontFamily: 'var(--clash-font-mono)' }}>{completedRunData.distance} <span style={{ fontSize: '12px' }}>KM</span></span>
                  </div>
                  <div style={{ background: '#151515', border: '1px solid #2A2A2A', padding: '16px', borderRadius: '16px' }}>
                    <span className="clash-label" style={{ fontSize: '8px', display: 'block', marginBottom: '4px' }}>Duration</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>
                      {Math.floor(completedRunData.duration / 60)}:{(completedRunData.duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <div style={{ background: '#151515', border: '1px solid #2A2A2A', padding: '16px', borderRadius: '16px' }}>
                    <span className="clash-label" style={{ fontSize: '8px', display: 'block', marginBottom: '4px' }}>Average Pace</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>{completedRunData.pace}</span>
                  </div>
                  <div style={{ background: '#151515', border: '1px solid #2A2A2A', padding: '16px', borderRadius: '16px' }}>
                    <span className="clash-label" style={{ fontSize: '8px', display: 'block', marginBottom: '4px' }}>Average Speed</span>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>{completedRunData.speed} <span style={{ fontSize: '12px' }}>km/h</span></span>
                  </div>
                </div>

                {/* Secondary stats & rewards */}
                <div style={{ background: '#151515', border: '1px solid #2A2A2A', padding: '20px', borderRadius: '20px', display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--clash-text-secondary)', fontWeight: '800' }}>ENERGY BURNED</span>
                    <span style={{ fontSize: '14px', color: 'white', fontWeight: '800' }}>{completedRunData.calories} KCAL</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2A2A2A', paddingTop: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--clash-text-secondary)', fontWeight: '800' }}>SECTORS CAPTURED</span>
                    <span style={{ fontSize: '14px', color: '#FC4C02', fontWeight: '800' }}>
                      {completedRunData.summaryStatistics?.conqueredTerritoryName ? 1 : 0}
                    </span>
                  </div>
                  
                  {/* Rewards Row */}
                  <div style={{ display: 'flex', gap: '10px', borderTop: '1px solid #2A2A2A', paddingTop: '14px', marginTop: '4px' }}>
                    <div style={{ flex: 1, background: 'rgba(252, 76, 2, 0.05)', border: '1px solid rgba(252, 76, 2, 0.15)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)', fontWeight: '800' }}>COINS</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Coins size={12} style={{ color: '#FC4C02' }} />
                        <span style={{ fontSize: '13px', color: 'white', fontWeight: '800' }}>+{Math.ceil(completedRunData.distance * 20) + 10}</span>
                      </div>
                    </div>
                    <div style={{ flex: 1, background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '12px', padding: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)', fontWeight: '800' }}>XP REWARD</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Award size={12} style={{ color: '#10B981' }} />
                        <span style={{ fontSize: '13px', color: 'white', fontWeight: '800' }}>+{Math.ceil(completedRunData.distance * 100) + 50}</span>
                      </div>
                    </div>
                  </div>

                  {/* Achievements section */}
                  <div style={{ borderTop: '1px solid #2A2A2A', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>
                      Achievements Earned
                    </span>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {completedRunData.distance >= 1.0 ? (
                        <div style={{ fontSize: '10px', color: 'white', background: 'rgba(255,255,255,0.05)', border: '1px solid #2A2A2A', padding: '4px 10px', borderRadius: '8px', fontWeight: '800' }}>
                          🔥 First Flight
                        </div>
                      ) : null}
                      {completedRunData.speed >= 10 ? (
                        <div style={{ fontSize: '10px', color: 'white', background: 'rgba(255,255,255,0.05)', border: '1px solid #2A2A2A', padding: '4px 10px', borderRadius: '8px', fontWeight: '800' }}>
                          🏃 Speed Demon
                        </div>
                      ) : null}
                      {completedRunData.summaryStatistics?.conqueredTerritoryName ? (
                        <div style={{ fontSize: '10px', color: 'white', background: 'rgba(255,255,255,0.05)', border: '1px solid #2A2A2A', padding: '4px 10px', borderRadius: '8px', fontWeight: '800' }}>
                          🎯 Precision Loop
                        </div>
                      ) : null}
                      {completedRunData.distance < 1.0 && completedRunData.speed < 10 && !completedRunData.summaryStatistics?.conqueredTerritoryName ? (
                        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
                          No achievements earned this run. Keep going!
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* Primary Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto', marginBottom: '20px' }}>
                  <button 
                    onClick={async () => {
                      addLog("System: Saving run record to database...");
                      const res = await saveCompletedRun(completedRunData);
                      if (res.success) {
                        addLog("System: Run successfully synced and saved.");
                      } else {
                        addLog("GPS Warning: Run saved locally (sync deferred).");
                      }
                      
                      // Reward coins and XP
                      const coinReward = Math.ceil(completedRunData.distance * 20) + 10;
                      const xpReward = Math.ceil(completedRunData.distance * 100) + 50;
                      setCurrentUser(prev => {
                        const newXp = prev.xp + xpReward;
                        const leveledUp = newXp >= prev.nextLevelXp;
                        return {
                          ...prev,
                          coins: prev.coins + coinReward,
                          xp: leveledUp ? newXp - prev.nextLevelXp : newXp,
                          level: leveledUp ? prev.level + 1 : prev.level,
                          nextLevelXp: leveledUp ? prev.nextLevelXp + 500 : prev.nextLevelXp
                        };
                      });

                      // Clear maps layer
                      if (polylineRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(polylineRef.current);
                      if (runnerMarkerRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(runnerMarkerRef.current);

                      setRunState({
                        status: 'idle',
                        path: [],
                        distance: 0,
                        duration: 0,
                        pace: '--:--',
                        gpsAccuracy: null,
                        speed: 0,
                        avgSpeed: 0,
                        avgPace: '--:--',
                        calories: 0,
                        isAutoPaused: false
                      });

                      setShowSummaryModal(false);
                    }}
                    className="clash-btn-primary"
                    style={{ height: '48px', width: '100%', borderRadius: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: '800' }}
                  >
                    CONTINUE
                  </button>
                  
                  <button 
                    disabled
                    style={{ height: '44px', width: '100%', borderRadius: '22px', border: '1px solid rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', fontWeight: '800', background: 'transparent', cursor: 'not-allowed' }}
                  >
                    SHARE RUN (COMING SOON)
                  </button>

                  <button 
                    onClick={() => {
                      if (confirm("Are you sure you want to discard this run summary? The logged data will be permanently deleted.")) {
                        if (polylineRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(polylineRef.current);
                        if (runnerMarkerRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(runnerMarkerRef.current);

                        setRunState({
                          status: 'idle',
                          path: [],
                          distance: 0,
                          duration: 0,
                          pace: '--:--',
                          gpsAccuracy: null,
                          speed: 0,
                          avgSpeed: 0,
                          avgPace: '--:--',
                          calories: 0,
                          isAutoPaused: false
                        });
                        setShowSummaryModal(false);
                      }
                    }}
                    style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '6px', textAlign: 'center', fontWeight: '800' }}
                  >
                    DISCARD RECORD
                  </button>
                </div>
              </div>
            )}

            {/* SETTINGS DRAWER OVERLAY */}
            {showSettingsDrawer && (
              <div className="fade-in settings-drawer-mobile" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: '#0B0B0B',
                zIndex: 9999,
                padding: '24px 20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '22px',
                overflowY: 'auto'
              }}>
                {/* Header Title */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--clash-border)', paddingBottom: '14px' }}>
                  <h3 className="clash-subtitle" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Tactical Settings</h3>
                  <button 
                    onClick={() => setShowSettingsDrawer(false)}
                    className="clash-btn-secondary btn-sm"
                    style={{ color: '#FC4C02', borderColor: '#FC4C02' }}
                  >
                    Close
                  </button>
                </div>

                {/* Profile Header Block */}
                <div className="clash-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: '#0B0B0B',
                      border: '2px solid #FC4C02',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: '800',
                      color: 'white',
                      boxShadow: 'none'
                    }}>
                      {(currentUser.displayName || 'R')[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h4 className="clash-title" style={{ margin: 0, fontSize: '18px' }}>{currentUser.displayName}</h4>
                      <span className="clash-label" style={{ color: '#FC4C02', fontSize: '10px' }}>
                        {currentUser.clan || 'Udaipur Racers'}
                      </span>
                    </div>
                  </div>

                  {/* XP & Level progress */}
                  <div style={{ borderTop: '1px solid var(--clash-border)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--clash-text-secondary)', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '800' }}>LEVEL {currentUser.level}</span>
                      <span style={{ fontFamily: 'var(--clash-font-family)' }}>{currentUser.xp} XP</span>
                    </div>
                    <div className="clash-progress-bar">
                      <div className="clash-progress-bar-fill" style={{ width: `${(currentUser.xp / (currentUser.nextLevelXp || 2500)) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Coin holdings */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0B0B0B', border: '1px solid var(--clash-border)', padding: '8px 12px', borderRadius: '10px' }}>
                    <span className="clash-label" style={{ fontSize: '9px' }}>Coin Holdings</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Coins size={14} style={{ color: '#FC4C02' }} />
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>{currentUser.coins}</span>
                    </div>
                  </div>
                </div>

                {DEBUG_MODE && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                    <span className="clash-label" style={{ fontSize: '9px' }}>Running & GPS Configuration</span>
                    <div className="clash-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label className="clash-subtitle" style={{ fontSize: '12px' }}>Location Source Mode</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <button 
                            className={trackingMode === 'gps' ? 'clash-btn-primary' : 'clash-btn-secondary'}
                            onClick={() => { setTrackingMode('gps'); addLog("GPS: Switched to Real GPS mode."); }}
                            disabled={runState.status !== 'idle'}
                            style={{ fontSize: '10px', padding: '10px', gap: '6px', borderRadius: '12px' }}
                          >
                            <Navigation size={12} style={{ transform: 'rotate(45deg)' }} /> Real GPS
                          </button>
                          <button 
                            className={trackingMode === 'sim' ? 'clash-btn-primary' : 'clash-btn-secondary'}
                            onClick={() => { setTrackingMode('sim'); addLog("GPS: Switched to Dev Simulator mode."); }}
                            disabled={runState.status !== 'idle'}
                            style={{ fontSize: '10px', padding: '10px', gap: '6px', borderRadius: '12px' }}
                          >
                            <Radio size={12} /> Dev Sim
                          </button>
                        </div>
                      </div>
                      {trackingMode === 'sim' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--clash-border)', paddingTop: '12px' }}>
                          <label className="clash-subtitle" style={{ fontSize: '12px' }}>Mock Simulator Loop</label>
                          <select 
                            value={simulationRouteKey}
                            onChange={e => setSimulationRouteKey(e.target.value)}
                            disabled={runState.status !== 'idle'}
                            className="cyber-select focus-ring"
                            style={{ fontSize: '11px' }}
                          >
                            <option value="lake">Fateh Sagar Lake Loop (3.2 km)</option>
                            <option value="foothills">Sajjan Garh Foothills Base (2.1 km)</option>
                            <option value="monument">Udaipur Castle Park (1.4 km)</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {DEBUG_MODE && (
                  <details style={{ marginTop: '12px' }}>
                    <summary className="clash-label" style={{ fontSize: '10px', cursor: 'pointer', outline: 'none' }}>
                      Developer Tools
                    </summary>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                      <span className="clash-label" style={{ fontSize: '8px' }}>Tactical Console Logs</span>
                      <div style={{
                        background: '#0B0B0B',
                        border: '1px solid var(--clash-border)',
                        borderRadius: '12px',
                        padding: '10px',
                        height: '150px',
                        overflowY: 'auto',
                        fontFamily: 'var(--clash-font-family)',
                        fontSize: '10px',
                        color: 'white',
                        display: 'flex',
                        flexDirection: 'column-reverse',
                        gap: '4px'
                      }}>
                        {consoleLogs.map((log, i) => (
                          <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '3px' }}>
                            <span style={{ color: '#FC4C02', fontWeight: 'bold' }}>[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span> {log}
                          </div>
                        ))}
                      </div>
                    </div>
                  </details>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--clash-border)', paddingTop: '16px', marginTop: '16px' }}>
                  <button 
                    onClick={() => {
                      if (confirm("Are you sure you want to sign out?")) {
                        handleLogout();
                        setShowSettingsDrawer(false);
                      }
                    }}
                    className="clash-btn-secondary"
                    style={{ borderColor: '#FC4C02', color: '#FC4C02', width: '100%', height: '48px' }}
                  >
                    <LogOut size={13} style={{ color: '#FC4C02' }} /> Sign Out Account
                  </button>

                  <div className="clash-body" style={{ textAlign: 'center', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                    RunClash v2.0.0 • Secured Database Sync
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: activeTab === 'dashboard' ? 'flex' : 'none', flexDirection: 'column', gap: '20px', padding: '18px', height: '100%', overflowY: 'auto' }} className="fade-in">
              
              {/* Greeting Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div>
                  <span className="clash-label" style={{ fontSize: '10px' }}>
                    {(() => {
                      const hr = new Date().getHours();
                      if (hr < 12) return 'Good Morning';
                      if (hr < 17) return 'Good Afternoon';
                      return 'Good Evening';
                    })()}
                  </span>
                  <h3 className="clash-title" style={{ margin: '2px 0 0 0', fontSize: '24px' }}>
                    {currentUser.displayName || 'Runner'}
                  </h3>
                </div>
                <div style={{
                  border: '1px solid #FC4C02',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '9px',
                  fontWeight: '800',
                  color: '#FC4C02',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px'
                }}>
                  {currentUser.clan || 'Udaipur Racers'}
                </div>
              </div>

              {/* CTA Hero Card - Start Run */}
              <div className="clash-card" style={{ gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="clash-label" style={{ color: '#FC4C02', fontSize: '10px' }}>Quick Start</span>
                    <h4 className="clash-subtitle" style={{ margin: '4px 0 0 0' }}>Ready for your next loop?</h4>
                  </div>
                  <Compass size={24} style={{ color: '#FC4C02' }} />
                </div>
                <p className="clash-body" style={{ margin: 0, fontSize: '12px' }}>
                  Step outside, close a loop with GPS tracking, and expand your crew's sector holdings.
                </p>
                <button className="clash-btn-primary" onClick={() => setActiveTab('map')}>
                  Start Run
                </button>
              </div>

              {/* Hero Card - Today's Real Activity */}
              <div className="clash-card" style={{ gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="clash-label" style={{ fontSize: '10px' }}>Today's Activity</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: runState.status === 'tracking' ? '#FC4C02' : 'rgba(255,255,255,0.1)' }}></div>
                </div>
                
                {runState.distance > 0 || runState.status === 'tracking' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '32px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-family)' }}>{runState.distance.toFixed(2)}</span>
                      <span className="clash-body" style={{ fontSize: '14px', fontWeight: '700' }}>km</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--clash-border)', paddingTop: '10px' }}>
                      <div>
                        <span className="clash-label" style={{ fontSize: '9px' }}>Duration</span>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'white', marginTop: '2px' }}>
                          {(() => {
                            const hrs = Math.floor(runState.duration / 3600);
                            const mins = Math.floor((runState.duration % 3600) / 60);
                            const secs = runState.duration % 60;
                            return hrs > 0 
                              ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
                              : `${mins}:${secs.toString().padStart(2, '0')}`;
                          })()}
                        </div>
                      </div>
                      <div>
                        <span className="clash-label" style={{ fontSize: '9px' }}>Avg Pace</span>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'white', marginTop: '2px' }}>{runState.pace} /km</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0', textAlign: 'center', gap: '8px' }}>
                    <Compass size={24} className="clash-body" style={{ opacity: 0.4 }} />
                    <div className="clash-subtitle" style={{ fontSize: '13px' }}>No runs tracked today</div>
                    <span className="clash-body" style={{ fontSize: '11px' }}>Recorded statistics from your active run will display here.</span>
                  </div>
                )}
              </div>

              {/* Weekly Goal Status */}
              <div className="clash-card" style={{ gap: '12px' }}>
                <span className="clash-label" style={{ fontSize: '10px' }}>Weekly Progress</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
                    <span style={{ color: 'white' }}>Distance Goal</span>
                    <span className="clash-body">0 / 15.0 km</span>
                  </div>
                  <div className="clash-progress-bar">
                    <div className="clash-progress-bar-fill" style={{ width: '0%' }}></div>
                  </div>
                  <span className="clash-body" style={{ fontSize: '10px', fontStyle: 'italic', textAlign: 'center', marginTop: '4px' }}>
                    Weekly goals are not configured yet. Start a run to establish your target!
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                
                {/* Coins Stat Card */}
                <div className="clash-card" style={{ gap: '6px', cursor: 'pointer' }} onClick={() => setActiveTab('conquests')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Coins size={14} style={{ color: '#FC4C02' }} />
                    <span className="clash-label" style={{ fontSize: '10px' }}>Coins</span>
                  </div>
                  <h4 className="clash-title" style={{ margin: 0, fontSize: '24px' }}>{currentUser.coins}</h4>
                  <span className="clash-body" style={{ fontSize: '9px' }}>Spend in Armory &rarr;</span>
                </div>

                {/* Level / XP Stat Card */}
                <div className="clash-card" style={{ gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} style={{ color: '#FC4C02' }} />
                    <span className="clash-label" style={{ fontSize: '10px' }}>XP Level</span>
                  </div>
                  <h4 className="clash-title" style={{ margin: 0, fontSize: '24px' }}>LVL {currentUser.level}</h4>
                  <span className="clash-body" style={{ fontSize: '9px' }}>{currentUser.xp} total XP</span>
                </div>

                {/* Sectors Conquered Card */}
                <div className="clash-card" style={{ gap: '6px', cursor: 'pointer' }} onClick={() => setActiveTab('conquests')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Target size={14} style={{ color: '#FC4C02' }} />
                    <span className="clash-label" style={{ fontSize: '10px' }}>Sectors</span>
                  </div>
                  <h4 className="clash-title" style={{ margin: 0, fontSize: '24px' }}>
                    {territories.filter(t => t.ownerId === currentUser.uid).length}
                  </h4>
                  <span className="clash-body" style={{ fontSize: '9px' }}>View conquered loops &rarr;</span>
                </div>

                {/* Standing / Rank Card */}
                <div className="clash-card" style={{ gap: '6px', cursor: 'pointer' }} onClick={() => setActiveTab('clans')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Trophy size={14} style={{ color: '#FC4C02' }} />
                    <span className="clash-label" style={{ fontSize: '10px' }}>Rank</span>
                  </div>
                  <h4 className="clash-title" style={{ margin: 0, fontSize: '24px' }}>
                    {(() => {
                      const userRankIndex = leaderboard.findIndex(p => p.displayName === currentUser.displayName);
                      return userRankIndex !== -1 ? `#${userRankIndex + 1}` : '#5';
                    })()}
                  </h4>
                  <span className="clash-body" style={{ fontSize: '9px' }}>View leaderboards &rarr;</span>
                </div>

              </div>

              {/* Current Territory */}
              <div className="clash-card" style={{ gap: '10px' }}>
                <span className="clash-label" style={{ fontSize: '10px' }}>Active Holding</span>
                {(() => {
                  const userTerrs = territories.filter(t => t.ownerId === currentUser.uid);
                  const latest = userTerrs[userTerrs.length - 1];
                  if (latest) {
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div className="clash-subtitle" style={{ fontSize: '14px', color: 'white' }}>{latest.name}</div>
                          <span className="clash-body" style={{ fontSize: '11px' }}>{latest.area} sq m</span>
                        </div>
                        <span style={{ fontSize: '10px', color: '#FC4C02', border: '1px solid #FC4C02', padding: '3px 8px', borderRadius: '10px', fontWeight: '800' }}>
                          {latest.decayHours}h Shield
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', textAlign: 'center', gap: '6px' }}>
                      <Target size={18} className="clash-body" style={{ opacity: 0.4 }} />
                      <div className="clash-subtitle" style={{ fontSize: '12px' }}>No captured sectors</div>
                      <span className="clash-body" style={{ fontSize: '10px' }}>Conquer loops to claim sectors.</span>
                    </div>
                  );
                })()}
              </div>

              {/* Recent Activity / Captures */}
              <div className="clash-card" style={{ gap: '10px' }}>
                <span className="clash-label" style={{ fontSize: '10px' }}>Recent Captures</span>
                {(() => {
                  const userTerrs = territories.filter(t => t.ownerId === currentUser.uid);
                  if (userTerrs.length > 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {userTerrs.slice(-2).reverse().map((terr, index) => (
                          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--clash-border)' }}>
                            <span style={{ fontSize: '12px', color: 'white', fontWeight: '700' }}>{terr.name}</span>
                            <span style={{ fontSize: '11px', fontWeight: '700', color: '#FC4C02', fontFamily: 'var(--clash-font-family)' }}>{terr.area} sq m</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', textAlign: 'center', gap: '6px' }}>
                      <Compass size={18} className="clash-body" style={{ opacity: 0.4 }} />
                      <div className="clash-subtitle" style={{ fontSize: '12px' }}>No recent activities</div>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* TAB: MAP */}
            <div style={{ display: activeTab === 'map' ? 'flex' : 'none', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}>
              
              {/* Fullscreen Map Hero */}
              <div id="map" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}></div>

              {/* Floating top Command Header */}
              {runState.status === 'idle' && (
              <div 
                className="clash-glass-panel animate-fade-in-down"
                style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  right: '16px',
                  borderRadius: '24px',
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  zIndex: 999,
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
                  gap: '6px'
                }}
              >
                {/* LEFT: Profile & Clan Info */}
                <div 
                  onClick={() => setShowSettingsDrawer(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: '#FC4C02',
                    border: '1.5px solid rgba(255, 255, 255, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: '800',
                    color: 'white',
                    flexShrink: 0
                  }}
                  className="clash-btn-press"
                  >
                    {(currentUser.displayName || 'R')[0].toUpperCase()}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', lineHeight: 1 }}>
                      {currentUser.displayName}
                    </span>
                    <span style={{ fontSize: '7px', fontWeight: '800', color: 'var(--clash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {currentUser.clan || 'Udaipur Racers'}
                    </span>
                  </div>
                </div>

                {/* CENTER: Coin Counter */}
                <div style={{
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  height: '30px',
                  padding: '0 8px',
                  borderRadius: '15px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  flexShrink: 0
                }}>
                  <Coins size={11} style={{ color: '#FC4C02' }} />
                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-family)' }}>
                    {currentUser.coins}
                  </span>
                </div>

                {/* RIGHT: Level, GPS Status & Settings */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  {/* Level Badge */}
                  <span style={{ fontSize: '9px', fontWeight: '800', color: '#FC4C02', background: 'rgba(252, 76, 2, 0.08)', border: '1px solid rgba(252, 76, 2, 0.2)', padding: '3px 6px', borderRadius: '8px', flexShrink: 0 }}>
                    LVL {currentUser.level}
                  </span>

                  {/* GPS Status Indicator */}
                  <div style={{
                    background: 'rgba(0, 0, 0, 0.25)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    height: '30px',
                    padding: '0 8px',
                    borderRadius: '15px',
                    fontSize: '9px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: 'white',
                    flexShrink: 0
                  }}>
                    {(() => {
                      if (trackingMode === 'sim') {
                        return (
                          <>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#FC4C02', display: 'inline-block' }} className="gps-pulse"></span>
                            <span style={{ fontSize: '9px' }}>Sim</span>
                          </>
                        );
                      }
                      if (runState.gpsAccuracy === null) {
                        return (
                          <>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#888888', display: 'inline-block' }}></span>
                            <span style={{ fontSize: '9px' }}>GPS</span>
                          </>
                        );
                      }
                      if (runState.gpsAccuracy < 30) {
                        return (
                          <>
                            <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} className="gps-pulse"></span>
                            <span style={{ fontSize: '9px' }}>GPS</span>
                          </>
                        );
                      }
                      return (
                        <>
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
                          <span style={{ fontSize: '9px' }}>Lost</span>
                        </>
                      );
                    })()}
                  </div>

                  {/* Settings Button */}
                  <button 
                    onClick={() => setShowSettingsDrawer(true)}
                    style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      color: 'white',
                      width: '30px',
                      height: '30px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                    className="clash-btn-press"
                    title="Tactical settings"
                  >
                    <Settings size={12} style={{ color: '#FC4C02' }} />
                  </button>
                </div>
              </div>

              )}

              {/* Accuracy floating indicator (Hidden/relegated to Top HUD capsule in 2.0) */}
              {false && (runState.status === 'tracking' || runState.status === 'paused') && trackingMode === 'gps' && runState.gpsAccuracy && (
                <div style={{
                  position: 'absolute',
                  top: '76px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#151515',
                  borderRadius: '20px',
                  padding: '5px 14px',
                  fontSize: '9px',
                  zIndex: 999,
                  border: '1px solid #2A2A2A',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '800',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  boxShadow: 'var(--clash-shadow-sm)'
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: runState.gpsAccuracy < 15 ? '#FC4C02' : '#A8A8A8' }}></div>
                  GPS Accuracy: {Math.round(runState.gpsAccuracy)}m
                </div>
              )}

              {/* Right Circular Map Controls (Aligned Vertically) */}
              <div style={{
                position: 'absolute',
                top: '200px',
                right: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                zIndex: 999
              }}>
                {/* Recenter */}
                <button 
                  onClick={recenterMap}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: '1px solid #2A2A2A',
                    color: '#FC4C02',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0B0B0D',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    cursor: 'pointer',
                    transition: 'transform 0.1s ease'
                  }}
                  className="clash-btn-press"
                  title="Recenter GPS"
                >
                  <Navigation size={14} style={{ transform: 'rotate(45deg)', color: '#FC4C02' }} />
                </button>

                {/* Camera Button */}
                <button 
                  onClick={() => setCameraSheetOpen(true)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: '1px solid #2A2A2A',
                    color: '#FC4C02',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0B0B0D',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    cursor: 'pointer',
                    transition: 'transform 0.1s ease'
                  }}
                  className="clash-btn-press"
                  title="Drone Recon Camera"
                >
                  <Radio size={14} style={{ color: '#FC4C02' }} />
                </button>

                {/* Zoom In */}
                <button 
                  onClick={() => {
                    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: '1px solid #2A2A2A',
                    color: '#FC4C02',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0B0B0D',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: '800',
                    transition: 'transform 0.1s ease'
                  }}
                  className="clash-btn-press"
                  title="Zoom In"
                >
                  +
                </button>

                {/* Zoom Out */}
                <button 
                  onClick={() => {
                    if (mapInstanceRef.current) mapInstanceRef.current.zoomOut();
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    border: '1px solid #2A2A2A',
                    color: '#FC4C02',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0B0B0D',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: '800',
                    transition: 'transform 0.1s ease'
                  }}
                  className="clash-btn-press"
                  title="Zoom Out"
                >
                  -
                </button>
              </div>

              {/* Draggable bottom sheet / Startup Action Deck */}
              {runState.status === 'idle' && (() => {
                let runnerLatLng = null;
                if (runnerMarkerRef.current) {
                  runnerLatLng = runnerMarkerRef.current.getLatLng();
                } else if (mapInstanceRef.current) {
                  runnerLatLng = mapInstanceRef.current.getCenter();
                }

                // If a territory is selected, calculate distance to it
                let targetDist = 'Dynamic';
                let difficulty = 'Medium';
                if (renderedTerritory && runnerLatLng) {
                  const firstCoord = renderedTerritory.coords[0];
                  const dist = getGeodeticDistance(runnerLatLng.lat, runnerLatLng.lng, firstCoord[0], firstCoord[1]);
                  targetDist = `${dist.toFixed(2)} km`;
                  difficulty = renderedTerritory.rate >= 10 ? 'Hard' : (renderedTerritory.id === 't2' ? 'Medium' : 'Easy');
                }

                // Header status badge pill calculations
                let pillText = 'Abandoned';
                let pillColor = '#888888';
                let pillBg = 'rgba(136, 136, 136, 0.1)';
                let primaryActionLabel = 'Capture Territory';

                if (renderedTerritory) {
                  const isOwner = renderedTerritory.ownerId === currentUser.uid;
                  const isTeammate = renderedTerritory.clan === currentUser.clan && !isOwner;
                  const isEnemy = renderedTerritory.clan && renderedTerritory.clan !== currentUser.clan && renderedTerritory.ownerName !== 'Unclaimed';
                  
                  if (renderedTerritory.ownerName === 'Unclaimed') {
                    pillText = 'Neutral';
                    pillColor = '#EAB308'; // Orange
                    pillBg = 'rgba(234, 179, 8, 0.15)';
                    primaryActionLabel = 'Capture Territory';
                  } else if (isOwner) {
                    if (renderedTerritory.decayHours > 24) {
                      pillText = 'Protected';
                      pillColor = '#10B981'; // Green
                      pillBg = 'rgba(16, 185, 129, 0.15)';
                    } else {
                      pillText = 'Friendly';
                      pillColor = '#10B981'; // Green
                      pillBg = 'rgba(16, 185, 129, 0.15)';
                    }
                    primaryActionLabel = 'Defend Territory';
                  } else if (isTeammate) {
                    pillText = 'Clan';
                    pillColor = '#3B82F6'; // Blue
                    pillBg = 'rgba(59, 130, 246, 0.15)';
                    primaryActionLabel = 'Defend Territory';
                  } else if (isEnemy) {
                    if (renderedTerritory.decayHours > 40) {
                      pillText = 'Contested';
                      pillColor = '#EF4444'; // Red
                      pillBg = 'rgba(239, 68, 68, 0.15)';
                      primaryActionLabel = 'Continue Capture';
                    } else {
                      pillText = 'Enemy';
                      pillColor = '#EF4444'; // Red
                      pillBg = 'rgba(239, 68, 68, 0.15)';
                      primaryActionLabel = 'Attack Sector';
                    }
                  }
                }

                return (
                  <div 
                    className="clash-bottom-sheet animate-slide-in-up"
                    style={{
                      position: 'absolute',
                      bottom: '16px',
                      left: '16px',
                      right: '16px',
                      zIndex: 999,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      maxHeight: isBottomSheetExpanded && renderedTerritory ? '480px' : '120px',
                      overflow: 'hidden',
                      borderRadius: '28px',
                      background: '#151515',
                      border: '1px solid #2A2A2A',
                      padding: '16px 20px',
                      boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4)',
                      transition: 'max-height 250ms cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    {/* Pull Tab Handle */}
                    {renderedTerritory && (
                      <div 
                        onClick={() => setIsBottomSheetExpanded(prev => !prev)}
                        style={{
                          width: '40px',
                          height: '4px',
                          background: '#2D2D2D',
                          borderRadius: '2px',
                          margin: '0 auto 4px auto',
                          cursor: 'pointer'
                        }}
                      ></div>
                    )}

                    {/* Empty State */}
                    {!renderedTerritory ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', height: '80px', justifyContent: 'center' }}>
                        <div style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          background: 'rgba(252, 76, 2, 0.08)',
                          border: '1px solid rgba(252, 76, 2, 0.2)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          <Compass size={20} className="intel-badge-pulse" style={{ color: '#FC4C02' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: 'white' }}>No Sector Selected</h4>
                          <p style={{ margin: 0, fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                            Tap any nearby territory to inspect it.
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Inspected Territory Intelligence Card */
                      <div 
                        className="intel-content-transition"
                        style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '12px',
                          opacity: isInspectingTransition ? 0 : 1
                        }}
                      >
                        {/* Collapsed Header View */}
                        {!isBottomSheetExpanded ? (
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '80px' }}>
                            <div 
                              onClick={() => setIsBottomSheetExpanded(true)}
                              style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', gap: '4px', width: '55%' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pillColor, display: 'inline-block' }} className="intel-badge-pulse"></span>
                                <span className="clash-subtitle" style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', margin: 0 }}>
                                  {renderedTerritory.name}
                                </span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '7.5px',
                                  fontWeight: '800',
                                  background: pillBg,
                                  color: pillColor,
                                  textTransform: 'uppercase'
                                }}>
                                  {pillText}
                                </span>
                                <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
                                  {difficulty.toUpperCase()} • {targetDist}
                                </span>
                              </div>
                            </div>

                            <button 
                              onClick={startTracking}
                              className="clash-btn-primary clash-btn-press"
                              style={{ 
                                width: '40%', 
                                height: '44px', 
                                borderRadius: '22px', 
                                border: 'none', 
                                background: '#FC4C02', 
                                color: 'white', 
                                fontWeight: '800', 
                                fontSize: '11px',
                                letterSpacing: '0.5px',
                                boxShadow: '0 6px 16px rgba(252, 76, 2, 0.25)' 
                              }}
                            >
                              {primaryActionLabel.toUpperCase()}
                            </button>
                          </div>
                        ) : (
                          /* Expanded Panel Details */
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span className="clash-label" style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>TERRITORY INTELLIGENCE</span>
                              <button 
                                onClick={() => setIsBottomSheetExpanded(false)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--clash-text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                className="clash-btn-press"
                              >
                                <ChevronDown size={20} />
                              </button>
                            </div>

                            {/* Geometric Preview & Header */}
                            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', background: '#0B0B0D', padding: '12px', borderRadius: '20px', border: '1px solid #2A2A2A' }}>
                              {/* Relative SVG Polygon Preview */}
                              <div style={{
                                width: '72px',
                                height: '72px',
                                borderRadius: '12px',
                                background: '#151515',
                                border: '1px solid #2A2A2A',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                overflow: 'hidden'
                              }}>
                                {(() => {
                                  const coords = renderedTerritory.coords;
                                  if (!coords || coords.length === 0) return null;
                                  const lats = coords.map(c => c[0]);
                                  const lngs = coords.map(c => c[1]);
                                  const minLat = Math.min(...lats);
                                  const maxLat = Math.max(...lats);
                                  const minLng = Math.min(...lngs);
                                  const maxLng = Math.max(...lngs);
                                  
                                  const latRange = maxLat - minLat || 0.0001;
                                  const lngRange = maxLng - minLng || 0.0001;
                                  
                                  const points = coords.map(c => {
                                    const x = 6 + ((c[1] - minLng) / lngRange) * 60;
                                    const y = 66 - ((c[0] - minLat) / latRange) * 60;
                                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                                  }).join(' ');

                                  return (
                                    <svg width="72" height="72" viewBox="0 0 72 72">
                                      <polygon 
                                        points={points} 
                                        fill={pillColor} 
                                        fillOpacity="0.15" 
                                        stroke={pillColor} 
                                        strokeWidth="2" 
                                        strokeLinejoin="round"
                                      />
                                    </svg>
                                  );
                                })()}
                              </div>

                              {/* Title and Pill */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pillColor, display: 'inline-block' }} className="intel-badge-pulse"></span>
                                  <span style={{ fontSize: '8px', color: '#FC4C02', fontWeight: '800', letterSpacing: '0.5px', textTransform: 'uppercase' }}>SECTOR PROFILE</span>
                                </div>
                                <h4 style={{ margin: 0, fontSize: '15px', color: 'white', fontWeight: '800', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {renderedTerritory.name}
                                </h4>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <span style={{
                                    padding: '2px 8px',
                                    borderRadius: '8px',
                                    fontSize: '8px',
                                    fontWeight: '800',
                                    background: pillBg,
                                    color: pillColor,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.3px',
                                    border: `1.5px solid ${pillColor}10`
                                  }}
                                  className="intel-badge-pulse"
                                  >
                                    {pillText}
                                  </span>
                                  <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>
                                    {renderedTerritory.area}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* 2-Column Info Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', background: '#0B0B0D', padding: '14px', borderRadius: '20px', border: '1px solid #2A2A2A' }}>
                              <div>
                                <span className="clash-label" style={{ fontSize: '7.5px' }}>Owner</span>
                                <span className="clash-subtitle" style={{ fontSize: '11px', color: 'white' }}>
                                  {renderedTerritory.ownerName}
                                </span>
                              </div>
                              <div>
                                <span className="clash-label" style={{ fontSize: '7.5px' }}>Reward Coins</span>
                                <span className="clash-subtitle" style={{ fontSize: '11px', color: 'white' }}>
                                  {renderedTerritory.rate ? `+${renderedTerritory.rate} Coins/Hr` : '50 Coins'}
                                </span>
                              </div>
                              
                              <div>
                                <span className="clash-label" style={{ fontSize: '7.5px' }}>Distance</span>
                                <span className="clash-subtitle" style={{ fontSize: '11px', color: 'white' }}>
                                  {targetDist}
                                </span>
                              </div>
                              <div>
                                <span className="clash-label" style={{ fontSize: '7.5px' }}>Capture Progress</span>
                                <span className="clash-subtitle" style={{ fontSize: '11px', color: 'white' }}>
                                  {renderedTerritory.ownerId === currentUser.uid ? '100%' : '0%'}
                                </span>
                              </div>

                              <div>
                                <span className="clash-label" style={{ fontSize: '7.5px' }}>Difficulty</span>
                                <span className="clash-subtitle" style={{ fontSize: '11px', color: 'white' }}>
                                  {difficulty}
                                </span>
                              </div>
                              <div>
                                <span className="clash-label" style={{ fontSize: '7.5px' }}>Estimated Time</span>
                                <span className="clash-subtitle" style={{ fontSize: '11px', color: 'white' }}>
                                  {trackingMode === 'sim' ? '12 min' : 'Dynamic'}
                                </span>
                              </div>

                              <div>
                                <span className="clash-label" style={{ fontSize: '7.5px' }}>Reward XP</span>
                                <span className="clash-subtitle" style={{ fontSize: '11px', color: '#FC4C02', fontWeight: '800' }}>
                                  120 XP
                                </span>
                              </div>
                              {DEBUG_MODE && (
                                <div>
                                  <span className="clash-label" style={{ fontSize: '7.5px' }}>Simulation Key</span>
                                  <span className="clash-subtitle" style={{ fontSize: '11px', color: 'white' }}>
                                    {renderedTerritory.id === 't1' ? 'lake' : (renderedTerritory.id === 't2' ? 'foothills' : 'monument')}
                                  </span>
                                </div>
                              )}
                            </div>

                            {DEBUG_MODE && (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', marginBottom: '8px' }}>
                                <span className="clash-label" style={{ fontSize: '8px' }}>Tracker Configuration</span>
                                <div style={{ display: 'flex', background: '#0B0B0D', borderRadius: '12px', padding: '2px', border: '1px solid #2A2A2A' }}>
                                  <button 
                                    onClick={() => setTrackingMode('sim')}
                                    style={{
                                      flex: 1,
                                      background: trackingMode === 'sim' ? '#FC4C02' : 'transparent',
                                      color: 'white',
                                      border: 'none',
                                      padding: '6px 0',
                                      borderRadius: '10px',
                                      fontSize: '10px',
                                      fontWeight: '800',
                                      cursor: 'pointer'
                                    }}
                                    className="clash-btn-press"
                                  >
                                    Dev Simulator
                                  </button>
                                  <button 
                                    onClick={() => setTrackingMode('gps')}
                                    style={{
                                      flex: 1,
                                      background: trackingMode === 'gps' ? '#FC4C02' : 'transparent',
                                      color: 'white',
                                      border: 'none',
                                      padding: '6px 0',
                                      borderRadius: '10px',
                                      fontSize: '10px',
                                      fontWeight: '800',
                                      cursor: 'pointer'
                                    }}
                                    className="clash-btn-press"
                                  >
                                    Real GPS Stride
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Actions */}
                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '2px' }}>
                              <button 
                                onClick={() => {
                                  if (mapInstanceRef.current && renderedTerritory.coords?.length > 0) {
                                    mapInstanceRef.current.flyTo(renderedTerritory.coords[0], 15);
                                    addLog(`System: Navigating viewport to ${renderedTerritory.name}.`);
                                  }
                                }}
                                className="clash-btn-secondary clash-btn-press"
                                style={{ height: '44px', flex: 1, borderRadius: '22px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#151515', border: '1px solid #2A2A2A', color: 'white', fontWeight: '800' }}
                              >
                                Navigate
                              </button>
                              <button 
                                onClick={() => {
                                  // Auto-set the correct route key if using simulator
                                  if (trackingMode === 'sim') {
                                    const key = renderedTerritory.id === 't1' ? 'lake' : (renderedTerritory.id === 't2' ? 'foothills' : 'monument');
                                    setSimulationRouteKey(key);
                                  }
                                  setIsBottomSheetExpanded(false);
                                  startTracking();
                                }}
                                className="clash-btn-primary clash-btn-press"
                                style={{ height: '44px', flex: 1.5, borderRadius: '22px', fontSize: '11px', boxShadow: '0 8px 16px rgba(252, 76, 2, 0.25)', background: '#FC4C02', color: 'white', border: 'none', fontWeight: '800' }}
                              >
                                {primaryActionLabel.toUpperCase()}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* COMPACT TOP HUD */}
              {(runState.status === 'tracking' || runState.status === 'paused') && (
                <div 
                  className="clash-glass-panel animate-fade-in-down"
                  style={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    right: '16px',
                    borderRadius: '24px',
                    padding: '8px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    zIndex: 1000,
                    background: 'rgba(11, 11, 13, 0.9)',
                    border: '1px solid #2A2A2A',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: '#FC4C02',
                      border: '1.5px solid rgba(255, 255, 255, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: '800',
                      color: 'white',
                      flexShrink: 0
                    }}>
                      {(currentUser.displayName || 'R')[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>
                      {currentUser.displayName}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(252, 76, 2, 0.08)', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(252, 76, 2, 0.2)' }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: '#FC4C02',
                      display: 'inline-block',
                      animation: 'pulse 1.2s infinite'
                    }}></span>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: '#FC4C02', letterSpacing: '0.5px' }}>
                      LIVE REC
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: runState.gpsAccuracy && runState.gpsAccuracy <= 15 ? '#10B981' : runState.gpsAccuracy && runState.gpsAccuracy <= 25 ? '#FBBF24' : '#EF4444' }}>
                      {(() => {
                        if (trackingMode === 'sim') return '🟢 GPS LOCKED';
                        if (runState.gpsAccuracy === null) return '🟡 ACQUIRING SIGNAL';
                        if (runState.gpsAccuracy <= 15) return '🟢 GPS LOCKED';
                        if (runState.gpsAccuracy <= 25) return '🟡 ACQUIRING SIGNAL';
                        return '🔴 WEAK SIGNAL';
                      })()}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>
                      {Math.floor(runState.duration / 60)}:{(runState.duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              )}

              {/* DYNAMIC TERRITORY NOTIFICATION BANNER */}
              {activeBanner && (
                <div 
                  className="animate-slide-down"
                  style={{
                    position: 'absolute',
                    top: '80px',
                    left: '16px',
                    right: '16px',
                    zIndex: 1001,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                  }}
                >
                  <div 
                    style={{
                      background: '#0B0B0B',
                      border: (() => {
                        if (activeBanner.type === 'entering_friendly') return '1px solid #10B981';
                        if (activeBanner.type === 'entering_enemy') return '1px solid #EF4444';
                        if (activeBanner.type === 'entering_neutral') return '1px solid #FC4C02';
                        if (activeBanner.type === 'captured') return '1px solid #FC4C02';
                        if (activeBanner.type === 'lost') return '1px solid #EF4444';
                        return '1px solid #2A2A2A';
                      })(),
                      borderRadius: '16px',
                      padding: '10px 16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                      maxWidth: '320px',
                      width: '100%'
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: (() => {
                        if (activeBanner.type === 'entering_friendly') return 'rgba(16, 185, 129, 0.1)';
                        if (activeBanner.type === 'entering_enemy') return 'rgba(239, 68, 68, 0.1)';
                        if (activeBanner.type === 'entering_neutral') return 'rgba(252, 76, 2, 0.1)';
                        if (activeBanner.type === 'captured') return 'rgba(252, 76, 2, 0.1)';
                        if (activeBanner.type === 'lost') return 'rgba(239, 68, 68, 0.1)';
                        return 'rgba(255, 255, 255, 0.05)';
                      })(),
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: (() => {
                        if (activeBanner.type === 'entering_friendly') return '#10B981';
                        if (activeBanner.type === 'entering_enemy') return '#EF4444';
                        return '#FC4C02';
                      })()
                    }}>
                      {activeBanner.type === 'captured' ? <Trophy size={14} /> : <Compass size={14} />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>
                        {(() => {
                          if (activeBanner.type === 'entering_friendly') return 'Entering Friendly Sector';
                          if (activeBanner.type === 'entering_enemy') return 'Entering Hostile Sector';
                          if (activeBanner.type === 'entering_neutral') return 'Entering Neutral Sector';
                          if (activeBanner.type === 'captured') return 'Sector Secured';
                          if (activeBanner.type === 'lost') return 'Sector Compromised';
                          if (activeBanner.type === 'leaving') return 'Leaving Sector';
                          return 'Sector Alert';
                        })()}
                      </span>
                      <span style={{ fontSize: '11px', color: 'white', fontWeight: '800' }}>
                        {activeBanner.sectorName}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* FLOATING CAMERA ACTION SHEET */}
              {cameraSheetOpen && (
                <div 
                  className="fade-in" 
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.7)',
                    backdropFilter: 'blur(4px)',
                    zIndex: 20001,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                  }}
                >
                  <div 
                    className="slide-up"
                    style={{
                      width: '100%',
                      background: '#151515',
                      borderTopLeftRadius: '24px',
                      borderTopRightRadius: '24px',
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.5)',
                      border: '1px solid #2A2A2A',
                      borderBottom: 'none'
                    }}
                  >
                    <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Drone Recon Camera
                      </span>
                    </div>

                    <button 
                      onClick={() => {
                        setShowCameraFlash(true);
                        setTimeout(() => setShowCameraFlash(false), 200);
                        setToastMessage("Snapshot Saved: Drone Recon Record logged.");
                        setTimeout(() => setToastMessage(null), 3000);
                        setCameraSheetOpen(false);
                      }}
                      className="clash-btn-primary"
                      style={{ height: '48px', width: '100%', borderRadius: '24px', fontWeight: '800' }}
                    >
                      TAKE PHOTO
                    </button>

                    <button 
                      onClick={() => {
                        setShowCameraFlash(true);
                        setTimeout(() => setShowCameraFlash(false), 200);
                        setToastMessage("Recon Video Saved: Tactical story created.");
                        setTimeout(() => setToastMessage(null), 3000);
                        setCameraSheetOpen(false);
                      }}
                      className="clash-btn-primary"
                      style={{ height: '48px', width: '100%', borderRadius: '24px', fontWeight: '800' }}
                    >
                      RECORD VIDEO
                    </button>

                    <button 
                      onClick={() => setCameraSheetOpen(false)}
                      className="clash-btn-secondary"
                      style={{ height: '44px', width: '100%', borderRadius: '22px', border: '1px solid #2A2A2A', color: 'rgba(255,255,255,0.6)', fontWeight: '800' }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {/* CAMERA FLASH OVERLAY */}
              {showCameraFlash && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'white',
                  zIndex: 99999,
                  opacity: 1
                }} />
              )}

              {/* TOAST NOTIFICATION */}
              {toastMessage && (
                <div 
                  className="fade-in"
                  style={{
                    position: 'absolute',
                    bottom: '180px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#FC4C02',
                    color: 'white',
                    padding: '10px 20px',
                    borderRadius: '20px',
                    zIndex: 20002,
                    fontWeight: '800',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    boxShadow: '0 8px 16px rgba(252, 76, 2, 0.3)',
                    letterSpacing: '0.5px'
                  }}
                >
                  {toastMessage}
                </div>
              )}

              {/* MULTI-STAGE BOTTOM HUD */}
              {(runState.status === 'tracking' || runState.status === 'paused') && (
                <div 
                  className="clash-bottom-sheet"
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '16px',
                    right: '16px',
                    zIndex: 999,
                    background: '#151515',
                    border: '1px solid #2A2A2A',
                    borderRadius: '24px',
                    padding: '16px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    height: (() => {
                      if (runState.distance === 0) return '110px';
                      if (bottomHudState === 'mini') return '90px';
                      if (bottomHudState === 'medium') return '155px';
                      return '310px';
                    })(),
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6)'
                  }}
                >
                  {/* Drag Handle */}
                  <div 
                    onTouchStart={(e) => {
                      touchStartY.current = e.touches[0].clientY;
                    }}
                    onTouchEnd={(e) => {
                      const deltaY = touchStartY.current - e.changedTouches[0].clientY;
                      if (deltaY > 40) {
                        setBottomHudState(prev => prev === 'mini' ? 'medium' : 'expanded');
                      } else if (deltaY < -40) {
                        setBottomHudState(prev => prev === 'expanded' ? 'medium' : 'mini');
                      }
                    }}
                    onClick={() => {
                      if (runState.distance === 0) return;
                      setBottomHudState(prev => {
                        if (prev === 'mini') return 'medium';
                        if (prev === 'medium') return 'expanded';
                        return 'mini';
                      });
                    }}
                    style={{
                      width: '40px',
                      height: '4px',
                      background: 'rgba(255,255,255,0.15)',
                      borderRadius: '2px',
                      margin: '-8px auto 12px auto',
                      cursor: 'pointer'
                    }}
                  />

                  {runState.distance === 0 ? (
                    <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '8px', paddingBottom: '8px' }}>
                      <Radio size={16} className="gps-pulse" style={{ color: '#FC4C02' }} />
                      <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--clash-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        Waiting for movement...
                      </span>
                    </div>
                  ) : (
                    <>
                      {/* MINI STATE */}
                      {bottomHudState === 'mini' && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Distance</span>
                            <span style={{ fontSize: '16px', fontWeight: '800', color: '#FC4C02', fontFamily: 'var(--clash-font-mono)' }}>{runState.distance} <span style={{ fontSize: '9px' }}>KM</span></span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Time</span>
                            <span style={{ fontSize: '16px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>
                              {Math.floor(runState.duration / 60)}:{(runState.duration % 60).toString().padStart(2, '0')}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Pace</span>
                            <span style={{ fontSize: '16px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>{runState.pace}</span>
                          </div>
                        </div>
                      )}

                      {/* MEDIUM STATE */}
                      {bottomHudState === 'medium' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '6px', textAlign: 'center' }}>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Distance</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: '#FC4C02', fontFamily: 'var(--clash-font-mono)' }}>{runState.distance} <span style={{ fontSize: '8px' }}>KM</span></span>
                            </div>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Time</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>
                                {Math.floor(runState.duration / 60)}:{(runState.duration % 60).toString().padStart(2, '0')}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Pace</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>{runState.pace}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Speed</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>{runState.speed} <span style={{ fontSize: '8px' }}>KM/H</span></span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            <button 
                              onClick={togglePauseResume}
                              className="clash-btn-secondary"
                              style={{ height: '40px', flex: 1, borderRadius: '20px', fontSize: '11px', border: '1px solid #2A2A2A', fontWeight: '800' }}
                            >
                              {runState.status === 'tracking' ? 'Pause' : 'Resume'}
                            </button>
                            <button 
                              onClick={() => stopTracking("Explicit User Request")}
                              className="clash-btn-primary"
                              style={{ height: '40px', flex: 1.2, borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}
                            >
                              STOP & CLAIM
                            </button>
                          </div>
                        </div>
                      )}

                      {/* EXPANDED STATE */}
                      {bottomHudState === 'expanded' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px 6px', textAlign: 'center' }}>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Distance</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: '#FC4C02', fontFamily: 'var(--clash-font-mono)' }}>{runState.distance} <span style={{ fontSize: '8px' }}>KM</span></span>
                            </div>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Time</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>
                                {Math.floor(runState.duration / 60)}:{(runState.duration % 60).toString().padStart(2, '0')}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Cur Pace</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>{runState.pace}</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Avg Pace</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>{runState.avgPace}</span>
                            </div>

                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Speed</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>{runState.speed} <span style={{ fontSize: '8px' }}>KM/H</span></span>
                            </div>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Calories</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>{runState.calories} <span style={{ fontSize: '8px' }}>KCAL</span></span>
                            </div>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Elevation</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>384 <span style={{ fontSize: '8px' }}>M</span></span>
                            </div>
                            <div>
                              <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>GPS Lock</span>
                              <span style={{ fontSize: '13px', fontWeight: '800', color: runState.gpsAccuracy && runState.gpsAccuracy <= 10 ? '#10B981' : '#FC4C02', fontFamily: 'var(--clash-font-mono)' }}>
                                {runState.gpsAccuracy ? `${Math.round(runState.gpsAccuracy)}m` : 'Lock'}
                              </span>
                            </div>

                            <div>
                              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.2)', display: 'block', textTransform: 'uppercase' }}>Weather</span>
                              <span style={{ fontSize: '12px', fontWeight: '800', color: 'rgba(255,255,255,0.3)' }}>28°C</span>
                            </div>
                            <div>
                              <span style={{ fontSize: '7px', color: 'rgba(255,255,255,0.2)', display: 'block', textTransform: 'uppercase' }}>Heart Rate</span>
                              <span style={{ fontSize: '12px', fontWeight: '800', color: 'rgba(255,255,255,0.3)' }}>142 BPM</span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                            <button 
                              onClick={togglePauseResume}
                              className="clash-btn-secondary"
                              style={{ height: '40px', flex: 1, borderRadius: '20px', fontSize: '11px', border: '1px solid #2A2A2A', fontWeight: '800' }}
                            >
                              {runState.status === 'tracking' ? 'Pause' : 'Resume'}
                            </button>
                            <button 
                              onClick={() => stopTracking("Explicit User Request")}
                              className="clash-btn-primary"
                              style={{ height: '40px', flex: 1.2, borderRadius: '20px', fontSize: '11px', fontWeight: '800' }}
                            >
                              STOP & CLAIM
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* TAB: CONQUESTS */}
            <div style={{ display: activeTab === 'conquests' ? 'flex' : 'none', flexDirection: 'column', gap: '22px', padding: '16px', height: '100%', overflowY: 'auto' }} className="fade-in">
              
              {/* Controlled Sectors */}
              <div>
                <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
                  <Target size={15} style={{ color: '#FC4C02' }} /> Controlled Sectors ({territories.filter(t => t.ownerId === currentUser.uid && t.is_active !== false).length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {territories.filter(t => t.ownerId === currentUser.uid && t.is_active !== false).length === 0 ? (
                    <div className="clash-card" style={{ borderStyle: 'dashed', padding: '32px', textAlign: 'center' }}>
                      <Compass size={32} style={{ color: '#FC4C02', margin: '0 auto 12px auto' }} />
                      <h4 className="clash-subtitle" style={{ margin: '0 0 6px 0' }}>NO ACTIVE SECTORS DETECTED</h4>
                      <p className="clash-body" style={{ margin: '0 0 16px 0' }}>
                        Step outside, start your GPS run, and close a path loop to establish Udaipur crew dominance.
                      </p>
                      <button className="clash-btn-primary btn-sm" onClick={() => setActiveTab('map')}>
                        Launch Tactical Map
                      </button>
                    </div>
                  ) : (
                    territories.filter(t => t.ownerId === currentUser.uid && t.is_active !== false).map(terr => {
                      const clanColor = terr.clan === 'Udaipur Racers' ? '#FC4C02' : terr.clan === 'GITS Runners' ? '#FFFFFF' : '#555555';
                      const maxDecay = terr.maxDecayHours || 72;
                      const currentDecay = terr.decayHours || 72;
                      const percentage = Math.max(0, Math.min(100, (currentDecay / maxDecay) * 100));
                      
                      return (
                        <div key={terr.id} className="clash-card p-4 gap-3" style={{ display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${clanColor}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <h4 className="clash-subtitle" style={{ margin: '0' }}>{terr.name}</h4>
                                <span className="clash-label" style={{ background: 'rgba(252, 76, 2, 0.05)', border: '1px solid #FC4C02', padding: '2px 6px', borderRadius: '8px', color: '#FC4C02', fontSize: '8px' }}>SECURED</span>
                              </div>
                              <span className="clash-body" style={{ fontSize: '11px' }}>
                                Area: {terr.area}
                              </span>
                            </div>
                            <button 
                              onClick={() => useShield(terr.id)}
                              className="clash-btn-secondary btn-sm"
                              style={{ borderColor: '#FC4C02', color: '#FC4C02' }}
                            >
                              <Shield size={11} /> Fortify
                            </button>
                          </div>

                          {/* Rewards details */}
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--clash-border)', padding: '2px 8px', borderRadius: '12px' }}>
                              <Coins size={10} style={{ color: '#FC4C02' }} />
                              <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>+{terr.rate || 5} COINS/HR</span>
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--clash-border)', padding: '2px 8px', borderRadius: '12px' }}>
                              <Award size={10} style={{ color: 'white' }} />
                              <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>+150 XP CAPTURE</span>
                            </div>
                          </div>

                          {/* Shield integrity slider */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                              <span className="clash-body">Shield integrity</span>
                              <span style={{ color: clanColor, fontWeight: '800' }}>{currentDecay}h remaining</span>
                            </div>
                            <div className="clash-progress-bar">
                              <div className="clash-progress-bar-fill" style={{ width: `${percentage}%`, backgroundColor: clanColor }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Historical / Expired holdings */}
              {territories.filter(t => t.ownerId === currentUser.uid && t.is_active === false).length > 0 && (
                <div>
                  <h3 className="clash-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <RefreshCw size={14} style={{ color: '#FC4C02' }} /> Lost & Expired Sectors ({territories.filter(t => t.ownerId === currentUser.uid && t.is_active === false).length})
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {territories.filter(t => t.ownerId === currentUser.uid && t.is_active === false).map(terr => (
                      <div key={terr.id} className="clash-card p-4 gap-3" style={{ display: 'flex', flexDirection: 'column', opacity: 0.65, borderLeft: '4px solid #555555' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <h4 className="clash-subtitle" style={{ margin: '0' }}>{terr.name}</h4>
                              <span className="clash-label" style={{ border: '1px solid #555555', padding: '2px 6px', borderRadius: '8px', color: '#9CA3AF', fontSize: '8px' }}>DECAYED</span>
                            </div>
                            <span className="clash-body" style={{ fontSize: '10px' }}>Lost area: {terr.area}</span>
                          </div>
                          <button 
                            onClick={() => setActiveTab('map')}
                            className="clash-btn-secondary btn-sm"
                            style={{ borderColor: '#FC4C02', color: '#FC4C02' }}
                          >
                            Reclaim
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Power-up Shop */}
              <div>
                <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
                  <Coins size={15} style={{ color: '#FC4C02' }} /> Power-Up Armory
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="clash-card" onClick={() => buyItem('shields', shopCosts.shield)} style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center', cursor: 'pointer' }}>
                    <Shield size={24} style={{ color: '#FC4C02' }} />
                    <span className="clash-subtitle" style={{ fontSize: '12px', marginTop: '2px' }}>Shield (24h)</span>
                    <span className="clash-body" style={{ fontSize: '10px' }}>Inventory: {inventory.shields}</span>
                    <button 
                      className="clash-btn-secondary btn-sm"
                      style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Coins size={10} style={{ color: '#FC4C02' }} /> {shopCosts.shield}
                    </button>
                  </div>

                  <div className="clash-card" onClick={() => buyItem('boots', shopCosts.boots)} style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center', cursor: 'pointer' }}>
                    <Zap size={24} style={{ color: '#FC4C02' }} />
                    <span className="clash-subtitle" style={{ fontSize: '12px', marginTop: '2px' }}>Speed Boots</span>
                    <span className="clash-body" style={{ fontSize: '10px' }}>Inventory: {inventory.boots}</span>
                    <button 
                      className="clash-btn-secondary btn-sm"
                      style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Coins size={10} style={{ color: '#FC4C02' }} /> {shopCosts.boots}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB: SOCIAL (CLANS & FRIENDS) */}
            <div style={{ display: activeTab === 'clans' ? 'flex' : 'none', flexDirection: 'column', gap: '14px', padding: '16px', height: '100%', overflowY: 'auto' }} className="fade-in">
              
              {/* Social Sub-Tab header toggle */}
              <div style={{ display: 'flex', background: '#0B0B0D', borderRadius: '14px', padding: '3px', border: '1px solid #2A2A2A', marginBottom: '4px', flexShrink: 0 }}>
                <button 
                  onClick={() => setSocialSubTab('crew')}
                  style={{
                    flex: 1,
                    background: socialSubTab === 'crew' ? '#FC4C02' : 'transparent',
                    color: 'white',
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: '11px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                  className="clash-btn-press"
                >
                  Crew Arena
                </button>
                <button 
                  onClick={() => setSocialSubTab('network')}
                  style={{
                    flex: 1,
                    background: socialSubTab === 'network' ? '#FC4C02' : 'transparent',
                    color: 'white',
                    border: 'none',
                    padding: '8px 0',
                    borderRadius: '11px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer'
                  }}
                  className="clash-btn-press"
                >
                  Friends Network
                </button>
              </div>

              {socialSubTab === 'crew' ? (
                /* SUB-TAB: CREW (ORIGINAL CLAN VIEW) */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} className="fade-in">
                  {/* Crew Header Banner */}
                  <div className="clash-card p-4 gap-3" style={{ borderLeft: `4px solid ${currentUser.clan === 'GITS Runners' ? '#FFFFFF' : '#FC4C02'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '12px',
                        background: '#0B0B0B',
                        border: `1.5px solid ${currentUser.clan === 'GITS Runners' ? '#FFFFFF' : '#FC4C02'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <Users size={22} style={{ color: currentUser.clan === 'GITS Runners' ? '#FFFFFF' : '#FC4C02' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <span className="clash-label" style={{ fontSize: '9px' }}>Active Tactical Crew</span>
                        <h3 className="clash-subtitle" style={{ margin: '0' }}>{currentUser.clan || 'Udaipur Racers'}</h3>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className="clash-label" style={{ border: '1px solid #FC4C02', color: '#FC4C02', padding: '3px 8px', borderRadius: '10px', fontSize: '9px' }}>
                          DOMINANT
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Clan Standings */}
                  <div>
                    <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                      <Trophy size={14} style={{ color: '#FC4C02' }} /> Crew Dominance Standings
                    </h3>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {getClanStandings().map((c, index) => {
                        const color = c.name === 'Udaipur Racers' ? '#FC4C02' : c.name === 'GITS Runners' ? '#FFFFFF' : '#555555';
                        return (
                          <div key={c.name} className="clash-card p-3 gap-2" style={{ borderColor: `${color}40` }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '800', marginBottom: '2px' }}>
                              <span style={{ color: color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ color: 'var(--clash-text-secondary)', fontWeight: 'bold' }}>#{index + 1}</span> {c.name}
                              </span>
                              <span style={{ color: 'white' }}>{c.percentage}% DOMAIN</span>
                            </div>
                            <div className="clash-progress-bar">
                              <div className="clash-progress-bar-fill" style={{ width: `${c.percentage}%`, backgroundColor: color }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Leaderboard Section */}
                  <div>
                    <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                      <Award size={14} style={{ color: '#FC4C02' }} /> Elite Runners Leaderboard
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                      {(() => {
                        const displayLeaderboard = [...leaderboard];
                        if (currentUser) {
                          const userInBoard = displayLeaderboard.some(p => p.displayName === currentUser.displayName);
                          if (!userInBoard) {
                            displayLeaderboard.push({
                              displayName: currentUser.displayName,
                              clan: currentUser.clan || 'Udaipur Racers',
                              level: currentUser.level || 1,
                              xp: currentUser.xp || 0
                            });
                          }
                        }
                        displayLeaderboard.sort((a, b) => b.xp - a.xp);

                        if (displayLeaderboard.length === 0) {
                          return (
                            <div className="clash-card p-4 text-center">
                              No active tactical runners synced.
                            </div>
                          );
                        }

                        return displayLeaderboard.map((player, idx) => {
                          const isSelf = player.displayName === currentUser?.displayName;
                          
                          let rankBorder = 'var(--clash-border)';
                          let rankColor = 'var(--clash-text-secondary)';
                          let badgeIcon = `#${idx + 1}`;
                          if (idx === 0) {
                            rankBorder = '#FC4C02';
                            rankColor = '#FC4C02';
                            badgeIcon = '👑';
                          } else if (idx === 1) {
                            rankBorder = '#FFFFFF';
                            rankColor = '#FFFFFF';
                            badgeIcon = '🥈';
                          } else if (idx === 2) {
                            rankBorder = '#A8A8A8';
                            rankColor = '#A8A8A8';
                            badgeIcon = '🥉';
                          }

                          return (
                            <div 
                              key={idx} 
                              className="clash-card clash-btn-press" 
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                padding: '10px 14px',
                                borderLeft: `4px solid ${isSelf ? '#FC4C02' : rankBorder}`,
                                background: isSelf ? 'rgba(252, 76, 2, 0.05)' : 'var(--clash-card)',
                                cursor: 'pointer'
                              }}
                              onClick={() => {
                                const found = INITIAL_PROFILES.find(p => p.displayName === player.displayName) || {
                                  id: 'user_self',
                                  displayName: player.displayName,
                                  clan: player.clan,
                                  level: player.level,
                                  xp: player.xp,
                                  distance: '12.4 km',
                                  territories: territories.filter(t => t.ownerId === currentUser.uid).length,
                                  bio: 'Strategic operative ready to claim territories.',
                                  friendsCount: friendsList.length,
                                  postsCount: 3,
                                  online: true
                                };
                                setSelectedProfileUser(found);
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ fontWeight: '800', color: rankColor, fontSize: '13px', width: '20px', textAlign: 'center' }}>
                                  {badgeIcon}
                                </span>
                                
                                <div style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: '#0B0B0B',
                                  border: `1.5px solid ${player.clan === 'GITS Runners' ? '#FFFFFF' : '#FC4C02'}`,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  color: 'white'
                                }}>
                                  {(player.displayName || 'G')[0].toUpperCase()}
                                </div>

                                <div>
                                  <span style={{ fontWeight: '800', color: isSelf ? '#FC4C02' : 'white' }}>
                                    {player.displayName} {isSelf && <span className="clash-body" style={{ fontSize: '9px' }}>(You)</span>}
                                  </span>
                                  <span className="clash-label" style={{ fontSize: '8px', marginLeft: '8px' }}>
                                    {player.clan}
                                  </span>
                                </div>
                              </div>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', fontWeight: 'bold' }}>LVL {player.level}</span>
                                <span style={{ fontFamily: 'var(--clash-font-family)', color: '#FC4C02', fontWeight: '800', fontSize: '12px' }}>
                                  {player.xp.toLocaleString()} XP
                                </span>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Clan Chat */}
                  <div className="clash-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '230px', padding: '14px' }}>
                    <span className="clash-label" style={{ borderBottom: '1px solid var(--clash-border)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <MessageSquare size={13} style={{ color: '#FC4C02' }} /> Crew Comm Channel
                    </span>
     
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
                      {clanMessages.map((msg) => {
                        const isSelf = msg.sender.includes('You') || msg.sender === currentUser.displayName;
                        return (
                          <div 
                            key={msg.id} 
                            style={{
                              alignSelf: isSelf ? 'flex-end' : 'flex-start',
                              maxWidth: '85%',
                              padding: '10px 14px',
                              borderRadius: '16px',
                              fontSize: '12px',
                              lineHeight: '1.45',
                              background: isSelf ? 'rgba(252, 76, 2, 0.05)' : '#0B0B0B',
                              border: `1px solid ${isSelf ? '#FC4C02' : 'var(--clash-border)'}`,
                              color: 'white'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '2px' }}>
                              <span 
                                onClick={() => {
                                  if (!isSelf) {
                                    const found = INITIAL_PROFILES.find(p => p.displayName === msg.sender) || {
                                      id: 'mock_chat_' + msg.sender,
                                      displayName: msg.sender,
                                      clan: currentUser.clan,
                                      level: 5,
                                      xp: 1800,
                                      distance: '24.5 km',
                                      territories: 1,
                                      bio: 'Active crew operator.',
                                      friendsCount: 6,
                                      postsCount: 1,
                                      online: true
                                    };
                                    setSelectedProfileUser(found);
                                  }
                                }}
                                style={{ fontSize: '9px', fontWeight: '800', color: isSelf ? '#FC4C02' : '#FFFFFF', cursor: isSelf ? 'default' : 'pointer' }}
                                className={isSelf ? '' : 'clash-btn-press'}
                              >
                                {msg.sender}
                              </span>
                              <span className="clash-body" style={{ fontSize: '8px' }}>{msg.time}</span>
                            </div>
                            <p style={{ margin: '0', fontSize: '11px', color: 'white', fontWeight: '500' }}>{msg.text}</p>
                          </div>
                        );
                      })}
                    </div>
     
                    <form onSubmit={handleClanSendMessage} style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--clash-border)', paddingTop: '10px' }}>
                      <input 
                        type="text" 
                        value={clanInput}
                        onChange={(e) => setClanInput(e.target.value)}
                        placeholder="Message crew..."
                        className="cyber-input"
                        style={{ padding: '8px 12px', fontSize: '12px' }}
                      />
                      <button type="submit" style={{ background: '#FC4C02', border: 'none', color: 'white', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', transition: 'transform 0.1s ease' }}>
                        <Send size={12} />
                      </button>
                    </form>
                  </div>
                </div>
              ) : (
                /* SUB-TAB: FRIENDS NETWORK */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="fade-in">
                  
                  {/* Notification feed widget */}
                  {socialNotifications.length > 0 && (
                    <div className="clash-card p-3 gap-2" style={{ borderLeft: '3px solid #FC4C02' }}>
                      <span className="clash-label" style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '6px', color: '#FC4C02' }}>
                        <AlertCircle size={11} /> Social Activity Log
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '90px', overflowY: 'auto' }}>
                        {socialNotifications.map(notif => (
                          <div key={notif.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', paddingBottom: '4px', borderBottom: '1px solid #222222' }}>
                            <span style={{ color: 'white' }}>
                              <b>{notif.senderName}</b> {notif.type === 'friend_request' ? 'sent you a friend request.' : notif.type === 'friend_accepted' ? 'accepted your request!' : 'started following you.'}
                            </span>
                            <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)' }}>{notif.timestamp}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Pending requests incoming block */}
                  {friendRequestsReceived.length > 0 && (
                    <div className="clash-card p-3 gap-2" style={{ borderLeft: '4px solid #FC4C02', display: 'flex', flexDirection: 'column' }}>
                      <span className="clash-label" style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '6px', color: '#FC4C02' }}>
                        <AlertCircle size={11} /> Pending Incoming Requests ({friendRequestsReceived.length})
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {friendRequestsReceived.map(reqId => {
                          const sender = INITIAL_PROFILES.find(p => p.id === reqId) || { displayName: 'Sam', clan: 'GITS Runners', level: 10 };
                          return (
                            <div key={reqId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0B0B0D', padding: '8px 12px', borderRadius: '12px', border: '1px solid #2A2A2A' }}>
                              <div 
                                onClick={() => setSelectedProfileUser(sender)}
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                              >
                                <div style={{
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '50%',
                                  background: '#FC4C02',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: '800',
                                  color: 'white'
                                }}>
                                  {sender.displayName[0].toUpperCase()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <span style={{ fontSize: '11px', fontWeight: '800', color: 'white' }}>{sender.displayName}</span>
                                  <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)' }}>LVL {sender.level} • {sender.clan}</span>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                  onClick={() => rejectFriendRequest(reqId)}
                                  style={{ background: '#222222', border: '1px solid #333333', color: 'white', fontSize: '9px', fontWeight: '800', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer' }}
                                  className="clash-btn-press"
                                >
                                  REJECT
                                </button>
                                <button 
                                  onClick={() => acceptFriendRequest(reqId)}
                                  style={{ background: '#FC4C02', border: 'none', color: 'white', fontSize: '9px', fontWeight: '800', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer' }}
                                  className="clash-btn-press"
                                >
                                  ACCEPT
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Profile block (self) */}
                  <div className="clash-card p-4 gap-3">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        background: '#FC4C02',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: '800',
                        color: 'white'
                      }}>
                        {(currentUser.displayName || 'G')[0].toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <h4 className="clash-title" style={{ margin: 0, fontSize: '16px' }}>{currentUser.displayName}</h4>
                          <span style={{ fontSize: '8px', fontWeight: '800', color: '#FC4C02', background: 'rgba(252, 76, 2, 0.08)', border: '1px solid rgba(252, 76, 2, 0.2)', padding: '2px 6px', borderRadius: '6px' }}>
                            LVL {currentUser.level}
                          </span>
                        </div>
                        <span className="clash-label" style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>
                          {currentUser.clan || 'Udaipur Racers'}
                        </span>
                      </div>
                      <button 
                        onClick={() => {
                          setEditDisplayName(currentUser.displayName);
                          setEditBio(userBio);
                          setIsEditingProfile(true);
                        }}
                        className="clash-btn-secondary clash-btn-press"
                        style={{ padding: '6px 12px', fontSize: '9px', height: '28px', borderRadius: '14px', fontWeight: '800' }}
                      >
                        EDIT PROFILE
                      </button>
                    </div>

                    {isEditingProfile ? (
                      <div style={{ background: '#0B0B0D', padding: '12px', borderRadius: '16px', border: '1px solid #2A2A2A', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                        <div>
                          <span className="clash-label" style={{ fontSize: '8px', marginBottom: '4px', display: 'block' }}>Display Name</span>
                          <input 
                            type="text" 
                            value={editDisplayName} 
                            onChange={(e) => setEditDisplayName(e.target.value)} 
                            className="cyber-input" 
                            style={{ padding: '6px 10px', fontSize: '11px' }} 
                          />
                        </div>
                        <div>
                          <span className="clash-label" style={{ fontSize: '8px', marginBottom: '4px', display: 'block' }}>Bio</span>
                          <textarea 
                            value={editBio} 
                            onChange={(e) => setEditBio(e.target.value)} 
                            className="cyber-input" 
                            style={{ padding: '6px 10px', fontSize: '11px', height: '50px', resize: 'none' }} 
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                          <button 
                            onClick={() => setIsEditingProfile(false)} 
                            style={{ background: 'transparent', border: 'none', color: 'var(--clash-text-secondary)', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}
                          >
                            CANCEL
                          </button>
                          <button 
                            onClick={() => {
                              if (editDisplayName.trim()) {
                                setCurrentUser(prev => ({ ...prev, displayName: editDisplayName.trim() }));
                              }
                              setUserBio(editBio.trim());
                              setIsEditingProfile(false);
                              addLog("Social: Profile updated successfully.");
                            }} 
                            style={{ background: '#FC4C02', border: 'none', color: 'white', fontSize: '10px', fontWeight: '800', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer' }}
                          >
                            SAVE CHANGES
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="clash-body" style={{ margin: '4px 0 0 0', fontSize: '11px', fontStyle: 'italic', color: 'var(--clash-text-secondary)' }}>
                          "{userBio}"
                        </p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '6px', borderTop: '1px solid #2A2A2A', paddingTop: '10px', textAlign: 'center' }}>
                          <div>
                            <span className="clash-label" style={{ fontSize: '7.5px' }}>Territories</span>
                            <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', display: 'block', fontWeight: '800' }}>
                              {territories.filter(t => t.ownerId === currentUser.uid).length}
                            </span>
                          </div>
                          <div>
                            <span className="clash-label" style={{ fontSize: '7.5px' }}>Friends</span>
                            <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', display: 'block', fontWeight: '800' }}>
                              {friendsList.length}
                            </span>
                          </div>
                          <div>
                            <span className="clash-label" style={{ fontSize: '7.5px' }}>Followers</span>
                            <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', display: 'block', fontWeight: '800' }}>
                              {followersList.length}
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Friends List section */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <Users size={14} style={{ color: '#FC4C02' }} /> Friends ({friendsList.length})
                      </h3>
                      <input 
                        type="text" 
                        value={friendsSearchQuery} 
                        onChange={(e) => setFriendsSearchQuery(e.target.value)} 
                        placeholder="Search friends..." 
                        className="cyber-input" 
                        style={{ width: '130px', padding: '4px 8px', fontSize: '10px', height: '24px' }} 
                      />
                    </div>

                    {(() => {
                      const filteredFriends = friendsList.filter(id => {
                        const profile = INITIAL_PROFILES.find(p => p.id === id);
                        return profile && profile.displayName.toLowerCase().includes(friendsSearchQuery.toLowerCase());
                      });

                      if (filteredFriends.length === 0) {
                        return (
                          <div className="clash-card p-4 text-center clash-body" style={{ fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                            No friends matched your search.
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {filteredFriends.map(friendId => {
                            const friend = INITIAL_PROFILES.find(p => p.id === friendId);
                            return (
                              <div 
                                key={friendId} 
                                className="clash-card p-3 clash-btn-press" 
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                                onClick={() => setSelectedProfileUser(friend)}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  <div style={{ position: 'relative' }}>
                                    <div style={{
                                      width: '32px',
                                      height: '32px',
                                      borderRadius: '50%',
                                      background: '#FC4C02',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '13px',
                                      fontWeight: '800',
                                      color: 'white'
                                    }}>
                                      {friend.displayName[0].toUpperCase()}
                                    </div>
                                    <span style={{
                                      position: 'absolute',
                                      bottom: 0,
                                      right: 0,
                                      width: '8px',
                                      height: '8px',
                                      borderRadius: '50%',
                                      background: friend.online ? '#10B981' : '#888888',
                                      border: '1.5px solid #151515'
                                    }}></span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>{friend.displayName}</span>
                                    <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>LVL {friend.level} • {friend.clan}</span>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span style={{ fontSize: '8px', color: friend.online ? '#10B981' : 'var(--clash-text-secondary)', fontWeight: '800', textTransform: 'uppercase' }}>
                                    {friend.online ? 'Online' : 'Offline'}
                                  </span>
                                  <ChevronUp size={16} style={{ transform: 'rotate(90deg)', color: 'var(--clash-text-secondary)' }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Discover Section */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <Sparkles size={14} style={{ color: '#FC4C02' }} /> Discover Udaipur Runners
                      </h3>
                      <input 
                        type="text" 
                        value={discoverSearchQuery} 
                        onChange={(e) => setDiscoverSearchQuery(e.target.value)} 
                        placeholder="Search network..." 
                        className="cyber-input" 
                        style={{ width: '130px', padding: '4px 8px', fontSize: '10px', height: '24px' }} 
                      />
                    </div>

                    {(() => {
                      const nonFriends = INITIAL_PROFILES.filter(p => !friendsList.includes(p.id));
                      const filteredDiscover = nonFriends.filter(p => p.displayName.toLowerCase().includes(discoverSearchQuery.toLowerCase()));

                      if (filteredDiscover.length === 0) {
                        return (
                          <div className="clash-card p-4 text-center clash-body" style={{ fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                            All active runners are already in your network!
                          </div>
                        );
                      }

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {filteredDiscover.map(p => {
                            const isSent = friendRequestsSent.includes(p.id);
                            const isReceived = friendRequestsReceived.includes(p.id);
                            return (
                              <div 
                                key={p.id} 
                                className="clash-card p-3" 
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                              >
                                <div 
                                  style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                                  onClick={() => setSelectedProfileUser(p)}
                                >
                                  <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    background: '#222222',
                                    border: '1px solid #333333',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '13px',
                                    fontWeight: '800',
                                    color: 'white'
                                  }}>
                                    {p.displayName[0].toUpperCase()}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>{p.displayName}</span>
                                    <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>LVL {p.level} • {p.clan}</span>
                                  </div>
                                </div>

                                <div>
                                  {isSent ? (
                                    <button 
                                      disabled
                                      style={{ background: 'transparent', border: '1px solid #333333', color: 'var(--clash-text-secondary)', fontSize: '8.5px', fontWeight: '800', padding: '6px 12px', borderRadius: '12px' }}
                                    >
                                      PENDING
                                    </button>
                                  ) : isReceived ? (
                                    <button 
                                      onClick={() => acceptFriendRequest(p.id)}
                                      style={{ background: '#FC4C02', border: 'none', color: 'white', fontSize: '8.5px', fontWeight: '800', padding: '6px 12px', borderRadius: '12px', cursor: 'pointer' }}
                                      className="clash-btn-press"
                                    >
                                      ACCEPT
                                    </button>
                                  ) : (
                                    <button 
                                      onClick={() => sendFriendRequest(p.id)}
                                      style={{ background: 'transparent', border: '1px solid #FC4C02', color: '#FC4C02', fontSize: '8.5px', fontWeight: '800', padding: '6px 12px', borderRadius: '12px', cursor: 'pointer' }}
                                      className="clash-btn-press"
                                    >
                                      ADD FRIEND
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                </div>
              )}
            </div>

            {/* TAB: AI COACH */}
            <div style={{ display: activeTab === 'coach' ? 'flex' : 'none', flexDirection: 'column', gap: '14px', padding: '16px', height: '100%' }} className="fade-in">
              
              {/* Coach Header Banner */}
              <div className="clash-card p-3" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid #FC4C02' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#0B0B0B',
                  border: '1.5px solid #FC4C02',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Sparkles size={18} style={{ color: '#FC4C02' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h4 className="clash-subtitle" style={{ margin: '0', fontSize: '14px' }}>Synergy AI Coach</h4>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FC4C02' }}></span>
                  </div>
                  <p className="clash-body" style={{ margin: '2px 0 0 0', fontSize: '11px' }}>
                    Tactical Route Assistant • Online
                  </p>
                </div>
              </div>

              {/* Chat Thread Panel */}
              <div className="clash-card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '230px', padding: '14px' }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
                  {coachMessages.map((msg) => {
                    const isCoach = msg.sender === 'coach';
                    return (
                      <div 
                        key={msg.id} 
                        style={{ 
                          alignSelf: isCoach ? 'flex-start' : 'flex-end',
                          maxWidth: '85%',
                          padding: '10px 14px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          lineHeight: '1.45',
                          background: isCoach ? '#0B0B0B' : 'rgba(252, 76, 2, 0.05)',
                          border: `1px solid ${isCoach ? 'var(--clash-border)' : '#FC4C02'}`,
                          color: 'white'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '800', color: isCoach ? '#FC4C02' : '#FFFFFF' }}>
                            {isCoach ? '🛡️ Coach' : 'You'}
                          </span>
                          <span className="clash-body" style={{ fontSize: '8px' }}>{msg.time}</span>
                        </div>
                        <p style={{ margin: '0', fontSize: '11px', color: 'white', lineHeight: '1.45', fontWeight: '500' }}>{msg.text}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Action Suggestion Chips */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', borderTop: '1px solid var(--clash-border)', paddingTop: '8px', scrollbarWidth: 'none' }}>
                  <button 
                    onClick={() => handleCoachSendMessage(null, "routes")}
                    className="clash-btn-secondary btn-sm"
                    style={{ fontSize: '9px', whiteSpace: 'nowrap', borderRadius: '12px', padding: '4px 10px', color: '#FC4C02', borderColor: 'var(--clash-border)' }}
                  >
                    Plan route
                  </button>
                  <button 
                    onClick={() => handleCoachSendMessage(null, "pace")}
                    className="clash-btn-secondary btn-sm"
                    style={{ fontSize: '9px', whiteSpace: 'nowrap', borderRadius: '12px', padding: '4px 10px', color: '#FC4C02', borderColor: 'var(--clash-border)' }}
                  >
                    Check pace
                  </button>
                  <button 
                    onClick={() => handleCoachSendMessage(null, "gps")}
                    className="clash-btn-secondary btn-sm"
                    style={{ fontSize: '9px', whiteSpace: 'nowrap', borderRadius: '12px', padding: '4px 10px', color: '#FC4C02', borderColor: 'var(--clash-border)' }}
                  >
                    How to run GPS?
                  </button>
                  <button 
                    onClick={() => handleCoachSendMessage(null, "hello")}
                    className="clash-btn-secondary btn-sm"
                    style={{ fontSize: '9px', whiteSpace: 'nowrap', borderRadius: '12px', padding: '4px 10px', color: '#FC4C02', borderColor: 'var(--clash-border)' }}
                  >
                    Calibrate
                  </button>
                </div>

                {/* Input Area */}
                <form onSubmit={handleCoachSendMessage} style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--clash-border)', paddingTop: '10px', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                    <input 
                      type="text" 
                      value={coachInput}
                      onChange={(e) => setCoachInput(e.target.value)}
                      placeholder="Ask Coach (e.g. 'gps', 'pace')..."
                      className="cyber-input"
                      style={{ padding: '8px 36px 8px 12px', fontSize: '12px', width: '100%' }}
                    />
                    {/* Voice mic icon placeholder */}
                    <button 
                      type="button"
                      onClick={() => alert("Voice assistant module loading...")}
                      style={{ background: 'none', border: 'none', color: 'var(--clash-text-secondary)', position: 'absolute', right: '10px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                      title="Voice Input (Coming Soon)"
                    >
                      <Settings size={12} style={{ color: '#FC4C02', opacity: 0.6 }} />
                    </button>
                  </div>
                  <button type="submit" style={{ background: '#FC4C02', border: 'none', color: 'white', borderRadius: '10px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.1s ease', flexShrink: 0 }}>
                    <Send size={12} />
                  </button>
                </form>
              </div>
            </div>

          </div>

          {/* Navigation Bar */}
          <div style={{
            height: '60px',
            borderTop: '1px solid var(--clash-border)',
            background: '#151515',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            zIndex: 100
          }}>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`tab-btn ${activeTab === 'dashboard' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'dashboard' ? '#FC4C02' : 'var(--clash-text-secondary)' }}
            >
              <Home size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Home</span>
            </button>

            <button 
              onClick={() => setActiveTab('map')}
              className={`tab-btn ${activeTab === 'map' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'map' ? '#FC4C02' : 'var(--clash-text-secondary)' }}
            >
              <Compass size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Map</span>
            </button>

            <button 
              onClick={() => setActiveTab('conquests')}
              className={`tab-btn ${activeTab === 'conquests' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'conquests' ? '#FC4C02' : 'var(--clash-text-secondary)' }}
            >
              <Shield size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Conquests</span>
            </button>

            <button 
              onClick={() => setActiveTab('clans')}
              className={`tab-btn ${activeTab === 'clans' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'clans' ? '#FC4C02' : 'var(--clash-text-secondary)' }}
            >
              <Users size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Social</span>
            </button>
 
            <button 
              onClick={() => setActiveTab('coach')}
              className={`tab-btn ${activeTab === 'coach' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'coach' ? '#FC4C02' : 'var(--clash-text-secondary)' }}
            >
              <Sparkles size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coach</span>
            </button>
          </div>
 
          {/* Public Profile Modal */}
          {selectedProfileUser && (
            <div 
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(11, 11, 13, 0.85)',
                backdropFilter: 'blur(8px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
              onClick={() => setSelectedProfileUser(null)}
            >
              <div 
                style={{
                  background: '#151515',
                  border: '1px solid #2A2A2A',
                  borderRadius: '28px',
                  width: '100%',
                  maxWidth: '360px',
                  padding: '24px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  boxShadow: '0 16px 48px rgba(0, 0, 0, 0.5)'
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#FC4C02',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '22px',
                    fontWeight: '800',
                    color: 'white',
                    border: '2px solid rgba(255, 255, 255, 0.15)'
                  }}>
                    {selectedProfileUser.displayName[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white' }}>
                        {selectedProfileUser.displayName}
                      </h3>
                      {selectedProfileUser.online && (
                        <span 
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: '#10B981',
                            display: 'inline-block'
                          }}
                          className="intel-badge-pulse"
                          title="Online"
                        ></span>
                      )}
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: '#FC4C02', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {selectedProfileUser.clan}
                    </span>
                  </div>
                </div>

                {/* Bio */}
                <div style={{ background: '#0B0B0D', padding: '12px 14px', borderRadius: '16px', border: '1px solid #2A2A2A' }}>
                  <span className="clash-label" style={{ fontSize: '8px', marginBottom: '4px', display: 'block' }}>BIO</span>
                  <p style={{ margin: 0, fontSize: '11px', color: 'white', fontStyle: 'italic', lineHeight: '1.4' }}>
                    "{selectedProfileUser.bio || 'Operative has not set a bio yet.'}"
                  </p>
                </div>

                {/* Two-Column Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', background: '#0B0B0D', padding: '14px', borderRadius: '20px', border: '1px solid #2A2A2A' }}>
                  <div>
                    <span className="clash-label" style={{ fontSize: '7.5px' }}>Level</span>
                    <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', fontWeight: '800' }}>
                      LVL {selectedProfileUser.level}
                    </span>
                  </div>
                  <div>
                    <span className="clash-label" style={{ fontSize: '7.5px' }}>Distance</span>
                    <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', fontWeight: '800' }}>
                      {selectedProfileUser.distance || '0.0 km'}
                    </span>
                  </div>

                  <div>
                    <span className="clash-label" style={{ fontSize: '7.5px' }}>Sectors Owned</span>
                    <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', fontWeight: '800' }}>
                      {selectedProfileUser.territories || 0}
                    </span>
                  </div>
                  <div>
                    <span className="clash-label" style={{ fontSize: '7.5px' }}>Experience Points</span>
                    <span className="clash-subtitle" style={{ fontSize: '12px', color: '#FC4C02', fontWeight: '800' }}>
                      {selectedProfileUser.xp ? selectedProfileUser.xp.toLocaleString() : '0'} XP
                    </span>
                  </div>

                  <div>
                    <span className="clash-label" style={{ fontSize: '7.5px' }}>Friends Network</span>
                    <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', fontWeight: '800' }}>
                      {selectedProfileUser.friendsCount || 0}
                    </span>
                  </div>
                  <div>
                    <span className="clash-label" style={{ fontSize: '7.5px' }}>Conquest Posts</span>
                    <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', fontWeight: '800' }}>
                      {selectedProfileUser.postsCount || 0}
                    </span>
                  </div>
                </div>

                {/* Connection Action Buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(() => {
                    const isFriend = friendsList.includes(selectedProfileUser.id);
                    const isSent = friendRequestsSent.includes(selectedProfileUser.id);
                    const isReceived = friendRequestsReceived.includes(selectedProfileUser.id);

                    if (isFriend) {
                      return (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => {
                              removeFriend(selectedProfileUser.id);
                              setSelectedProfileUser(null);
                            }}
                            className="clash-btn-secondary clash-btn-press"
                            style={{ height: '42px', flex: 1, borderRadius: '21px', fontSize: '11px', background: '#151515', border: '1px solid #2A2A2A', color: '#EF4444', fontWeight: '800' }}
                          >
                            REMOVE FRIEND
                          </button>
                          <button 
                            onClick={() => {
                              alert(`Tactical chat channel with ${selectedProfileUser.displayName} loading...`);
                              setSelectedProfileUser(null);
                            }}
                            className="clash-btn-primary clash-btn-press"
                            style={{ height: '42px', flex: 1.2, borderRadius: '21px', fontSize: '11px', background: '#FC4C02', color: 'white', border: 'none', fontWeight: '800' }}
                          >
                            MESSAGE
                          </button>
                        </div>
                      );
                    }

                    if (isSent) {
                      return (
                        <button 
                          disabled
                          style={{ height: '42px', width: '100%', borderRadius: '21px', fontSize: '11px', background: '#0B0B0D', border: '1px solid #2A2A2A', color: 'var(--clash-text-secondary)', fontWeight: '800' }}
                        >
                          FRIEND REQUEST SENT
                        </button>
                      );
                    }

                    if (isReceived) {
                      return (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button 
                            onClick={() => {
                              rejectFriendRequest(selectedProfileUser.id);
                              setSelectedProfileUser(null);
                            }}
                            className="clash-btn-secondary clash-btn-press"
                            style={{ height: '42px', flex: 1, borderRadius: '21px', fontSize: '11px', color: 'white', background: '#151515', border: '1px solid #2A2A2A', fontWeight: '800' }}
                          >
                            REJECT
                          </button>
                          <button 
                            onClick={() => {
                              acceptFriendRequest(selectedProfileUser.id);
                              setSelectedProfileUser(null);
                            }}
                            className="clash-btn-primary clash-btn-press"
                            style={{ height: '42px', flex: 1.2, borderRadius: '21px', fontSize: '11px', background: '#FC4C02', color: 'white', border: 'none', fontWeight: '800' }}
                          >
                            ACCEPT REQUEST
                          </button>
                        </div>
                      );
                    }

                    return (
                      <button 
                        onClick={() => {
                          sendFriendRequest(selectedProfileUser.id);
                          setSelectedProfileUser(null);
                        }}
                        className="clash-btn-primary clash-btn-press"
                        style={{ height: '42px', width: '100%', borderRadius: '21px', fontSize: '11px', background: '#FC4C02', color: 'white', border: 'none', fontWeight: '800' }}
                      >
                        ADD TO SQUAD
                      </button>
                    );
                  })()}

                  <button 
                    onClick={() => setSelectedProfileUser(null)}
                    className="clash-btn-secondary clash-btn-press"
                    style={{ height: '40px', width: '100%', borderRadius: '20px', fontSize: '11px', color: 'var(--clash-text-secondary)', border: 'none', background: 'transparent', fontWeight: '800' }}
                  >
                    CLOSE PROFILE
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
 
    </div>
  );
}



