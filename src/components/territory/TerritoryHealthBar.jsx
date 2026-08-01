import React from 'react';

export const TerritoryHealthBar = ({ decayHours = 72, maxDecayHours = 72 }) => {
  const percentage = Math.min(100, Math.max(0, Math.round((decayHours / maxDecayHours) * 100)));
  
  let barColor = '#10B981';
  if (percentage < 30) barColor = '#EF4444';
  else if (percentage < 60) barColor = '#F59E0B';

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', fontWeight: '800' }}>
        <span style={{ color: 'var(--clash-text-secondary)', textTransform: 'uppercase' }}>Sector Health</span>
        <span style={{ color: barColor }}>{percentage}% ({decayHours}h left)</span>
      </div>
      <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          width: `${percentage}%`,
          height: '100%',
          background: barColor,
          borderRadius: '3px',
          transition: 'width 0.3s ease'
        }} />
      </div>
    </div>
  );
};
