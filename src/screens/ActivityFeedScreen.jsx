import React, { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, AlertCircle } from 'lucide-react';
import { getActivityFeed, subscribeToActivityFeed } from '../services/activityService';
import { ActivityFilters } from '../components/activity/ActivityFilters';
import { ActivityCard } from '../components/activity/ActivityCard';

export const ActivityFeedScreen = ({ onSelectPlayer }) => {
  const [filter, setFilter] = useState('friends'); // 'friends' | 'mine' | 'global'
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadFeed = useCallback(async (mountedRef) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getActivityFeed(filter, 20);
      if (mountedRef && !mountedRef.current) return;
      if (res.success) {
        setActivities(res.data || []);
      } else {
        setError(res.error || 'Failed to load activity feed.');
      }
    } catch (err) {
      if (mountedRef && !mountedRef.current) return;
      setError(err.message || 'Error loading activity feed.');
    } finally {
      if (!mountedRef || mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [filter]);

  useEffect(() => {
    const mountedRef = { current: true };
    loadFeed(mountedRef);
    return () => {
      mountedRef.current = false;
    };
  }, [loadFeed]);

  // Realtime Feed Listener
  useEffect(() => {
    const sub = subscribeToActivityFeed((newActivity) => {
      loadFeed({ current: true });
    });
    return () => {
      sub.unsubscribe();
    };
  }, [loadFeed]);

  return (
    <div className="fade-in p-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
      {/* Filter Tabs */}
      <ActivityFilters
        filter={filter}
        onFilterChange={setFilter}
      />

      {/* Feed Section Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={14} style={{ color: '#FC4C02' }} />
          <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {filter === 'friends' ? 'Network Activity' : filter === 'mine' ? 'My Operations' : 'Global Feed'}
          </h4>
        </div>
        {isLoading && <RefreshCw size={12} className="spin" style={{ color: '#FC4C02' }} />}
      </div>

      {/* Feed Content */}
      {isLoading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#FC4C02', display: 'flex', justifyContent: 'center' }}>
          <RefreshCw size={20} className="spin" />
        </div>
      ) : error ? (
        <div className="clash-card" style={{ padding: '24px', textAlign: 'center', color: '#EF4444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={24} />
          <span style={{ fontSize: '12px', fontWeight: '700' }}>{error}</span>
          <button
            onClick={() => loadFeed({ current: true })}
            style={{
              padding: '6px 16px',
              backgroundColor: '#FC4C02',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Retry
          </button>
        </div>
      ) : activities.length === 0 ? (
        <div className="clash-card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--clash-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Activity size={28} style={{ color: '#444' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>No activities logged</span>
          <span style={{ fontSize: '11px' }}>Complete runs and claim sectors to see activity stream cards here.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {activities.map(act => (
            <ActivityCard
              key={act.id}
              activity={act}
              onSelectActor={onSelectPlayer}
            />
          ))}
        </div>
      )}
    </div>
  );
};
