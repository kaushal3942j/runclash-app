import React from 'react';
import { Activity, Map, Zap, Flame, Trophy, Maximize2 } from 'lucide-react';

export const ProfileStatsGrid = ({ stats }) => {
  const safeStats = stats || {
    totalDistanceKm: 0,
    totalRuns: 0,
    longestRunKm: 0,
    fastestPaceSec: 0,
    avgPaceSec: 0,
    territoriesOwned: 0,
    totalTerritoriesCaptured: 0,
    totalControlledAreaM2: 0,
    biggestTerritoryM2: 0
  };

  const formatPace = (seconds) => {
    if (!seconds || seconds <= 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatArea = (m2) => {
    if (!m2 || m2 <= 0) return '0 m²';
    if (m2 >= 1000000) return `${(m2 / 1000000).toFixed(2)} km²`;
    return `${m2.toLocaleString()} m²`;
  };

  const statItems = [
    { label: 'TOTAL DISTANCE', value: `${safeStats.totalDistanceKm} km`, icon: Activity, color: '#FC4C02' },
    { label: 'TOTAL RUNS', value: safeStats.totalRuns, icon: Flame, color: '#F59E0B' },
    { label: 'LONGEST RUN', value: `${safeStats.longestRunKm} km`, icon: Trophy, color: '#3B82F6' },
    { label: 'FASTEST PACE', value: `${formatPace(safeStats.fastestPaceSec)} /km`, icon: Zap, color: '#10B981' },
    { label: 'TERRITORIES HELD', value: safeStats.territoriesOwned, icon: Map, color: '#8B5CF6' },
    { label: 'CONTROLLED AREA', value: formatArea(safeStats.totalControlledAreaM2), icon: Maximize2, color: '#EC4899' },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
      {statItems.map((item, idx) => {
        const IconComp = item.icon;
        return (
          <div key={idx} className="clash-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="clash-label" style={{ fontSize: '9px', letterSpacing: '1px' }}>{item.label}</span>
              <IconComp size={14} style={{ color: item.color }} />
            </div>
            <span style={{ fontSize: '18px', fontWeight: '900', color: 'white', letterSpacing: '-0.5px' }}>
              {item.value}
            </span>
          </div>
        );
      })}
    </div>
  );
};
