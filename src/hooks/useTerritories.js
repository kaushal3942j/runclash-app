import { useState, useEffect, useMemo } from 'react';
import { subscribeToTerritories, saveNewTerritory, updateTerritory } from '../supabase';

export function useTerritories() {
  const [territories, setTerritories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToTerritories((updatedTerritories) => {
      setTerritories(updatedTerritories || []);
      setIsLoading(false);
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const claimTerritory = async (newTerritory) => {
    const result = await saveNewTerritory(newTerritory);
    return result;
  };

  const editTerritory = async (id, updates) => {
    const result = await updateTerritory(id, updates);
    return result;
  };

  // Dynamically calculate clan standings based on captured territories
  const clanStandings = useMemo(() => {
    const playerTerritories = territories.filter(t => !t.isLandmark && t.clan && t.clan !== 'None');
    const totalClaimed = playerTerritories.length;

    if (totalClaimed === 0) {
      return [];
    }

    const clanCounts = {};
    playerTerritories.forEach(t => {
      clanCounts[t.clan] = (clanCounts[t.clan] || 0) + 1;
    });

    const standings = Object.keys(clanCounts).map(clanName => {
      const count = clanCounts[clanName];
      const dominance = ((count / totalClaimed) * 100).toFixed(1);
      return {
        name: clanName,
        territories: count,
        dominance: parseFloat(dominance)
      };
    });

    return standings.sort((a, b) => b.territories - a.territories);
  }, [territories]);

  return {
    territories,
    setTerritories,
    isLoading,
    claimTerritory,
    editTerritory,
    clanStandings
  };
}
