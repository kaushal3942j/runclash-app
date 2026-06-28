import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { 
  MapPin, Play, Square, Shield, Zap, Award, Users, Compass, 
  Coins, MessageSquare, Send, Sparkles, AlertCircle, RefreshCw, Trophy, Target,
  Lock, Mail, User, ShieldCheck, LogOut, CheckCircle, Navigation, Radio
} from 'lucide-react';
import { 
  isFirebaseActive, subscribeToAuth, registerUser, loginUser, loginGuest, logout,
  syncUserStats, subscribeToTerritories, saveNewTerritory, updateTerritory
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
  const [activeTab, setActiveTab] = useState('map'); // 'map', 'conquests', 'clans', 'coach'
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
    status: 'idle', // 'idle', 'tracking', 'finished'
    path: [],
    distance: 0,
    duration: 0,
    pace: '--:--',
    gpsAccuracy: null
  });

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
    // 1. Subscribe to Auth Changes
    const unsubscribeAuth = subscribeToAuth((user) => {
      setCurrentUser(user);
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
      unsubscribeAuth();
      unsubscribeTerritories();
    };
  }, []);

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
      } else if (authMode === 'signup') {
        if (!authName.trim()) throw new Error("Display name is required.");
        const profile = await registerUser(authEmail, authPassword, authName, authClan);
        setCurrentUser(profile);
      } else if (authMode === 'guest') {
        const name = authPassword.trim() || authName.trim() || `Runner_${Math.floor(1000 + Math.random() * 9000)}`;
        const profile = await loginGuest(name, authClan);
        setCurrentUser(profile);
      }
    } catch (err) {
      setAuthError(err.message || "Authentication failed.");
      addLog(`Auth Error: ${err.message}`);
    }
  };

  const handleLogout = async () => {
    await logout();
    setCurrentUser(null);
    stopTracking();
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
      
      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }
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
      const polyColor = terr.ownerName === 'Unclaimed' ? '#fffb00' : isOwner ? '#00e5ff' : '#ff007f';

      const poly = L.polygon(terr.coords, {
        color: polyColor,
        fillColor: polyColor,
        fillOpacity: 0.25,
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

  const startTracking = () => {
    if (runState.status !== 'idle') return;

    addLog("GPS: Calibrating tracking device...");
    
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
    let elapsed = 0;
    timerIntervalRef.current = setInterval(() => {
      elapsed += 1;
      setRunState(prev => {
        const paceMin = Math.floor((elapsed / 60) / (prev.distance || 0.01));
        const paceSec = Math.floor((elapsed % 60) / (prev.distance || 0.01)) % 60;
        return {
          ...prev,
          duration: elapsed,
          pace: isFinite(paceMin) && prev.distance > 0.02 ? `${paceMin}:${paceSec.toString().padStart(2, '0')}` : '5:30'
        };
      });
    }, 1000);

    // Initial Path Polyline
    if (mapInstanceRef.current) {
      polylineRef.current = L.polyline([], {
        color: '#ff007f',
        weight: 4,
        className: 'glow-active-pulse'
      }).addTo(mapInstanceRef.current);

      const runnerIcon = L.divIcon({
        className: 'custom-runner-icon',
        html: `<div style="background-color: var(--neon-pink); width: 16px; height: 16px; border-radius: 50%; box-shadow: 0 0 15px var(--neon-pink); border: 3px solid white;"></div>`,
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
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          setRunState(prev => {
            // Filter poor accuracy coordinates (>25 meters accuracy discarded)
            if (accuracy > 25) {
              addLog(`GPS: Poor signal accuracy (${Math.round(accuracy)}m). Discarding point.`);
              return { ...prev, gpsAccuracy: accuracy };
            }

            const newPoint = [lat, lng];
            const updatedPath = [...prev.path, newPoint];
            
            // Calculate distance
            let incrementalDist = 0;
            if (prev.path.length > 0) {
              const lastPoint = prev.path[prev.path.length - 1];
              incrementalDist = getGeodeticDistance(lastPoint[0], lastPoint[1], lat, lng);
            }
            const updatedDistance = parseFloat((prev.distance + incrementalDist).toFixed(3));

            // Update Map visual
            if (polylineRef.current) polylineRef.current.setLatLngs(updatedPath);
            if (runnerMarkerRef.current) runnerMarkerRef.current.setLatLng(newPoint);
            if (mapInstanceRef.current) mapInstanceRef.current.panTo(newPoint);

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
          addLog(`GPS Error: ${error.message}`);
          alert(`GPS tracking error: ${error.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    } else {
      // PRELOADED DEVELOPER SIMULATOR
      const route = SIMULATION_ROUTES[simulationRouteKey];
      addLog(`GPS Sim: Starting developer walk on loop: ${route.name}`);
      let idx = 0;

      simIntervalRef.current = setInterval(() => {
        if (idx >= route.points.length) {
          clearInterval(simIntervalRef.current);
          finishRealRun(route.points);
          return;
        }

        const point = route.points[idx];
        setRunState(prev => {
          const updatedPath = [...prev.path, point];
          let stepDist = 0;
          if (prev.path.length > 0) {
            const lastPoint = prev.path[prev.path.length - 1];
            stepDist = getGeodeticDistance(lastPoint[0], lastPoint[1], point[0], point[1]);
          }
          const updatedDistance = parseFloat((prev.distance + stepDist).toFixed(2));

          if (polylineRef.current) polylineRef.current.setLatLngs(updatedPath);
          if (runnerMarkerRef.current) runnerMarkerRef.current.setLatLng(point);
          if (mapInstanceRef.current) mapInstanceRef.current.panTo(point);

          return {
            ...prev,
            path: updatedPath,
            distance: updatedDistance
          };
        });

        idx++;
      }, 1500);
    }
  };

  const stopTracking = () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    clearInterval(simIntervalRef.current);
    clearInterval(timerIntervalRef.current);

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

  const finishRealRun = async (loopCoordinates) => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    clearInterval(simIntervalRef.current);
    clearInterval(timerIntervalRef.current);

    addLog("GPS: Closed loop verification verified.");
    const areaSqM = calculatePolygonArea(loopCoordinates);
    const formattedArea = `${areaSqM.toLocaleString()} m²`;

    if (areaSqM < 200) {
      addLog("GeoCalc: Loop area is too small (<200 m²). Territory not recorded.");
      alert(`Loop area (${formattedArea}) was too small. Run a larger path!`);
      stopTracking();
      return;
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
  const handleCoachSendMessage = (e) => {
    e.preventDefault();
    if (!coachInput.trim()) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: coachInput,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setCoachMessages(prev => [...prev, userMsg]);
    const input = coachInput.toLowerCase();
    setCoachInput('');

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px' }}>
        <div className="glass-panel-heavy card-cyber" style={{ width: '420px', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div style={{ textAlign: 'center' }}>
            <span className="text-neon-pink" style={{ fontSize: '13px', fontWeight: 'bold', letterSpacing: '3px', textTransform: 'uppercase' }}>RunClash MVP // GPS Conquest</span>
            <h1 style={{ margin: '8px 0 0 0', fontSize: '36px', color: 'white', fontWeight: '800', letterSpacing: '-1px' }}>RUNCLASH</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>
              Connect your GPS to conquer real-world loops. Powered by {isFirebaseActive() ? 'Supabase Cloud' : 'LocalStorage persistence'}.
            </p>
          </div>

          {authError && (
            <div style={{ background: 'rgba(255, 0, 127, 0.1)', border: '1px solid var(--neon-pink)', color: 'white', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={14} className="text-neon-pink" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {authMode !== 'guest' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="email" 
                    value={authEmail} 
                    onChange={e => setAuthEmail(e.target.value)}
                    required
                    placeholder="email@provider.com"
                    style={{ width: '100%', padding: '12px 12px 12px 36px', background: '#090912', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600' }}>Password / Nickname</label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type={authMode === 'guest' ? 'text' : 'password'}
                  value={authPassword} 
                  onChange={e => setAuthPassword(e.target.value)}
                  required={authMode !== 'guest'}
                  placeholder={authMode === 'guest' ? 'e.g. Lakshya' : '••••••••'}
                  style={{ width: '100%', padding: '12px 12px 12px 36px', background: '#090912', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none' }}
                />
              </div>
            </div>

            {authMode === 'signup' && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '600' }}>Display Name</label>
                  <input 
                    type="text" 
                    value={authName} 
                    onChange={e => setAuthName(e.target.value)}
                    required
                    placeholder="e.g. Lakshya"
                    style={{ width: '100%', padding: '12px', background: '#090912', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none' }}
                  />
                </div>
              </>
            )}

            {(authMode === 'signup' || authMode === 'guest') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600' }}>Choose Crew / Clan</label>
                <select 
                  value={authClan} 
                  onChange={e => setAuthClan(e.target.value)}
                  style={{ width: '100%', padding: '12px', background: '#090912', border: '1px solid var(--border-color)', borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none', fontFamily: 'var(--font-sans)' }}
                >
                  <option value="Udaipur Racers">Udaipur Racers (Cyan)</option>
                  <option value="GITS Runners">GITS Runners (Pink)</option>
                  <option value="Delhi Marathon Club">Delhi Marathon Club (White)</option>
                </select>
              </div>
            )}

            <button type="submit" className="btn-neon" style={{ marginTop: '10px' }}>
              {authMode === 'login' ? 'Access Sector' : authMode === 'signup' ? 'Create Account' : 'Enter Arena'}
            </button>
          </form>

          {/* Form Switching Toggles */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', fontSize: '12px', textAlign: 'center' }}>
            {authMode === 'login' ? (
              <>
                <div>New runner? <span className="text-neon-blue" style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setAuthMode('signup')}>Sign Up</span></div>
                <div>Just exploring? <span className="text-neon-pink" style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setAuthMode('guest')}>Enter as Guest</span></div>
              </>
            ) : authMode === 'signup' ? (
              <div>Already registered? <span className="text-neon-blue" style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setAuthMode('login')}>Sign In</span></div>
            ) : (
              <div>Want cloud account? <span className="text-neon-blue" style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={() => setAuthMode('signup')}>Sign Up</span></div>
            )}
          </div>

        </div>
      </div>
    );
  }

  // ACTIVE GAMEPLAY DASHBOARD
  return (
    <div className="sim-container">
      
      {/* SIMULATOR / CONFIGURATION CONTROL PANEL */}
      <div className="glass-panel-heavy card-cyber" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content' }}>
        <div>
          <span className="text-neon-pink" style={{ fontSize: '11px', fontWeight: 'bold', letterSpacing: '2px', textTransform: 'uppercase' }}>MVP Dashboard</span>
          <h2 style={{ margin: '6px 0 0 0', fontSize: '26px', color: 'white', fontWeight: '800' }}>GPS Tracker Setup</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', lineHeight: '1.4' }}>
            Choose your execution mode. Step outside and run in loops with <b>Real GPS</b>, or test closed loops from your computer with <b>Developer Sim</b>.
          </p>
        </div>

        {/* Tracking Mode selection */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: '600' }}>Location Source Mode</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <button 
              className={trackingMode === 'gps' ? 'btn-neon btn-neon-blue' : 'btn-secondary'}
              onClick={() => setTrackingMode('gps')}
              disabled={runState.status !== 'idle'}
              style={{ fontSize: '11px', gap: '4px' }}
            >
              <Navigation size={12} /> Real GPS
            </button>
            <button 
              className={trackingMode === 'sim' ? 'btn-neon' : 'btn-secondary'}
              onClick={() => setTrackingMode('sim')}
              disabled={runState.status !== 'idle'}
              style={{ fontSize: '11px', gap: '4px' }}
            >
              <Radio size={12} /> Developer Sim
            </button>
          </div>
        </div>

        {/* Predefined Simulator selection (Only shown if mode is sim) */}
        {trackingMode === 'sim' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600' }}>Mock Simulator Loop</label>
            <select 
              value={simulationRouteKey}
              onChange={e => setSimulationRouteKey(e.target.value)}
              disabled={runState.status !== 'idle'}
              style={{ background: '#121222', border: '1px solid var(--border-color)', color: 'white', padding: '10px', borderRadius: '8px', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '13px' }}
            >
              <option value="lake">Fateh Sagar Lake Loop (3.2 km)</option>
              <option value="foothills">Sajjan Garh Foothills Base (2.1 km)</option>
              <option value="monument">Udaipur Castle Park (1.4 km)</option>
            </select>
          </div>
        )}

        {/* Control execution buttons */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {runState.status === 'idle' ? (
            <button className="btn-neon" onClick={startTracking} style={{ width: '100%', fontSize: '12px' }}>
              <Play size={14} /> Start Tracking
            </button>
          ) : (
            <button className="btn-secondary" onClick={stopTracking} style={{ width: '100%', borderColor: 'var(--neon-pink)', color: 'var(--neon-pink)', fontSize: '12px' }}>
              <Square size={14} /> Stop Run
            </button>
          )}

          <button 
            className="btn-secondary"
            onClick={handleLogout}
            style={{ width: '100%', fontSize: '12px', gap: '4px' }}
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>

        {/* Engine logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: '600' }}>GPS Engine Console logs</span>
          <div style={{
            background: '#040408',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            padding: '12px',
            height: '180px',
            overflowY: 'auto',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            color: 'var(--neon-green)',
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '6px'
          }}>
            {consoleLogs.map((log, i) => (
              <div key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.01)', paddingBottom: '3px' }}>
                <span style={{ color: 'var(--text-muted)' }}>[{new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}]</span> {log}
              </div>
            ))}
          </div>
        </div>

        {/* Cloud database active details */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255, 255, 255, 0.02)', padding: '10px 14px', borderRadius: '10px', border: '1.5px solid var(--border-color)' }}>
          <ShieldCheck size={16} className={isFirebaseActive() ? 'text-neon-green' : 'text-neon-yellow'} />
          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Active Sync: <b>{isFirebaseActive() ? 'Supabase Cloud (PostgreSQL)' : 'Local Offline Database'}</b>
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
            padding: '14px 16px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: 'rgba(14, 14, 26, 0.9)',
            zIndex: 100
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #00e5ff 0%, #9d4edd 100%)',
                border: '2.5px solid var(--neon-blue)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '13px'
              }}>
                {currentUser.displayName?.substring(0,1).toUpperCase() || 'U'}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700' }}>{currentUser.displayName}</span>
                </div>
                <span style={{ fontSize: '9px', color: 'var(--neon-blue)', fontWeight: 'bold' }}>{currentUser.clan}</span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: 'rgba(255, 255, 255, 0.05)', padding: '3px 8px', borderRadius: '20px' }}>
                <Coins size={10} className="text-neon-yellow" />
                <span style={{ fontSize: '11px', fontWeight: '700', fontFamily: 'var(--font-mono)' }}>{currentUser.coins}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>LVL {currentUser.level}</span>
                <div style={{ width: '45px', height: '4px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '2px' }}>
                  <div style={{ width: `${(currentUser.xp / (currentUser.nextLevelXp || 2500)) * 100}%`, height: '100%', background: 'var(--neon-pink)' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Active Tab Screen Content */}
          <div style={{ flex: 1, position: 'relative', overflowY: activeTab === 'map' ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
            
            {/* TAB: MAP */}
            <div style={{ display: activeTab === 'map' ? 'flex' : 'none', flexDirection: 'column', height: '100%', width: '100%' }}>
              
              <div id="map" style={{ flex: 1, width: '100%' }}></div>

              {/* Real-time stats box */}
              {runState.status === 'tracking' && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '16px',
                  right: '16px',
                  background: 'rgba(7, 7, 12, 0.9)',
                  backdropFilter: 'blur(8px)',
                  border: '1.5px solid var(--neon-pink)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  zIndex: 999,
                  display: 'flex',
                  justifyContent: 'space-between',
                  boxShadow: '0 10px 20px rgba(0,0,0,0.5)'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Distance</span>
                    <h3 style={{ margin: '1px 0 0 0', fontSize: '18px', fontFamily: 'var(--font-mono)', color: 'white' }}>{runState.distance} <span style={{ fontSize: '10px' }}>KM</span></h3>
                  </div>
                  <div style={{ textAlign: 'center', borderLeft: '1px solid rgba(255, 255, 255, 0.08)', borderRight: '1px solid rgba(255, 255, 255, 0.08)', padding: '0 10px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Pace</span>
                    <h3 style={{ margin: '1px 0 0 0', fontSize: '18px', fontFamily: 'var(--font-mono)', color: 'var(--neon-green)' }}>{runState.pace}</h3>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Time</span>
                    <h3 style={{ margin: '1px 0 0 0', fontSize: '18px', fontFamily: 'var(--font-mono)', color: 'white' }}>
                      {Math.floor(runState.duration / 60)}:{(runState.duration % 60).toString().padStart(2, '0')}
                    </h3>
                  </div>
                </div>
              )}

              {/* Accuracy visual alert (only in real GPS mode) */}
              {runState.status === 'tracking' && trackingMode === 'gps' && runState.gpsAccuracy && (
                <div style={{
                  position: 'absolute',
                  top: '90px',
                  left: '16px',
                  background: 'rgba(7, 7, 12, 0.8)',
                  borderRadius: '20px',
                  padding: '4px 10px',
                  fontSize: '9px',
                  zIndex: 999,
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: runState.gpsAccuracy < 15 ? 'var(--neon-green)' : 'var(--neon-yellow)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: runState.gpsAccuracy < 15 ? 'var(--neon-green)' : 'var(--neon-yellow)' }}></div>
                  GPS Accuracy: {Math.round(runState.gpsAccuracy)}m
                </div>
              )}

              {/* Action trigger button */}
              {runState.status === 'idle' && (
                <div style={{
                  position: 'absolute',
                  bottom: '16px',
                  left: '16px',
                  right: '16px',
                  background: 'rgba(7, 7, 12, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '16px',
                  padding: '12px 14px',
                  zIndex: 999,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Compass size={18} className="text-neon-pink" />
                    <div>
                      <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Selected Tracker</span>
                      <h4 style={{ margin: '0', fontSize: '12px', color: 'white', fontWeight: 'bold' }}>
                        {trackingMode === 'gps' ? 'Outside Real GPS Stride' : SIMULATION_ROUTES[simulationRouteKey].name}
                      </h4>
                    </div>
                  </div>
                  <button 
                    onClick={startTracking}
                    style={{
                      background: 'var(--grad-primary)',
                      border: 'none',
                      color: 'white',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      boxShadow: 'var(--glow-pink)'
                    }}
                  >
                    Start Run
                  </button>
                </div>
              )}
            </div>

            {/* TAB: CONQUESTS */}
            <div style={{ display: activeTab === 'conquests' ? 'flex' : 'none', flexDirection: 'column', gap: '20px', padding: '16px' }}>
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Target size={15} className="text-neon-blue" /> Controlled Sectors ({territories.filter(t => t.ownerId === currentUser.uid).length})
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {territories.filter(t => t.ownerId === currentUser.uid).length === 0 ? (
                    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--border-color)', borderRadius: '12px', padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      No controlled sectors detected. Touch grass, start your GPS run, and enclose a loop to capture!
                    </div>
                  ) : (
                    territories.filter(t => t.ownerId === currentUser.uid).map(terr => (
                      <div key={terr.id} className="card-cyber" style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <h4 style={{ margin: '0', fontSize: '13px', color: 'white', fontWeight: '700' }}>{terr.name}</h4>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Yields +{terr.rate} Coins/hr • Area {terr.area}</span>
                          </div>
                          <button 
                            onClick={() => useShield(terr.id)}
                            style={{
                              background: 'rgba(0, 229, 255, 0.08)',
                              border: '1px solid var(--neon-blue)',
                              color: 'var(--neon-blue)',
                              borderRadius: '6px',
                              padding: '4px 8px',
                              fontSize: '9px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontWeight: 'bold'
                            }}
                          >
                            <Shield size={10} /> Fortify
                          </button>
                        </div>

                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginBottom: '2px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Shield integrity</span>
                            <span style={{ color: 'var(--neon-blue)', fontWeight: 'bold' }}>{terr.decayHours || 72}h remaining</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${((terr.decayHours || 72) / (terr.maxDecayHours || 72)) * 100}%`, height: '100%', background: 'linear-gradient(90deg, var(--neon-blue) 0%, var(--neon-pink) 100%)' }}></div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Power-up Shop */}
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Coins size={15} className="text-neon-yellow" /> Power-Up Armory
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ background: '#121222', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
                    <Shield size={22} className="text-neon-blue" style={{ filter: 'drop-shadow(0 0 5px var(--neon-blue))' }} />
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'white' }}>Shield (24h)</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Inventory: {inventory.shields}</span>
                    <button 
                      onClick={() => buyItem('shields', shopCosts.shield)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <Coins size={9} className="text-neon-yellow" /> {shopCosts.shield}
                    </button>
                  </div>

                  <div style={{ background: '#121222', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', textAlign: 'center' }}>
                    <Zap size={22} className="text-neon-pink" style={{ filter: 'drop-shadow(0 0 5px var(--neon-pink))' }} />
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'white' }}>Speed Boots</span>
                    <span style={{ fontSize: '9px', color: 'var(--text-secondary)' }}>Inventory: {inventory.boots}</span>
                    <button 
                      onClick={() => buyItem('boots', shopCosts.boots)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: 'white',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <Coins size={9} className="text-neon-yellow" /> {shopCosts.boots}
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* TAB: CLANS */}
            <div style={{ display: activeTab === 'clans' ? 'flex' : 'none', flexDirection: 'column', gap: '20px', padding: '16px', height: '100%' }}>
              <div>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Trophy size={15} className="text-neon-yellow" /> Clan Standings
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ background: 'rgba(0, 229, 255, 0.05)', border: '1px solid rgba(0, 229, 255, 0.15)', borderRadius: '12px', padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--neon-blue)' }}>1. Udaipur Racers</span>
                      <span>48% Domain</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '48%', height: '100%', background: 'var(--neon-blue)' }}></div>
                    </div>
                  </div>

                  <div style={{ background: 'rgba(255, 0, 127, 0.05)', border: '1px solid rgba(255, 0, 127, 0.15)', borderRadius: '12px', padding: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', marginBottom: '3px' }}>
                      <span style={{ color: 'var(--neon-pink)' }}>2. GITS Runners</span>
                      <span>32% Domain</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: '32%', height: '100%', background: 'var(--neon-pink)' }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clan Chat */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', background: '#090910', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '10px', minHeight: '220px' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MessageSquare size={13} className="text-neon-blue" /> Crew Comm Channel
                </span>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', padding: '4px 0' }}>
                  {clanMessages.map((msg) => (
                    <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '6px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', alignSelf: msg.sender.includes('You') ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: msg.sender.includes('You') ? 'var(--neon-blue)' : 'var(--text-secondary)' }}>{msg.sender}</span>
                        <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>{msg.time}</span>
                      </div>
                      <p style={{ margin: '0', fontSize: '11px', color: 'white' }}>{msg.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleClanSendMessage} style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                  <input 
                    type="text" 
                    value={clanInput}
                    onChange={(e) => setClanInput(e.target.value)}
                    placeholder="Message crew..."
                    style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '6px 10px', fontSize: '11px', outline: 'none', fontFamily: 'var(--font-sans)' }}
                  />
                  <button type="submit" style={{ background: 'var(--neon-blue)', border: 'none', color: 'black', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Send size={11} />
                  </button>
                </form>
              </div>
            </div>

            {/* TAB: AI COACH */}
            <div style={{ display: activeTab === 'coach' ? 'flex' : 'none', flexDirection: 'column', gap: '12px', padding: '16px', height: '100%' }}>
              <div className="card-cyber" style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Sparkles size={22} className="text-neon-yellow" style={{ filter: 'drop-shadow(0 0 4px var(--neon-yellow))' }} />
                <div>
                  <h4 style={{ margin: '0', fontSize: '13px', color: 'white', fontWeight: '700' }}>Synergy AI Coach</h4>
                  <p style={{ margin: '0', fontSize: '9px', color: 'var(--text-secondary)' }}>GPS Sector Planner</p>
                </div>
              </div>

              {/* Chat Thread */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', background: '#090910', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '10px', minHeight: '220px' }}>
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {coachMessages.map((msg) => (
                    <div key={msg.id} style={{
                      alignSelf: msg.sender === 'coach' ? 'flex-start' : 'flex-end',
                      background: msg.sender === 'coach' ? 'rgba(157, 78, 221, 0.1)' : 'rgba(0, 229, 255, 0.1)',
                      border: msg.sender === 'coach' ? '1px solid rgba(157, 78, 221, 0.15)' : '1px solid rgba(0, 229, 255, 0.15)',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      maxWidth: '85%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: msg.sender === 'coach' ? 'var(--neon-purple)' : 'var(--neon-blue)' }}>
                          {msg.sender === 'coach' ? '🛡️ Coach' : 'You'}
                        </span>
                        <span style={{ fontSize: '7px', color: 'var(--text-muted)' }}>{msg.time}</span>
                      </div>
                      <p style={{ margin: '0', fontSize: '11px', color: 'white', lineHeight: '1.4' }}>{msg.text}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={handleCoachSendMessage} style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                  <input 
                    type="text" 
                    value={coachInput}
                    onChange={(e) => setCoachInput(e.target.value)}
                    placeholder="Ask Coach (e.g. 'gps', 'pace')..."
                    style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'white', padding: '6px 10px', fontSize: '11px', outline: 'none', fontFamily: 'var(--font-sans)' }}
                  />
                  <button type="submit" style={{ background: 'var(--neon-purple)', border: 'none', color: 'white', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <Send size={11} />
                  </button>
                </form>
              </div>
            </div>

          </div>

          {/* Navigation Bar */}
          <div style={{
            height: '60px',
            borderTop: '1px solid var(--border-color)',
            background: 'rgba(14, 14, 26, 0.95)',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            zIndex: 100
          }}>
            <button 
              onClick={() => setActiveTab('map')}
              style={{ background: 'none', border: 'none', color: activeTab === 'map' ? 'var(--neon-pink)' : 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
            >
              <Compass size={18} />
              <span style={{ fontSize: '9px', fontWeight: 'bold' }}>Map</span>
            </button>

            <button 
              onClick={() => setActiveTab('conquests')}
              style={{ background: 'none', border: 'none', color: activeTab === 'conquests' ? 'var(--neon-blue)' : 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
            >
              <Shield size={18} />
              <span style={{ fontSize: '9px', fontWeight: 'bold' }}>Conquests</span>
            </button>

            <button 
              onClick={() => setActiveTab('clans')}
              style={{ background: 'none', border: 'none', color: activeTab === 'clans' ? 'var(--neon-yellow)' : 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
            >
              <Users size={18} />
              <span style={{ fontSize: '9px', fontWeight: 'bold' }}>Clans</span>
            </button>

            <button 
              onClick={() => setActiveTab('coach')}
              style={{ background: 'none', border: 'none', color: activeTab === 'coach' ? 'var(--neon-purple)' : 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer' }}
            >
              <Sparkles size={18} />
              <span style={{ fontSize: '9px', fontWeight: 'bold' }}>Coach</span>
            </button>
          </div>

        </div>
      </div>

    </div>
  );
}
