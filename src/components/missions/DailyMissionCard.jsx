import React from 'react';
import { Target, CheckCircle2 } from 'lucide-react';

export const DailyMissionCard = ({ mission, onClaim }) => {
  const isCompleted = mission.completed;
  const progressPercent = Math.min(100, Math.round((mission.progress / mission.target) * 100));

  return (
    <div className="clash-card" style={{ gap: '10px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Target size={16} style={{ color: isCompleted ? '#10B981' : '#FC4C02' }} />
          <span style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}>
            {mission.title}
          </span>
        </div>
        <span style={{ fontSize: '9px', fontWeight: '800', color: isCompleted ? '#10B981' : '#F59E0B' }}>
          +{mission.rewardCoins} 🪙 | +{mission.rewardXp} XP
        </span>
      </div>

      <p style={{ margin: 0, fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
        {mission.description}
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
        <div style={{ flex: 1, height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: isCompleted ? '#10B981' : '#FC4C02',
            transition: 'width 0.3s ease'
          }} />
        </div>
        <span style={{ fontSize: '10px', fontWeight: '800', color: 'white', minWidth: '40px', textAlign: 'right' }}>
          {progressPercent}%
        </span>
      </div>
    </div>
  );
};
