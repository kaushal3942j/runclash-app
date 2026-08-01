import React from 'react';
import { getRankFromXp } from '../../utils/ranks';

export const RankBadge = ({ xp = 0 }) => {
  const rankInfo = getRankFromXp(xp);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      background: 'rgba(255, 255, 255, 0.05)',
      border: `1px solid ${rankInfo.badgeColor}`,
      padding: '4px 10px',
      borderRadius: '12px'
    }}>
      <span style={{ fontSize: '13px' }}>{rankInfo.icon}</span>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '10px', fontWeight: '800', color: rankInfo.badgeColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {rankInfo.name}
        </span>
        <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)' }}>
          {xp} XP
        </span>
      </div>
    </div>
  );
};
