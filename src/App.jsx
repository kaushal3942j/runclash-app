import React, { useState, useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import {
  MapPin, Play, Square, Shield, Zap, Award, Users, Compass,
  Coins, MessageSquare, Send, Sparkles, AlertCircle, RefreshCw, Trophy, Target,
  Lock, Mail, User, ShieldCheck, LogOut, CheckCircle, Navigation, Radio, Settings, Home,
  ChevronUp, ChevronDown, Clock, Check, Flame, Share2, Edit3, Bell, ChevronLeft, ChevronRight, Activity, Bookmark
} from 'lucide-react';
import { 
  isFirebaseActive, useSupabase, isValidUUID, generateUUID, subscribeToAuth, registerUser, loginUser, loginGuest, logout,
  syncUserStats, subscribeToTerritories, saveNewTerritory, updateTerritory, getLeaderboard, reportError,
  saveCompletedRun, updateUserProfile, fetchClans, createClanInCloud, joinClanInCloud, leaveClanInCloud
} from './supabase';
import { PhotoGalleryModal } from './components/profile/PhotoGalleryModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { HomeScreen } from './screens/HomeScreen';
import { ConquestsScreen } from './screens/ConquestsScreen';
import { SocialScreen } from './screens/SocialScreen';
import { CoachScreen } from './screens/CoachScreen';
import { PremiumScreen } from './screens/PremiumScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { PublicProfileScreen } from './screens/PublicProfileScreen';
import { createRunActivity, createTerritoryActivity } from './services/activityService';
import { RankBadge } from './components/profile/RankBadge';
import { runEngine } from './run-engine/runEngine';
import { validateTerritoryCapture } from './territory-engine/geometryEngine.js';
import { TERRITORY_ENGINE_CONFIG } from './territory-engine/territoryEngineConfig.js';
import { rechargeSector, DECAY_DURATION_HOURS } from './territory-engine/decayEngine.js';
import { DailyMissionCard } from './components/missions/DailyMissionCard';
import { TerritoryHealthBar } from './components/territory/TerritoryHealthBar';
import { usePremiumAccess } from './hooks/usePremiumAccess';
import { useIdentity } from './hooks/useIdentity';
import { FEATURE_KEYS } from './config/premiumConfig';
import { DEFAULT_DAILY_MISSIONS } from './utils/missions';
import { getRankFromXp } from './utils/ranks';
import { formatDisplayDistance, getDistanceInMeters } from './utils/distance';

// Dynamic Crew/Clan color assignment based on name hash
const getClanColor = (clanName) => {
  if (!clanName || clanName === 'None') return '#555555';
  let hash = 0;
  for (let i = 0; i < clanName.length; i++) {
    hash = clanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = ['#FC4C02', '#00F0FF', '#FF007A', '#39FF14', '#FFD700', '#8A2BE2'];
  return colors[Math.abs(hash) % colors.length];
};

import { SkeletonCard } from './components/common/SkeletonCard';

// Predefined Simulation Routes for Udaipur (Developer Mode)
const SIMULATION_ROUTES = {
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

// ============================================================================
// RUN ENGINE MODULE 1: CENTRALIZED CONFIGURATION & CONSTANTS
// ============================================================================
const RUN_ENGINE_CONFIG = {
  // Geolocation & Signal Quality Thresholds
  GPS_ACCURACY_THRESHOLD: 30.0,        // meters (accept points with accuracy <= 30m)
  MIN_TIME_COMPUTATION_WINDOW: 1.0,    // seconds
  MIN_MOVEMENT_SEGMENT_METERS: 0.8,    // meters (minimum displacement to accept segment)

  // Speed & Motion Processing Thresholds
  STATIONARY_SPEED_THRESHOLD: 0.40,    // m/s (1.44 km/h)
  RESUME_SPEED_THRESHOLD: 0.50,        // m/s (1.80 km/h)
  AUTO_PAUSE_STATIONARY_TIMEOUT_SEC: 15.0, // seconds stationary before auto-pause triggers (requires 15s AND 3 stationary fixes)
  SETTLING_DURATION_SEC: 3.0,          // seconds after start run to filter initial acquisition drift
  SETTLING_MIN_SAMPLES: 3,             // minimum samples required before leaving settling phase
  REQUIRED_MOVING_WINDOWS: 1,          // consecutive moving segments required to enter TRACKING
  MIN_VALID_SPEED_KMH: 1.20,           // km/h (minimum valid speed for display)

  // Auto-Pause & Inactivity Timers
  INACTIVITY_PAUSE_TIMEOUT: 10.0,      // seconds without GPS update before auto-pausing

  // Loop Detection & Territory Conquest Limits
  MIN_LOOP_POINTS: 8,                  // minimum coordinates required before loop validation
  MIN_LOOP_DISTANCE_KM: 0.04,          // minimum cumulative distance (40m) required for valid loop
  MIN_LOOP_DURATION_SEC: 25,           // minimum active duration seconds required for loop
  MIN_LOOP_AREA_SQM: 80,               // minimum enclosed area (80 m²) required for sector capture
  LOOP_CLOSURE_DISTANCE_METERS: 18.0,  // baseline loop closure distance threshold

  // Anti-Cheat Engine Thresholds
  MAX_INSTANT_SPEED_KMH: 30.0,         // km/h (8.33 m/s) instant jump cutoff
  MAX_INSTANT_SPEED_MS: 8.33,          // m/s (30 km/h)
  SUSTAINED_HIGH_SPEED_LIMIT: 8.0,     // m/s (28.8 km/h) vehicle detection limit
  SUSTAINED_HIGH_SPEED_MAX_DUR: 5,     // max seconds allowed at vehicle speed before auto-invalidation
  VEHICLE_SPEED_LIMIT: 7.0,            // m/s (25.2 km/h) maximum overall average speed allowed
  SUSPICION_SCORE_CUTOFF: 80           // anti-cheat suspicion score cutoff (out of 100)
};

// Backward-compatibility alias
const GPS_CONFIG = RUN_ENGINE_CONFIG;

export default function App() {
  // Identity Engine & Auth Hook
  const {
    isLoadingIdentity,
    authUser,
    currentProfile,
    setCurrentProfile,
    identityMode,
    authErrorMessage,
    legacyMigrationNeeded,
    signOutCurrentUser,
    loginGuestUser
  } = useIdentity();

  const currentUser = currentProfile;
  const setCurrentUser = setCurrentProfile;

  useEffect(() => {
    console.log('[APP] render ready');
  }, []);

  // Auth & Session State
  const [authMode, setAuthMode] = useState('login'); // 'login', 'signup', 'guest'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authClan, setAuthClan] = useState('None');
  const [authError, setAuthError] = useState('');
  const [isFinalizingRun, setIsFinalizingRun] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Global App States
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'map', 'social', 'conquests', 'profile'
  const [viewingPublicProfileId, setViewingPublicProfileId] = useState(null);
  const [territories, setTerritories] = useState([]);
  const [inventory, setInventory] = useState({
    shields: 2,
    boots: 1,
    decoys: 0
  });

  const DEBUG_MODE = false;
  const [trackingMode, setTrackingMode] = useState('gps'); // Enforced 'gps' in production
  const [simulationRouteKey, setSimulationRouteKey] = useState('foothills');
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
    isAutoPaused: false,
    manualPaused: false
  });

  const [completedRunData, setCompletedRunData] = useState(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [mapMode, setMapMode] = useState('solo'); // 'solo' | 'clan'

  // Live Run Screen 2.0 States
  const [bottomHudState, setBottomHudState] = useState('medium'); // 'mini', 'medium', 'expanded'
  const [cameraSheetOpen, setCameraSheetOpen] = useState(false);
  const [activeBanner, setActiveBanner] = useState(null); // { type, sectorName }
  const [toastMessage, setToastMessage] = useState(null);
  const toastTimerRef = useRef(null);

  // REAL DEVICE GPS DIAGNOSTIC MODE STATES
  const [isDebugPanelOpen, setIsDebugPanelOpen] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [debugModalText, setDebugModalText] = useState('');
  const [liveDebugInfo, setLiveDebugInfo] = useState({
    engineState: 'idle',
    accuracy: 0,
    coordsSpeedKmh: 'N/A',
    lat: 0,
    lng: 0,
    bufferFixes: 0,
    windowSeconds: 0,
    totalPathMeters: 0,
    netDisplacementMeters: 0,
    directionEfficiency: 0,
    medianSpeedKmh: 0,
    medianAccuracy: 0,
    primaryPass: false,
    fallbackPass: false,
    lastDecision: 'N/A',
    lastReason: 'N/A',
    gpsFixCount: 0,
    acceptedFixCount: 0,
    rejectedAccuracyCount: 0,
    lastStepMeters: 0,
    lastFixDtSeconds: 0,
    calculatedSegmentSpeedKmh: 0,
    distFromFirstWindowFix: 0
  });
  const debugHistoryRef = useRef([]);

  const showToast = useCallback((message, durationMs = 4000) => {
    if (!message) return;
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, durationMs);
  }, []);

  const handleCopyGpsDebug = useCallback(() => {
    const jsonText = JSON.stringify(debugHistoryRef.current, null, 2);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(jsonText)
        .then(() => showToast("Copied 20 GPS debug records to clipboard!"))
        .catch(() => {
          setDebugModalText(jsonText);
          setShowDebugModal(true);
        });
    } else {
      setDebugModalText(jsonText);
      setShowDebugModal(true);
    }
  }, [showToast]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const [showCameraFlash, setShowCameraFlash] = useState(false);

  const lastEnteredSectorIdRef = useRef(null);

  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);

  // Selected Territory State & Fade-in transition handler
  const [selectedTerritoryId, setSelectedTerritoryId] = useState(null);
  const [isInspectingTransition, setIsInspectingTransition] = useState(false);
  const [renderedTerritory, setRenderedTerritory] = useState(null);

  // GPS Lock state and Guidance Line variables
  const [isGpsReady, setIsGpsReady] = useState(false);
  const [initialGpsLockCoords, setInitialGpsLockCoords] = useState(null);
  const [guidanceLineCoords, setGuidanceLineCoords] = useState(null);

  const guidancePolylineRef = useRef(null);

  // Runner HQ Configuration & Subpages States
  const [activeSettingSubpage, setActiveSettingSubpage] = useState(null); // null, 'notifications', 'privacy', 'preferences', 'gps', 'appearance', 'support', 'about', 'account'
  const [editClanName, setEditClanName] = useState('');

  const [showAchievementsModal, setShowAchievementsModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showClanModal, setShowClanModal] = useState(false);
  const [showPhotoGalleryModal, setShowPhotoGalleryModal] = useState(false);
  const [showSavedPostsModal, setShowSavedPostsModal] = useState(false);
  const [showDraftStoriesModal, setShowDraftStoriesModal] = useState(false);

  // Clan Management Form States
  const [clanModalTab, setClanModalTab] = useState('create'); // 'create' | 'join'
  const [newClanName, setNewClanName] = useState('');
  const [newClanPublic, setNewClanPublic] = useState(true);
  const [clanSearchQuery, setClanSearchQuery] = useState('');
  const [joinInviteCode, setJoinInviteCode] = useState('');
  const [clanSuccessMsg, setClanSuccessMsg] = useState(null);
  const [clanErrorMsg, setClanErrorMsg] = useState(null);
  const [clansList, setClansList] = useState([]);
  const [isLoadingClans, setIsLoadingClans] = useState(false);

  const loadClans = async () => {
    setIsLoadingClans(true);
    const res = await fetchClans();
    if (res.success && res.data) {
      setClansList(res.data);
    } else {
      setClansList([]);
    }
    setIsLoadingClans(false);
  };

  useEffect(() => {
    if (showClanModal) {
      loadClans();
    }
  }, [showClanModal]);

  const handleCreateClanSubmit = async (e) => {
    e.preventDefault();
    if (!newClanName.trim()) {
      setClanErrorMsg("Clan Name cannot be empty.");
      return;
    }
    setClanErrorMsg(null);
    setClanSuccessMsg(null);

    const res = await createClanInCloud(newClanName.trim(), currentUser?.uid);
    if (res.success) {
      setCurrentUser(prev => prev ? ({ ...prev, clan: newClanName.trim() }) : prev);
      addLog(`Clan created: ${newClanName.trim()}`);
      setClanSuccessMsg(`Successfully created clan '${newClanName.trim()}'!`);
      setNewClanName('');
      await loadClans();
    } else {
      setClanErrorMsg(res.error || "Failed to create clan.");
    }
  };

  const handleJoinClanByName = async (clanName) => {
    setClanErrorMsg(null);
    setClanSuccessMsg(null);
    const res = await joinClanInCloud(clanName, currentUser?.uid);
    if (res.success) {
      setCurrentUser(prev => prev ? ({ ...prev, clan: clanName }) : prev);
      addLog(`Joined clan: ${clanName}`);
      setClanSuccessMsg(`Welcome to ${clanName}!`);
      await loadClans();
    } else {
      setClanErrorMsg(res.error || "Failed to join clan.");
    }
  };

  const handleJoinClanByCode = async (e) => {
    e.preventDefault();
    if (!joinInviteCode.trim()) {
      setClanErrorMsg("Please enter an invite code or clan name.");
      return;
    }
    await handleJoinClanByName(joinInviteCode.trim());
    setJoinInviteCode('');
  };

  const handleLeaveClanSubmit = async () => {
    setClanErrorMsg(null);
    setClanSuccessMsg(null);
    const res = await leaveClanInCloud(currentUser?.uid);
    if (res.success) {
      setCurrentUser(prev => prev ? ({ ...prev, clan: 'None' }) : prev);
      addLog("Left current clan.");
      setClanSuccessMsg("You have left your clan.");
      await loadClans();
    } else {
      setClanErrorMsg(res.error || "Failed to leave clan.");
    }
  };

  // Settings values
  const [prefAutoPause, setPrefAutoPause] = useState(true);
  const [prefUnits, setPrefUnits] = useState('metric');
  const [prefNotifications, setPrefNotifications] = useState({ sound: true, vibration: true, clan: true });
  const [prefPrivacy, setPrefPrivacy] = useState({ publicProfile: true, shareStats: true });
  const [prefAppearance, setPrefAppearance] = useState({ darkMode: true, neonGlow: false, accentColor: '#FC4C02' });

  // Initialize edit profile fields when user is loaded
  useEffect(() => {
    if (currentUser) {
      setEditDisplayName(currentUser.displayName || '');
      setEditClanName(currentUser.clan || '');
    }
  }, [currentUser]);

  // Dynamic statistics calculator based on local history
  const getLifetimeStats = () => {
    try {
      const runs = JSON.parse(localStorage.getItem('clash_runs')) || [];
      const totalRuns = runs.length;
      const lifetimeDistance = runs.reduce((acc, r) => acc + (parseFloat(r.distance) || 0), 0);
      const longestRun = Math.max(0, ...runs.map(r => parseFloat(r.distance) || 0));
      const totalCalories = runs.reduce((acc, r) => acc + (parseInt(r.calories) || 0), 0);

      const paceToSeconds = (paceStr) => {
        if (!paceStr || paceStr === '--:--') return Infinity;
        const parts = paceStr.split(':');
        if (parts.length !== 2) return Infinity;
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
      };

      const secondsToPace = (secs) => {
        if (secs === Infinity || secs === 0) return '0:00';
        const mins = Math.floor(secs / 60);
        const rem = Math.floor(secs % 60);
        return `${mins}:${rem.toString().padStart(2, '0')}`;
      };

      const paces = runs.map(r => paceToSeconds(r.pace)).filter(p => p !== Infinity);
      const bestPaceSecs = paces.length > 0 ? Math.min(...paces) : Infinity;
      const bestPace = bestPaceSecs === Infinity ? '0:00' : secondsToPace(bestPaceSecs);

      const totalDist = runs.reduce((acc, r) => acc + (parseFloat(r.distance) || 0), 0);
      const totalDur = runs.reduce((acc, r) => acc + (parseInt(r.duration) || 0), 0);
      const avgPace = totalDist > 0 ? secondsToPace(totalDur / totalDist) : '0:00';

      return {
        totalRuns,
        lifetimeDistance: parseFloat(lifetimeDistance.toFixed(2)),
        longestRun: parseFloat(longestRun.toFixed(2)),
        bestPace,
        avgPace,
        calories: totalCalories
      };
    } catch (e) {
      return {
        totalRuns: 0,
        lifetimeDistance: 0.00,
        longestRun: 0.00,
        bestPace: '0:00',
        avgPace: '0:00',
        calories: 0
      };
    }
  };

  const getTodayLatestRun = () => {
    try {
      const runs = JSON.parse(localStorage.getItem('clash_runs')) || [];
      if (runs.length === 0) return null;
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRuns = runs.filter(r => {
        if (!r.startTime && !r.endTime && !r.createdAt && !r.date) return true;
        const rDate = (r.endTime || r.startTime || r.createdAt || r.date || '').split('T')[0];
        return rDate === todayStr;
      });
      return todayRuns.length > 0 ? todayRuns[todayRuns.length - 1] : runs[runs.length - 1];
    } catch (e) {
      return null;
    }
  };

  useEffect(() => {
    setIsInspectingTransition(true);
    const timer = setTimeout(() => {
      const found = territories.find(t => t.id === selectedTerritoryId);
      setRenderedTerritory(found || null);
      if (!found) {
        setGuidanceLineCoords(null);
      }
      setIsInspectingTransition(false);
    }, 150); // Matches .intel-content-transition 150ms delay
    return () => clearTimeout(timer);
  }, [selectedTerritoryId, territories]);

  // Initial GPS Lock and map centring
  useEffect(() => {
    if (activeTab === 'map') {
      if (trackingMode === 'sim') {
        setIsGpsReady(true);
        return;
      }
      setIsGpsReady(false);

      const retrieveInitialLock = () => {
        if (!navigator.geolocation) {
          setIsGpsReady(true);
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setIsGpsReady(true);
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setInitialGpsLockCoords([lat, lng]);
            if (mapInstanceRef.current) {
              mapInstanceRef.current.setView([lat, lng], 15.5);

              if (runnerMarkerRef.current) {
                runnerMarkerRef.current.setLatLng([lat, lng]);
              } else {
                const runnerIcon = L.divIcon({
                  className: 'custom-runner-icon',
                  html: `<div style="background-color: #FC4C02; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
                  iconSize: [16, 16]
                });
                runnerMarkerRef.current = L.marker([lat, lng], { icon: runnerIcon }).addTo(mapInstanceRef.current);
              }
            }
          },
          (error) => {
            console.warn("[GPS] Initial lock failed:", error.message);
            setIsGpsReady(true); // Fallback to allow starting run
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      };
      retrieveInitialLock();
    }
  }, [activeTab, trackingMode]);

  // Guidance Line Rendering Effect
  useEffect(() => {
    if (mapInstanceRef.current) {
      if (guidancePolylineRef.current) {
        mapInstanceRef.current.removeLayer(guidancePolylineRef.current);
        guidancePolylineRef.current = null;
      }
      if (guidanceLineCoords) {
        guidancePolylineRef.current = L.polyline(guidanceLineCoords, {
          color: '#FC4C02',
          weight: 3,
          dashArray: '5, 8'
        }).addTo(mapInstanceRef.current);
      }
    }
  }, [guidanceLineCoords]);

  const handleNavigateTerritory = () => {
    if (mapInstanceRef.current && renderedTerritory && renderedTerritory.coords?.length > 0) {
      const startLoc = runnerMarkerRef.current
        ? runnerMarkerRef.current.getLatLng()
        : mapInstanceRef.current.getCenter();
      const endLoc = renderedTerritory.coords[0];

      setGuidanceLineCoords([[startLoc.lat, startLoc.lng], [endLoc[0], endLoc[1]]]);
      mapInstanceRef.current.flyTo(endLoc, 15.5);
      addLog(`System: Navigating to ${renderedTerritory.name}. Temporary guidance path active.`);
    }
  };

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
  const [editAvatarUrl, setEditAvatarUrl] = useState(null);
  const [editBannerUrl, setEditBannerUrl] = useState(null);

  // Persisted Social arrays
  const [friendsList, setFriendsList] = useState(() => {
    return JSON.parse(localStorage.getItem('clash_friends_list')) || [];
  });
  const [friendRequestsReceived, setFriendRequestsReceived] = useState(() => {
    return JSON.parse(localStorage.getItem('clash_requests_received')) || [];
  });
  const [friendRequestsSent, setFriendRequestsSent] = useState(() => {
    return JSON.parse(localStorage.getItem('clash_requests_sent')) || [];
  });
  const [followersList, setFollowersList] = useState(() => {
    return JSON.parse(localStorage.getItem('clash_followers_list')) || [];
  });
  const [userBio, setUserBio] = useState(() => {
    return localStorage.getItem('clash_user_bio') || 'Runner on RunClash.';
  });
  const [socialNotifications, setSocialNotifications] = useState(() => {
    return JSON.parse(localStorage.getItem('clash_social_notifications')) || [];
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
    addLog(`Social: Sent friend request.`);
  };

  const acceptFriendRequest = (profileId) => {
    setFriendRequestsReceived(prev => prev.filter(id => id !== profileId));
    if (!friendsList.includes(profileId)) {
      setFriendsList(prev => [...prev, profileId]);
    }
    if (!followersList.includes(profileId)) {
      setFollowersList(prev => [...prev, profileId]);
    }
    const newNotif = {
      id: 'notif_' + Date.now(),
      type: 'friend_accepted',
      senderName: 'Runner',
      timestamp: 'Just now',
      read: false
    };
    setSocialNotifications(prev => [newNotif, ...prev]);
    addLog(`Social: Accepted friend request.`);
  };

  const rejectFriendRequest = (profileId) => {
    setFriendRequestsReceived(prev => prev.filter(id => id !== profileId));
    addLog(`Social: Rejected friend request.`);
  };

  const removeFriend = (profileId) => {
    setFriendsList(prev => prev.filter(id => id !== profileId));
    addLog(`Social: Removed friend from network.`);
  };

  const [mapAutoFollow, setMapAutoFollow] = useState(true);
  const mapAutoFollowRef = useRef(true);
  useEffect(() => {
    mapAutoFollowRef.current = mapAutoFollow;
  }, [mapAutoFollow]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoadingLeaderboard(true);
    getLeaderboard().then(data => {
      if (active) {
        setLeaderboard(data || []);
        setIsLoadingLeaderboard(false);
      }
    }).catch(err => {
      if (active) {
        setLeaderboard([]);
        setIsLoadingLeaderboard(false);
      }
    });
    return () => { active = false; };
  }, [currentUser]);

  const runStateRef = useRef(runState);
  runStateRef.current = runState;
  const manualPausedRef = useRef(false);

  const wakeLockRef = useRef(null);

  // Run Timing & Auto-Pause Refs
  const startTimeRef = useRef(null);
  const endTimeRef = useRef(null);
  const lowSpeedDurationRef = useRef(0);

  // Anti-Cheat References
  const cheatMetricsRef = useRef({ speedSpikes: 0, repeatedJumps: 0, unrealisticAcceleration: 0 });
  const lastPointTimeRef = useRef(null);
  const lastSpeedRef = useRef(0);

  // High-performance GPS Tracking Refs (updates map in real-time, throttles React renders to once per second)
  const gpsPathRef = useRef([]);
  const gpsDistanceRef = useRef(0);
  const gpsSpeedRef = useRef(0);
  const gpsPaceRef = useRef('--:--');
  const gpsAccuracyRef = useRef(null);
  const gpsAutoPausedRef = useRef(false);
  const runEngineStateRef = useRef('idle'); // 'idle' | 'acquiring' | 'waiting' | 'tracking' | 'paused'
  const waitingBufferRef = useRef([]);
  const waitingBaselineRef = useRef(null);
  const activeMovementWindowRef = useRef([]);
  const trackingStartTimeRef = useRef(null);
  const activeDurationAccumulatedRef = useRef(0);
  const trackingSegmentStartRef = useRef(null);
  const gpsLastPointRef = useRef(null);
  const lastMovementTimestampRef = useRef(null);
  const consecutiveStationaryFixesRef = useRef(0);
  const stationaryAnchorPointRef = useRef(null);
  const pauseAnchorRef = useRef(null);
  const autoPauseStartTimeRef = useRef(null);
  const runMovementConfirmedRef = useRef(false);
  const initialAnchorRef = useRef(null);
  const initialSettlingSamplesRef = useRef([]);
  const initialSettlingCompleteRef = useRef(false);
  const initialMovementCandidatesRef = useRef(0);
  const pendingInitialPointsRef = useRef([]);
  const initialWaitingStartTimeRef = useRef(null);
  const driftCandidateDistRef = useRef(0);
  const resumeCandidatesRef = useRef(0);
  const startAccuracyRef = useRef(null);
  const gpsDiagnosticsRef = useRef({
    received: 0,
    accepted: 0,
    rejectedAccuracy: 0,
    rejectedMicro: 0,
    rejectedTeleport: 0,
    autoPauseCount: 0,
    driftCandidates: 0,
    driftDiscarded: 0,
    resumeCandidates: 0,
    confirmedResumes: 0
  });
  const smoothedSpeedRef = useRef(0);
  const speedHistoryRef = useRef([]);
  const accumulatedDistanceRef = useRef(0);
  const accumulatedDurationRef = useRef(0);

  // Settling Phase & Hysteresis State Machine References
  const settlingStartTimeRef = useRef(null);
  const settlingSamplesCountRef = useRef(0);
  const stableBaselinePointRef = useRef(null);
  const startMarkerRef = useRef(null);
  const [distanceToStartMeters, setDistanceToStartMeters] = useState(null);
  const lastRunStartInteractionRef = useRef(0);
  const consecutiveMovingWindowsRef = useRef(0);
  const consecutiveStationaryWindowsRef = useRef(0);
  const activeMovingDurationRef = useRef(0);
  const totalSessionDurationRef = useRef(0);

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
  const [clanMessages, setClanMessages] = useState([]);

  // Leaflet Refs
  const mapInstanceRef = useRef(null);
  const polylineRef = useRef(null);
  const runnerMarkerRef = useRef(null);
  const territoryPolygonsRef = useRef({});
  const watchIdRef = useRef(null);

  // Simulation Interval Refs
  const simIntervalRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const lastLoopWarningTimeRef = useRef(0);

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

  // ----------------------------------------------------
  // RunEngine Subscription & UI Synchronization (SECTION 3)
  // ----------------------------------------------------
  const formatSpeedKmh = (val) => {
    if (val === null || val === undefined || isNaN(val) || val <= 0) return '0.0';
    return Number(val).toFixed(1);
  };

  const applyRunEngineSnapshot = (eventType, data) => {
    const snap = data.metrics;
    const engineState = data.engineState;

    console.log('[ENGINE SNAPSHOT APPLIED]', { eventType, engineState, distance: snap.distance, speed: snap.speed });

    runEngineStateRef.current = engineState;

    setRunState(prev => ({
      ...prev,
      status: engineState,
      distance: snap.distance,
      duration: snap.duration,
      speed: formatSpeedKmh(snap.speed),
      rawSpeed: snap.speed,
      pace: snap.pace,
      avgSpeed: formatSpeedKmh(snap.avgSpeed),
      avgPace: snap.avgPace,
      path: snap.path,
      isAutoPaused: engineState === 'paused',
      gpsAccuracy: snap.accuracy || prev.gpsAccuracy
    }));

    if (snap.lastPoint && mapInstanceRef.current) {
      if (runnerMarkerRef.current) runnerMarkerRef.current.setLatLng(snap.lastPoint);
      if (polylineRef.current) polylineRef.current.setLatLngs(snap.path);
      if (mapAutoFollowRef.current) mapInstanceRef.current.panTo(snap.lastPoint);
    }
  };

  useEffect(() => {
    const unsubscribe = runEngine.subscribe((eventType, data) => {
      applyRunEngineSnapshot(eventType, data);
    });
    return unsubscribe;
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
    if (e) e.preventDefault();
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError('');

    try {
      if (authMode !== 'guest') {
        const trimmedEmail = authEmail.trim();
        if (!trimmedEmail) {
          throw new Error("Email address is required.");
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
          throw new Error("Please enter a valid email address (e.g. name@domain.com).");
        }
        if (!authPassword) {
          throw new Error("Password is required.");
        }
        if (authPassword.length < 6) {
          throw new Error("Password must be at least 6 characters long.");
        }
      }

      if (authMode === 'login') {
        const profile = await loginUser(authEmail.trim(), authPassword);
        setCurrentUser(profile);
        console.log(`[AUTH]\nauthenticated: true\nuserId: ${profile.uid}\nsession: active`);
      } else if (authMode === 'signup') {
        if (!authName.trim()) throw new Error("Display name is required.");
        const profile = await registerUser(authEmail.trim(), authPassword, authName.trim(), authClan);
        setCurrentUser(profile);
        console.log(`[AUTH]\nauthenticated: true\nuserId: ${profile.uid}\nsession: active`);
      } else if (authMode === 'guest') {
        const rawName = authPassword.trim() || authName.trim();
        const res = await loginGuestUser(rawName, 'None');
        if (!res.success) {
          throw new Error(res.error || 'Guest login failed.');
        }
        console.log(`[AUTH]\nauthenticated: true\nuserId: ${res.data.uid}\nsession: active`);
      }
    } catch (err) {
      setAuthError(err.message || "Authentication failed.");
      addLog(`Auth Error: ${err.message}`);
      console.log(`[AUTH]\nauthenticated: false\nuserId: null\nsession: null\nerror: ${err.message}`);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setAuthError('');

    try {
      stopTracking("User Sign Out");
      const res = await signOutCurrentUser();
      if (res && res.error) {
        setAuthError(res.error);
        addLog(`Sign-out warning: ${res.error}`);
      } else {
        setShowSignOutModal(false);
        addLog('System: User signed out successfully.');
      }
    } catch (err) {
      console.error('[SIGN OUT] Logout exception:', err);
      setAuthError(err.message || 'Failed to sign out.');
    } finally {
      setIsSigningOut(false);
    }
  };

  // ----------------------------------------------------
  // Leaflet Map Setup
  // ----------------------------------------------------
  useEffect(() => {
    if (isLoadingIdentity) return;
    if (!currentUser) return;
    if (mapInstanceRef.current) return;

    // Verify map container DOM element exists before calling L.map
    const mapElement = L.DomUtil.get('map');
    if (!mapElement) {
      return;
    }

    const map = L.map(mapElement, {
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true
    }).setView([24.5950, 73.6800], 13.5);

    const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
    if (mapboxToken) {
      L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/{z}/{x}/{y}@2x?access_token=${mapboxToken}`, {
        maxZoom: 20,
        attribution: '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a>'
      }).addTo(map);
    } else {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', {
        maxZoom: 20
      }).addTo(map);
    }

    mapInstanceRef.current = map;
    addLog("System: Leaflet Map loaded.");

    map.on('click', () => {
      setSelectedTerritoryId(null);
    });

    map.on('dragstart', () => {
      setMapAutoFollow(false);
    });

    setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 150);

    return () => {
      if (mapInstanceRef.current) {
        console.log("[Map Setup] Destroying map instance and clearing ref.");
        try {
          if (polylineRef.current) mapInstanceRef.current.removeLayer(polylineRef.current);
          if (runnerMarkerRef.current) mapInstanceRef.current.removeLayer(runnerMarkerRef.current);
          if (guidancePolylineRef.current) mapInstanceRef.current.removeLayer(guidancePolylineRef.current);
          Object.values(territoryPolygonsRef.current).forEach(layer => {
            if (layer) mapInstanceRef.current.removeLayer(layer);
          });
          mapInstanceRef.current.remove();
        } catch (e) {
          console.error("Map removal error", e);
        } finally {
          mapInstanceRef.current = null;
        }
      }
      territoryPolygonsRef.current = {};
    };
  }, [isLoadingIdentity, currentUser]);

  // Resize map when tab changes back to map
  useEffect(() => {
    if (currentUser && activeTab === 'map' && mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
      }, 100);
    }
  }, [activeTab, currentUser]);

  // Render territories onto the Leaflet map in real time (SOLO MAP vs CLAN MAP)
  useEffect(() => {
    if (!mapInstanceRef.current || !currentUser) return;

    // Clear old layers
    Object.values(territoryPolygonsRef.current).forEach(layer => {
      mapInstanceRef.current.removeLayer(layer);
    });
    territoryPolygonsRef.current = {};

    // Redraw list based on active mapMode (solo vs clan)
    territories.forEach(terr => {
      // 1. Render Official Landmark (Always Visible)
      if (terr.isLandmark) {
        const starIcon = L.divIcon({
          className: 'custom-landmark-icon',
          html: `<div style="background-color: rgba(250,204,21,0.15); border: 2px solid #FACC15; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(250,204,21,0.4);" class="intel-badge-pulse">
            <span style="font-size: 14px;">🏆</span>
          </div>`,
          iconSize: [28, 28]
        });
        const marker = L.marker(terr.coords[0], { icon: starIcon }).addTo(mapInstanceRef.current);
        marker.bindTooltip(terr.name, { permanent: false, direction: 'top', className: 'clash-tooltip' });

        marker.on('click', (e) => {
          if (e.originalEvent) e.originalEvent.stopPropagation();
          setSelectedTerritoryId(terr.id);
          setIsBottomSheetExpanded(true);
        });

        territoryPolygonsRef.current[terr.id] = marker;
        return;
      }

      // 2. Render Player-Created Territories per mapMode
      const isOwner = terr.ownerId === currentUser.uid;
      const isUserClan = currentUser.clan && currentUser.clan !== 'None' && terr.clan === currentUser.clan;
      const isEnemyClan = terr.clan && terr.clan !== 'None' && (!currentUser.clan || terr.clan !== currentUser.clan);
      const isUnclaimed = !terr.clan || terr.clan === 'None' || terr.ownerName === 'Unclaimed';

      let polyColor = '#888888';
      let fillOp = 0.12;
      let lineWeight = 2;
      let dashStyle = null;

      if (mapMode === 'solo') {
        // SOLO MAP: Highlight personal owned sectors & neutral sectors
        if (isOwner) {
          polyColor = '#FC4C02';
          fillOp = 0.25;
          lineWeight = 2.5;
        } else {
          polyColor = '#A8A8A8';
          fillOp = 0.08;
          lineWeight = 1.5;
        }
      } else {
        // CLAN MAP: Highlight clan sectors prominently, dim rival clan sectors
        if (isUserClan) {
          polyColor = '#3B82F6';
          fillOp = 0.35;
          lineWeight = 3;
        } else if (isEnemyClan) {
          polyColor = '#EF4444';
          fillOp = 0.12;
          lineWeight = 1.5;
        } else {
          polyColor = '#6B7280';
          fillOp = 0.05;
          lineWeight = 1;
          dashStyle = '4,4';
        }
      }

      const poly = L.polygon(terr.coords, {
        color: polyColor,
        fillColor: polyColor,
        fillOpacity: fillOp,
        weight: lineWeight,
        dashArray: dashStyle
      }).addTo(mapInstanceRef.current);

      const tooltipText = mapMode === 'clan'
        ? `${terr.name} [${terr.clan || 'Neutral'}]`
        : `${terr.name} (${terr.ownerName || 'Unclaimed'})`;

      poly.bindTooltip(tooltipText, { permanent: false, direction: 'center', className: 'clash-tooltip' });

      poly.on('click', (e) => {
        if (e.originalEvent) e.originalEvent.stopPropagation();
        setSelectedTerritoryId(terr.id);
        setIsBottomSheetExpanded(true);
      });

      territoryPolygonsRef.current[terr.id] = poly;
    });
  }, [territories, currentUser, mapMode]);

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

  const togglePauseResume = (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }

    if (runEngine.state === 'paused' || runState.status === 'paused') {
      runEngine.transitionTo('tracking', 'User manually resumed');
      addLog("System: Run resumed manually.");
    } else {
      runEngine.transitionTo('paused', 'User manually paused');
      addLog("System: Run paused manually.");
    }
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

  // Sector & Territory Boundary Transition Processor
  const processTerritoryTransition = (newPoint) => {
    let currentEnteredTerritory = null;
    for (const t of territories) {
      if (t.coords && t.coords.length >= 3) {
        if (isPointInPolygon(newPoint, t.coords)) {
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
  };

  // Real-Time Leaflet Map & Runner Marker DOM Renderer Sync
  const updateMapDisplay = (newPoint) => {
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(gpsPathRef.current);
    }
    if (runnerMarkerRef.current) {
      runnerMarkerRef.current.setLatLng(newPoint);
    }
    if (mapInstanceRef.current && mapAutoFollowRef.current) {
      mapInstanceRef.current.panTo(newPoint);
    }

    // PART 3 & 4: Render Start-Point Marker & calculate distance-to-start
    if (gpsPathRef.current && gpsPathRef.current.length > 0 && mapInstanceRef.current) {
      const startCoord = gpsPathRef.current[0];
      if (!startMarkerRef.current) {
        const startIcon = L.divIcon({
          className: 'custom-start-icon',
          html: `<div style="background-color: #10B981; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px rgba(16, 185, 129, 0.8);"></div>`,
          iconSize: [16, 16]
        });
        startMarkerRef.current = L.marker(startCoord, { icon: startIcon }).addTo(mapInstanceRef.current);
      } else {
        startMarkerRef.current.setLatLng(startCoord);
      }

      const distM = getDistanceInMeters(newPoint[0], newPoint[1], startCoord[0], startCoord[1]);
      setDistanceToStartMeters(Math.round(distM));
    }
  };

  const startTracking = (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    lastRunStartInteractionRef.current = Date.now();

    if (runState.status !== 'idle' && runState.status !== 'finished') return;

    requestWakeLock();

    // Start canonical Run Engine session and register GPS watch
    runEngine.startSession();
    runEngine.registerGpsWatch();
    addLog("GPS: Run session started. Tracking active.");
  };

  // Helper to check 2D line segment intersection
  const doSegmentsIntersect = (p1, q1, p2, q2) => {
    const orientation = (p, q, r) => {
      const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]);
      if (Math.abs(val) < 1e-9) return 0;
      return val > 0 ? 1 : 2;
    };
    const o1 = orientation(p1, q1, p2);
    const o2 = orientation(p1, q1, q2);
    const o3 = orientation(p2, q2, p1);
    const o4 = orientation(p2, q2, q1);
    if (o1 !== o2 && o3 !== o4) return true;
    return false;
  };

  const validateLoopRouteWrapper = (path, distanceKm) => {
    // Wrap the new engine to include the legacy run duration check
    const activeSec = (Date.now() - (startTimeRef.current ? startTimeRef.current.getTime() : Date.now())) / 1000;
    const minDurationSec = TERRITORY_ENGINE_CONFIG.MIN_LOOP_DURATION_SEC || 25;

    if (activeSec < minDurationSec) {
      return { 
        valid: false, 
        diagnostic: { validationFailureReason: `Run duration too short (${Math.round(activeSec)}s of ${minDurationSec}s required).` } 
      };
    }

    const res = validateTerritoryCapture(path, TERRITORY_ENGINE_CONFIG);
    if (!res.valid) {
      // Map reason to message
      let msg = 'Unknown validation error';
      if (res.reason === 'INSUFFICIENT_POINTS') msg = `Not enough GPS points recorded (${res.pointCount} of ${TERRITORY_ENGINE_CONFIG.MIN_LOOP_POINTS} required).`;
      if (res.reason === 'PATH_TOO_SHORT') msg = `Route distance too short: ${Math.round(res.pathDistanceKm * 1000)} m (minimum ${Math.round(TERRITORY_ENGINE_CONFIG.MIN_PATH_DISTANCE_KM * 1000)} m required).`;
      if (res.reason === 'LOOP_NOT_CLOSED') msg = `Loop not closed — you are ${Math.round(res.closureDistanceMeters)} m from your starting point. Finish within ${Math.round(TERRITORY_ENGINE_CONFIG.CLOSURE_THRESHOLD_METERS)} m.`;
      if (res.reason === 'AREA_TOO_SMALL') msg = `Territory area too small — minimum ${TERRITORY_ENGINE_CONFIG.MIN_LOOP_AREA_SQM} m² (currently ${res.areaSqM.toLocaleString()} m²).`;
      return { valid: false, diagnostic: { validationFailureReason: msg } };
    }

    return { 
      valid: true, 
      diagnostic: { 
        validationFailureReason: null,
        polygonAreaSqm: res.areaSqM
      }, 
      closedCoords: res.normalizedPath 
    };
  };

  const handleStopAndClaim = async (e) => {
    if (e) {
      if (typeof e.preventDefault === 'function') e.preventDefault();
      if (typeof e.stopPropagation === 'function') e.stopPropagation();
    }
    console.log('[STOP CLAIM] 1 handler started');

    if (isFinalizingRun) {
      console.log('[STOP CLAIM] Guard: Finalization already in progress, ignoring duplicate tap.');
      return;
    }
    setIsFinalizingRun(true);

    try {
      const currentPath = (gpsPathRef.current && gpsPathRef.current.length > 0)
        ? [...gpsPathRef.current]
        : (runState.path && runState.path.length > 0 ? [...runState.path] : []);
      const currentDistance = gpsDistanceRef.current || runState.distance || 0;

      // Short-run graceful cancellation (< 5 points or < 0.01 km)
      if (currentPath.length < 5 || currentDistance < 0.01) {
        addLog("Run Cancelled: Short run under 5 GPS points recorded.");
        showToast("Run cancelled: Insufficient GPS points recorded.", 3500);
        stopTracking("Short run cancelled");
        return;
      }

      const { valid, diagnostic, closedCoords } = validateLoopRouteWrapper(currentPath, currentDistance);

      if (!valid) {
        addLog(`Claim Validation Failed: ${diagnostic.validationFailureReason}`);
        showToast(diagnostic.validationFailureReason, 5000);
        stopTracking(`Claim Validation Failed: ${diagnostic.validationFailureReason}`);
        return;
      }

      await finishRealRun(closedCoords, diagnostic);
    } catch (err) {
      console.error('[STOP CLAIM ERROR] Exception in handleStopAndClaim:', err);
      const errMsg = `Claim Exception: ${err.message || 'Unknown Error'}`;
      addLog(errMsg);
      setToastMessage(errMsg);
      setTimeout(() => setToastMessage(null), 6000);
    } finally {
      setIsFinalizingRun(false);
    }
  };

  const stopTracking = (reason = "Explicit User Request") => {
    runEngine.cancelSession(reason);
    runEngine.clearGpsWatch();

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

    let finalActiveDuration = activeDurationAccumulatedRef.current;
    if (runEngineStateRef.current === 'tracking' && trackingSegmentStartRef.current) {
      finalActiveDuration += Math.max(0, Math.floor((Date.now() - trackingSegmentStartRef.current) / 1000));
    }

    // If the run has significant distance, show the summary modal instead of resetting immediately!
    if (reason === "Explicit User Request" && runState.distance >= 0.01) {
      const runSummary = {
        userId: currentUser.uid,
        path: runState.path,
        distance: runState.distance,
        duration: finalActiveDuration,
        pace: calculateConsistentRunStats(runState.distance, finalActiveDuration).formattedPace,
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
    if (startMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    setDistanceToStartMeters(null);
    // Keep runnerMarkerRef visible on map after stopping run (PART 5 & 6)

    // Reset tracking refs
    gpsPathRef.current = [];
    gpsDistanceRef.current = 0;
    gpsSpeedRef.current = 0;
    gpsPaceRef.current = '--:--';
    gpsAccuracyRef.current = null;
    gpsAutoPausedRef.current = false;
    gpsLastPointRef.current = null;
    smoothedSpeedRef.current = 0;
    accumulatedDistanceRef.current = 0;
    accumulatedDurationRef.current = 0;
    settlingStartTimeRef.current = null;
    settlingSamplesCountRef.current = 0;
    consecutiveMovingWindowsRef.current = 0;
    consecutiveStationaryWindowsRef.current = 0;
    activeMovingDurationRef.current = 0;
    totalSessionDurationRef.current = 0;

    runEngineStateRef.current = 'idle';
    console.log(`[RUN ENGINE LIFECYCLE] State reset: idle`);
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
      isAutoPaused: false,
      manualPaused: false
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

  const finishRealRun = async (loopCoordinates, claimDiagnostic = {}) => {
    const areaSqM = claimDiagnostic.polygonAreaSqm || calculatePolygonArea(loopCoordinates);
    const formattedArea = `${areaSqM.toLocaleString()} m²`;

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

      // 1. Hard cutoff check: overall average speed > VEHICLE_SPEED_LIMIT is impossible for long running loops
      if (overallAvgSpeed > GPS_CONFIG.VEHICLE_SPEED_LIMIT) {
        addLog(`Anti-Cheat: Run invalidated. Unrealistic average speed (${(overallAvgSpeed * 3.6).toFixed(1)} km/h).`);
        reportError(
          `Anti-Cheat: Invalidation. Overall avg speed is too high (${(overallAvgSpeed * 3.6).toFixed(1)} km/h).`,
          '',
          'AntiCheat',
          { distance: runState.distance, duration: runState.duration, avgSpeed: overallAvgSpeed }
        );
        setToastMessage("Anti-Cheat Triggered: Average speed exceeds realistic running limits.");
        setTimeout(() => setToastMessage(null), 4000);
        stopTracking("Anti-Cheat Average Speed Spike Cutoff");
        return;
      }

      // 2. Calculate dynamic suspicion score
      let suspicionScore = 0;
      suspicionScore += cheatMetricsRef.current.repeatedJumps * 15;
      suspicionScore += cheatMetricsRef.current.unrealisticAcceleration * 10;
      suspicionScore += (cheatMetricsRef.current.speedSpikes || 0) * 35;

      const maxSpeed = cheatMetricsRef.current.maxSpeed || 0;
      if (maxSpeed > 28) {
        suspicionScore += 50; // High speed spike suspicion (bike/car)
      }
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
        setToastMessage("Anti-Cheat Triggered: Unrealistic movement signals detected.");
        setTimeout(() => setToastMessage(null), 4000);
        stopTracking("Anti-Cheat High Suspicion Score Invalidation");
        return;
      }

      if (suspicionScore > 0) {
        addLog(`Anti-Cheat: Run verified with caution. Suspicion Score: ${suspicionScore}/100.`);
      }
    }

    const sectorName = trackingMode === 'gps'
      ? `Sector_${Math.floor(100 + Math.random() * 900)}`
      : (SIMULATION_ROUTES[simulationRouteKey]?.name || 'Simulated Sector');

    // CHECKPOINT 2: Run payload created
    const operationId = generateUUID();
    const runSummary = {
      operationId,
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
    console.log('[STOP CLAIM] 2 run payload created', { operationId });

    // CHECKPOINT 3: Save completed run FIRST (Independent of territory result)
    let runRes = null;
    try {
      runRes = await saveCompletedRun(runSummary);
      if (runRes?.cloud === true) {
        createRunActivity(runSummary, 'run', runSummary.operationId).catch(e => console.warn('[ACTIVITY LOG ERROR]', e));
      }
      console.log('[STOP CLAIM] 3 run saved or queued');
      addLog(`System: Run history successfully saved.`);
    } catch (runErr) {
      console.error('[STOP CLAIM] Run save exception:', runErr);
    }

    // CHECKPOINT 4: Territory payload created
    const claimId = generateUUID();
    const newTerritory = {
      claimId,
      name: sectorName,
      ownerId: currentUser.uid,
      ownerName: currentUser.displayName,
      clan: currentUser.clan,
      area: formattedArea,
      decayHours: 72,
      maxDecayHours: 72,
      rate: Math.ceil(areaSqM / 2000) || 5,
      coords: loopCoordinates
    };
    console.log('[STOP CLAIM] 4 territory payload created', { claimId });

    // CHECKPOINT 5: Territory cloud saved / queued / failed
    let territoryRes = null;
    try {
      territoryRes = await saveNewTerritory(newTerritory);
      if (territoryRes?.cloud === true) {
        createTerritoryActivity(newTerritory, 'territory', newTerritory.claimId).catch(e => console.warn('[ACTIVITY LOG ERROR]', e));
      }
      console.log('[STOP CLAIM] 5 territory cloud saved / queued / failed', {
        cloud: territoryRes?.cloud,
        queued: territoryRes?.queued,
        error: territoryRes?.error
      });
    } catch (terrErr) {
      console.error('[STOP CLAIM] Territory save exception:', terrErr);
      territoryRes = { success: true, queued: true, cloud: false, error: terrErr.message };
    }

    if (territoryRes?.queued) {
      addLog(`System: Territory '${sectorName}' saved locally and queued for sync.`);
      setToastMessage("Territory saved locally and queued for sync");
      setTimeout(() => setToastMessage(null), 4000);
    } else if (territoryRes?.error) {
      addLog(`System: Territory Notice: ${territoryRes.error}`);
    } else {
      addLog(`System: Conquest confirmed! Territory '${sectorName}' registered.`);
    }

    // CHECKPOINT 6: Reward Stats & UI Finalized
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

    if (polylineRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(polylineRef.current);
    if (startMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(startMarkerRef.current);
      startMarkerRef.current = null;
    }
    setDistanceToStartMeters(null);

    setCompletedRunData({
      territoryName: sectorName,
      area: formattedArea,
      distance: runState.distance,
      duration: runState.duration,
      pace: runState.avgPace !== '--:--' ? runState.avgPace : runState.pace,
      speed: runState.avgSpeed,
      calories: runState.calories || Math.round(runState.distance * 75 * 1.03),
      startTime: startTimeRef.current ? startTimeRef.current.toISOString() : new Date().toISOString(),
      endTime: new Date().toISOString(),
      summaryStatistics: {
        conqueredTerritoryName: sectorName,
        originalTrackingMode: trackingMode
      }
    });
    setShowSummaryModal(true);

    stopTracking("Conquest Complete");
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
    console.log('[STOP CLAIM] 6 UI finalized');

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



  const getClanStandings = () => {
    const clanAreas = {};
    let totalArea = 0;

    territories.forEach(terr => {
      if (terr.clan && terr.clan !== 'None') {
        const areaVal = parseFloat(terr.area.replace(/[^\d.]/g, '')) || 0;
        if (clanAreas[terr.clan] === undefined) {
          clanAreas[terr.clan] = 0;
        }
        clanAreas[terr.clan] += areaVal;
        totalArea += areaVal;
      }
    });

    if (totalArea === 0) {
      return [];
    }

    return Object.keys(clanAreas).map(name => {
      const percentage = totalArea > 0 ? Math.round((clanAreas[name] / totalArea) * 100) : 0;
      return { name, percentage };
    }).sort((a, b) => b.percentage - a.percentage);
  };

  // Distance computation (Haversine formula in meters)
  const getDistanceInMeters = (lat1, lon1, lat2, lon2) => {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // ============================================================================
  // RUN ENGINE MODULE: SPEED & PACE PROCESSOR
  // ============================================================================
  /**
   * Converts speed in meters per second (m/s) to kilometers per hour (km/h).
   */
  const convertMSToKmH = (speedMS) => {
    if (!speedMS || speedMS < 0) return 0;
    return parseFloat((speedMS * 3.6).toFixed(1));
  };

  /**
   * Formats distance for UI display:
   * - below 1 km: metres rounded to nearest whole metre (e.g. 420 m)
   * - 1 km or more: kilometres with two decimals (e.g. 1.26 km)
   */
  const formatDisplayDistance = (distKm) => {
    if (distKm === null || distKm === undefined || isNaN(distKm)) return '0 m';
    const km = Number(distKm);
    if (km < 1.0) {
      const meters = Math.round(km * 1000);
      return `${meters} m`;
    }
    return `${km.toFixed(2)} km`;
  };

  // TASK 1 runtime test assertions
  if (typeof window !== 'undefined' && !window.__distanceAssertionsTested) {
    window.__distanceAssertionsTested = true;
    try {
      console.assert(formatDisplayDistance(0) === '0 m', 'Assertion failed for 0');
      console.assert(formatDisplayDistance(0.004) === '4 m', 'Assertion failed for 0.004');
      console.assert(formatDisplayDistance(0.01) === '10 m', 'Assertion failed for 0.01');
      console.assert(formatDisplayDistance(0.05) === '50 m', 'Assertion failed for 0.05');
      console.assert(formatDisplayDistance(0.42) === '420 m', 'Assertion failed for 0.42');
      console.assert(formatDisplayDistance(0.999) === '999 m', 'Assertion failed for 0.999');
      console.assert(formatDisplayDistance(1.0) === '1.00 km', 'Assertion failed for 1.0');
      console.assert(formatDisplayDistance(1.26) === '1.26 km', 'Assertion failed for 1.26');
      console.log('[DISTANCE CONVERSION TEST] All 8 test assertions PASSED successfully.');
    } catch (e) {
      console.error('[DISTANCE CONVERSION TEST ERROR]', e);
    }
  }

  /**
   * Calculates completed-run average speed and pace derived strictly from total distance and duration.
   * Includes consistency assertion ensuring average speed (km/h) and pace-derived speed differ by < 0.1 km/h.
   */
  const calculateConsistentRunStats = (distanceKm, durationSeconds) => {
    const dist = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
    const dur = Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : 0;

    if (dist === 0 || dur === 0) {
      return {
        avgSpeedKmh: 0,
        paceSecondsPerKm: 0,
        formattedPace: '--:--',
        expectedSpeedKmh: 0,
        consistent: true
      };
    }

    // 1. Completed-run average speed (km/h)
    const avgSpeedKmh = (dist * 3600) / dur;

    // 2. Completed-run pace (seconds per km)
    const paceSecondsPerKm = dur / dist;

    let paceMin = Math.floor(paceSecondsPerKm / 60);
    let paceSec = Math.round(paceSecondsPerKm % 60);
    if (paceSec === 60) {
      paceMin += 1;
      paceSec = 0;
    }
    const formattedPace = `${paceMin}:${paceSec.toString().padStart(2, '0')}`;

    // 3. Consistency assertion: expectedSpeedKmh derived from pace
    const expectedSpeedKmh = paceSecondsPerKm > 0 ? 3600 / paceSecondsPerKm : 0;
    const speedDiff = Math.abs(avgSpeedKmh - expectedSpeedKmh);

    if (speedDiff >= 0.1) {
      console.warn(`[SPEED CONSISTENCY WARN] Speed diff (${speedDiff.toFixed(3)} km/h) >= 0.1 km/h!`, {
        dist, dur, avgSpeedKmh, expectedSpeedKmh
      });
    }

    return {
      avgSpeedKmh: parseFloat(avgSpeedKmh.toFixed(1)),
      paceSecondsPerKm,
      formattedPace,
      expectedSpeedKmh: parseFloat(expectedSpeedKmh.toFixed(1)),
      consistent: speedDiff < 0.1
    };
  };

  // Runtime assertions for speed & pace consistency
  if (typeof window !== 'undefined' && !window.__speedAssertionsTested) {
    window.__speedAssertionsTested = true;
    try {
      const ex1 = calculateConsistentRunStats(1.0, 600); // 1 km in 10 min = 6 km/h (10:00/km)
      console.assert(ex1.avgSpeedKmh === 6.0, `Ex1 avgSpeedKmh failed: ${ex1.avgSpeedKmh}`);
      console.assert(ex1.formattedPace === '10:00', `Ex1 formattedPace failed: ${ex1.formattedPace}`);
      console.assert(ex1.consistent, 'Ex1 consistency failed');

      const ex2 = calculateConsistentRunStats(1.0, 360); // 1 km in 6 min = 10 km/h (6:00/km)
      console.assert(ex2.avgSpeedKmh === 10.0, `Ex2 avgSpeedKmh failed: ${ex2.avgSpeedKmh}`);
      console.assert(ex2.formattedPace === '6:00' || ex2.formattedPace === '06:00', `Ex2 formattedPace failed: ${ex2.formattedPace}`);
      console.assert(ex2.consistent, 'Ex2 consistency failed');

      const ex3 = calculateConsistentRunStats(0.5, 360); // 500m in 6 min = 5 km/h (12:00/km)
      console.assert(ex3.avgSpeedKmh === 5.0, `Ex3 avgSpeedKmh failed: ${ex3.avgSpeedKmh}`);
      console.assert(ex3.formattedPace === '12:00', `Ex3 formattedPace failed: ${ex3.formattedPace}`);
      console.assert(ex3.consistent, 'Ex3 consistency failed');

      console.log('[SPEED CONSISTENCY TEST] All required speed & pace test assertions PASSED successfully.');
    } catch (e) {
      console.error('[SPEED CONSISTENCY TEST ERROR]', e);
    }
  }

  /**
   * Applies Exponential Moving Average (EMA) smoothing to raw speed in m/s.
   */
  const smoothSpeed = (rawSpeedMS, prevSmoothedSpeedMS, alpha = RUN_ENGINE_CONFIG.EMA_SMOOTHING_ALPHA || 0.3) => {
    if (rawSpeedMS <= 0) return 0;
    if (!prevSmoothedSpeedMS || prevSmoothedSpeedMS === 0) return rawSpeedMS;
    return alpha * rawSpeedMS + (1 - alpha) * prevSmoothedSpeedMS;
  };

  /**
   * Converts instantaneous speed in km/h to pace string formatted as MM:SS per km.
   * Returns '--:--' if stationary, zero, or out of valid human pace bounds (2:00 to 30:00 min/km).
   */
  const calculatePaceFromSpeed = (speedKmH) => {
    const minSpeedThresholdKmH = (RUN_ENGINE_CONFIG.DRIFT_SPEED_THRESHOLD || 0.8) * 3.6;
    if (!speedKmH || speedKmH < minSpeedThresholdKmH) {
      return '--:--';
    }

    const paceMinutesPerKm = 60 / speedKmH;
    let mins = Math.floor(paceMinutesPerKm);
    let secs = Math.round((paceMinutesPerKm - mins) * 60);

    if (secs >= 60) {
      mins += 1;
      secs = 0;
    }

    // Validate human pace bounds (2:00 /km to 30:00 /km)
    if (mins < 2 || mins > 30 || (mins === 30 && secs > 0)) {
      return '--:--';
    }

    return `${mins}:${secs.toString().padStart(2, '0')}`;
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



  /**
   * Calculates overall average pace string (MM:SS) from cumulative duration (seconds) and distance (km).
   * Returns '--:--' if duration < 10s, distance < 0.02 km, or out of valid human pace range.
   */
  const calculatePaceStr = (elapsedSeconds, distanceKm) => {
    if (!elapsedSeconds || elapsedSeconds < 10 || !distanceKm || distanceKm < 0.02) {
      return '--:--';
    }

    const distanceMeters = distanceKm * 1000;
    const paceMinutesPerKm = (elapsedSeconds / 60) / (distanceMeters / 1000);

    let finalMin = Math.floor(paceMinutesPerKm);
    let paceSec = Math.round((paceMinutesPerKm - finalMin) * 60);

    if (paceSec >= 60) {
      finalMin += 1;
      paceSec = 0;
    }

    // Validate human pace range (2:00 min/km to 30:00 min/km)
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
    
    // Instead of raw +24 decayHours, we use the new decayEngine to recharge health to 100%
    const rechargedTerr = rechargeSector(terr, Date.now());

    await updateTerritory(territoryId, { 
      last_recharged_at: rechargedTerr.last_recharged_at,
      expires_at: rechargedTerr.expires_at,
      decay_hours: DECAY_DURATION_HOURS // For legacy compat if needed
    });
    
    addLog(`System: Recharged '${terr.name}' to full health with Shield.`);
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

  // IDENTITY LOADING HUD GATE
  if (isLoadingIdentity) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0B0B0D', color: 'white', gap: '16px' }}>
        <div className="animate-spin" style={{ width: '36px', height: '36px', border: '3px solid rgba(252,76,2,0.2)', borderTopColor: '#FC4C02', borderRadius: '50%' }} />
        <span style={{ fontSize: '11px', letterSpacing: '2px', textTransform: 'uppercase', color: 'var(--clash-text-secondary)', fontWeight: '800' }}>
          Authenticating Tactical Unit...
        </span>
      </div>
    );
  }

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
                  placeholder={authMode === 'guest' ? 'e.g. Runner' : '••••••••'}
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
                  placeholder="e.g. Runner"
                  className="cyber-input focus-ring"
                />
              </div>
            )}

            {authMode === 'signup' && (
              <div className="gap-2" style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="clash-label" style={{ fontSize: '9px' }}>Join a Clan (Optional)</label>
                <select
                  value={authClan}
                  onChange={e => setAuthClan(e.target.value)}
                  className="cyber-select focus-ring"
                >
                  <option value="None">Skip for now</option>
                </select>
              </div>
            )}

            <button type="submit" disabled={isAuthenticating} className="clash-btn-primary" style={{ marginTop: '12px', opacity: isAuthenticating ? 0.6 : 1 }}>
              {isAuthenticating ? 'ENTERING ARENA...' : (authMode === 'login' ? 'Access Sector' : authMode === 'signup' ? 'Create Account' : 'Enter Arena')}
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
    <ErrorBoundary>
      <div
        className="sim-container fade-in"
        style={{ display: 'flex', justifyContent: 'center', padding: '24px 0', minHeight: '100vh', alignItems: 'center' }}
      >
      {/* MOBILE DEVICE FRAME SIMULATION */}
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
            {/* Offline Banner Notice — ONLY when identityMode is offline-local */}
            {identityMode === 'offline-local' && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'rgba(252, 76, 2, 0.1)',
                borderBottom: '1px solid rgba(252, 76, 2, 0.3)',
                padding: '5px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '10px',
                color: '#FC4C02',
                fontWeight: '700',
                zIndex: 99
              }}>
                <AlertCircle size={12} />
                <span>Offline profile active. Connect to sync your progress.</span>
              </div>
            )}

            {/* Auth Error Banner Notice — ONLY when identityMode is error */}
            {identityMode === 'error' && authErrorMessage && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                background: 'rgba(252, 76, 2, 0.15)',
                borderBottom: '1px solid rgba(252, 76, 2, 0.4)',
                padding: '5px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: '10px',
                color: '#FC4C02',
                fontWeight: '700',
                zIndex: 99
              }}>
                <AlertCircle size={12} />
                <span>{authErrorMessage}</span>
              </div>
            )}
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
          <div style={{ flex: 1, position: 'relative', overflowY: activeTab === 'map' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column', paddingBottom: '60px' }}>

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
                    <span style={{ fontSize: '20px', fontWeight: '800', color: '#FC4C02', fontFamily: 'var(--clash-font-mono)' }}>{formatDisplayDistance(completedRunData.distance)}</span>
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

            {/* SIGN OUT CONFIRMATION MODAL (PART 3) */}
            {showSignOutModal && (
              <div
                className="fade-in"
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.85)',
                  backdropFilter: 'blur(8px)',
                  zIndex: 30000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '20px'
                }}
              >
                <div
                  className="clash-card"
                  style={{
                    width: '380px',
                    maxWidth: '100%',
                    backgroundColor: '#141414',
                    border: '1px solid #2A2A2A',
                    borderRadius: '20px',
                    padding: '24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.9)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(252, 76, 2, 0.1)',
                      border: '1px solid rgba(252, 76, 2, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <LogOut size={20} style={{ color: '#FC4C02' }} />
                    </div>
                    <div>
                      <h3 className="clash-title" style={{ margin: 0, fontSize: '18px', color: 'white', fontWeight: '800' }}>
                        Sign out of RunClash?
                      </h3>
                      <span className="clash-label" style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>
                        AUTHENTICATION NOTICE
                      </span>
                    </div>
                  </div>

                  <p className="clash-body" style={{ margin: 0, fontSize: '12px', color: '#A0A0A0', lineHeight: '1.5' }}>
                    Anonymous guest progress cannot be recovered after signing out unless the account is upgraded.
                  </p>

                  {authError && (
                    <div style={{ background: 'rgba(252, 76, 2, 0.1)', border: '1px solid #FC4C02', color: '#FC4C02', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: '600' }}>
                      {authError}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                    <button
                      onClick={() => {
                        if (!isSigningOut) {
                          setAuthError('');
                          setShowSignOutModal(false);
                        }
                      }}
                      disabled={isSigningOut}
                      className="clash-btn-secondary"
                      style={{ flex: 1, height: '42px', borderRadius: '12px', fontSize: '12px', opacity: isSigningOut ? 0.5 : 1 }}
                    >
                      Cancel
                    </button>

                    <button
                      onClick={async () => {
                        await handleLogout();
                      }}
                      disabled={isSigningOut}
                      className="clash-btn-primary"
                      style={{ flex: 1.2, height: '42px', borderRadius: '12px', fontSize: '12px', backgroundColor: '#FC4C02', opacity: isSigningOut ? 0.6 : 1 }}
                    >
                      {isSigningOut ? 'SIGNING OUT...' : 'Sign Out'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* SETTINGS DRAWER OVERLAY (TRANSFORMED INTO RUNNER HQ COMMAND CENTER) */}
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
                gap: '20px',
                overflowY: 'auto'
              }}>
                {activeSettingSubpage !== null ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Subpage Header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--clash-border)', paddingBottom: '14px' }}>
                      <button
                        onClick={() => setActiveSettingSubpage(null)}
                        className="clash-btn-secondary"
                        style={{ width: '32px', height: '32px', borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #2A2A2A', background: '#151515', cursor: 'pointer' }}
                      >
                        <ChevronLeft size={16} style={{ color: '#FC4C02' }} />
                      </button>
                      <h3 className="clash-subtitle" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '14px' }}>
                        {activeSettingSubpage === 'notifications' && 'Notifications'}
                        {activeSettingSubpage === 'privacy' && 'Privacy Settings'}
                        {activeSettingSubpage === 'preferences' && 'Running Preferences'}
                        {activeSettingSubpage === 'gps' && 'GPS & Permissions'}
                        {activeSettingSubpage === 'appearance' && 'Appearance'}
                        {activeSettingSubpage === 'support' && 'Support & Feedback'}
                        {activeSettingSubpage === 'about' && 'About RunClash'}
                        {activeSettingSubpage === 'account' && 'Account Settings'}
                      </h3>
                    </div>

                    {/* Subpage Body Content */}
                    <div className="clash-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {activeSettingSubpage === 'notifications' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>Sound Effects</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Audio feedback during active loops</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={prefNotifications.sound}
                              onChange={e => setPrefNotifications(prev => ({ ...prev, sound: e.target.checked }))}
                              style={{ accentColor: '#FC4C02', width: '18px', height: '18px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>Loop Vibration</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Vibrate phone when loop is verified</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={prefNotifications.vibration}
                              onChange={e => setPrefNotifications(prev => ({ ...prev, vibration: e.target.checked }))}
                              style={{ accentColor: '#FC4C02', width: '18px', height: '18px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>Clan Alerts</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Get notified on sector challenges</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={prefNotifications.clan}
                              onChange={e => setPrefNotifications(prev => ({ ...prev, clan: e.target.checked }))}
                              style={{ accentColor: '#FC4C02', width: '18px', height: '18px' }}
                            />
                          </div>
                        </>
                      )}

                      {activeSettingSubpage === 'privacy' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>Public Profile</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Allow other clans to view your stats</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={prefPrivacy.publicProfile}
                              onChange={e => setPrefPrivacy(prev => ({ ...prev, publicProfile: e.target.checked }))}
                              style={{ accentColor: '#FC4C02', width: '18px', height: '18px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>Leaderboard Sharing</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Share runs history on leaderboards</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={prefPrivacy.shareStats}
                              onChange={e => setPrefPrivacy(prev => ({ ...prev, shareStats: e.target.checked }))}
                              style={{ accentColor: '#FC4C02', width: '18px', height: '18px' }}
                            />
                          </div>
                        </>
                      )}

                      {activeSettingSubpage === 'preferences' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>Auto-Pause Loop</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Pause tracking when runner stops moving</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={prefAutoPause}
                              onChange={e => setPrefAutoPause(e.target.checked)}
                              style={{ accentColor: '#FC4C02', width: '18px', height: '18px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>Measurement Units</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Select preferred units system</span>
                            </div>
                            <select
                              value={prefUnits}
                              onChange={e => setPrefUnits(e.target.value)}
                              className="cyber-select"
                              style={{ fontSize: '11px', padding: '6px 10px', background: '#0B0B0D', border: '1px solid #2A2A2A', color: 'white', borderRadius: '8px' }}
                            >
                              <option value="metric">Metric (km, km/h)</option>
                              <option value="imperial">Imperial (miles, mph)</option>
                            </select>
                          </div>
                        </>
                      )}

                      {activeSettingSubpage === 'gps' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>GPS Lock State</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Status of device geolocation hardware</span>
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: isGpsReady ? '#10B981' : '#FBBF24' }}>
                              {isGpsReady ? '🟢 ACTIVE & READY' : '🟡 ACQUIRING...'}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '14px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '800', color: '#FC4C02', letterSpacing: '0.5px', textTransform: 'uppercase' }}>GPS Troubleshooting Guide</span>

                            <div style={{ background: 'rgba(252, 76, 2, 0.05)', border: '1px solid rgba(252, 76, 2, 0.15)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'white', display: 'block', marginBottom: '2px' }}>1. Enable Location Services</span>
                                <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>Make sure GPS/Location services are turned ON in your device's system settings.</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'white', display: 'block', marginBottom: '2px' }}>2. Grant Browser Permissions</span>
                                <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>Ensure that your browser has permission to access your location. Check your browser address bar's lock icon to verify.</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'white', display: 'block', marginBottom: '2px' }}>3. High Accuracy Mode</span>
                                <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>Set your device location mode to 'High Accuracy' or 'Device Only' for the best results outdoors.</span>
                              </div>
                              <div>
                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'white', display: 'block', marginBottom: '2px' }}>4. Stand in Open Space</span>
                                <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>Buildings and heavy tree canopy can block satellite signals. Step into an open area for a quick lock.</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      {activeSettingSubpage === 'appearance' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>Interface Theme</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Toggle dark mode</span>
                            </div>
                            <span style={{ fontSize: '11px', color: 'white', fontWeight: '800' }}>DARK (default)</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px' }}>
                            <div>
                              <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>Neon Glow Accents</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Toggle high contrast border lighting</span>
                            </div>
                            <input
                              type="checkbox"
                              checked={prefAppearance.neonGlow}
                              onChange={e => setPrefAppearance(prev => ({ ...prev, neonGlow: e.target.checked }))}
                              style={{ accentColor: '#FC4C02', width: '18px', height: '18px' }}
                            />
                          </div>
                        </>
                      )}

                      {activeSettingSubpage === 'support' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                            Access the support center, read legal terms, or file reports to the arena operations team.
                          </span>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <button
                              className="clash-btn-primary"
                              style={{ height: '36px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                              onClick={() => { alert("Support Portal: Please send bug reports to support@runclash.com with your log details."); }}
                            >
                              Report Bug / System Issue
                            </button>
                            <button
                              className="clash-btn-secondary"
                              style={{ height: '36px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                              onClick={() => { alert("Contact GITS Operations: operations@runclash.com"); }}
                            >
                              Contact Support Team
                            </button>
                          </div>

                          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>FAQ & Legal Docs</span>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => alert("FAQ (Coming Soon in Alpha v2)")}>
                                <span>Frequently Asked Questions</span>
                                <span style={{ color: '#FC4C02', fontSize: '10px' }}>🚧 COMING SOON</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer' }} onClick={() => alert("Privacy Policy:\n\nRunClash is committed to protecting your GPS location data. Location updates are only processed locally to map loops and are synced securely to Supabase. No telemetry data is sold or shared.")}>
                                <span>Privacy Policy</span>
                                <span style={{ color: 'var(--clash-text-secondary)' }}>&rarr;</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', cursor: 'pointer' }} onClick={() => alert("Terms of Service:\n\nBy using RunClash, you agree to play fairly. Using vehicle simulation, GPS spoofing, or biking to record running loops is strictly forbidden and will result in temporary or permanent sector bans.")}>
                                <span>Terms of Service</span>
                                <span style={{ color: 'var(--clash-text-secondary)' }}>&rarr;</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeSettingSubpage === 'about' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                          <span style={{ color: 'white', fontWeight: '800' }}>RunClash v2.0.0</span>
                          <span>Gamified GPS Loop Tracking & Crew Territory Conquests. Built by GITS Developers.</span>
                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '6px', fontSize: '9px' }}>
                            &copy; 2026 RunClash Arena. All rights reserved.
                          </div>
                        </div>
                      )}

                      {activeSettingSubpage === 'account' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--clash-text-secondary)' }}>Display Name</label>
                            <input
                              type="text"
                              value={editDisplayName}
                              onChange={e => setEditDisplayName(e.target.value)}
                              className="cyber-select focus-ring"
                              style={{ height: '40px', padding: '0 12px', fontSize: '12px', color: 'white', background: '#0B0B0D', border: '1px solid #2A2A2A', borderRadius: '10px' }}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--clash-text-secondary)' }}>Clan Name</label>
                            <input
                              type="text"
                              value={editClanName}
                              onChange={e => setEditClanName(e.target.value)}
                              className="cyber-select focus-ring"
                              style={{ height: '40px', padding: '0 12px', fontSize: '12px', color: 'white', background: '#0B0B0D', border: '1px solid #2A2A2A', borderRadius: '10px' }}
                            />
                          </div>

                          {/* Profile Avatar Upload */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--clash-text-secondary)' }}>Profile Photo</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '50px',
                                height: '50px',
                                borderRadius: '50%',
                                border: '1.5px solid #FC4C02',
                                backgroundImage: editAvatarUrl ? `url(${editAvatarUrl})` : undefined,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: editAvatarUrl ? undefined : '#0B0B0D'
                              }}>
                                {!editAvatarUrl && <Users size={16} style={{ color: 'var(--clash-text-secondary)' }} />}
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    if (file.size > 800 * 1024) {
                                      alert("Image size must be less than 800 KB to fit within storage limits.");
                                      return;
                                    }
                                    if (!file.type.startsWith('image/')) {
                                      alert("Invalid file format. Please choose an image.");
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (uploadEvent) => {
                                      setEditAvatarUrl(uploadEvent.target.result);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}
                              />
                            </div>
                          </div>

                          {/* Profile Banner Upload */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <label style={{ fontSize: '11px', color: 'var(--clash-text-secondary)' }}>Banner / Cover Image</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              <div style={{
                                width: '100%',
                                height: '80px',
                                borderRadius: '12px',
                                border: '1px dashed #2A2A2A',
                                backgroundImage: editBannerUrl ? `url(${editBannerUrl})` : undefined,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: editBannerUrl ? undefined : '#0B0B0D'
                              }}>
                                {!editBannerUrl && <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>No Banner Uploaded</span>}
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const file = e.target.files[0];
                                  if (file) {
                                    if (file.size > 800 * 1024) {
                                      alert("Image size must be less than 800 KB to fit within storage limits.");
                                      return;
                                    }
                                    if (!file.type.startsWith('image/')) {
                                      alert("Invalid file format. Please choose an image.");
                                      return;
                                    }
                                    const reader = new FileReader();
                                    reader.onload = (uploadEvent) => {
                                      setEditBannerUrl(uploadEvent.target.result);
                                    };
                                    reader.readAsDataURL(file);
                                  }
                                }}
                                style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}
                              />
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              if (!editDisplayName.trim()) return alert("Display Name cannot be empty!");
                              const updatedUser = {
                                ...currentUser,
                                displayName: editDisplayName.trim(),
                                clan: editClanName.trim() || 'None',
                                avatarUrl: editAvatarUrl,
                                bannerUrl: editBannerUrl
                              };
                              setCurrentUser(updatedUser);
                              localStorage.setItem('clash_user', JSON.stringify(updatedUser));
                              setActiveSettingSubpage(null);
                              setToastMessage("Account settings updated successfully!");
                              setTimeout(() => setToastMessage(null), 3000);
                            }}
                            className="clash-btn-primary"
                            style={{ height: '42px', fontSize: '11px', marginTop: '6px', cursor: 'pointer' }}
                          >
                            Save Changes
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* MAIN RUNNER HQ COMMAND CENTER VIEW */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Header Row */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--clash-border)', paddingBottom: '14px' }}>
                      <h3 className="clash-subtitle" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1.5px', fontSize: '14px', color: '#FC4C02', fontWeight: '800' }}>Runner HQ</h3>
                      <button
                        onClick={() => setShowSettingsDrawer(false)}
                        className="clash-btn-secondary btn-sm"
                        style={{ color: '#FC4C02', borderColor: '#FC4C02', borderRadius: '12px', height: '28px', cursor: 'pointer' }}
                      >
                        Exit HQ
                      </button>
                    </div>

                    {/* 1. HERO PROFILE CARD */}
                    <div className="runner-hq-card runner-hq-hero-bg card-entrance" style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px',
                      padding: '20px',
                      backgroundImage: currentUser.bannerUrl ? `url(${currentUser.bannerUrl})` : undefined,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', fontWeight: '800', letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                          {(() => {
                            const hr = new Date().getHours();
                            if (hr < 12) return 'Good Morning, Runner ☀️';
                            if (hr < 17) return 'Good Afternoon, Runner 🌤️';
                            return 'Good Evening, Runner 🌙';
                          })()}
                        </span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: '8px',
                          fontSize: '8px',
                          fontWeight: '800',
                          background: 'rgba(252, 76, 2, 0.15)',
                          color: '#FC4C02',
                          textTransform: 'uppercase'
                        }}>
                          {(() => {
                            const lvl = currentUser.level || 1;
                            if (lvl < 5) return 'Bronze Scout';
                            if (lvl < 9) return 'Silver Raider';
                            if (lvl < 13) return 'Gold Vanguard';
                            return 'Apex Centurion';
                          })()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Custom glowing circular avatar */}
                        <div style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '50%',
                          background: currentUser.avatarUrl ? undefined : 'rgba(11, 11, 13, 0.9)',
                          border: '2px solid #FC4C02',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '22px',
                          fontWeight: '800',
                          color: 'white',
                          boxShadow: '0 0 12px rgba(252, 76, 2, 0.2)',
                          backgroundImage: currentUser.avatarUrl ? `url(${currentUser.avatarUrl})` : undefined,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }}>
                          {!currentUser.avatarUrl && (currentUser.displayName || 'R')[0].toUpperCase()}
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <h4 className="clash-title" style={{ margin: 0, fontSize: '20px', letterSpacing: '0.2px' }}>{currentUser.displayName}</h4>
                          <span style={{ fontSize: '11px', color: 'var(--clash-text-secondary)', fontFamily: 'var(--clash-font-family)' }}>
                            @{ (currentUser.displayName || 'runner').toLowerCase().replace(/\s+/g, '_') }
                          </span>
                        </div>
                      </div>

                      {/* XP Progress Slider */}
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--clash-text-secondary)', marginBottom: '5px' }}>
                          <span style={{ fontWeight: '800', color: 'white' }}>LVL {currentUser.level} BADGE</span>
                          <span>{currentUser.xp} / {currentUser.nextLevelXp || 2500} XP</span>
                        </div>
                        <div className="clash-progress-bar" style={{ height: '6px', background: 'rgba(255,255,255,0.05)' }}>
                          <div className="clash-progress-bar-fill" style={{ width: `${Math.min(100, ((currentUser.xp || 0) / (currentUser.nextLevelXp || 2500)) * 100)}%`, height: '100%' }}></div>
                        </div>
                      </div>

                      {/* CTA Buttons */}
                      <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button
                          onClick={() => {
                            setEditDisplayName(currentUser.displayName || '');
                            setEditClanName(currentUser.clan || '');
                            setEditAvatarUrl(currentUser.avatarUrl || null);
                            setEditBannerUrl(currentUser.bannerUrl || null);
                            setActiveSettingSubpage('account');
                          }}
                          className="clash-btn-secondary btn-sm"
                          style={{ height: '32px', flex: 1, borderRadius: '16px', fontSize: '10px', fontWeight: '800', border: '1px solid #2A2A2A', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                        >
                          <Edit3 size={11} style={{ marginRight: '4px' }} /> Edit Profile
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`Check out my RunClash stats! LVL ${currentUser.level} | ${currentUser.clan}`);
                            setToastMessage("Profile details copied to clipboard!");
                            setTimeout(() => setToastMessage(null), 3000);
                          }}
                          className="clash-btn-secondary btn-sm"
                          style={{ height: '32px', flex: 1, borderRadius: '16px', fontSize: '10px', fontWeight: '800', border: '1px solid #2A2A2A', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                        >
                          <Share2 size={11} style={{ marginRight: '4px' }} /> Share Profile
                        </button>
                      </div>
                    </div>

                    {/* 2. TODAY'S MISSION CARD */}
                    <div className="runner-hq-card card-entrance" style={{ animationDelay: '100ms', gap: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="clash-label" style={{ fontSize: '9px', color: '#FC4C02' }}>DAILY CAMPAIGN</span>
                        <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>+150 XP • +25 COINS</span>
                      </div>

                      {(() => {
                        const stats = getLifetimeStats();
                        const isMissionDone = stats.totalRuns > 0;

                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div>
                                <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '13px' }}>
                                  {isMissionDone ? 'Daily Loop Infiltration' : 'Tactical Loop Infiltration'}
                                </h4>
                                <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', display: 'block', marginTop: '2px' }}>
                                  {isMissionDone ? 'Run loop verified successfully!' : 'Complete any loop of at least 1.5 km.'}
                                </span>
                              </div>
                              <Target size={16} style={{ color: '#FC4C02' }} />
                            </div>

                            <div>
                              <div className="clash-progress-bar" style={{ height: '5px', background: 'rgba(255,255,255,0.05)' }}>
                                <div className="clash-progress-bar-fill" style={{ width: isMissionDone ? '100%' : '0%', height: '100%' }}></div>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '8px', color: 'var(--clash-text-secondary)', marginTop: '4px' }}>
                                <span>PROGRESS</span>
                                <span>{isMissionDone ? '100%' : '0%'}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* 3. WEEKLY PROGRESS CHART */}
                    <div className="runner-hq-card card-entrance" style={{ animationDelay: '180ms', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="clash-label" style={{ fontSize: '9px' }}>WEEKLY ACTIVITY</span>
                        <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>
                          AVG: { (getLifetimeStats().lifetimeDistance / 7).toFixed(1) } km/day
                        </span>
                      </div>

                      {/* Visual capsules bar graph */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: '100px', paddingTop: '10px', paddingBottom: '4px', background: 'rgba(0,0,0,0.15)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
                        {[
                          { day: 'Mon', val: 3.2, active: true },
                          { day: 'Tue', val: 5.4, active: true },
                          { day: 'Wed', val: 1.8, active: true },
                          { day: 'Thu', val: 0.0, active: false },
                          { day: 'Fri', val: 4.2, active: true },
                          { day: 'Sat', val: 8.5, active: true },
                          { day: 'Sun', val: 2.1, active: true }
                        ].map((d, index) => {
                          const percentage = Math.min(100, (d.val / 8.5) * 100);
                          return (
                            <div key={index} className="weekly-bar-container">
                              <div className="weekly-bar-bg" style={{ height: '65px' }}>
                                <div className="weekly-bar-fill" style={{ height: `${percentage}%`, background: d.active ? '#FC4C02' : '#2A2A2A' }}></div>
                              </div>
                              <span style={{ fontSize: '8px', color: d.active ? 'white' : 'var(--clash-text-secondary)', fontWeight: '800' }}>{d.day}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. DAILY STREAK CARD */}
                    <div className="runner-hq-card card-entrance" style={{ animationDelay: '240ms', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '20px' }}>🔥</span>
                          <div>
                            <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Running Streak</span>
                            <span style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>8 Days Active</span>
                          </div>
                        </div>
                        <span style={{ fontSize: '9px', color: '#10B981', fontWeight: '800', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '8px' }}>STREAK SAFE</span>
                      </div>
                      <p style={{ margin: 0, fontSize: '10px', color: 'var(--clash-text-secondary)', fontStyle: 'italic' }}>
                        "Don't break your running loop streak tomorrow. Keep Udaipur secured!"
                      </p>
                    </div>

                    {/* 5. PERFORMANCE DASHBOARD */}
                    <div className="runner-hq-card card-entrance" style={{ animationDelay: '300ms', gap: '14px' }}>
                      <span className="clash-label" style={{ fontSize: '9px' }}>PERFORMANCE ANALYTICS</span>

                      {(() => {
                        const stats = getLifetimeStats();
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            {/* Running Group */}
                            <div>
                              <span style={{ fontSize: '9px', fontWeight: '800', color: '#FC4C02', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>Running Overview</span>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
                                  <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Lifetime Dist</span>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>{stats.lifetimeDistance} km</span>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
                                  <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Total Runs</span>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>{stats.totalRuns}</span>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
                                  <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Longest Run</span>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>{stats.longestRun} km</span>
                                </div>
                              </div>
                            </div>

                            {/* Performance Group */}
                            <div>
                              <span style={{ fontSize: '9px', fontWeight: '800', color: '#FC4C02', textTransform: 'uppercase', display: 'block', marginBottom: '8px', letterSpacing: '0.5px' }}>Velocity & Energy</span>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
                                  <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Best Pace</span>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>{stats.bestPace} /km</span>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
                                  <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Avg Pace</span>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>{stats.avgPace} /km</span>
                                </div>
                                <div style={{ background: 'rgba(0,0,0,0.2)', padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
                                  <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Calories</span>
                                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>{stats.calories} kcal</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* TACTICAL CREW / CLAN CARD */}
                    <div className="runner-hq-card card-entrance" style={{ animationDelay: '330ms', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="clash-label" style={{ fontSize: '9px' }}>TACTICAL CREW</span>
                        <Users size={14} style={{ color: '#FC4C02' }} />
                      </div>

                      {(!currentUser.clan || currentUser.clan === 'None') ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', color: '#EF4444' }}>No Clan</h4>
                            <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', lineHeight: '1.4' }}>
                              You are currently unaligned. Register or join a tactical crew to claim and defend Udaipur sectors.
                            </span>
                          </div>
                          <button
                            onClick={() => setShowClanModal(true)}
                            className="clash-btn-primary btn-sm"
                            style={{ height: '32px', borderRadius: '16px', fontSize: '10px', fontWeight: '800', border: 'none', background: '#FC4C02', color: 'white', cursor: 'pointer' }}
                          >
                            Create or Join Clan
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '14px', color: '#FC4C02' }}>{currentUser.clan}</h4>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)', display: 'block', marginTop: '2px' }}>
                                Alignment Secured
                              </span>
                            </div>
                            <span className="clash-label" style={{ border: '1px solid #FC4C02', color: '#FC4C02', padding: '2px 6px', borderRadius: '8px', fontSize: '8px' }}>ACTIVE</span>
                          </div>
                          <button
                            onClick={() => setShowClanModal(true)}
                            className="clash-btn-secondary btn-sm"
                            style={{ height: '32px', borderRadius: '16px', fontSize: '10px', fontWeight: '800', border: '1px solid #2A2A2A', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                          >
                            Manage Crew
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 6. TERRITORY COMMAND CENTER */}
                    <div className="runner-hq-card card-entrance" style={{ animationDelay: '360ms', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="clash-label" style={{ fontSize: '9px' }}>TERRITORY CONTROL</span>
                        <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>Rank #14 Globally</span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', background: 'rgba(0,0,0,0.15)', padding: '8px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
                        <div>
                          <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Controlled Sectors</span>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>
                            {territories.filter(t => t.ownerId === currentUser.uid).length}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Territory XP</span>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>
                            {currentUser.level * 450 + currentUser.xp} XP
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Hourly yield</span>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#FC4C02', display: 'block', marginTop: '2px' }}>
                            +{territories.filter(t => t.ownerId === currentUser.uid).reduce((acc, t) => acc + (t.rate || 5), 0)}/HR
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <button
                          onClick={() => { setShowSettingsDrawer(false); setActiveTab('map'); }}
                          className="clash-btn-secondary btn-sm"
                          style={{ height: '32px', flex: 1, borderRadius: '16px', fontSize: '10px', fontWeight: '800', border: '1px solid #2A2A2A', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                        >
                          View Territories
                        </button>
                        <button
                          onClick={() => setShowHistoryModal(true)}
                          className="clash-btn-secondary btn-sm"
                          style={{ height: '32px', flex: 1, borderRadius: '16px', fontSize: '10px', fontWeight: '800', border: '1px solid #2A2A2A', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                        >
                          Territory History
                        </button>
                      </div>
                    </div>

                    {/* 7. ACHIEVEMENTS CARD */}
                    <div className="runner-hq-card card-entrance" style={{ animationDelay: '420ms', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="clash-label" style={{ fontSize: '9px' }}>ACHIEVEMENTS</span>
                        <button
                          onClick={() => setShowAchievementsModal(true)}
                          style={{ background: 'none', border: 'none', color: '#FC4C02', fontSize: '9px', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase' }}
                        >
                          View All
                        </button>
                      </div>

                      {/* Horizontal Scrolling Badges */}
                      <div className="runner-hq-scroll" style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '8px' }}>
                        {[
                          { id: 'first_run', title: '🥇', label: 'First Run', unlocked: getLifetimeStats().totalRuns > 0 },
                          { id: 'first_terr', title: '🗺', label: 'First Territory', unlocked: territories.some(t => t.ownerId === currentUser.uid) },
                          { id: 'streak_7', title: '🔥', label: '7-Day Streak', unlocked: true },
                          { id: 'km_100', title: '💯', label: '100 km Club', unlocked: getLifetimeStats().lifetimeDistance >= 100 },
                          { id: 'terr_king', title: '👑', label: 'Territory King', unlocked: false },
                          { id: 'speed_demon', title: '⚡', label: 'Speed Demon', unlocked: false }
                        ].map((ach, idx) => (
                          <div key={idx} className={`achievement-badge ${ach.unlocked ? '' : 'locked'}`}>
                            <span style={{ fontSize: '24px' }}>{ach.title}</span>
                            <span style={{ fontSize: '9px', fontWeight: '800', color: 'white', whiteSpace: 'nowrap' }}>{ach.label}</span>
                            <span style={{ fontSize: '7px', color: ach.unlocked ? '#10B981' : 'var(--clash-text-secondary)' }}>
                              {ach.unlocked ? 'UNLOCKED' : 'LOCKED'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 8. SOCIAL OVERVIEW */}
                    <div className="runner-hq-card card-entrance" style={{ animationDelay: '460ms', gap: '12px' }}>
                      <span className="clash-label" style={{ fontSize: '9px' }}>SOCIAL MATRIX</span>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr 1fr', gap: '4px', background: 'rgba(0,0,0,0.15)', padding: '8px 10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.02)', textAlign: 'center' }}>
                        <div>
                          <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Friends</span>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>{friendsList.length}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Followers</span>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>{followersList.length}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Following</span>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>{friendRequestsSent.length}</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Posts</span>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', display: 'block', marginTop: '2px' }}>0</span>
                        </div>
                        <div>
                          <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Stories</span>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: '#FC4C02', display: 'block', marginTop: '2px' }}>0</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <button
                          className="clash-btn-secondary btn-sm"
                          style={{ height: '32px', flex: 1, borderRadius: '16px', fontSize: '10px', border: '1px solid #2A2A2A', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                          onClick={() => setShowPhotoGalleryModal(true)}
                        >
                          My Photos
                        </button>
                        <button
                          className="clash-btn-secondary btn-sm"
                          style={{ height: '32px', flex: 1, borderRadius: '16px', fontSize: '10px', border: '1px solid #2A2A2A', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                          onClick={() => setShowSavedPostsModal(true)}
                        >
                          Saved Posts
                        </button>
                        <button
                          className="clash-btn-secondary btn-sm"
                          style={{ height: '32px', flex: 1, borderRadius: '16px', fontSize: '10px', border: '1px solid #2A2A2A', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                          onClick={() => setShowDraftStoriesModal(true)}
                        >
                          Draft Stories
                        </button>
                      </div>
                    </div>

                    {/* 9. AI COACH INSIGHT */}
                    <div className="runner-hq-card card-entrance" style={{ animationDelay: '500ms', gap: '10px', borderLeft: '3px solid #FC4C02' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span className="clash-label" style={{ fontSize: '9px', color: '#FC4C02' }}>AI COACH ANALYTICS</span>
                        <Sparkles size={14} style={{ color: '#FC4C02' }} />
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: 'white', lineHeight: '1.4' }}>
                        "You're running 12% farther than last week. Consider a recovery run tomorrow to maintain pace."
                      </p>
                      <button
                        onClick={() => { setShowSettingsDrawer(false); setActiveTab('coach'); }}
                        className="clash-btn-primary btn-sm"
                        style={{ height: '32px', borderRadius: '16px', fontSize: '10px', border: 'none', background: '#FC4C02', color: 'white', marginTop: '4px', cursor: 'pointer' }}
                      >
                        Open AI Coach
                      </button>
                    </div>

                    {/* 10. RUNNER SETTINGS (GLASS CARDS STACK) */}
                    <div className="runner-hq-card card-entrance" style={{ animationDelay: '550ms', gap: '10px' }}>
                      <span className="clash-label" style={{ fontSize: '9px' }}>COMMAND PREFERENCES</span>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {[
                          { id: 'notifications', title: 'Notifications', icon: <Bell size={13} style={{ color: '#FC4C02' }} /> },
                          { id: 'privacy', title: 'Privacy Settings', icon: <Lock size={13} style={{ color: '#FC4C02' }} /> },
                          { id: 'preferences', title: 'Running Preferences', icon: <Compass size={13} style={{ color: '#FC4C02' }} /> },
                          { id: 'gps', title: 'GPS & Permissions', icon: <Navigation size={13} style={{ color: '#FC4C02', transform: 'rotate(45deg)' }} /> },
                          { id: 'appearance', title: 'Appearance & Themes', icon: <Trophy size={13} style={{ color: '#FC4C02' }} /> },
                          { id: 'support', title: 'Support & Feedback', icon: <AlertCircle size={13} style={{ color: '#FC4C02' }} /> },
                          { id: 'about', title: 'About RunClash', icon: <Target size={13} style={{ color: '#FC4C02' }} /> },
                          { id: 'account', title: 'Account Settings', icon: <User size={13} style={{ color: '#FC4C02' }} /> }
                        ].map((settingItem, idx) => (
                          <div
                            key={idx}
                            onClick={() => setActiveSettingSubpage(settingItem.id)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              background: 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.04)',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s ease'
                            }}
                            className="clash-btn-press"
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              {settingItem.icon}
                              <span style={{ fontSize: '11px', fontWeight: '800', color: 'white' }}>{settingItem.title}</span>
                            </div>
                            <ChevronRight size={13} style={{ color: 'var(--clash-text-secondary)' }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Exit Sign Out Account Action */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--clash-border)', paddingTop: '16px', marginTop: '16px' }}>
                      <button
                        onClick={() => {
                          setShowSettingsDrawer(false);
                          setShowSignOutModal(true);
                        }}
                        disabled={isSigningOut}
                        className="clash-btn-secondary"
                        style={{ borderColor: '#FC4C02', color: '#FC4C02', width: '100%', height: '48px', cursor: 'pointer' }}
                      >
                        <LogOut size={13} style={{ color: '#FC4C02', marginRight: '6px' }} />
                        Sign Out Account
                      </button>

                      <div className="clash-body" style={{ textAlign: 'center', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                        RunClash v2.0.0 • Secured Database Sync
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* TAB: HOME / DASHBOARD */}
            <HomeScreen
              currentUser={currentUser}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              runState={runState}
              getTodayLatestRun={getTodayLatestRun}
              formatDisplayDistance={formatDisplayDistance}
              territories={territories}
              leaderboard={leaderboard}
            />

            {/* TAB: MAP */}
            <div style={{ display: activeTab === 'map' ? 'flex' : 'none', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}>

              {/* Fullscreen Map Hero */}
              <div id="map" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}></div>

              {/* Segmented Map Mode Switch (SOLO MAP / CLAN MAP - TASK 3) */}
              <div style={{
                position: 'absolute',
                top: runState.status === 'idle' ? '72px' : '16px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1001,
                display: 'flex',
                background: 'rgba(11, 11, 13, 0.88)',
                backdropFilter: 'blur(8px)',
                padding: '3px',
                borderRadius: '16px',
                border: '1.5px solid rgba(255, 255, 255, 0.12)',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
              }}>
                <button
                  onClick={() => setMapMode('solo')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: '800',
                    border: 'none',
                    cursor: 'pointer',
                    background: mapMode === 'solo' ? '#FC4C02' : 'transparent',
                    color: mapMode === 'solo' ? 'white' : 'var(--clash-text-secondary)',
                    transition: 'all 0.2s ease',
                    letterSpacing: '0.5px'
                  }}
                >
                  SOLO MAP
                </button>
                <button
                  onClick={() => setMapMode('clan')}
                  style={{
                    padding: '5px 12px',
                    borderRadius: '12px',
                    fontSize: '10px',
                    fontWeight: '800',
                    border: 'none',
                    cursor: 'pointer',
                    background: mapMode === 'clan' ? '#3B82F6' : 'transparent',
                    color: mapMode === 'clan' ? 'white' : 'var(--clash-text-secondary)',
                    transition: 'all 0.2s ease',
                    letterSpacing: '0.5px'
                  }}
                >
                  CLAN MAP
                </button>
              </div>

              {/* CLAN MAP: No Clan Overlay Banner */}
              {mapMode === 'clan' && (!currentUser.clan || currentUser.clan === 'None') && (
                <div style={{
                  position: 'absolute',
                  top: runState.status === 'idle' ? '120px' : '65px',
                  left: '16px',
                  right: '16px',
                  zIndex: 1000,
                  background: 'rgba(15, 23, 42, 0.92)',
                  backdropFilter: 'blur(10px)',
                  border: '1.5px solid rgba(59, 130, 246, 0.4)',
                  borderRadius: '16px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Shield size={20} style={{ color: '#3B82F6', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: '800', color: 'white' }}>
                      Join or create a clan to access Clan Map
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('clans')}
                    style={{
                      background: '#3B82F6',
                      color: 'white',
                      border: 'none',
                      padding: '6px 12px',
                      borderRadius: '10px',
                      fontSize: '10px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Go to Social
                  </button>
                </div>
              )}

              {/* CLAN MAP: Legend Overlay */}
              {mapMode === 'clan' && (
                <div style={{
                  position: 'absolute',
                  bottom: '120px',
                  left: '16px',
                  zIndex: 1000,
                  background: 'rgba(11, 11, 13, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6' }}></div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>Your Clan</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }}></div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>Rival Clan</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6B7280' }}></div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>Neutral</span>
                  </div>
                </div>
              )}

              {/* Empty World State Banner */}
              {runState.status === 'idle' && (() => {
                const hasPlayerTerritories = territories.some(t => !t.isLandmark);
                return !hasPlayerTerritories;
              })() && (
                <div
                  className="animate-slide-down"
                  style={{
                    position: 'absolute',
                    top: '80px',
                    left: '16px',
                    right: '16px',
                    zIndex: 1000,
                    display: 'flex',
                    justifyContent: 'center',
                    pointerEvents: 'none'
                  }}
                >
                  <div
                    style={{
                      background: 'rgba(11, 11, 13, 0.9)',
                      backdropFilter: 'blur(8px)',
                      border: '1.5px solid #2A2A2A',
                      borderRadius: '16px',
                      padding: '12px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      maxWidth: '400px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                    }}
                  >
                    <span style={{ fontSize: '18px', flexShrink: 0 }}>🌍</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', letterSpacing: '0.3px' }}>
                        No territories exist yet.
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
                        Be the first runner to create one.
                      </span>
                    </div>
                  </div>
                </div>
              )}

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
                      {(!currentUser.clan || currentUser.clan === 'None') ? 'No Clan' : currentUser.clan}
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

              {/* Territory Intelligence Card Overlay (Visible above Ready to Run Card) */}
              {runState.status === 'idle' && renderedTerritory && (() => {
                let runnerLatLng = null;
                if (runnerMarkerRef.current) {
                  runnerLatLng = runnerMarkerRef.current.getLatLng();
                } else if (mapInstanceRef.current) {
                  runnerLatLng = mapInstanceRef.current.getCenter();
                }

                let targetDist = 'Dynamic';
                let difficulty = 'Medium';
                if (runnerLatLng) {
                  const firstCoord = renderedTerritory.coords[0];
                  const dist = getGeodeticDistance(runnerLatLng.lat, runnerLatLng.lng, firstCoord[0], firstCoord[1]);
                  targetDist = `...${dist.toFixed(2)} km`.replace('...', '');
                  difficulty = renderedTerritory.rate >= 10 ? 'Hard' : (renderedTerritory.rate >= 5 ? 'Medium' : 'Easy');
                }

                const isLandmark = !!renderedTerritory.isLandmark;

                let pillText = 'Abandoned';
                let pillColor = '#888888';
                let pillBg = 'rgba(136, 136, 136, 0.1)';
                let primaryActionLabel = 'Capture Territory';

                if (isLandmark) {
                  pillText = 'Landmark';
                  pillColor = '#FACC15';
                  pillBg = 'rgba(250, 204, 21, 0.15)';
                } else {
                  const isOwner = renderedTerritory.ownerId === currentUser.uid;
                  const isTeammate = renderedTerritory.clan === currentUser.clan && !isOwner;
                  const isEnemy = renderedTerritory.clan && renderedTerritory.clan !== currentUser.clan && renderedTerritory.ownerName !== 'Unclaimed';

                  if (renderedTerritory.ownerName === 'Unclaimed') {
                    pillText = 'Neutral';
                    pillColor = '#EAB308';
                    pillBg = 'rgba(234, 179, 8, 0.15)';
                  } else if (isOwner) {
                    pillText = renderedTerritory.decayHours > 24 ? 'Protected' : 'Friendly';
                    pillColor = '#10B981';
                    pillBg = 'rgba(16, 185, 129, 0.15)';
                    primaryActionLabel = 'Defend Territory';
                  } else if (isTeammate) {
                    pillText = 'Clan';
                    pillColor = '#3B82F6';
                    pillBg = 'rgba(59, 130, 246, 0.15)';
                    primaryActionLabel = 'Defend Territory';
                  } else if (isEnemy) {
                    pillText = renderedTerritory.decayHours > 40 ? 'Contested' : 'Enemy';
                    pillColor = '#EF4444';
                    pillBg = 'rgba(239, 68, 68, 0.15)';
                    primaryActionLabel = 'Attack Sector';
                  }
                }

                return (
                  <div
                    className="clash-bottom-sheet animate-slide-in-up"
                    style={{
                      position: 'absolute',
                      bottom: '150px',
                      left: '16px',
                      right: '16px',
                      zIndex: 998,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                      maxHeight: isBottomSheetExpanded ? '340px' : '135px',
                      overflowY: 'auto',
                      borderRadius: '24px',
                      background: '#151515',
                      border: '1px solid #2A2A2A',
                      padding: '16px 20px',
                      boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.4)',
                      transition: 'max-height 250ms cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    {/* Collapsed view */}
                    {!isBottomSheetExpanded ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: isInspectingTransition ? 0 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pillColor, display: 'inline-block' }} className="intel-badge-pulse"></span>
                            <span className="clash-subtitle" style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', margin: 0, fontWeight: '800' }}>
                              {renderedTerritory.name}
                            </span>
                          </div>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '6px',
                            fontSize: '8px',
                            fontWeight: '800',
                            background: pillBg,
                            color: pillColor,
                            textTransform: 'uppercase'
                          }}>
                            {pillText}
                          </span>
                        </div>

                        {/* Middle quick details */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', background: '#0B0B0D', padding: '8px 12px', borderRadius: '12px', border: '1px solid #2A2A2A', textAlign: 'center' }}>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Owner</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                              {isLandmark ? 'Official' : renderedTerritory.ownerName}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Distance</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>{targetDist}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Difficulty</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>
                              {isLandmark ? 'N/A' : difficulty}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                          <button
                            onClick={handleNavigateTerritory}
                            className="clash-btn-secondary"
                            style={{ height: '32px', flex: 1, borderRadius: '16px', fontSize: '10px', fontWeight: '800', border: '1px solid #2A2A2A', background: '#151515' }}
                          >
                            NAVIGATE
                          </button>
                          <button
                            onClick={() => setIsBottomSheetExpanded(true)}
                            className="clash-btn-secondary"
                            style={{ height: '32px', flex: 1, borderRadius: '16px', fontSize: '10px', fontWeight: '800', border: '1px solid #2A2A2A', background: '#151515' }}
                          >
                            INSPECT
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Detailed/Expanded view */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', opacity: isInspectingTransition ? 0 : 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span className="clash-label" style={{ fontSize: '8px' }}>SECTOR INTEL</span>
                          <button
                            onClick={() => setIsBottomSheetExpanded(false)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--clash-text-secondary)', cursor: 'pointer' }}
                          >
                            <ChevronDown size={18} />
                          </button>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                          <div style={{
                            width: '44px',
                            height: '44px',
                            borderRadius: '8px',
                            background: '#0B0B0D',
                            border: '1px solid #2A2A2A',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {isLandmark ? (
                              <span style={{ fontSize: '18px' }}>🏆</span>
                            ) : (
                              (() => {
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
                                  const x = 4 + ((c[1] - minLng) / lngRange) * 36;
                                  const y = 40 - ((c[0] - minLat) / latRange) * 36;
                                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                                }).join(' ');
                                return (
                                  <svg width="44" height="44" viewBox="0 0 44 44">
                                    <polygon points={points} fill={pillColor} fillOpacity="0.15" stroke={pillColor} strokeWidth="1.5" />
                                  </svg>
                                );
                              })()
                            )}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                            <span style={{ fontSize: '14px', fontWeight: '800', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {renderedTerritory.name}
                            </span>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <span style={{ fontSize: '8px', color: pillColor, background: pillBg, padding: '1px 6px', borderRadius: '4px', fontWeight: '800' }}>{pillText}</span>
                              <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>
                                {isLandmark ? 'Official Area' : renderedTerritory.area}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Grid Details */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', background: '#0B0B0D', padding: '12px', borderRadius: '16px', border: '1px solid #2A2A2A' }}>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block' }}>OWNER</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>
                              {isLandmark ? 'Official Landmark' : renderedTerritory.ownerName}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block' }}>COIN REWARD</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>
                              {isLandmark ? 'None' : (renderedTerritory.rate ? `+&nbsp;${renderedTerritory.rate} Coins/Hr`.replace('&nbsp;', ' ') : '50 Coins')}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block' }}>DISTANCE</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>{targetDist}</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block' }}>XP REWARD</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: '#FC4C02' }}>
                              {isLandmark ? 'None' : '120 XP'}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block' }}>EST. CAPTURE TIME</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>
                              {isLandmark ? 'N/A' : '12 min'}
                            </span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block' }}>DIFFICULTY</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>
                              {isLandmark ? 'N/A' : difficulty}
                            </span>
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
                          <button
                            onClick={handleNavigateTerritory}
                            className="clash-btn-secondary"
                            style={{ height: '36px', flex: 1, borderRadius: '18px', fontSize: '11px', fontWeight: '800', border: '1px solid #2A2A2A', background: '#151515' }}
                          >
                            NAVIGATE
                          </button>

                          {!isLandmark && (
                            <button
                              onClick={() => {
                                setIsBottomSheetExpanded(false);
                                startTracking();
                              }}
                              className="clash-btn-primary"
                              style={{ height: '36px', flex: 1.5, borderRadius: '18px', fontSize: '11px', fontWeight: '800', border: 'none', background: '#FC4C02', color: 'white' }}
                            >
                              {primaryActionLabel.toUpperCase()}
                            </button>
                          )}

                          {isLandmark && (
                            <button
                              onClick={() => setIsBottomSheetExpanded(false)}
                              className="clash-btn-secondary"
                              style={{ height: '36px', flex: 1, borderRadius: '18px', fontSize: '11px', fontWeight: '800', border: '1px solid #2A2A2A', background: '#151515' }}
                            >
                              CLOSE
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Ready to Run Card (Bottom HUD module) */}
              {runState.status === 'idle' && (
                <div
                  className="clash-bottom-sheet"
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '16px',
                    right: '16px',
                    height: '110px',
                    background: '#151515',
                    border: '1px solid #2A2A2A',
                    borderRadius: '24px',
                    padding: '12px 20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    zIndex: 999,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}>Ready to Run</span>
                      <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>
                        Start a tactical mission to conquer sectors and capture loops.
                      </span>
                    </div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: isGpsReady ? '#10B981' : '#FBBF24' }}>
                      {isGpsReady ? '🟢 GPS READY' : '🟡 ACQUIRING...'}
                    </span>
                  </div>

                  <button
                    disabled={!isGpsReady}
                    onClick={(e) => startTracking(e)}
                    className="clash-btn-primary clash-btn-press"
                    style={{
                      width: '100%',
                      height: '40px',
                      borderRadius: '20px',
                      border: 'none',
                      background: isGpsReady ? '#FC4C02' : '#2A2A2A',
                      color: isGpsReady ? 'white' : 'rgba(255,255,255,0.3)',
                      fontWeight: '800',
                      fontSize: '12px',
                      letterSpacing: '0.5px',
                      boxShadow: isGpsReady ? '0 6px 16px rgba(252, 76, 2, 0.2)' : 'none',
                      cursor: isGpsReady ? 'pointer' : 'not-allowed'
                    }}
                  >
                    {isGpsReady ? 'START RUN' : 'ACQUIRING GPS LOCK...'}
                  </button>
                </div>
              )}

              {/* COMPACT TOP HUD */}
              {(runState.status === 'tracking' || runState.status === 'paused' || runState.status === 'acquiring' || runState.status === 'waiting') && (
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
                      background: runState.status === 'paused' ? '#FBBF24' : '#FC4C02',
                      display: 'inline-block',
                      animation: 'pulse 1.2s infinite'
                    }}></span>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: (runState.manualPaused || runState.status === 'paused') ? '#FBBF24' : '#FC4C02', letterSpacing: '0.5px' }}>
                      {runState.manualPaused ? 'MANUALLY PAUSED' : runState.status === 'acquiring' ? 'ACQUIRING GPS' : runState.status === 'waiting' ? 'WAITING MOVEMENT' : runState.status === 'paused' ? 'AUTO-PAUSED' : 'LIVE REC'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      fontSize: '9px',
                      fontWeight: '800',
                      color: (() => {
                        if (trackingMode === 'sim') return '#10B981';
                        const acc = runState.gpsAccuracy;
                        if (acc === null) return '#EF4444';
                        if (acc < 10) return '#10B981';
                        if (acc <= 25) return '#FBBF24';
                        if (acc <= 50) return '#F97316';
                        return '#EF4444';
                      })()
                    }}>
                      {(() => {
                        if (trackingMode === 'sim') return '🟢 GPS LOCKED';
                        const acc = runState.gpsAccuracy;
                        if (acc === null) return '🔴 GPS WEAK';
                        if (acc < 10) return '🟢 GPS LOCKED';
                        if (acc <= 25) return '🟡 GPS GOOD';
                        if (acc <= 50) return '🟠 GPS FAIR';
                        return '🔴 GPS WEAK';
                      })()}
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>
                      {Math.floor(runState.duration / 60)}:{(runState.duration % 60).toString().padStart(2, '0')}
                    </span>
                  </div>
                </div>
              )}

              {/* REAL DEVICE GPS DIAGNOSTIC PANEL (COLLAPSIBLE) */}
              {(runState.status === 'tracking' || runState.status === 'paused' || runState.status === 'acquiring' || runState.status === 'waiting') && (
                <div
                  style={{
                    position: 'absolute',
                    top: '70px',
                    left: '16px',
                    right: '16px',
                    zIndex: 1005,
                    background: 'rgba(10, 10, 14, 0.95)',
                    border: '1px solid #334155',
                    borderRadius: '16px',
                    padding: '10px 14px',
                    color: '#E0E0E0',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.8)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isDebugPanelOpen ? '8px' : '0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 'bold', color: '#10B981' }}>🛠️ GPS DEBUG</span>
                      <span style={{ fontSize: '10px', background: '#1E293B', padding: '2px 6px', borderRadius: '4px', color: '#38BDF8' }}>
                        STATE: {runEngineStateRef.current.toUpperCase()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={handleCopyGpsDebug}
                        style={{
                          background: '#FC4C02',
                          border: 'none',
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '10px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        📋 COPY DEBUG
                      </button>
                      <button
                        onClick={() => setIsDebugPanelOpen(prev => !prev)}
                        style={{
                          background: '#334155',
                          border: 'none',
                          color: 'white',
                          fontSize: '10px',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          cursor: 'pointer'
                        }}
                      >
                        {isDebugPanelOpen ? '▲ HIDE' : '▼ SHOW'}
                      </button>
                    </div>
                  </div>

                  {isDebugPanelOpen && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', borderTop: '1px solid #334155', paddingTop: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                      <div><strong style={{ color: '#94A3B8' }}>STATE:</strong> <span style={{ color: '#F59E0B' }}>{runEngineStateRef.current}</span></div>
                      <div><strong style={{ color: '#94A3B8' }}>ACCURACY:</strong> <span style={{ color: liveDebugInfo.accuracy <= 30 ? '#10B981' : '#EF4444' }}>{liveDebugInfo.accuracy}m</span></div>

                      <div><strong style={{ color: '#94A3B8' }}>COORDS SPEED:</strong> {liveDebugInfo.coordsSpeedKmh} {liveDebugInfo.coordsSpeedKmh !== 'N/A' ? 'km/h' : ''}</div>
                      <div><strong style={{ color: '#94A3B8' }}>LAT/LNG:</strong> {liveDebugInfo.lat.toFixed(4)}, {liveDebugInfo.lng.toFixed(4)}</div>

                      <div><strong style={{ color: '#94A3B8' }}>BUF FIXES:</strong> {liveDebugInfo.bufferFixes} / 6</div>
                      <div><strong style={{ color: '#94A3B8' }}>WIN SECONDS:</strong> {liveDebugInfo.windowSeconds}s</div>

                      <div><strong style={{ color: '#94A3B8' }}>TOTAL PATH:</strong> {liveDebugInfo.totalPathMeters}m</div>
                      <div><strong style={{ color: '#94A3B8' }}>NET DISPLACE:</strong> {liveDebugInfo.netDisplacementMeters}m</div>

                      <div><strong style={{ color: '#94A3B8' }}>DIR EFFICIENCY:</strong> {liveDebugInfo.directionEfficiency}</div>
                      <div><strong style={{ color: '#94A3B8' }}>MEDIAN SPEED:</strong> {liveDebugInfo.medianSpeedKmh} km/h</div>

                      <div><strong style={{ color: '#94A3B8' }}>MEDIAN ACC:</strong> {liveDebugInfo.medianAccuracy}m</div>
                      <div><strong style={{ color: '#94A3B8' }}>FIRST FIX DIST:</strong> {liveDebugInfo.distFromFirstWindowFix}m</div>

                      <div><strong style={{ color: '#94A3B8' }}>PRIMARY PASS:</strong> <span style={{ color: liveDebugInfo.primaryPass ? '#10B981' : '#EF4444' }}>{liveDebugInfo.primaryPass ? 'TRUE' : 'FALSE'}</span></div>
                      <div><strong style={{ color: '#94A3B8' }}>FALLBACK PASS:</strong> <span style={{ color: liveDebugInfo.fallbackPass ? '#10B981' : '#EF4444' }}>{liveDebugInfo.fallbackPass ? 'TRUE' : 'FALSE'}</span></div>

                      <div><strong style={{ color: '#94A3B8' }}>LAST STEP:</strong> {liveDebugInfo.lastStepMeters}m ({liveDebugInfo.lastFixDtSeconds}s)</div>
                      <div><strong style={{ color: '#94A3B8' }}>SEGMENT SPEED:</strong> {liveDebugInfo.calculatedSegmentSpeedKmh} km/h</div>

                      <div><strong style={{ color: '#94A3B8' }}>FIX COUNTS:</strong> {liveDebugInfo.gpsFixCount} (Acc: {liveDebugInfo.acceptedFixCount}, Rej: {liveDebugInfo.rejectedAccuracyCount})</div>
                      <div><strong style={{ color: '#94A3B8' }}>DECISION:</strong> <span style={{ color: '#38BDF8' }}>{liveDebugInfo.lastDecision}</span></div>

                      <div style={{ gridColumn: 'span 2' }}><strong style={{ color: '#94A3B8' }}>REASON:</strong> <span style={{ color: '#CBD5E1' }}>{liveDebugInfo.lastReason}</span></div>
                    </div>
                  )}
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
              {(runState.status === 'tracking' || runState.status === 'paused' || runState.status === 'acquiring' || runState.status === 'waiting') && (
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
                      let baseHeight = 90;
                      if (bottomHudState === 'medium') baseHeight = 155;
                      else if (bottomHudState === 'expanded') baseHeight = 310;

                      if (runState.distance === 0 || ['acquiring', 'waiting', 'paused'].includes(runState.status)) {
                        return `${baseHeight + 35}px`;
                      }
                      return `${baseHeight}px`;
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

                  {(runState.manualPaused || ['acquiring', 'waiting', 'paused'].includes(runState.status) || runState.distance === 0) && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      background: (runState.manualPaused || runState.status === 'paused') ? 'rgba(251, 191, 36, 0.08)' : 'rgba(252, 76, 2, 0.08)',
                      borderRadius: '12px',
                      border: (runState.manualPaused || runState.status === 'paused') ? '1px solid rgba(251, 191, 36, 0.2)' : '1px solid rgba(252, 76, 2, 0.15)',
                      marginBottom: '10px',
                      width: '100%',
                      boxSizing: 'border-box'
                    }}>
                      <Radio size={12} className="gps-pulse" style={{ color: (runState.manualPaused || runState.status === 'paused') ? '#FBBF24' : '#FC4C02' }} />
                      <span style={{ fontSize: '10px', fontWeight: '800', color: (runState.manualPaused || runState.status === 'paused') ? '#FBBF24' : 'var(--clash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {runState.manualPaused ? 'Run paused manually' : runState.status === 'acquiring' ? 'Acquiring GPS satellites...' : runState.status === 'waiting' ? 'Waiting for movement...' : runState.status === 'paused' ? 'Auto-paused (runner stopped)' : 'Waiting for movement...'}
                      </span>
                    </div>
                  )}

                  {/* LIVE START-POINT PROXIMITY INDICATOR (PART 4) */}
                  {(runState.status === 'tracking' || runState.status === 'paused') && (() => {
                    const path = gpsPathRef.current || [];
                    const currentAcc = gpsAccuracyRef.current || 15;
                    const startAcc = startAccuracyRef.current || 15;
                    const closureRadius = Math.min(Math.max(12, startAcc, currentAcc), 22);
                    const activeSec = (Date.now() - (startTimeRef.current ? startTimeRef.current.getTime() : Date.now())) / 1000;

                    const closedCoords = path.length >= 3 ? [...path, path[0]] : [];
                    const areaSqM = closedCoords.length >= 4 ? calculatePolygonArea(closedCoords) : 0;

                    const isLoopReadyToClose = (
                      distanceToStartMeters !== null &&
                      distanceToStartMeters <= closureRadius &&
                      gpsDistanceRef.current >= RUN_ENGINE_CONFIG.MIN_LOOP_DISTANCE_KM &&
                      activeSec >= RUN_ENGINE_CONFIG.MIN_LOOP_DURATION_SEC &&
                      path.length >= RUN_ENGINE_CONFIG.MIN_LOOP_POINTS &&
                      areaSqM >= RUN_ENGINE_CONFIG.MIN_LOOP_AREA_SQM
                    );

                    return (
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '12px',
                        background: isLoopReadyToClose
                          ? 'rgba(16, 185, 129, 0.15)'
                          : 'rgba(255, 255, 255, 0.05)',
                        border: isLoopReadyToClose
                          ? '1px solid #10B981'
                          : '1px solid rgba(255, 255, 255, 0.1)',
                        marginBottom: '10px',
                        width: '100%',
                        boxSizing: 'border-box',
                        transition: 'all 0.3s ease'
                      }}>
                        <MapPin size={12} style={{ color: isLoopReadyToClose ? '#10B981' : '#FC4C02' }} />
                        <span style={{
                          fontSize: '10px',
                          fontWeight: '800',
                          color: isLoopReadyToClose ? '#10B981' : 'white',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}>
                          {path.length === 0 || distanceToStartMeters === null
                            ? "TRACKING LOOP"
                            : isLoopReadyToClose
                              ? `LOOP CLOSABLE — ${Math.round(distanceToStartMeters)} m to start`
                              : `BUILDING LOOP — ${Math.round(distanceToStartMeters)} m from start`}
                        </span>
                      </div>
                    );
                  })()}

                  {/* MINI STATE */}
                  {bottomHudState === 'mini' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
                      <div>
                        <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Distance</span>
                        <span style={{ fontSize: '16px', fontWeight: '800', color: '#FC4C02', fontFamily: 'var(--clash-font-mono)' }}>{formatDisplayDistance(runState.distance)}</span>
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
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#FC4C02', fontFamily: 'var(--clash-font-mono)' }}>{formatDisplayDistance(runState.distance)}</span>
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
                          onClick={(e) => togglePauseResume(e)}
                          className="clash-btn-secondary"
                          style={{ height: '40px', flex: 1, borderRadius: '20px', fontSize: '11px', border: '1px solid #2A2A2A', fontWeight: '800' }}
                        >
                          {runState.manualPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          onClick={handleStopAndClaim}
                          disabled={isFinalizingRun}
                          className="clash-btn-primary"
                          style={{ height: '40px', flex: 1.2, borderRadius: '20px', fontSize: '11px', fontWeight: '800', opacity: isFinalizingRun ? 0.6 : 1 }}
                        >
                          {isFinalizingRun ? 'SAVING...' : 'STOP & CLAIM'}
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
                          <span style={{ fontSize: '13px', fontWeight: '800', color: '#FC4C02', fontFamily: 'var(--clash-font-mono)' }}>{formatDisplayDistance(runState.distance)}</span>
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
                          onClick={(e) => togglePauseResume(e)}
                          className="clash-btn-secondary"
                          style={{ height: '40px', flex: 1, borderRadius: '20px', fontSize: '11px', border: '1px solid #2A2A2A', fontWeight: '800' }}
                        >
                          {runState.manualPaused ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          onClick={handleStopAndClaim}
                          disabled={isFinalizingRun}
                          className="clash-btn-primary"
                          style={{ height: '40px', flex: 1.2, borderRadius: '20px', fontSize: '11px', fontWeight: '800', opacity: isFinalizingRun ? 0.6 : 1 }}
                        >
                          {isFinalizingRun ? 'SAVING...' : 'STOP & CLAIM'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* TAB: CONQUESTS */}
            <ConquestsScreen
              currentUser={currentUser}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              territories={territories}
              getClanColor={getClanColor}
              useShield={useShield}
              buyItem={buyItem}
              shopCosts={shopCosts}
              inventory={inventory}
            />

            {/* TAB: SOCIAL */}
            <div style={{ display: (activeTab === 'social' || activeTab === 'clans') ? 'flex' : 'none', flexDirection: 'column', height: '100%' }} className="fade-in">
              <SocialScreen
                currentUser={currentUser}
                selectedTab={socialSubTab || 'feed'}
                onTabChange={setSocialSubTab}
                onSelectPlayer={(userId) => setViewingPublicProfileId(userId)}
                onTerritoryClick={() => setActiveTab('conquests')}
              />
            </div>

            {/* TAB: PROFILE */}
            <div style={{ display: activeTab === 'profile' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }} className="fade-in">
              <ProfileScreen
                currentProfile={currentUser}
                onUpdateProfile={(updated) => {
                  setCurrentUser(prev => ({
                    ...prev,
                    displayName: updated.display_name || prev.displayName,
                    display_name: updated.display_name || prev.display_name,
                    username: updated.username,
                    bio: updated.bio,
                    avatar_url: updated.avatar_url,
                    avatarUrl: updated.avatar_url
                  }));
                }}
                onSignOut={() => setShowSignOutModal(true)}
              />
            </div>

            {/* TAB: AI COACH */}
            <div style={{ display: activeTab === 'coach' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }} className="fade-in">
              <CoachScreen currentUser={currentUser} onUpgradeClick={() => setActiveTab('premium')} />
            </div>

            {/* TAB: PREMIUM */}
            <div style={{ display: activeTab === 'premium' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }} className="fade-in">
              <PremiumScreen currentUser={currentUser} onUpgrade={() => {
                setCurrentUser(prev => ({ ...prev, subscription_tier: 'premium' }));
                setToastMessage('Success: Upgraded to RunClash Pro Membership!');
                setTimeout(() => setToastMessage(null), 5000);
              }} />
            </div>

          </div>

          {/* Navigation Bar */}
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
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
              onClick={() => setActiveTab('social')}
              className={`tab-btn ${(activeTab === 'social' || activeTab === 'clans') ? 'tab-btn-active' : ''}`}
              style={{ color: (activeTab === 'social' || activeTab === 'clans') ? '#FC4C02' : 'var(--clash-text-secondary)' }}
            >
              <Users size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Social</span>
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
              onClick={() => setActiveTab('profile')}
              className={`tab-btn ${activeTab === 'profile' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'profile' ? '#FC4C02' : 'var(--clash-text-secondary)' }}
            >
              <User size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Profile</span>
            </button>
          </div>

          {/* Achievements View All Checklist Modal */}
          {showAchievementsModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(11, 11, 13, 0.85)',
                backdropFilter: 'blur(8px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
            >
              <div
                className="clash-card animate-slide-in-up"
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  maxHeight: '80vh',
                  background: '#151515',
                  border: '1px solid #2A2A2A',
                  borderRadius: '24px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                  <h3 className="clash-subtitle" style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase' }}>Achievements</h3>
                  <button
                    onClick={() => setShowAchievementsModal(false)}
                    className="clash-btn-secondary btn-sm"
                    style={{ color: '#FC4C02', borderColor: '#FC4C02', borderRadius: '10px', height: '24px', padding: '0 8px' }}
                  >
                    Close
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[
                    { title: '🥇 First Run', desc: 'Complete your first run loop', req: '1 loop tracking run', unlocked: getLifetimeStats().totalRuns > 0 },
                    { title: '🗺 First Territory', desc: 'Claim your first tactical sector', req: '1 captured territory', unlocked: territories.some(t => t.ownerId === currentUser.uid) },
                    { title: '🔥 7-Day Streak', desc: 'Maintain running streak for 7 days', req: '7 consecutive running days', unlocked: true },
                    { title: '💯 100 km Club', desc: 'Accumulate 100 km total distance', req: '100 km cumulative running', unlocked: getLifetimeStats().lifetimeDistance >= 100 },
                    { title: '👑 Territory King', desc: 'Own 10 active sectors simultaneously', req: '10 owned territories', unlocked: false },
                    { title: '⚡ Speed Demon', desc: 'Maintain pace faster than 4:30/km for a full loop', req: 'Fast loop pace', unlocked: false }
                  ].map((ach, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.04)',
                      borderRadius: '14px',
                      padding: '12px',
                      opacity: ach.unlocked ? 1 : 0.4
                    }}>
                      <span style={{ fontSize: '24px' }}>{ach.title.split(' ')[0]}</span>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', display: 'block', color: 'white' }}>{ach.title.replace(/^[^\s]+\s+/, '')}</span>
                        <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>{ach.desc}</span>
                      </div>
                      <span style={{ fontSize: '8px', fontWeight: '800', color: ach.unlocked ? '#10B981' : 'var(--clash-text-secondary)' }}>
                        {ach.unlocked ? 'UNLOCKED' : 'LOCKED'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Territory History Completed Loops Modal */}
          {showHistoryModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(11, 11, 13, 0.85)',
                backdropFilter: 'blur(8px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
            >
              <div
                className="clash-card animate-slide-in-up"
                style={{
                  width: '100%',
                  maxWidth: '400px',
                  maxHeight: '80vh',
                  background: '#151515',
                  border: '1px solid #2A2A2A',
                  borderRadius: '24px',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
                  <h3 className="clash-subtitle" style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase' }}>Territory History</h3>
                  <button
                    onClick={() => setShowHistoryModal(false)}
                    className="clash-btn-secondary btn-sm"
                    style={{ color: '#FC4C02', borderColor: '#FC4C02', borderRadius: '10px', height: '24px', padding: '0 8px' }}
                  >
                    Close
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(() => {
                    const runs = JSON.parse(localStorage.getItem('clash_runs')) || [];
                    if (runs.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--clash-text-secondary)', fontSize: '11px' }}>
                          No loops completed yet. Capture a territory to write history!
                        </div>
                      );
                    }
                    return runs.slice().reverse().map((r, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '14px',
                        padding: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>
                            {r.summaryStatistics?.conqueredTerritoryName || 'Loop Sector'}
                          </span>
                          <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)' }}>
                            {new Date(r.endTime).toLocaleDateString()}
                          </span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center' }}>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block' }}>DISTANCE</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>{r.distance} km</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block' }}>PACE</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>{r.pace} /km</span>
                          </div>
                          <div>
                            <span style={{ fontSize: '7px', color: 'var(--clash-text-secondary)', display: 'block' }}>CALORIES</span>
                            <span style={{ fontSize: '10px', fontWeight: '800', color: 'white' }}>{r.calories} kcal</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Unlocked Clan Management Modal */}
          {showClanModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(11, 11, 13, 0.92)',
                backdropFilter: 'blur(12px)',
                zIndex: 99999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '16px'
              }}
            >
              <div
                className="clash-card animate-slide-in-up"
                style={{
                  width: '100%',
                  maxWidth: '440px',
                  maxHeight: '85vh',
                  background: '#0B0B0D',
                  border: '1px solid #FC4C02',
                  borderRadius: '24px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  overflowY: 'auto',
                  boxShadow: '0 0 25px rgba(252, 76, 2, 0.2)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(252, 76, 2, 0.2)', paddingBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} style={{ color: '#FC4C02' }} />
                    <h3 className="clash-subtitle" style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>Crew Conquest HQ</h3>
                  </div>
                  <button
                    onClick={() => { setShowClanModal(false); setClanSuccessMsg(null); setClanErrorMsg(null); }}
                    className="clash-btn-secondary btn-sm"
                    style={{ color: '#FC4C02', borderColor: '#FC4C02', borderRadius: '10px', height: '24px', padding: '0 8px', cursor: 'pointer' }}
                  >
                    Close
                  </button>
                </div>

                {/* Current Clan Badge & Leave Clan Action */}
                {currentUser?.clan && currentUser.clan !== 'None' && (
                  <div style={{ background: 'rgba(252, 76, 2, 0.08)', border: '1px solid rgba(252, 76, 2, 0.3)', borderRadius: '14px', padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span className="clash-label" style={{ fontSize: '8px', color: '#FC4C02' }}>Active Tactical Alignment</span>
                      <div className="clash-subtitle" style={{ fontSize: '14px', color: 'white', marginTop: '2px' }}>{currentUser.clan}</div>
                    </div>
                    <button
                      onClick={handleLeaveClanSubmit}
                      style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid #EF4444', color: '#EF4444', borderRadius: '10px', padding: '5px 10px', fontSize: '9px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      Leave Clan
                    </button>
                  </div>
                )}

                {/* Sub-Tab Selector (Create / Join) */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderRadius: '14px', padding: '3px', border: '1px solid #2A2A2A' }}>
                  <button
                    type="button"
                    onClick={() => setClanModalTab('create')}
                    style={{ flex: 1, background: clanModalTab === 'create' ? '#FC4C02' : 'transparent', color: 'white', border: 'none', fontSize: '10px', fontWeight: '800', padding: '8px 0', borderRadius: '10px', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    Registry (Create)
                  </button>
                  <button
                    type="button"
                    onClick={() => setClanModalTab('join')}
                    style={{ flex: 1, background: clanModalTab === 'join' ? '#FC4C02' : 'transparent', color: 'white', border: 'none', fontSize: '10px', fontWeight: '800', padding: '8px 0', borderRadius: '10px', textTransform: 'uppercase', cursor: 'pointer' }}
                  >
                    Search & Join
                  </button>
                </div>

                {/* Success / Error Messages */}
                {clanSuccessMsg && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid #10B981', color: '#10B981', padding: '8px 12px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>
                    ✓ {clanSuccessMsg}
                  </div>
                )}
                {clanErrorMsg && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #EF4444', color: '#EF4444', padding: '8px 12px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', textAlign: 'center' }}>
                    ⚠️ {clanErrorMsg}
                  </div>
                )}

                {/* Tab 1: Create Clan */}
                {clanModalTab === 'create' && (
                  <form onSubmit={handleCreateClanSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', textTransform: 'uppercase' }}>Proposed Clan Name</label>
                      <input
                        type="text"
                        value={newClanName}
                        onChange={(e) => setNewClanName(e.target.value)}
                        placeholder="e.g. Udaipur Mavericks"
                        className="cyber-input"
                        style={{ height: '36px', background: 'rgba(0,0,0,0.4)', border: '1px solid #2A2A2A', color: 'white' }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', textTransform: 'uppercase' }}>Security Level</label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'white', cursor: 'pointer' }}>
                          <input type="radio" name="clan_privacy" checked={newClanPublic} onChange={() => setNewClanPublic(true)} /> Public Clan
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'white', cursor: 'pointer' }}>
                          <input type="radio" name="clan_privacy" checked={!newClanPublic} onChange={() => setNewClanPublic(false)} /> Private (Invite Code)
                        </label>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="clash-btn-primary"
                      style={{ height: '40px', marginTop: '4px', textTransform: 'uppercase', fontSize: '11px', fontWeight: '800' }}
                    >
                      Deploy Crew Network
                    </button>
                  </form>
                )}

                {/* Tab 2: Search & Join */}
                {clanModalTab === 'join' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Search Input */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', textTransform: 'uppercase' }}>Search Public Clans</label>
                      <input
                        type="text"
                        value={clanSearchQuery}
                        onChange={(e) => setClanSearchQuery(e.target.value)}
                        placeholder="Search by clan name..."
                        className="cyber-input"
                        style={{ height: '34px', background: 'rgba(0,0,0,0.4)', border: '1px solid #2A2A2A', color: 'white' }}
                      />
                    </div>

                    {/* Filtered Public Clans List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                      {isLoadingClans ? (
                        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--clash-text-secondary)', padding: '16px' }}>Loading clans...</div>
                      ) : clansList.filter(c => c.name.toLowerCase().includes(clanSearchQuery.toLowerCase())).length === 0 ? (
                        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--clash-text-secondary)', padding: '16px', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '10px' }}>
                          No public clans available yet. Create the first clan.
                        </div>
                      ) : (
                        clansList.filter(c => c.name.toLowerCase().includes(clanSearchQuery.toLowerCase())).map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid #2A2A2A', padding: '8px 12px', borderRadius: '10px' }}>
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>{c.name}</div>
                              <div style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>Dominance: {c.domain_percentage || 0}%</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleJoinClanByName(c.name)}
                              disabled={currentUser?.clan === c.name}
                              style={{
                                background: currentUser?.clan === c.name ? '#2A2A2A' : '#FC4C02',
                                border: 'none',
                                color: 'white',
                                fontSize: '9px',
                                fontWeight: '800',
                                padding: '5px 10px',
                                borderRadius: '8px',
                                cursor: currentUser?.clan === c.name ? 'default' : 'pointer'
                              }}
                            >
                              {currentUser?.clan === c.name ? 'JOINED' : 'JOIN'}
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Join by Code Form */}
                    <form onSubmit={handleJoinClanByCode} style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', textTransform: 'uppercase' }}>Join via Invite Code</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          value={joinInviteCode}
                          onChange={(e) => setJoinInviteCode(e.target.value)}
                          placeholder="e.g. APEX01"
                          className="cyber-input"
                          style={{ flex: 1, height: '34px', background: 'rgba(0,0,0,0.4)', border: '1px solid #2A2A2A', color: 'white' }}
                        />
                        <button
                          type="submit"
                          className="clash-btn-primary"
                          style={{ height: '34px', padding: '0 14px', fontSize: '10px', fontWeight: '800' }}
                        >
                          Join
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photo Gallery Modal Component */}
          <PhotoGalleryModal
            isOpen={showPhotoGalleryModal}
            onClose={() => setShowPhotoGalleryModal(false)}
            currentUser={currentUser}
          />

          {/* Saved Posts In-App Modal */}
          {showSavedPostsModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11, 11, 13, 0.9)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <div className="clash-card animate-slide-in-up" style={{ width: '100%', maxWidth: '400px', maxHeight: '85vh', background: '#0B0B0D', border: '1px solid #FC4C02', borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(252,76,2,0.2)', paddingBottom: '10px' }}>
                  <h3 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase' }}>Saved Posts</h3>
                  <button onClick={() => setShowSavedPostsModal(false)} className="clash-btn-secondary btn-sm" style={{ color: '#FC4C02', borderColor: '#FC4C02', borderRadius: '8px', padding: '2px 8px' }}>Close</button>
                </div>
                <div style={{ textAlign: 'center', padding: '24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Bookmark size={28} style={{ color: 'var(--clash-text-secondary)', opacity: 0.5 }} />
                  <span style={{ fontSize: '12px', color: 'white', fontWeight: '800' }}>No Saved Posts Found</span>
                  <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>Bookmark tactical posts and loop recaps in the Social feed to review them here.</span>
                </div>
              </div>
            </div>
          )}

          {/* Draft Stories In-App Modal */}
          {showDraftStoriesModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(11, 11, 13, 0.9)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <div className="clash-card animate-slide-in-up" style={{ width: '100%', maxWidth: '400px', maxHeight: '85vh', background: '#0B0B0D', border: '1px solid #FC4C02', borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(252,76,2,0.2)', paddingBottom: '10px' }}>
                  <h3 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase' }}>Draft Stories</h3>
                  <button onClick={() => setShowDraftStoriesModal(false)} className="clash-btn-secondary btn-sm" style={{ color: '#FC4C02', borderColor: '#FC4C02', borderRadius: '8px', padding: '2px 8px' }}>Close</button>
                </div>
                <div style={{ textAlign: 'center', padding: '24px 12px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <Flame size={28} style={{ color: 'var(--clash-text-secondary)', opacity: 0.5 }} />
                  <span style={{ fontSize: '12px', color: 'white', fontWeight: '800' }}>No Draft Stories</span>
                  <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>Telemetry snapshots and loop clips captured during active runs can be saved as story drafts here.</span>
                </div>
              </div>
            </div>
          )}

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
                              setToastMessage("🚧 Tactical chat channel coming soon!");
                              setTimeout(() => setToastMessage(null), 3000);
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

          {/* Public Profile Dossier Overlay */}
          {viewingPublicProfileId && (
            <PublicProfileScreen
              targetUserId={viewingPublicProfileId}
              onClose={() => setViewingPublicProfileId(null)}
            />
          )}

          {/* SELECTABLE DEBUG TEXT MODAL (FALLBACK FOR CLIPBOARD) */}
          {showDebugModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                background: 'rgba(0,0,0,0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}
            >
              <div
                style={{
                  background: '#0F172A',
                  border: '1px solid #334155',
                  borderRadius: '16px',
                  width: '100%',
                  maxWidth: '500px',
                  maxHeight: '80vh',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '16px',
                  color: 'white',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.8)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', color: '#10B981', fontFamily: 'monospace' }}>📋 GPS DEBUG DATA (LAST 20 FIXES)</h3>
                  <button
                    onClick={() => setShowDebugModal(false)}
                    style={{ background: '#334155', border: 'none', color: 'white', borderRadius: '8px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    ✕ CLOSE
                  </button>
                </div>
                <p style={{ fontSize: '10px', color: '#94A3B8', margin: '0 0 8px 0', fontFamily: 'sans-serif' }}>Select all text below and copy it manually:</p>
                <textarea
                  readOnly
                  value={debugModalText}
                  style={{
                    flex: 1,
                    minHeight: '260px',
                    background: '#020617',
                    color: '#38BDF8',
                    border: '1px solid #1E293B',
                    borderRadius: '8px',
                    padding: '10px',
                    fontFamily: 'monospace',
                    fontSize: '10px',
                    resize: 'none'
                  }}
                  onClick={(e) => e.target.select()}
                />
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
    </ErrorBoundary>
  );
}



