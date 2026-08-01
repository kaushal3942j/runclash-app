import { saveCompletedRun } from '../supabase';

export const runService = {
  saveRun: async (runData) => {
    try {
      const res = await saveCompletedRun(runData);
      return { success: res.success !== false, data: res.data, error: res.error || null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  },
  loadHistory: () => {
    try {
      const runs = JSON.parse(localStorage.getItem('clash_runs')) || [];
      return { success: true, data: runs, error: null };
    } catch (err) {
      return { success: false, data: [], error: err.message };
    }
  },
  loadTodayRun: () => {
    try {
      const runs = JSON.parse(localStorage.getItem('clash_runs')) || [];
      if (runs.length === 0) return { success: true, data: null };
      const todayStr = new Date().toISOString().split('T')[0];
      const todayRuns = runs.filter(r => {
        const rDate = (r.endTime || r.startTime || r.createdAt || r.date || '').split('T')[0];
        return rDate === todayStr;
      });
      const latest = todayRuns.length > 0 ? todayRuns[todayRuns.length - 1] : runs[runs.length - 1];
      return { success: true, data: latest };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  }
};
