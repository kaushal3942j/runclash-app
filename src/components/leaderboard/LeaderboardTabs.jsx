import React from 'react';
import { Globe, Flag, MapPin, Users } from 'lucide-react';

export const LeaderboardTabs = ({ scope, onScopeChange, metric, onMetricChange, period, onPeriodChange }) => {
  const scopes = [
    { id: 'global', label: 'Global', icon: Globe },
    { id: 'country', label: 'Country', icon: Flag },
    { id: 'city', label: 'City', icon: MapPin },
    { id: 'friends', label: 'Friends', icon: Users }
  ];

  const metrics = [
    { id: 'xp', label: 'XP' },
    { id: 'distance', label: 'Distance' },
    { id: 'territories', label: 'Territories' }
  ];

  const periods = [
    { id: 'all_time', label: 'All Time' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'weekly', label: 'Weekly' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Scope Selector */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '2px' }}>
        {scopes.map(s => {
          const IconC = s.icon;
          const active = scope === s.id;
          return (
            <button
              key={s.id}
              onClick={() => onScopeChange(s.id)}
              style={{
                flex: 1,
                minWidth: '70px',
                height: '34px',
                borderRadius: '10px',
                border: active ? '1px solid #FC4C02' : '1px solid #2A2A2A',
                backgroundColor: active ? 'rgba(252, 76, 2, 0.15)' : '#141414',
                color: active ? '#FC4C02' : '#A0A0A0',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
            >
              <IconC size={12} />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Metric & Period Selector Sub-bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        {/* Metric Pills */}
        <div style={{ display: 'flex', gap: '4px', background: '#141414', padding: '3px', borderRadius: '8px', border: '1px solid #2A2A2A' }}>
          {metrics.map(m => {
            const active = metric === m.id;
            return (
              <button
                key={m.id}
                onClick={() => onMetricChange(m.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: active ? '#FC4C02' : 'transparent',
                  color: active ? 'white' : '#A0A0A0',
                  fontSize: '10px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Period Pills */}
        <div style={{ display: 'flex', gap: '4px', background: '#141414', padding: '3px', borderRadius: '8px', border: '1px solid #2A2A2A' }}>
          {periods.map(p => {
            const active = period === p.id;
            return (
              <button
                key={p.id}
                onClick={() => onPeriodChange(p.id)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: active ? '#2A2A2A' : 'transparent',
                  color: active ? 'white' : '#888',
                  fontSize: '9px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
