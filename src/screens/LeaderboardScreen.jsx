import React, { useState, useEffect, useCallback } from 'react';
import { Award, RefreshCw } from 'lucide-react';
import { getLeaderboard } from '../services/leaderboardService';
import { LeaderboardTabs } from '../components/leaderboard/LeaderboardTabs';
import { LeaderboardRow } from '../components/leaderboard/LeaderboardRow';

export const LeaderboardScreen = ({ currentUserId, onSelectPlayer }) => {
  const [scope, setScope] = useState('global');
  const [metric, setMetric] = useState('xp');
  const [period, setPeriod] = useState('all_time');
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getLeaderboard(metric, period, scope, 100);
      if (res.success) {
        setLeaderboard(res.data || []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [metric, period, scope]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  return (
    <div className="fade-in p-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
      {/* Category / Filter Controls */}
      <LeaderboardTabs
        scope={scope}
        onScopeChange={setScope}
        metric={metric}
        onMetricChange={setMetric}
        period={period}
        onPeriodChange={setPeriod}
      />

      {/* Leaderboard List Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Award size={14} style={{ color: '#FC4C02' }} />
          <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {scope} Leaderboard • {metric.toUpperCase()}
          </h4>
        </div>
        {isLoading && <RefreshCw size={12} className="spin" style={{ color: '#FC4C02' }} />}
      </div>

      {/* Leaderboard List */}
      {isLoading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#FC4C02', display: 'flex', justifyContent: 'center' }}>
          <RefreshCw size={20} className="spin" />
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="clash-card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--clash-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Award size={28} style={{ color: '#444' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>No leaderboard entries</span>
          <span style={{ fontSize: '11px' }}>Complete your first run to appear on the sector leaderboards.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {leaderboard.map(player => (
            <LeaderboardRow
              key={player.id}
              player={player}
              isCurrentUser={player.id === currentUserId}
              metric={metric}
              onSelect={onSelectPlayer}
            />
          ))}
        </div>
      )}
    </div>
  );
};
