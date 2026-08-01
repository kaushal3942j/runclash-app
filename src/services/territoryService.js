import { saveNewTerritory, updateTerritory, subscribeToTerritories, getMockTerritories } from '../supabase';

export const territoryService = {
  saveTerritory: async (territory) => {
    try {
      const res = await saveNewTerritory(territory);
      return { success: res.success !== false, data: res.data, error: res.error || null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  },
  updateTerritory: async (id, updates) => {
    try {
      const res = await updateTerritory(id, updates);
      return { success: res.success !== false, data: res.data, error: res.error || null };
    } catch (err) {
      return { success: false, data: null, error: err.message };
    }
  },
  subscribe: (onUpdate) => {
    return subscribeToTerritories(onUpdate);
  },
  getMockList: () => {
    return getMockTerritories();
  }
};
