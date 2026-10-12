import { useState, useEffect, useCallback } from 'react';
import { Award, RefreshCw, AlertCircle, Users } from 'lucide-react';
import { getLeaderboard } from '../services/leaderboardService';
import { LeaderboardTabs } from '../components/leaderboard/LeaderboardTabs';
import { LeaderboardRow } from '../components/leaderboard/LeaderboardRow';

export const LeaderboardScreen = ({ currentUserId, onSelectPlayer }) => {
  const [scope, setScope] = useState('global');
  const [metric, setMetric] = useState('xp');
  const [period, setPeriod] = useState('all_time');
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isSignedOutFriends, setIsSignedOutFriends] = useState(false);

  const loadLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setIsSignedOutFriends(false);
    try {
      const res = await getLeaderboard(metric, period, scope, 100);
      if (res.success) {
        if (res.isSignedOut && scope === 'friends') {
          setIsSignedOutFriends(true);
          setLeaderboard([]);
        } else {
          setIsSignedOutFriends(false);
          setLeaderboard(res.data || []);
        }
        setErrorMessage(null);
      } else {
        setErrorMessage(res.error || 'Failed to load leaderboard data.');
        setLeaderboard([]);
        setIsSignedOutFriends(false);
      }
    } catch (err) {
      setErrorMessage(err?.message || 'An unexpected error occurred while fetching leaderboard.');
      setLeaderboard([]);
      setIsSignedOutFriends(false);
    } finally {
      setIsLoading(false);
    }
  }, [metric, period, scope]);

  useEffect(() => {
    let ignore = false;
    const executeFetch = async () => {
      await Promise.resolve();
      if (!ignore) {
        loadLeaderboard();
      }
    };
    executeFetch();
    return () => {
      ignore = true;
    };
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
        <button
          onClick={() => loadLeaderboard()}
          disabled={isLoading}
          style={{
            background: 'none',
            border: 'none',
            color: '#FC4C02',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center'
          }}
          title="Refresh leaderboard"
        >
          <RefreshCw size={13} className={isLoading ? 'spin' : ''} />
        </button>
      </div>

      {/* Leaderboard Content */}
      {isLoading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#FC4C02', display: 'flex', justifyContent: 'center' }}>
          <RefreshCw size={20} className="spin" />
        </div>
      ) : errorMessage ? (
        <div
          className="clash-card"
          style={{
            padding: '24px 16px',
            textAlign: 'center',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <AlertCircle size={32} style={{ color: '#EF4444' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: '#FFF' }}>
              Unable to Load Leaderboard
            </span>
            <span style={{ fontSize: '11px', color: '#EF4444', maxWidth: '320px', wordBreak: 'break-word' }}>
              {errorMessage}
            </span>
          </div>
          <button
            onClick={() => loadLeaderboard()}
            style={{
              marginTop: '4px',
              padding: '8px 18px',
              backgroundColor: '#FC4C02',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={13} />
            Retry
          </button>
        </div>
      ) : isSignedOutFriends ? (
        <div
          className="clash-card"
          style={{
            padding: '32px 16px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: 'rgba(252, 76, 2, 0.1)',
              border: '1px solid #FC4C02',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Users size={22} style={{ color: '#FC4C02' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>
              Sign In to View Friends
            </span>
            <span style={{ fontSize: '11px', color: 'var(--clash-text-secondary)', maxWidth: '280px' }}>
              Log in to your RunClash account to compete with friends and track mutual sector rankings.
            </span>
          </div>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="clash-card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--clash-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Award size={28} style={{ color: '#444' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>No leaderboard entries</span>
          <span style={{ fontSize: '11px' }}>No runners recorded for {scope} • {metric.toUpperCase()} ({period.replace('_', ' ')}).</span>
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

