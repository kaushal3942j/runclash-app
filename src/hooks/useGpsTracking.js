import { useState, useEffect, useRef, useCallback } from 'react';
import { GPS_CONFIG, SIMULATION_ROUTES } from '../constants/appConstants';
import { calculateDistance, detectLoopClosure } from '../utils/geoUtils';
import { formatPace } from '../utils/formatters';

export function useGpsTracking({ onLoopDetected }) {
  const [trackingMode, setTrackingMode] = useState('gps'); // 'gps' or 'sim'
  const [simulationRouteKey, setSimulationRouteKey] = useState('lake');

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

  const watchIdRef = useRef(null);
  const timerIdRef = useRef(null);
  const simIndexRef = useRef(0);
  const simTimerRef = useRef(null);
  const autoPauseTimerRef = useRef(null);
  const lastPositionRef = useRef(null);

  const stopTrackingTimers = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (timerIdRef.current !== null) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    if (simTimerRef.current !== null) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    if (autoPauseTimerRef.current !== null) {
      clearTimeout(autoPauseTimerRef.current);
      autoPauseTimerRef.current = null;
    }
  }, []);

  // Clear timers and watchers on unmount
  useEffect(() => {
    return () => {
      stopTrackingTimers();
    };
  }, [stopTrackingTimers]);

  // Core Position Processing Engine: Drift Rejection & Slow Speed Tracking
  const processNewPosition = useCallback((position) => {
    const { latitude, longitude, accuracy, speed: rawSpeed } = position.coords;
    const timestamp = position.timestamp || Date.now();

    // 1. Accuracy Drift Rejection Filter
    if (accuracy && accuracy > GPS_CONFIG.GPS_ACCURACY_THRESHOLD) {
      console.warn(`[GPS Drift Filter] Discarded low-accuracy reading (${Math.round(accuracy)}m > ${GPS_CONFIG.GPS_ACCURACY_THRESHOLD}m)`);
      return;
    }

    setRunState((prev) => {
      if (prev.status !== 'tracking' && prev.status !== 'paused') return prev;

      const newPoint = [latitude, longitude];
      let addedDistance = 0;
      let calculatedSpeed = rawSpeed || 0;

      if (lastPositionRef.current) {
        const prevLat = lastPositionRef.current.lat;
        const prevLng = lastPositionRef.current.lng;
        const prevTime = lastPositionRef.current.timestamp;
        const timeDiffSec = (timestamp - prevTime) / 1000;

        const distKm = calculateDistance(prevLat, prevLng, latitude, longitude);

        if (timeDiffSec > 0.5) {
          const derivedSpeedMps = (distKm * 1000) / timeDiffSec;
          
          // 2. High-speed Teleportation / Vehicle Anti-Cheat Filter
          if (derivedSpeedMps > GPS_CONFIG.SUSTAINED_HIGH_SPEED_LIMIT) {
            console.warn(`[GPS Anti-Cheat] Velocity spike ignored (${derivedSpeedMps.toFixed(1)} m/s > ${GPS_CONFIG.SUSTAINED_HIGH_SPEED_LIMIT} m/s)`);
            return prev;
          }

          // 3. Jitter filter for tiny noise below jitter threshold
          if (distKm < GPS_CONFIG.JITTER_DISTANCE_FILTER) {
            calculatedSpeed = 0;
          } else {
            addedDistance = distKm;
            calculatedSpeed = derivedSpeedMps;
          }
        }
      }

      // Update position reference
      lastPositionRef.current = { lat: latitude, lng: longitude, timestamp };

      const updatedPath = [...prev.path, newPoint];
      const updatedDistance = prev.distance + addedDistance;
      const currentPaceStr = formatPace(calculatedSpeed);
      
      const avgSpeedMps = prev.duration > 0 ? (updatedDistance * 1000) / prev.duration : 0;
      const avgPaceStr = formatPace(avgSpeedMps);

      // Check loop closure if at least 5 points captured
      if (updatedPath.length >= 5 && onLoopDetected) {
        const loopCheck = detectLoopClosure(updatedPath);
        if (loopCheck.isLoop) {
          onLoopDetected(loopCheck);
        }
      }

      return {
        ...prev,
        path: updatedPath,
        distance: parseFloat(updatedDistance.toFixed(3)),
        gpsAccuracy: accuracy ? Math.round(accuracy) : 5,
        speed: parseFloat(calculatedSpeed.toFixed(2)),
        pace: currentPaceStr,
        avgSpeed: parseFloat(avgSpeedMps.toFixed(2)),
        avgPace: avgPaceStr
      };
    });
  }, [onLoopDetected]);

  // Simulation mode loop for testing routes
  const startSimulationMode = useCallback(() => {
    const route = SIMULATION_ROUTES[simulationRouteKey] || SIMULATION_ROUTES.lake;
    simIndexRef.current = 0;

    simTimerRef.current = setInterval(() => {
      if (simIndexRef.current >= route.points.length) {
        clearInterval(simTimerRef.current);
        return;
      }
      const nextPoint = route.points[simIndexRef.current];
      simIndexRef.current += 1;

      processNewPosition({
        coords: {
          latitude: nextPoint[0],
          longitude: nextPoint[1],
          accuracy: 5.0,
          speed: 2.8 // ~10 km/h run pace
        },
        timestamp: Date.now()
      });
    }, 2000);
  }, [simulationRouteKey, processNewPosition]);

  // Live Geolocation Watcher
  const startGpsWatcher = useCallback(() => {
    if (!navigator.geolocation) {
      console.warn('[GPS] Geolocation API not supported');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        processNewPosition(position);
      },
      (error) => {
        console.warn('[GPS] Position watch error:', error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
  }, [processNewPosition]);

  // Start a new run
  const startRun = () => {
    stopTrackingTimers();
    setRunState({
      status: 'tracking',
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
    lastPositionRef.current = null;

    // Duration Timer
    timerIdRef.current = setInterval(() => {
      setRunState((prev) => {
        if (prev.status !== 'tracking' || prev.isAutoPaused) return prev;
        const newDuration = prev.duration + 1;
        const newCalories = Math.floor(newDuration * 0.13 * (prev.speed > 0 ? 1.2 : 0.8));
        return {
          ...prev,
          duration: newDuration,
          calories: newCalories
        };
      });
    }, 1000);

    if (trackingMode === 'sim') {
      startSimulationMode();
    } else {
      startGpsWatcher();
    }
  };

  const pauseRun = () => {
    setRunState((prev) => ({ ...prev, status: 'paused', isAutoPaused: false }));
  };

  const resumeRun = () => {
    setRunState((prev) => ({ ...prev, status: 'tracking', isAutoPaused: false }));
  };

  const completeRun = () => {
    stopTrackingTimers();
    let finalState;
    setRunState((prev) => {
      finalState = { ...prev, status: 'finished' };
      return finalState;
    });
    return finalState;
  };

  const cancelRun = () => {
    stopTrackingTimers();
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
    lastPositionRef.current = null;
  };

  return {
    runState,
    setRunState,
    trackingMode,
    setTrackingMode,
    simulationRouteKey,
    setSimulationRouteKey,
    startRun,
    pauseRun,
    resumeRun,
    completeRun,
    cancelRun
  };
}
