import { supabase, useSupabase, isValidUUID } from '../supabase';

const PENDING_TERRITORIES_KEY = 'clash_pending_territories';
const PENDING_RUNS_KEY = 'clash_pending_runs';

export const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const syncQueueService = {
  getPendingTerritories: () => {
    try {
      const raw = localStorage.getItem(PENDING_TERRITORIES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[SYNC QUEUE] Error reading pending territories:', e);
      return [];
    }
  },

  enqueueTerritory: (territoryItem) => {
    try {
      const current = syncQueueService.getPendingTerritories();
      const claimId = territoryItem.claimId || territoryItem.claim_id || generateUUID();
      const itemToQueue = {
        ...territoryItem,
        claimId,
        createdAt: territoryItem.createdAt || new Date().toISOString()
      };

      const filtered = current.filter(i => (i.claimId || i.claim_id) !== claimId && i.name !== territoryItem.name);
      filtered.push(itemToQueue);
      localStorage.setItem(PENDING_TERRITORIES_KEY, JSON.stringify(filtered));
      console.log('[SYNC QUEUE] Enqueued pending territory claim:', territoryItem.name || claimId);
      return itemToQueue;
    } catch (e) {
      console.error('[SYNC QUEUE] Error enqueueing territory claim:', e);
      return territoryItem;
    }
  },

  getPendingRuns: () => {
    try {
      const raw = localStorage.getItem(PENDING_RUNS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn('[SYNC QUEUE] Error reading pending runs:', e);
      return [];
    }
  },

  enqueueRun: (runItem) => {
    try {
      const current = syncQueueService.getPendingRuns();
      const operationId = runItem.operationId || runItem.operation_id || generateUUID();
      const itemToQueue = {
        ...runItem,
        operationId,
        createdAt: runItem.createdAt || new Date().toISOString()
      };

      const filtered = current.filter(i => (i.operationId || i.operation_id) !== operationId);
      filtered.push(itemToQueue);
      localStorage.setItem(PENDING_RUNS_KEY, JSON.stringify(filtered));
      console.log('[SYNC QUEUE] Enqueued pending run:', operationId);
      return itemToQueue;
    } catch (e) {
      console.error('[SYNC QUEUE] Error enqueueing run:', e);
      return runItem;
    }
  },

  syncAll: async () => {
    if (!useSupabase) return { success: false, reason: 'Supabase inactive' };

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      const sessionUser = session?.user;

      if (!session || !sessionUser || !isValidUUID(sessionUser.id)) {
        console.warn('[SYNC QUEUE WORKER] Pre-check failed: No valid authenticated session.');
        return { success: false, reason: 'No authenticated session' };
      }

      const userId = sessionUser.id;

      // 1. Process Pending Territory Claims
      const pendingTerritories = syncQueueService.getPendingTerritories();
      if (pendingTerritories.length > 0) {
        console.log(`[SYNC QUEUE WORKER] Processing ${pendingTerritories.length} pending territory claim(s)...`);
        const remainingTerritories = [];

        for (let idx = 0; idx < pendingTerritories.length; idx++) {
          const item = pendingTerritories[idx];
          const claimId = item.claimId || item.claim_id || generateUUID();
          const areaVal = typeof item.area === 'number'
            ? item.area
            : parseFloat(String(item.area).replace(/[^\d.]/g, '')) || 0;

          const expiresAt = new Date();
          expiresAt.setHours(expiresAt.getHours() + 72);

          const dbTerr = {
            claim_id: claimId,
            name: item.name,
            owner_id: userId,
            owner_name: item.ownerName || 'Runner',
            clan_name: item.clan || 'None',
            area_sqm: areaVal,
            decay_hours: item.decayHours || 72,
            max_decay_hours: item.maxDecayHours || 72,
            rate: item.rate || 1.0,
            coords: item.coords,
            expires_at: expiresAt.toISOString()
          };

          const { data, error } = await supabase
            .from('territories')
            .insert(dbTerr)
            .select()
            .single();

          if (!error || error.code === '23505') {
            if (error?.code === '23505') {
              console.log(`[SYNC QUEUE WORKER] Claim "${item.name}" (Claim ID: ${claimId}) already synced in DB (23505). Removing from queue.`);
            } else {
              console.log(`[SYNC QUEUE WORKER] Successfully synced territory claim "${item.name}" (Claim ID: ${claimId}).`);
            }
          } else {
            console.warn(`[SYNC QUEUE WORKER] Error syncing territory claim "${item.name}":`, error.message);
            // Stop processing remaining queue on error and preserve retry state
            remainingTerritories.push(...pendingTerritories.slice(idx));
            localStorage.setItem(PENDING_TERRITORIES_KEY, JSON.stringify(remainingTerritories));
            break;
          }
        }

        if (remainingTerritories.length === 0) {
          localStorage.setItem(PENDING_TERRITORIES_KEY, JSON.stringify([]));
        }
      }

      // 2. Process Pending Runs
      const pendingRuns = syncQueueService.getPendingRuns();
      if (pendingRuns.length > 0) {
        console.log(`[SYNC QUEUE WORKER] Processing ${pendingRuns.length} pending run(s)...`);
        const remainingRuns = [];

        for (let idx = 0; idx < pendingRuns.length; idx++) {
          const run = pendingRuns[idx];
          const operationId = run.operationId || run.operation_id || generateUUID();
          
          const distanceKm = parseFloat(run.distance) || parseFloat(run.distanceKm) || 0;
          const durationSeconds = parseInt(run.duration) || parseInt(run.durationSeconds) || 0;
          const caloriesVal = parseInt(run.calories) || 0;
          
          let paceVal = null;
          if (typeof run.pace === 'number') paceVal = run.pace;
          else if (typeof run.paceSecondsPerKm === 'number') paceVal = run.paceSecondsPerKm;
          else if (typeof run.pace === 'string' && run.pace.includes(':')) {
            const [m, s] = run.pace.split(':').map(Number);
            if (!isNaN(m) && !isNaN(s)) paceVal = m * 60 + s;
          }

          let speedVal = parseFloat(run.speed) || parseFloat(run.averageSpeedKmh) || null;

          const dbRun = {
            operation_id: operationId,
            user_id: userId,
            distance_km: distanceKm,
            duration_seconds: durationSeconds,
            pace_seconds_per_km: paceVal,
            average_speed_kmh: speedVal,
            calories: caloriesVal,
            gps_path: run.path || run.gps_path || [],
            start_time: run.startTime || run.start_time || new Date().toISOString(),
            end_time: run.endTime || run.end_time || new Date().toISOString(),
            summary_statistics: run.summaryStatistics || run.summary_statistics || {}
          };

          const { data, error } = await supabase
            .from('runs')
            .insert(dbRun)
            .select()
            .single();

          if (!error || error.code === '23505') {
            if (error?.code === '23505') {
              console.log(`[SYNC QUEUE WORKER] Run (Operation ID: ${operationId}) already synced in DB (23505). Removing from queue.`);
            } else {
              console.log(`[SYNC QUEUE WORKER] Successfully synced run (Operation ID: ${operationId}).`);
            }
          } else {
            console.warn(`[SYNC QUEUE WORKER] Error syncing run (Operation ID: ${operationId}):`, error.message);
            remainingRuns.push(...pendingRuns.slice(idx));
            localStorage.setItem(PENDING_RUNS_KEY, JSON.stringify(remainingRuns));
            break;
          }
        }

        if (remainingRuns.length === 0) {
          localStorage.setItem(PENDING_RUNS_KEY, JSON.stringify([]));
        }
      }

      return { success: true };
    } catch (err) {
      console.error('[SYNC QUEUE WORKER] Exception during queue synchronization:', err);
      return { success: false, error: err.message };
    }
  }
};
