import React, { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { getActivityFeed, subscribeToActivityFeed } from '../services/activityService';
import { fetchPosts } from '../services/socialService';
import { ActivityFilters } from '../components/activity/ActivityFilters';
import { ActivityCard } from '../components/activity/ActivityCard';

export const ActivityFeedScreen = ({ onActorClick, onTerritoryClick }) => {
  const [filter, setFilter] = useState('friends'); // 'friends' | 'global' | 'mine'
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFeed = useCallback(async () => {
    setIsLoading(true);
    try {
      const actRes = await getActivityFeed(filter, 20);
      const postRes = await fetchPosts(filter);
      
      let allItems = [];
      if (actRes.success && actRes.data) allItems = [...allItems, ...actRes.data];
      if (postRes.success && postRes.data) {
        const mappedPosts = postRes.data.map(p => ({
          ...p,
          actor: p.profiles,
          activity_type: 'social_post'
        }));
        allItems = [...allItems, ...mappedPosts];
      }
      
      allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setActivities(allItems);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    const sub = subscribeToActivityFeed(() => {
      loadFeed();
    });
    return () => sub.unsubscribe();
  }, [loadFeed]);

  return (
    <div className="fade-in p-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
      {/* Activity Filter Bar */}
      <ActivityFilters filter={filter} onFilterChange={setFilter} />

      {/* Feed List Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Activity size={14} style={{ color: '#FC4C02' }} />
          <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Tactical Feed • {filter.toUpperCase()}
          </h4>
        </div>
        {isLoading && <RefreshCw size={12} className="spin" style={{ color: '#FC4C02' }} />}
      </div>

      {/* Feed Cards */}
      {isLoading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#FC4C02', display: 'flex', justifyContent: 'center' }}>
          <RefreshCw size={20} className="spin" />
        </div>
      ) : activities.length === 0 ? (
        <div className="clash-card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--clash-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Activity size={28} style={{ color: '#444' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>No activities in stream</span>
          <span style={{ fontSize: '11px' }}>Completed runs and claimed sectors will appear here in real-time.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activities.map(act => (
            <ActivityCard
              key={act.id}
              activity={act}
              onActorClick={onActorClick}
              onTerritoryClick={onTerritoryClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};
