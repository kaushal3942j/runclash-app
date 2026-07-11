import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  MapPin, Play, Square, Shield, Zap, Award, Users, Compass, 
  Coins, MessageSquare, Send, Sparkles, AlertCircle, RefreshCw, Trophy, Target,
  Lock, Mail, User, ShieldCheck, LogOut, CheckCircle, Navigation, Radio, Settings, Home,
  ChevronUp, ChevronDown
} from 'lucide-react';
import { 
  isFirebaseActive, subscribeToAuth, registerUser, loginUser, loginGuest, logout,
  syncUserStats, subscribeToTerritories, saveNewTerritory, updateTerritory, getLeaderboard, reportError
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

  // GPS Mode Toggles
  const [trackingMode, setTrackingMode] = useState('sim'); // 'sim' (Developer Mode) or 'gps' (Real Run)
  const [simulationRouteKey, setSimulationRouteKey] = useState('lake');
  
  // Tracking Run State
  const [runState, setRunState] = useState({
    status: 'idle', // 'idle', 'tracking', 'paused', 'finished'
    path: [],
    distance: 0,
    duration: 0,
    pace: '--:--',
    gpsAccuracy: null
  });

  const [showSettingsDrawer, setShowSettingsDrawer] = useState(false);
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
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
      
      let polyColor = '#888888'; // Neutral
      if (terr.ownerName === 'Unclaimed') {
        polyColor = '#f1c40f'; // Yellow
      } else if (isOwner) {
        polyColor = '#FC4C02'; // Orange
      } else if (isTeammate) {
        polyColor = '#3498db'; // Blue
      } else if (isEnemy) {
        polyColor = '#e74c3c'; // Red
      }

      const poly = L.polygon(terr.coords, {
        color: polyColor,
        fillColor: polyColor,
        fillOpacity: 0.08,
        weight: 2
      }).addTo(mapInstanceRef.current);

      poly.bindPopup(`
        <div style="font-family: 'Outfit', sans-serif; min-width: 140px;">
          <h4 style="margin: 0 0 4px; color: ${polyColor}; font-weight: 700;">${terr.name}</h4>
          <p style="margin: 0; font-size: 11px;"><b>Owner:</b> ${terr.ownerName}</p>
          <p style="margin: 0; font-size: 11px;"><b>Clan:</b> ${terr.clan}</p>
          <p style="margin: 0; font-size: 11px;"><b>Enclosed Area:</b> ${terr.area}</p>
          ${terr.decayHours > 0 ? `<p style="margin: 0; font-size: 11px;"><b>Shield:</b> ${terr.decayHours}h remaining</p>` : ''}
        </div>
      `);

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

  const startTracking = () => {
    if (runState.status !== 'idle') return;

    console.log(`[TRACKING]\ntrackingMode: ${trackingMode}\nrunState: tracking\nwatchId: null`);
    console.log(`[GPS Engine] Start Tracking invoked. Active trackingMode: "${trackingMode}"`);
    addLog(`GPS: Calibrating tracking device in [${trackingMode === 'gps' ? 'Real GPS' : 'Developer Simulator'}] mode...`);
    requestWakeLock();

    // Safety check: verify no simulator interval exists while trackingMode === 'gps'
    if (trackingMode === 'gps' && simIntervalRef.current) {
      console.warn(`[GPS Engine] Warning: active simulator interval ${simIntervalRef.current} detected in Real GPS mode. Force clearing.`);
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

    setRunState({
      status: 'tracking',
      path: [],
      distance: 0,
      duration: 0,
      pace: '--:--',
      gpsAccuracy: null
    });

    // Start Clock timer
    timerIntervalRef.current = setInterval(() => {
      setRunState(prev => {
        if (prev.status === 'paused') return prev;
        const newDuration = prev.duration + 1;
        const paceStr = calculatePaceStr(newDuration, prev.distance);
        return {
          ...prev,
          duration: newDuration,
          pace: paceStr
        };
      });
    }, 1000);

    // Initial Path Polyline
    if (mapInstanceRef.current) {
      polylineRef.current = L.polyline([], {
        color: '#FC4C02',
        weight: 4
      }).addTo(mapInstanceRef.current);

      const runnerIcon = L.divIcon({
        className: 'custom-runner-icon',
        html: `<div style="background-color: #FC4C02; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
        iconSize: [16, 16]
      });
      runnerMarkerRef.current = L.marker([24.5950, 73.6800], { icon: runnerIcon }).addTo(mapInstanceRef.current);
    }

    if (trackingMode === 'gps') {
      // REAL GEOLOCATION TRACKING
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser!");
        stopTracking();
        return;
      }

      addLog("GPS: Geolocation watch active. Requesting high accuracy position...");
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (runStateRef.current.status === 'paused') return;

          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;
          const timestamp = position.timestamp || Date.now();

          console.log(`[GPS]\nlatitude: ${lat}\nlongitude: ${lng}\naccuracy: ${accuracy}m\ntimestamp: ${timestamp}`);
          console.log(`[GPS Engine] Coord received from navigator.geolocation.watchPosition(). Lat: ${lat}, Lng: ${lng}, trackingMode: "${trackingMode}", timestamp: ${timestamp}`);

          setRunState(prev => {
            if (prev.status === 'paused') return prev;

            // Filter poor accuracy coordinates (>25 meters accuracy discarded)
            if (accuracy > 25) {
              addLog(`GPS: Poor signal accuracy (${Math.round(accuracy)}m). Discarding point.`);
              return { ...prev, gpsAccuracy: accuracy };
            }

            const newPoint = [lat, lng];
            const nowTime = Date.now();
            
            // Calculate distance
            let incrementalDist = 0;
            if (prev.path.length > 0) {
              const lastPoint = prev.path[prev.path.length - 1];
              incrementalDist = getGeodeticDistance(lastPoint[0], lastPoint[1], lat, lng);
            }

            // GPS Drift Filtering: if displacement is less than 2 meters (0.002 km), ignore it
            if (prev.path.length > 0 && incrementalDist < 0.002) {
              return { ...prev, gpsAccuracy: accuracy };
            }

            // Anti-Cheat: Analyze speed & acceleration between successive ticks
            let instantSpeed = 0;
            if (lastPointTimeRef.current !== null && prev.path.length > 0) {
              const dt = (nowTime - lastPointTimeRef.current) / 1000; // seconds
              if (dt > 0.1) {
                const distMeters = incrementalDist * 1000;
                instantSpeed = distMeters / dt; // m/s
                const acceleration = Math.abs(instantSpeed - lastSpeedRef.current) / dt; // m/s²

                // 1. Filter instant GPS spikes (> 12 m/s) - discard point to keep path clean
                if (instantSpeed > 12.0) {
                  cheatMetricsRef.current.speedSpikes += 1;
                  addLog(`GPS: Discarding GPS speed spike (${instantSpeed.toFixed(1)} m/s).`);
                  return { ...prev, gpsAccuracy: accuracy };
                }

                // 2. Track repeated jumps (> 6 m/s)
                if (instantSpeed > 6.0) {
                  cheatMetricsRef.current.repeatedJumps += 1;
                }

                // 3. Track unrealistic acceleration (> 4 m/s²)
                if (acceleration > 4.0) {
                  cheatMetricsRef.current.unrealisticAcceleration += 1;
                }

                lastSpeedRef.current = instantSpeed;
              }
            }

            lastPointTimeRef.current = nowTime;

            const updatedPath = [...prev.path, newPoint];
            const updatedDistance = parseFloat((prev.distance + incrementalDist).toFixed(3));

            // Log pace telemetry
            const distanceMeters = updatedDistance * 1000;
            const elapsedSeconds = prev.duration;
            const currentPace = calculatePaceStr(elapsedSeconds, updatedDistance);
            console.log(`[PACE]\ndistanceMeters: ${distanceMeters.toFixed(1)}\nelapsedSeconds: ${elapsedSeconds}\nspeed: ${instantSpeed.toFixed(2)} m/s\npace: ${currentPace}`);

            // Update Map visual
            if (polylineRef.current) polylineRef.current.setLatLngs(updatedPath);
            if (runnerMarkerRef.current) runnerMarkerRef.current.setLatLng(newPoint);
            if (mapInstanceRef.current && mapAutoFollowRef.current) mapInstanceRef.current.panTo(newPoint);

            // Real self-intersection check
            if (updatedPath.length >= 5 && updatedDistance > 0.05) {
              const intersectIdx = checkPathSelfIntersection(updatedPath);
              if (intersectIdx !== null) {
                // Closed loop detected! Trigger completion.
                setTimeout(() => {
                  finishRealRun(updatedPath.slice(intersectIdx));
                }, 200);
              }
            }

            return {
              ...prev,
              path: updatedPath,
              distance: updatedDistance,
              gpsAccuracy: accuracy
            };
          });
        },
        (error) => {
          console.error("GPS Error", error);
          addLog(`GPS Warning: ${error.message} (retrying)`);
        },
        { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
      );
      watchIdRef.current = watchId;
      console.log(`[TRACKING]\ntrackingMode: ${trackingMode}\nrunState: tracking\nwatchId: ${watchId}`);
    } else {
      // PRELOADED DEVELOPER SIMULATOR
      const route = SIMULATION_ROUTES[simulationRouteKey];
      addLog(`GPS Sim: Starting developer walk on loop: ${route.name}`);
      let idx = 0;

      const intervalId = setInterval(() => {
        if (runStateRef.current.status === 'paused') return;

        if (idx >= route.points.length) {
          console.log(`[GPS Engine] Simulator interval cleared (finished). Interval ID: ${simIntervalRef.current}`);
          addLog(`GPS: Simulator interval cleared (finished).`);
          clearInterval(simIntervalRef.current);
          simIntervalRef.current = null;
          finishRealRun(route.points);
          return;
        }

        const point = route.points[idx];
        const timestamp = Date.now();
        console.log(`[GPS]\nlatitude: ${point[0]}\nlongitude: ${point[1]}\naccuracy: 0m (simulated)\ntimestamp: ${timestamp}`);
        console.log(`[GPS Engine] Coord received from Simulator interval. Lat: ${point[0]}, Lng: ${point[1]}, trackingMode: "${trackingMode}", timestamp: ${timestamp}`);

        setRunState(prev => {
          if (prev.status === 'paused') return prev;
          const updatedPath = [...prev.path, point];
          let stepDist = 0;
          if (prev.path.length > 0) {
            const lastPoint = prev.path[prev.path.length - 1];
            stepDist = getGeodeticDistance(lastPoint[0], lastPoint[1], point[0], point[1]);
          }
          const updatedDistance = parseFloat((prev.distance + stepDist).toFixed(2));

          // Log pace telemetry
          const distanceMeters = updatedDistance * 1000;
          const elapsedSeconds = prev.duration;
          const currentSpeed = (stepDist * 1000) / 1.5;
          const currentPace = calculatePaceStr(elapsedSeconds, updatedDistance);
          console.log(`[PACE]\ndistanceMeters: ${distanceMeters.toFixed(1)}\nelapsedSeconds: ${elapsedSeconds}\nspeed: ${currentSpeed.toFixed(2)} m/s\npace: ${currentPace}`);

          if (polylineRef.current) polylineRef.current.setLatLngs(updatedPath);
          if (runnerMarkerRef.current) runnerMarkerRef.current.setLatLng(point);
          if (mapInstanceRef.current && mapAutoFollowRef.current) mapInstanceRef.current.panTo(point);

          return {
            ...prev,
            path: updatedPath,
            distance: updatedDistance
          };
        });

        idx++;
      }, 1500);

      simIntervalRef.current = intervalId;
      console.log(`[GPS Engine] Simulator interval created. Interval ID: ${intervalId}, trackingMode: "${trackingMode}"`);
      addLog(`GPS: Simulator interval created with ID: ${intervalId}`);
    }
  };

  const stopTracking = (reason = "Explicit User Request") => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    if (simIntervalRef.current) {
      console.log(`[GPS Engine] Simulator interval cleared (stop). Interval ID: ${simIntervalRef.current}`);
      addLog("GPS: Simulator interval cleared.");
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
    clearInterval(timerIntervalRef.current);
    releaseWakeLock();

    console.log(`[TRACKING]\ntrackingMode: ${trackingMode}\nrunState: idle\nwatchId: null\nterminationReason: ${reason}`);

    if (polylineRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(polylineRef.current);
    if (runnerMarkerRef.current && mapInstanceRef.current) mapInstanceRef.current.removeLayer(runnerMarkerRef.current);

    setRunState({
      status: 'idle',
      path: [],
      distance: 0,
      duration: 0,
      pace: '--:--',
      gpsAccuracy: null
    });
    addLog("System: Run tracking halted.");
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
      gpsAccuracy: null
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
      <div className="fade-in p-6" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="glass-panel-heavy card-cyber card-cyber-static p-8 gap-6" style={{ width: '420px', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ textAlign: 'center' }}>
            <span className="text-neon-pink text-xs" style={{ fontWeight: '800', letterSpacing: '3px', textTransform: 'uppercase' }}>RunClash MVP // GPS Conquest</span>
            <h1 className="text-4xl m-0" style={{ marginTop: '10px', color: 'white', fontWeight: '800', letterSpacing: '-1.5px', textShadow: '0 0 10px rgba(255,255,255,0.08)' }}>RUNCLASH</h1>
            <p className="text-base m-0" style={{ color: 'var(--text-secondary)', marginTop: '8px', lineHeight: '1.4' }}>
              Connect your GPS to conquer real-world loops. Powered by {isFirebaseActive() ? 'Supabase Cloud' : 'LocalStorage persistence'}.
            </p>
          </div>

          {authError && (
            <div className="p-3 gap-2" style={{ background: 'rgba(255, 0, 127, 0.08)', border: '1px solid var(--neon-pink)', color: 'white', borderRadius: '12px', fontSize: '12px', display: 'flex', alignItems: 'center', boxShadow: 'var(--glow-pink)' }}>
              <AlertCircle size={15} className="text-neon-pink" />
              <span style={{ fontWeight: '500' }}>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="gap-4" style={{ display: 'flex', flexDirection: 'column' }}>
            {authMode !== 'guest' && (
              <div className="gap-2" style={{ display: 'flex', flexDirection: 'column' }}>
                <label className="text-xs" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
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
              <label className="text-xs" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Password / Nickname</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
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
                <label className="text-xs" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Display Name</label>
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
                <label className="text-xs" style={{ fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Choose Crew / Clan</label>
                <select 
                  value={authClan} 
                  onChange={e => setAuthClan(e.target.value)}
                  className="cyber-select focus-ring"
                >
                  <option value="Udaipur Racers">Udaipur Racers (Cyan)</option>
                  <option value="GITS Runners">GITS Runners (Pink)</option>
                  <option value="Delhi Marathon Club">Delhi Marathon Club (White)</option>
                </select>
              </div>
            )}

            <button type="submit" className="btn-neon focus-ring" style={{ marginTop: '12px' }}>
              {authMode === 'login' ? 'Access Sector' : authMode === 'signup' ? 'Create Account' : 'Enter Arena'}
            </button>
          </form>

          {/* Form Switching Toggles */}
          <div className="gap-2 text-base" style={{ display: 'flex', flexDirection: 'column', borderTop: '1.5px solid var(--border-color)', paddingTop: '20px', textAlign: 'center' }}>
            {authMode === 'login' ? (
              <>
                <div style={{ color: 'var(--text-secondary)' }}>New runner? <span className="text-neon-blue" style={{ cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }} onClick={() => setAuthMode('signup')}>Sign Up</span></div>
                <div style={{ color: 'var(--text-secondary)' }}>Just exploring? <span className="text-neon-pink" style={{ cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }} onClick={() => setAuthMode('guest')}>Enter as Guest</span></div>
              </>
            ) : authMode === 'signup' ? (
              <div style={{ color: 'var(--text-secondary)' }}>Already registered? <span className="text-neon-blue" style={{ cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }} onClick={() => setAuthMode('login')}>Sign In</span></div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>Want cloud account? <span className="text-neon-blue" style={{ cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }} onClick={() => setAuthMode('signup')}>Sign Up</span></div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ACTIVE GAMEPLAY DASHBOARD
  return (
    <div className="sim-container fade-in">
      
      {/* SIMULATOR / CONFIGURATION CONTROL PANEL */}
      <div className="strava-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '22px', height: 'fit-content' }}>
        <div>
          <span className="strava-orange" style={{ fontSize: '11px', fontWeight: '800', letterSpacing: '2.5px', textTransform: 'uppercase' }}>Configuration Control</span>
          <h2 style={{ margin: '6px 0 0 0', fontSize: '28px', color: 'white', fontWeight: '800', letterSpacing: '-0.5px' }}>GPS Tracker Setup</h2>
          <p className="strava-text-secondary" style={{ fontSize: '13px', marginTop: '8px', lineHeight: '1.45' }}>
            Choose your execution mode. Step outside and run in loops with <b>Real GPS</b>, or test closed loops from your computer with <b>Developer Sim</b>.
          </p>
        </div>

        {/* Tracking Mode selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Location Source Mode</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button 
              className={trackingMode === 'gps' ? 'strava-btn-primary' : 'strava-btn-secondary'}
              onClick={() => setTrackingMode('gps')}
              disabled={runState.status !== 'idle'}
              style={{ fontSize: '11px', gap: '6px', padding: '12px' }}
            >
              <Navigation size={13} style={{ transform: 'rotate(45deg)' }} /> Real GPS
            </button>
            <button 
              className={trackingMode === 'sim' ? 'strava-btn-primary' : 'strava-btn-secondary'}
              onClick={() => setTrackingMode('sim')}
              disabled={runState.status !== 'idle'}
              style={{ fontSize: '11px', gap: '6px', padding: '12px' }}
            >
              <Radio size={13} /> Developer Sim
            </button>
          </div>
        </div>

        {/* Predefined Simulator selection (Only shown if mode is sim) */}
        {trackingMode === 'sim' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>Mock Simulator Loop</label>
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
            <button className="strava-btn-primary" onClick={startTracking} style={{ width: '100%', fontSize: '11px', padding: '12px' }}>
              <Play size={13} /> Start Tracking
            </button>
          ) : (
            <button className="strava-btn-secondary" onClick={stopTracking} style={{ width: '100%', borderColor: '#FC4C02', color: '#FC4C02', fontSize: '11px', padding: '12px' }}>
              <Square size={13} /> Stop Run
            </button>
          )}

          <button 
            className="strava-btn-secondary"
            onClick={handleLogout}
            style={{ width: '100%', fontSize: '11px', gap: '6px', padding: '12px' }}
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>

        {/* Collapsible Developer Console logs */}
        <details style={{ marginTop: '4px' }}>
          <summary style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none' }}>
            Developer Tools
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)' }}>GPS Engine Console logs</span>
            <div style={{
              background: '#09090e',
              border: '1px solid var(--border-color)',
              borderRadius: '12px',
              padding: '12px',
              height: '150px',
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              color: '#39ff14',
              display: 'flex',
              flexDirection: 'column-reverse',
              gap: '6px'
            }}>
              {consoleLogs.map((log, i) => (
                <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span> {log}
                </div>
              ))}
            </div>
          </div>
        </details>

        {/* Cloud database active details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255, 255, 255, 0.02)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
          <ShieldCheck size={16} className="strava-orange" />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '500' }}>
            Active Sync: <span style={{ color: 'white', fontWeight: '700' }}>{isFirebaseActive() ? 'Supabase Cloud (PostgreSQL)' : 'Local Offline Database'}</span>
          </span>
        </div>
      </div>

      {/* MOBILE DEVICE FRAME SIMULATION */}
      <div className="phone-frame">
        <div className="phone-notch">
          <div className="phone-camera"></div>
        </div>

        <div className="app-screen">
          
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #2A2A2A', paddingBottom: '14px' }}>
                  <h3 className="text-sm m-0" style={{ color: 'white', fontWeight: '800', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Tactical Settings</h3>
                  <button 
                    onClick={() => setShowSettingsDrawer(false)}
                    className="strava-btn-secondary btn-sm"
                    style={{ color: '#FC4C02', borderColor: '#FC4C02', background: 'rgba(252, 76, 2, 0.05)' }}
                  >
                    Close
                  </button>
                </div>

                {/* Profile Header Block */}
                <div className="strava-card" style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{
                      width: '52px',
                      height: '52px',
                      borderRadius: '50%',
                      background: 'rgba(252, 76, 2, 0.05)',
                      border: '2.5px solid #FC4C02',
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
                      <h4 className="text-lg m-0" style={{ color: 'white', fontWeight: '800' }}>{currentUser.displayName}</h4>
                      <span className="text-xs" style={{ color: '#FC4C02', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {currentUser.clan || 'Udaipur Racers'}
                      </span>
                    </div>
                  </div>

                  {/* XP & Level progress */}
                  <div style={{ borderTop: '1px solid #2A2A2A', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      <span style={{ fontWeight: '800' }}>LEVEL {currentUser.level}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{currentUser.xp} XP</span>
                    </div>
                    <div className="strava-progress-bar-bg" style={{ height: '6px' }}>
                      <div className="strava-progress-bar-fill" style={{ width: `${(currentUser.xp / (currentUser.nextLevelXp || 2500)) * 100}%` }}></div>
                    </div>
                  </div>

                  {/* Coin balance */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid #2A2A2A', padding: '8px 12px', borderRadius: '10px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase' }}>Coin Holdings</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Coins size={14} className="strava-orange" />
                      <span style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>{currentUser.coins}</span>
                    </div>
                  </div>
                </div>

                {/* Settings Group: Location Source */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Running & GPS Configuration</span>
                  
                  <div className="strava-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {/* Toggle Selector */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ fontSize: '11px', color: 'white', fontWeight: '700' }}>Location Source Mode</label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <button 
                          className={trackingMode === 'gps' ? 'strava-btn-primary focus-ring' : 'strava-btn-secondary focus-ring'}
                          onClick={() => { setTrackingMode('gps'); addLog("GPS: Switched to Real GPS mode."); }}
                          disabled={runState.status !== 'idle'}
                          style={{ fontSize: '10px', padding: '10px', gap: '6px', borderRadius: '10px' }}
                        >
                          <Navigation size={12} style={{ transform: 'rotate(45deg)' }} /> Real GPS
                        </button>
                        <button 
                          className={trackingMode === 'sim' ? 'strava-btn-primary focus-ring' : 'strava-btn-secondary focus-ring'}
                          onClick={() => { setTrackingMode('sim'); addLog("GPS: Switched to Dev Simulator mode."); }}
                          disabled={runState.status !== 'idle'}
                          style={{ fontSize: '10px', padding: '10px', gap: '6px', borderRadius: '10px' }}
                        >
                          <Radio size={12} /> Dev Sim
                        </button>
                      </div>
                    </div>

                    {/* Loop selector */}
                    {trackingMode === 'sim' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid #2A2A2A', paddingTop: '12px' }}>
                        <label style={{ fontSize: '11px', color: 'white', fontWeight: '700' }}>Mock Simulator Loop</label>
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

                {/* Collapsible System Diagnostics & Logs */}
                <details style={{ marginTop: '4px' }}>
                  <summary style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-secondary)', cursor: 'pointer', outline: 'none' }}>
                    Developer Tools
                  </summary>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Tactical Console Logs</span>
                    <div style={{
                      background: '#09090e',
                      border: '1px solid #2A2A2A',
                      borderRadius: '12px',
                      padding: '10px',
                      height: '150px',
                      overflowY: 'auto',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '9px',
                      color: '#39ff14',
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      gap: '4px'
                    }}>
                      {consoleLogs.map((log, i) => (
                        <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)', paddingBottom: '3px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span> {log}
                        </div>
                      ))}
                    </div>
                  </div>
                </details>

                {/* Settings Group: Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #2A2A2A', paddingTop: '16px' }}>
                  <button 
                    className="focus-ring" 
                    onClick={() => {
                      if (confirm("Are you sure you want to sign out?")) {
                        handleLogout();
                        setShowSettingsDrawer(false);
                      }
                    }}
                    style={{
                      background: 'rgba(252, 76, 2, 0.1)',
                      border: '1.5px solid #FC4C02',
                      color: 'white',
                      padding: '12px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: '800',
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <LogOut size={13} style={{ color: '#FC4C02' }} /> Sign Out Account
                  </button>
                  
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '9px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '4px' }}>
                    RunClash v1.2.0 • Secured Database Sync
                  </div>
                </div>
              </div>
            )}

            {/* TAB: DASHBOARD (HOME) */}
            <div style={{ display: activeTab === 'dashboard' ? 'flex' : 'none' }} className="strava-dashboard-container fade-in">
              
              {/* Greeting Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <div>
                  <span className="strava-text-secondary" style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {(() => {
                      const hr = new Date().getHours();
                      if (hr < 12) return 'Good Morning';
                      if (hr < 17) return 'Good Afternoon';
                      return 'Good Evening';
                    })()}
                  </span>
                  <h3 style={{ margin: '2px 0 0 0', fontSize: '24px', color: 'white', fontWeight: '800', letterSpacing: '-0.5px' }}>
                    {currentUser.displayName || 'Runner'}
                  </h3>
                </div>
                <div style={{
                  background: 'rgba(252, 76, 2, 0.1)',
                  border: '1px solid rgba(252, 76, 2, 0.25)',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '10px',
                  fontWeight: '800',
                  color: '#FC4C02',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  {currentUser.clan || 'Udaipur Racers'}
                </div>
              </div>

              {/* CTA Hero Card - Start Run */}
              <div className="strava-card" style={{ gap: '14px', background: 'linear-gradient(135deg, #1d1d1d 0%, #151515 100%)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="strava-orange" style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>Quick Start</span>
                    <h4 style={{ margin: '4px 0 0 0', fontSize: '18px', color: 'white', fontWeight: '800' }}>Ready for your next loop?</h4>
                  </div>
                  <Compass size={24} className="strava-orange" />
                </div>
                <p className="strava-text-secondary" style={{ margin: 0, fontSize: '12px', lineHeight: '1.4' }}>
                  Step outside, close a loop with GPS tracking, and expand your crew's sector holdings.
                </p>
                <button className="strava-btn-primary" onClick={() => setActiveTab('map')}>
                  Start Run
                </button>
              </div>

              {/* Hero Card - Today's Real Activity */}
              <div className="strava-card" style={{ gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="strava-text-secondary" style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Today's Activity</span>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: runState.status === 'tracking' ? '#39ff14' : 'rgba(255,255,255,0.1)' }}></div>
                </div>
                
                {runState.distance > 0 || runState.status === 'tracking' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{ fontSize: '32px', fontWeight: '800', color: 'white', fontFamily: 'var(--font-sans)' }}>{runState.distance.toFixed(2)}</span>
                      <span className="strava-text-secondary" style={{ fontSize: '14px', fontWeight: '700' }}>km</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                      <div>
                        <span className="strava-text-secondary" style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>Duration</span>
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
                        <span className="strava-text-secondary" style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase' }}>Avg Pace</span>
                        <div style={{ fontSize: '14px', fontWeight: '800', color: 'white', marginTop: '2px' }}>{runState.pace} /km</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0', textAlign: 'center', gap: '8px' }}>
                    <Compass size={24} className="strava-text-secondary" style={{ opacity: 0.4 }} />
                    <div style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>No runs tracked today</div>
                    <span className="strava-text-secondary" style={{ fontSize: '11px' }}>Recorded statistics from your active run will display here.</span>
                  </div>
                )}
              </div>

              {/* Weekly Goal Status */}
              <div className="strava-card" style={{ gap: '12px' }}>
                <span className="strava-text-secondary" style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Weekly Progress</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
                    <span style={{ color: 'white' }}>Distance Goal</span>
                    <span className="strava-text-secondary">0 / 15.0 km</span>
                  </div>
                  <div className="strava-progress-bar-bg">
                    <div className="strava-progress-bar-fill" style={{ width: '0%' }}></div>
                  </div>
                  <span className="strava-text-secondary" style={{ fontSize: '10px', fontStyle: 'italic', textAlign: 'center', marginTop: '4px' }}>
                    Weekly goals are not configured yet. Start a run to establish your target!
                  </span>
                </div>
              </div>

              {/* Stats Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                
                {/* Coins Stat Card */}
                <div className="strava-card" style={{ gap: '6px', cursor: 'pointer' }} onClick={() => setActiveTab('conquests')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Coins size={14} className="strava-orange" />
                    <span className="strava-text-secondary" style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>Coins</span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '24px', color: 'white', fontWeight: '800' }}>{currentUser.coins}</h4>
                  <span className="strava-text-secondary" style={{ fontSize: '9px' }}>Spend in Armory &rarr;</span>
                </div>

                {/* Level / XP Stat Card */}
                <div className="strava-card" style={{ gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} className="strava-orange" />
                    <span className="strava-text-secondary" style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>XP Level</span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '24px', color: 'white', fontWeight: '800' }}>LVL {currentUser.level}</h4>
                  <span className="strava-text-secondary" style={{ fontSize: '9px' }}>{currentUser.xp} total XP</span>
                </div>

                {/* Sectors Conquered Card */}
                <div className="strava-card" style={{ gap: '6px', cursor: 'pointer' }} onClick={() => setActiveTab('conquests')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Target size={14} className="strava-orange" />
                    <span className="strava-text-secondary" style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>Sectors</span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '24px', color: 'white', fontWeight: '800' }}>
                    {territories.filter(t => t.ownerId === currentUser.uid).length}
                  </h4>
                  <span className="strava-text-secondary" style={{ fontSize: '9px' }}>View conquered loops &rarr;</span>
                </div>

                {/* Standing / Rank Card */}
                <div className="strava-card" style={{ gap: '6px', cursor: 'pointer' }} onClick={() => setActiveTab('clans')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Trophy size={14} className="strava-orange" />
                    <span className="strava-text-secondary" style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase' }}>Rank</span>
                  </div>
                  <h4 style={{ margin: 0, fontSize: '24px', color: 'white', fontWeight: '800' }}>
                    {(() => {
                      const userRankIndex = leaderboard.findIndex(p => p.displayName === currentUser.displayName);
                      return userRankIndex !== -1 ? `#${userRankIndex + 1}` : '#5';
                    })()}
                  </h4>
                  <span className="strava-text-secondary" style={{ fontSize: '9px' }}>View leaderboards &rarr;</span>
                </div>

              </div>

              {/* Current Territory */}
              <div className="strava-card" style={{ gap: '10px' }}>
                <span className="strava-text-secondary" style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Active Holding</span>
                {(() => {
                  const userTerrs = territories.filter(t => t.ownerId === currentUser.uid);
                  const latest = userTerrs[userTerrs.length - 1];
                  if (latest) {
                    return (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>{latest.name}</div>
                          <span className="strava-text-secondary" style={{ fontSize: '11px' }}>{latest.area} sq m</span>
                        </div>
                        <span style={{ fontSize: '11px', color: '#FC4C02', fontWeight: '800', background: 'rgba(252, 76, 2, 0.1)', padding: '3px 8px', borderRadius: '10px' }}>
                          {latest.decayHours}h Shield
                        </span>
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', textAlign: 'center', gap: '6px' }}>
                      <Target size={18} className="strava-text-secondary" style={{ opacity: 0.4 }} />
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'white' }}>No captured sectors</div>
                      <span className="strava-text-secondary" style={{ fontSize: '10px' }}>Conquer loops to claim sectors.</span>
                    </div>
                  );
                })()}
              </div>

              {/* Recent Activity / Captures */}
              <div className="strava-card" style={{ gap: '10px' }}>
                <span className="strava-text-secondary" style={{ fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Recent Captures</span>
                {(() => {
                  const userTerrs = territories.filter(t => t.ownerId === currentUser.uid);
                  if (userTerrs.length > 0) {
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {userTerrs.slice(-2).reverse().map((terr, index) => (
                          <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '10px' }}>
                            <span style={{ fontSize: '12px', color: 'white', fontWeight: '700' }}>{terr.name}</span>
                            <span className="strava-orange" style={{ fontSize: '11px', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{terr.area} sq m</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', textAlign: 'center', gap: '6px' }}>
                      <Compass size={18} className="strava-text-secondary" style={{ opacity: 0.4 }} />
                      <div style={{ fontSize: '12px', fontWeight: '700', color: 'white' }}>No recent activities</div>
                    </div>
                  );
                })()}
              </div>

            </div>

            {/* TAB: MAP */}
            <div style={{ display: activeTab === 'map' ? 'flex' : 'none', flexDirection: 'column', height: '100%', width: '100%', position: 'relative' }}>
              
              {/* Fullscreen Map Hero */}
              <div id="map" style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 1 }}></div>

              {/* Floating top HUD */}
              <div style={{
                position: 'absolute',
                top: '16px',
                left: '16px',
                right: '16px',
                background: '#151515',
                border: '1px solid #2A2A2A',
                borderRadius: '20px',
                padding: '8px 12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                zIndex: 999,
                boxShadow: 'var(--clash-shadow-md)'
              }}>
                {/* Profile Avatar circle */}
                <div 
                  onClick={() => setShowSettingsDrawer(true)}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: '#FC4C02',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '13px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    border: '2px solid white',
                    boxShadow: 'var(--clash-shadow-sm)',
                    transition: 'transform 0.15s ease',
                    flexShrink: 0
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Open settings"
                >
                  {(currentUser.displayName || 'R')[0].toUpperCase()}
                </div>

                {/* Coin Balance Chip */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid #2A2A2A',
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Coins size={14} style={{ color: '#FC4C02' }} />
                  <span style={{ fontSize: '13px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-family)' }}>
                    {currentUser.coins}
                  </span>
                </div>

                {/* GPS Status Chip */}
                <div style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid #2A2A2A',
                  height: '40px',
                  padding: '0 12px',
                  borderRadius: '20px',
                  fontSize: '11px',
                  fontWeight: '800',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: 'white'
                }}>
                  {(() => {
                    if (trackingMode === 'sim') {
                      return (
                        <>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FC4C02', display: 'inline-block' }}></span>
                          <span>Sim Stride</span>
                        </>
                      );
                    }
                    if (runState.gpsAccuracy === null) {
                      return (
                        <>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f1c40f', display: 'inline-block' }}></span>
                          <span>Searching</span>
                        </>
                      );
                    }
                    if (runState.gpsAccuracy < 30) {
                      return (
                        <>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2ecc71', display: 'inline-block' }}></span>
                          <span>GPS Ready</span>
                        </>
                      );
                    }
                    return (
                      <>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#e74c3c', display: 'inline-block' }}></span>
                        <span>GPS Lost</span>
                      </>
                    );
                  })()}
                </div>

                {/* Settings Gear Button */}
                <button 
                  onClick={() => setShowSettingsDrawer(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid #2A2A2A',
                    color: 'white',
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Tactical settings"
                >
                  <Settings size={15} />
                </button>
              </div>

              {/* Accuracy floating indicator */}
              {(runState.status === 'tracking' || runState.status === 'paused') && trackingMode === 'gps' && runState.gpsAccuracy && (
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
                  color: runState.gpsAccuracy < 15 ? '#2ecc71' : '#f1c40f',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: '800',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                  boxShadow: 'var(--clash-shadow-sm)'
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: runState.gpsAccuracy < 15 ? '#2ecc71' : '#f1c40f' }}></div>
                  GPS Accuracy: {Math.round(runState.gpsAccuracy)}m
                </div>
              )}

              {/* Right Circular Map Controls (Aligned Vertically) */}
              <div style={{
                position: 'absolute',
                top: '50%',
                transform: 'translateY(-50%)',
                right: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                zIndex: 999
              }}>
                {/* Zoom In */}
                <button 
                  onClick={() => {
                    if (mapInstanceRef.current) mapInstanceRef.current.zoomIn();
                  }}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    border: '1px solid #2A2A2A',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#151515',
                    boxShadow: 'var(--clash-shadow-md)',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: '800',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
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
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    border: '1px solid #2A2A2A',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#151515',
                    boxShadow: 'var(--clash-shadow-md)',
                    cursor: 'pointer',
                    fontSize: '18px',
                    fontWeight: '800',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Zoom Out"
                >
                  -
                </button>

                {/* Recenter */}
                <button 
                  onClick={recenterMap}
                  style={{
                    width: '42px',
                    height: '42px',
                    borderRadius: '50%',
                    border: '1px solid #2A2A2A',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#151515',
                    boxShadow: 'var(--clash-shadow-md)',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease'
                  }}
                  onMouseDown={e => e.currentTarget.style.transform = 'scale(0.92)'}
                  onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  title="Recenter GPS"
                >
                  <Navigation size={15} style={{ transform: 'rotate(45deg)', color: '#FC4C02' }} />
                </button>
              </div>

              {/* Draggable bottom sheet / Startup Action Deck */}
              {runState.status === 'idle' && (
                <div 
                  className="clash-bottom-sheet"
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '16px',
                    right: '16px',
                    zIndex: 999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    maxHeight: isBottomSheetExpanded ? '440px' : '110px',
                    overflow: 'hidden',
                    transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                >
                  {/* Pull Tab Handle */}
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

                  {!isBottomSheetExpanded ? (
                    /* Collapsed Panel View */
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '60px' }}>
                      <div 
                        onClick={() => setIsBottomSheetExpanded(true)}
                        style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', gap: '2px' }}
                      >
                        <span className="clash-label">Selected Sector</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <span className="clash-subtitle" style={{ fontSize: '14px' }}>
                            {trackingMode === 'gps' ? 'Outside Real GPS' : SIMULATION_ROUTES[simulationRouteKey].name}
                          </span>
                          <ChevronUp size={14} style={{ color: '#FC4C02' }} />
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
                          {trackingMode === 'gps' ? 'Dynamic Stride • Ready' : `${SIMULATION_ROUTES[simulationRouteKey].distance} • Medium`}
                        </span>
                      </div>

                      <button 
                        onClick={startTracking}
                        className="clash-btn-primary"
                        style={{ height: '48px', padding: '0 24px' }}
                      >
                        START RUN
                      </button>
                    </div>
                  ) : (
                    /* Expanded Configuration Panel View */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h3 className="clash-subtitle" style={{ margin: 0, fontSize: '16px' }}>Configure Run Explorer</h3>
                        <button 
                          onClick={() => setIsBottomSheetExpanded(false)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--clash-text-secondary)', cursor: 'pointer' }}
                        >
                          <ChevronDown size={20} />
                        </button>
                      </div>

                      {/* Tracker switcher control */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="clash-label" style={{ fontSize: '9px' }}>Tracking Technology</span>
                        <div style={{ display: 'flex', background: '#0B0B0B', borderRadius: '12px', padding: '2px', border: '1px solid #2A2A2A' }}>
                          <button 
                            onClick={() => setTrackingMode('sim')}
                            style={{
                              flex: 1,
                              background: trackingMode === 'sim' ? '#FC4C02' : 'transparent',
                              color: 'white',
                              border: 'none',
                              padding: '8px 0',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              transition: 'background 0.2s'
                            }}
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
                              padding: '8px 0',
                              borderRadius: '10px',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              transition: 'background 0.2s'
                            }}
                          >
                            Real GPS Stride
                          </button>
                        </div>
                      </div>

                      {/* Simulation route selector dropdown */}
                      {trackingMode === 'sim' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span className="clash-label" style={{ fontSize: '9px' }}>Simulation Route Key</span>
                          <select 
                            value={simulationRouteKey}
                            onChange={(e) => setSimulationRouteKey(e.target.value)}
                            style={{
                              background: '#0B0B0B',
                              border: '1px solid #2A2A2A',
                              color: 'white',
                              padding: '10px',
                              borderRadius: '12px',
                              fontSize: '12px',
                              fontWeight: '700',
                              width: '100%',
                              outline: 'none',
                              cursor: 'pointer'
                            }}
                          >
                            {Object.entries(SIMULATION_ROUTES).map(([key, val]) => (
                              <option key={key} value={key}>{val.name} ({val.distance})</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Details Grid */}
                      {(() => {
                        let runnerLatLng = null;
                        if (runnerMarkerRef.current) {
                          runnerLatLng = runnerMarkerRef.current.getLatLng();
                        } else if (mapInstanceRef.current) {
                          runnerLatLng = mapInstanceRef.current.getCenter();
                        }

                        let nearest = null;
                        let minDist = Infinity;
                        if (runnerLatLng && territories.length > 0) {
                          territories.forEach(terr => {
                            if (!terr.coords || terr.coords.length === 0) return;
                            const firstCoord = terr.coords[0];
                            const dist = getGeodeticDistance(runnerLatLng.lat, runnerLatLng.lng, firstCoord[0], firstCoord[1]);
                            if (dist < minDist) {
                              minDist = dist;
                              nearest = terr;
                            }
                          });
                        }

                        const hasNearest = nearest && minDist <= 1.5;

                        return (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#0B0B0B', padding: '12px', borderRadius: '16px', border: '1px solid #2A2A2A' }}>
                            <div>
                              <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Sector Owner</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'white' }}>
                                {hasNearest ? nearest.ownerName : 'Unclaimed'}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Shield Status</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: hasNearest && nearest.decayHours > 0 ? '#2ecc71' : '#e74c3c' }}>
                                {hasNearest ? (nearest.decayHours > 0 ? `${nearest.decayHours}h remaining` : 'Decayed') : 'No Shield'}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Target Distance</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: 'white' }}>
                                {trackingMode === 'gps' ? 'Dynamic' : SIMULATION_ROUTES[simulationRouteKey].distance}
                              </span>
                            </div>
                            <div>
                              <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Difficulty</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#f1c40f' }}>
                                {trackingMode === 'gps' ? 'Custom' : simulationRouteKey === 'lake' ? 'Hard' : 'Medium'}
                              </span>
                            </div>
                            <div style={{ gridColumn: 'span 2' }}>
                              <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Estimated Conquest Rewards</span>
                              <span style={{ fontSize: '11px', fontWeight: '700', color: '#FC4C02' }}>
                                {hasNearest ? `+${nearest.rate || 5} Coins/Hr & +150 XP` : '+50 Coins & +150 XP on completion'}
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Actions */}
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button 
                          onClick={() => alert("Route planning active! Map out your sector loop bounds.")}
                          className="clash-btn-secondary"
                          style={{ height: '48px', flex: 1 }}
                        >
                          Plan Route
                        </button>
                        <button 
                          onClick={() => {
                            setIsBottomSheetExpanded(false);
                            startTracking();
                          }}
                          className="clash-btn-primary"
                          style={{ height: '48px', flex: 1.5 }}
                        >
                          START RUN NOW
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Active Run HUD (Live Stride stats overlay) */}
              {(runState.status === 'tracking' || runState.status === 'paused') && (
                <div 
                  className="clash-bottom-sheet"
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    left: '16px',
                    right: '16px',
                    zIndex: 999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="clash-label" style={{ fontSize: '9px' }}>Live HUD</span>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: '#FC4C02',
                        display: 'inline-block',
                        animation: 'pulse 1.5s infinite'
                      }}></span>
                    </div>
                    <span className="clash-label" style={{ fontSize: '9px', color: '#FC4C02' }}>
                      {runState.status === 'tracking' ? 'Recording' : 'Paused'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', background: '#0B0B0B', padding: '12px', borderRadius: '16px', border: '1px solid #2A2A2A', textAlign: 'center' }}>
                    <div>
                      <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Distance</span>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: '#FC4C02', fontFamily: 'var(--clash-font-mono)' }}>{runState.distance} <span style={{ fontSize: '10px' }}>KM</span></span>
                    </div>
                    <div>
                      <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Time</span>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>
                        {Math.floor(runState.duration / 60)}:{(runState.duration % 60).toString().padStart(2, '0')}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', display: 'block', textTransform: 'uppercase' }}>Pace</span>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-mono)' }}>{runState.pace}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button 
                      onClick={togglePauseResume}
                      className="clash-btn-secondary"
                      style={{ height: '44px', flex: 1 }}
                    >
                      {runState.status === 'tracking' ? 'Pause' : 'Resume'}
                    </button>
                    <button 
                      onClick={stopTracking}
                      className="clash-btn-primary"
                      style={{ height: '44px', flex: 1.2 }}
                    >
                      STOP & CLAIM
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* TAB: CONQUESTS */}
            <div style={{ display: activeTab === 'conquests' ? 'flex' : 'none', flexDirection: 'column', gap: '22px', padding: '16px', height: '100%', overflowY: 'auto' }} className="fade-in">
              
              {/* Controlled Sectors */}
              <div>
                <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
                  <Target size={15} className="text-neon-blue" /> Controlled Sectors ({territories.filter(t => t.ownerId === currentUser.uid && t.is_active !== false).length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {territories.filter(t => t.ownerId === currentUser.uid && t.is_active !== false).length === 0 ? (
                    <div className="card-cyber card-cyber-static" style={{ borderStyle: 'dashed', padding: '32px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                      <Compass size={32} className="text-neon-pink glow-active-pulse" style={{ margin: '0 auto 12px auto' }} />
                      <h4 className="text-base m-0" style={{ color: 'white', fontWeight: '800', marginBottom: '6px' }}>NO ACTIVE SECTORS DETECTED</h4>
                      <p className="text-sm m-0" style={{ lineHeight: '1.4', marginBottom: '16px' }}>
                        Step outside, start your GPS run, and close a path loop to establish Udaipur crew dominance.
                      </p>
                      <button className="btn-neon focus-ring btn-sm" onClick={() => setActiveTab('map')}>
                        Launch Tactical Map
                      </button>
                    </div>
                  ) : (
                    territories.filter(t => t.ownerId === currentUser.uid && t.is_active !== false).map(terr => {
                      const clanColor = terr.clan === 'Udaipur Racers' ? 'var(--neon-blue)' : terr.clan === 'GITS Runners' ? 'var(--neon-pink)' : '#ffffff';
                      const maxDecay = terr.maxDecayHours || 72;
                      const currentDecay = terr.decayHours || 72;
                      const percentage = Math.max(0, Math.min(100, (currentDecay / maxDecay) * 100));
                      
                      return (
                        <div key={terr.id} className="card-cyber card-cyber-static p-4 gap-3" style={{ display: 'flex', flexDirection: 'column', borderLeft: `3.5px solid ${clanColor}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <h4 className="text-base m-0" style={{ color: 'white', fontWeight: '800' }}>{terr.name}</h4>
                                <span className="text-xs" style={{ background: 'rgba(0, 229, 255, 0.08)', border: '1px solid var(--neon-blue)', padding: '2px 6px', borderRadius: '8px', color: 'var(--neon-blue)', fontWeight: '800', textTransform: 'uppercase' }}>SECURED</span>
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                Area: {terr.area}
                              </span>
                            </div>
                            <button 
                              onClick={() => useShield(terr.id)}
                              className="btn-secondary focus-ring btn-sm"
                              style={{ borderColor: 'var(--neon-blue)', color: 'var(--neon-blue)', background: 'rgba(0, 229, 255, 0.04)' }}
                            >
                              <Shield size={11} /> Fortify
                            </button>
                          </div>

                          {/* Rewards details */}
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 251, 0, 0.06)', border: '1px solid rgba(255,251,0,0.12)', padding: '2px 8px', borderRadius: '12px' }}>
                              <Coins size={10} className="text-neon-yellow" />
                              <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>+{terr.rate || 5} COINS/HR</span>
                            </div>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(157, 78, 221, 0.06)', border: '1px solid rgba(157,78,221,0.12)', padding: '2px 8px', borderRadius: '12px' }}>
                              <Award size={10} className="text-neon-purple" />
                              <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>+150 XP CAPTURE</span>
                            </div>
                          </div>

                          {/* Shield integrity slider */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>Shield integrity</span>
                              <span style={{ color: clanColor, fontWeight: '800' }}>{currentDecay}h remaining</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${percentage}%`, height: '100%', background: `linear-gradient(90deg, ${clanColor} 0%, var(--neon-pink) 100%)`, borderRadius: '3px', transition: 'width 0.4s ease' }}></div>
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
                  <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px', color: 'var(--text-secondary)' }}>
                    <RefreshCw size={14} className="text-neon-pink" /> Lost & Expired Sectors ({territories.filter(t => t.ownerId === currentUser.uid && t.is_active === false).length})
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {territories.filter(t => t.ownerId === currentUser.uid && t.is_active === false).map(terr => (
                      <div key={terr.id} className="card-cyber card-cyber-static p-4 gap-3" style={{ display: 'flex', flexDirection: 'column', opacity: 0.65, borderLeft: '3.5px solid var(--text-muted)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <h4 className="text-base m-0" style={{ color: 'var(--text-secondary)', fontWeight: '800' }}>{terr.name}</h4>
                              <span className="text-xs" style={{ background: 'rgba(255, 0, 127, 0.08)', border: '1px solid var(--neon-pink)', padding: '2px 6px', borderRadius: '8px', color: 'var(--neon-pink)', fontWeight: '800', textTransform: 'uppercase' }}>DECAYED</span>
                            </div>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Lost area: {terr.area}</span>
                          </div>
                          <button 
                            onClick={() => setActiveTab('map')}
                            className="btn-secondary focus-ring btn-sm"
                            style={{ borderColor: 'var(--neon-pink)', color: 'var(--neon-pink)', background: 'rgba(255, 0, 127, 0.04)' }}
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
                  <Coins size={15} className="text-neon-yellow" /> Power-Up Armory
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="card-cyber card-cyber-interactive" onClick={() => buyItem('shields', shopCosts.shield)} style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
                    <Shield size={24} className="text-neon-blue" style={{ filter: 'drop-shadow(0 0 6px rgba(0, 229, 255, 0.3))' }} />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', marginTop: '2px' }}>Shield (24h)</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Inventory: {inventory.shields}</span>
                    <button 
                      className="btn-secondary btn-sm focus-ring"
                      style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Coins size={10} className="text-neon-yellow" /> {shopCosts.shield}
                    </button>
                  </div>

                  <div className="card-cyber card-cyber-interactive" onClick={() => buyItem('boots', shopCosts.boots)} style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center' }}>
                    <Zap size={24} className="text-neon-pink" style={{ filter: 'drop-shadow(0 0 6px rgba(255, 0, 127, 0.3))' }} />
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', marginTop: '2px' }}>Speed Boots</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Inventory: {inventory.boots}</span>
                    <button 
                      className="btn-secondary btn-sm focus-ring"
                      style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Coins size={10} className="text-neon-yellow" /> {shopCosts.boots}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB: CLANS */}
            <div style={{ display: activeTab === 'clans' ? 'flex' : 'none', flexDirection: 'column', gap: '18px', padding: '16px', height: '100%', overflowY: 'auto' }} className="fade-in">
              
              {/* Crew Header Banner */}
              <div className="card-cyber card-cyber-static p-4 gap-3" style={{ borderLeft: `4px solid ${currentUser.clan === 'GITS Runners' ? 'var(--neon-pink)' : 'var(--neon-blue)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '12px',
                    background: currentUser.clan === 'GITS Runners' ? 'rgba(255, 0, 127, 0.08)' : 'rgba(0, 229, 255, 0.08)',
                    border: `1.5px solid ${currentUser.clan === 'GITS Runners' ? 'var(--neon-pink)' : 'var(--neon-blue)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: currentUser.clan === 'GITS Runners' ? '0 0 12px rgba(255, 0, 127, 0.15)' : '0 0 12px rgba(0, 229, 255, 0.15)'
                  }}>
                    <Users size={22} className={currentUser.clan === 'GITS Runners' ? 'text-neon-pink' : 'text-neon-blue'} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.8px' }}>Active Tactical Crew</span>
                    <h3 className="text-lg m-0" style={{ color: 'white', fontWeight: '800' }}>{currentUser.clan || 'Udaipur Racers'}</h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="text-xs" style={{ background: 'rgba(255, 251, 0, 0.08)', border: '1px solid var(--neon-yellow)', padding: '3px 8px', borderRadius: '10px', color: 'var(--neon-yellow)', fontWeight: '800' }}>
                      DOMINANT
                    </span>
                  </div>
                </div>
              </div>

              {/* Clan Standings */}
              <div>
                <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                  <Trophy size={14} className="text-neon-yellow" /> Crew Dominance Standings
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {getClanStandings().map((c, index) => {
                    const color = c.name === 'Udaipur Racers' ? 'var(--neon-blue)' : c.name === 'GITS Runners' ? 'var(--neon-pink)' : '#ffffff';
                    return (
                      <div key={c.name} className="card-cyber card-cyber-static p-3 gap-2" style={{ background: `${color}06`, borderColor: `${color}20` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '800', marginBottom: '2px' }}>
                          <span style={{ color: color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 'bold' }}>#{index + 1}</span> {c.name}
                          </span>
                          <span style={{ color: 'white' }}>{c.percentage}% DOMAIN</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${c.percentage}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.4s ease' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Leaderboard Section */}
              <div>
                <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
                  <Award size={14} className="text-neon-pink" /> Elite Runners Leaderboard
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
                        <div className="card-cyber card-cyber-static p-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                          No active tactical runners synced.
                        </div>
                      );
                    }

                    return displayLeaderboard.map((player, idx) => {
                      const isSelf = player.displayName === currentUser?.displayName;
                      
                      // Rank visual coloring
                      let rankBorder = 'var(--border-color)';
                      let rankColor = 'var(--text-secondary)';
                      let badgeIcon = `#${idx + 1}`;
                      if (idx === 0) {
                        rankBorder = 'var(--neon-yellow)'; // Gold
                        rankColor = 'var(--neon-yellow)';
                        badgeIcon = '👑';
                      } else if (idx === 1) {
                        rankBorder = 'rgba(255,255,255,0.4)'; // Silver
                        rankColor = '#ffffff';
                        badgeIcon = '🥈';
                      } else if (idx === 2) {
                        rankBorder = 'rgba(217, 119, 6, 0.5)'; // Bronze
                        rankColor = 'var(--neon-pink)';
                        badgeIcon = '🥉';
                      }

                      return (
                        <div key={idx} className="card-cyber card-cyber-static" style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          borderLeft: `4px solid ${isSelf ? 'var(--neon-blue)' : rankBorder}`,
                          boxShadow: isSelf ? '0 0 10px rgba(0, 229, 255, 0.1)' : 'none',
                          background: isSelf ? 'rgba(0, 229, 255, 0.04)' : 'rgba(9, 9, 20, 0.4)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontWeight: '800', color: rankColor, fontSize: '13px', width: '20px', textAlign: 'center' }}>
                              {badgeIcon}
                            </span>
                            
                            {/* Avatar */}
                            <div style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: player.clan === 'GITS Runners' ? 'rgba(255, 0, 127, 0.1)' : 'rgba(0, 229, 255, 0.1)',
                              border: `1.5px solid ${player.clan === 'GITS Runners' ? 'var(--neon-pink)' : 'var(--neon-blue)'}`,
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
                              <span style={{ fontWeight: '800', color: isSelf ? 'var(--neon-blue)' : 'white' }}>
                                {player.displayName} {isSelf && <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>(You)</span>}
                              </span>
                              <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '8px', fontWeight: '800', textTransform: 'uppercase' }}>
                                {player.clan}
                              </span>
                            </div>
                          </div>
                          
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold' }}>LVL {player.level}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--neon-pink)', fontWeight: '800', fontSize: '12px' }}>
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
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(5, 5, 9, 0.4)', border: '1.5px solid var(--border-color)', borderRadius: '18px', padding: '14px', minHeight: '230px' }}>
                <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', borderBottom: '1.5px solid var(--border-color)', paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <MessageSquare size={13} className="text-neon-blue" /> Crew Comm Channel
                </span>
 
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', padding: '4px 0' }}>
                  {clanMessages.map((msg) => {
                    const isSelf = msg.sender.includes('You');
                    return (
                      <div key={msg.id} className={isSelf ? 'chat-bubble chat-bubble-user' : 'chat-bubble chat-bubble-coach'} style={{ alignSelf: isSelf ? 'flex-end' : 'flex-start' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '800', color: isSelf ? 'var(--neon-blue)' : 'var(--neon-pink)' }}>{msg.sender}</span>
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{msg.time}</span>
                        </div>
                        <p style={{ margin: '0', fontSize: '11px', color: 'white', fontWeight: '500' }}>{msg.text}</p>
                      </div>
                    );
                  })}
                </div>
 
                <form onSubmit={handleClanSendMessage} style={{ display: 'flex', gap: '8px', borderTop: '1.5px solid var(--border-color)', paddingTop: '10px' }}>
                  <input 
                    type="text" 
                    value={clanInput}
                    onChange={(e) => setClanInput(e.target.value)}
                    placeholder="Message crew..."
                    className="cyber-input"
                    style={{ padding: '8px 12px', fontSize: '12px' }}
                  />
                  <button type="submit" style={{ background: 'var(--neon-blue)', border: 'none', color: 'black', borderRadius: '10px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', boxShadow: 'var(--glow-blue)', transition: 'transform 0.1s ease' }}>
                    <Send size={12} />
                  </button>
                </form>
              </div>
            </div>

            {/* TAB: AI COACH */}
            <div style={{ display: activeTab === 'coach' ? 'flex' : 'none', flexDirection: 'column', gap: '14px', padding: '16px', height: '100%' }} className="fade-in">
              
              {/* Coach Header Banner */}
              <div className="card-cyber card-cyber-static p-3" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid var(--neon-purple)' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(157, 78, 221, 0.08)',
                  border: '1.5px solid var(--neon-purple)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(157, 78, 221, 0.15)'
                }}>
                  <Sparkles size={18} className="text-neon-purple glow-active-pulse" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <h4 className="text-sm m-0" style={{ color: 'white', fontWeight: '800' }}>Synergy AI Coach</h4>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--neon-green)', filter: 'drop-shadow(0 0 3px var(--neon-green))' }}></span>
                  </div>
                  <p className="text-xs m-0" style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Tactical Route Assistant • Online
                  </p>
                </div>
              </div>

              {/* Chat Thread Panel */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(5, 5, 9, 0.4)', border: '1.5px solid var(--border-color)', borderRadius: '18px', padding: '14px', minHeight: '230px' }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 0' }}>
                  {coachMessages.map((msg) => {
                    const isCoach = msg.sender === 'coach';
                    return (
                      <div 
                        key={msg.id} 
                        className={isCoach ? 'chat-bubble chat-bubble-coach' : 'chat-bubble chat-bubble-user'} 
                        style={{ 
                          alignSelf: isCoach ? 'flex-start' : 'flex-end',
                          border: isCoach ? '1.5px solid var(--neon-purple)' : '1.5px solid var(--neon-blue)',
                          boxShadow: isCoach ? '0 0 8px rgba(157, 78, 221, 0.05)' : '0 0 8px rgba(0, 229, 255, 0.05)'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' }}>
                          <span style={{ fontSize: '9px', fontWeight: '800', color: isCoach ? 'var(--neon-purple)' : 'var(--neon-blue)' }}>
                            {isCoach ? '🛡️ Coach' : 'You'}
                          </span>
                          <span style={{ fontSize: '8px', color: 'var(--text-muted)' }}>{msg.time}</span>
                        </div>
                        <p style={{ margin: '0', fontSize: '11px', color: 'white', lineHeight: '1.45', fontWeight: '500' }}>{msg.text}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Action Suggestion Chips */}
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '6px', borderTop: '1px solid rgba(255,255,255,0.02)', paddingTop: '8px', scrollbarWidth: 'none' }}>
                  <button 
                    onClick={() => handleCoachSendMessage(null, "routes")}
                    className="btn-secondary focus-ring btn-sm"
                    style={{ fontSize: '9px', whiteSpace: 'nowrap', borderRadius: '12px', border: '1px solid rgba(157, 78, 221, 0.25)', color: 'var(--neon-purple)', padding: '4px 10px' }}
                  >
                    Plan route
                  </button>
                  <button 
                    onClick={() => handleCoachSendMessage(null, "pace")}
                    className="btn-secondary focus-ring btn-sm"
                    style={{ fontSize: '9px', whiteSpace: 'nowrap', borderRadius: '12px', border: '1px solid rgba(157, 78, 221, 0.25)', color: 'var(--neon-purple)', padding: '4px 10px' }}
                  >
                    Check pace
                  </button>
                  <button 
                    onClick={() => handleCoachSendMessage(null, "gps")}
                    className="btn-secondary focus-ring btn-sm"
                    style={{ fontSize: '9px', whiteSpace: 'nowrap', borderRadius: '12px', border: '1px solid rgba(157, 78, 221, 0.25)', color: 'var(--neon-purple)', padding: '4px 10px' }}
                  >
                    How to run GPS?
                  </button>
                  <button 
                    onClick={() => handleCoachSendMessage(null, "hello")}
                    className="btn-secondary focus-ring btn-sm"
                    style={{ fontSize: '9px', whiteSpace: 'nowrap', borderRadius: '12px', border: '1px solid rgba(157, 78, 221, 0.25)', color: 'var(--neon-purple)', padding: '4px 10px' }}
                  >
                    Calibrate
                  </button>
                </div>

                {/* Input Area */}
                <form onSubmit={handleCoachSendMessage} style={{ display: 'flex', gap: '8px', borderTop: '1.5px solid var(--border-color)', paddingTop: '10px', alignItems: 'center' }}>
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
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', position: 'absolute', right: '10px', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                      title="Voice Input (Coming Soon)"
                    >
                      <Settings size={12} className="text-neon-purple" style={{ opacity: 0.6 }} />
                    </button>
                  </div>
                  <button type="submit" className="focus-ring" style={{ background: 'var(--neon-purple)', border: 'none', color: 'white', borderRadius: '10px', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--glow-purple)', transition: 'transform 0.1s ease', flexShrink: 0 }}>
                    <Send size={12} />
                  </button>
                </form>
              </div>
            </div>

          </div>

          {/* Navigation Bar */}
          <div style={{
            height: '60px',
            borderTop: '1.5px solid var(--border-color)',
            background: 'rgba(10, 10, 20, 0.95)',
            backdropFilter: 'blur(10px)',
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            zIndex: 100
          }}>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`tab-btn ${activeTab === 'dashboard' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'dashboard' ? 'var(--neon-pink)' : 'var(--text-secondary)' }}
            >
              <Home size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Home</span>
            </button>

            <button 
              onClick={() => setActiveTab('map')}
              className={`tab-btn ${activeTab === 'map' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'map' ? 'var(--neon-pink)' : 'var(--text-secondary)' }}
            >
              <Compass size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Map</span>
            </button>

            <button 
              onClick={() => setActiveTab('conquests')}
              className={`tab-btn ${activeTab === 'conquests' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'conquests' ? 'var(--neon-blue)' : 'var(--text-secondary)' }}
            >
              <Shield size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Conquests</span>
            </button>

            <button 
              onClick={() => setActiveTab('clans')}
              className={`tab-btn ${activeTab === 'clans' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'clans' ? 'var(--neon-yellow)' : 'var(--text-secondary)' }}
            >
              <Users size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Clans</span>
            </button>

            <button 
              onClick={() => setActiveTab('coach')}
              className={`tab-btn ${activeTab === 'coach' ? 'tab-btn-active' : ''}`}
              style={{ color: activeTab === 'coach' ? 'var(--neon-purple)' : 'var(--text-secondary)' }}
            >
              <Sparkles size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Coach</span>
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}



