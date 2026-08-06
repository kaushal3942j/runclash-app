import React, { useState, useEffect } from 'react';
import { Activity, Users, Award, Bell, Shield } from 'lucide-react';
import { ActivityFeedScreen } from './ActivityFeedScreen';
import { FriendsScreen } from './FriendsScreen';
import { LeaderboardScreen } from './LeaderboardScreen';
import { NotificationsScreen } from './NotificationsScreen';
import { NotificationBadge } from '../components/notifications/NotificationBadge';
import { getUnreadCount } from '../services/notificationService';

export const SocialScreen = ({
  currentUser,
  selectedTab = 'feed',
  onTabChange,
  onSelectPlayer,
  onTerritoryClick,
  // Clan integration props
  clansList = [],
  userClan = null,
  joinClan,
  leaveClan,
  createClan
}) => {
  const [socialTab, setSocialTab] = useState(selectedTab || 'feed'); // 'feed' | 'friends' | 'leaderboard' | 'notifications' | 'clan'
  const [unreadNotifsCount, setUnreadNotifsCount] = useState(0);

  useEffect(() => {
    let active = true;
    getUnreadCount().then(res => {
      if (active) setUnreadNotifsCount(res.count || 0);
    });
    return () => { active = false; };
  }, []);

  const handleTabSelect = (tabKey) => {
    setSocialTab(tabKey);
    if (onTabChange) {
      onTabChange(tabKey);
    }
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Top Social Navigation Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        backgroundColor: '#0F0F1A',
        borderBottom: '1px solid var(--clash-border)',
        padding: '8px 12px',
        overflowX: 'auto'
      }}>
        <button
          onClick={() => handleTabSelect('feed')}
          style={{
            flex: 1,
            minWidth: '64px',
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: socialTab === 'feed' ? '#FC4C02' : 'transparent',
            color: socialTab === 'feed' ? 'white' : '#A0A0A0',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          <Activity size={13} />
          Feed
        </button>

        <button
          onClick={() => handleTabSelect('friends')}
          style={{
            flex: 1,
            minWidth: '68px',
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: socialTab === 'friends' ? '#FC4C02' : 'transparent',
            color: socialTab === 'friends' ? 'white' : '#A0A0A0',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          <Users size={13} />
          Friends
        </button>

        <button
          onClick={() => handleTabSelect('leaderboard')}
          style={{
            flex: 1,
            minWidth: '78px',
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: socialTab === 'leaderboard' ? '#FC4C02' : 'transparent',
            color: socialTab === 'leaderboard' ? 'white' : '#A0A0A0',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          <Award size={13} />
          Ranks
        </button>

        <button
          onClick={() => handleTabSelect('notifications')}
          style={{
            flex: 1,
            minWidth: '82px',
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: socialTab === 'notifications' ? '#FC4C02' : 'transparent',
            color: socialTab === 'notifications' ? 'white' : '#A0A0A0',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            position: 'relative'
          }}
        >
          <Bell size={13} />
          Comms
          <NotificationBadge count={unreadNotifsCount} />
        </button>

        <button
          onClick={() => handleTabSelect('clan')}
          style={{
            flex: 1,
            minWidth: '64px',
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: socialTab === 'clan' ? '#FC4C02' : 'transparent',
            color: socialTab === 'clan' ? 'white' : '#A0A0A0',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          <Shield size={13} />
          Clans
        </button>
      </div>

      {/* Screen Body */}
      {socialTab === 'feed' && (
        <ActivityFeedScreen
          onActorClick={onSelectPlayer}
          onTerritoryClick={onTerritoryClick}
        />
      )}

      {socialTab === 'friends' && (
        <FriendsScreen
          currentUserId={currentUser?.uid || currentUser?.id}
          onSelectPlayer={onSelectPlayer}
        />
      )}

      {socialTab === 'leaderboard' && (
        <LeaderboardScreen
          currentUserId={currentUser?.uid || currentUser?.id}
          onSelectPlayer={onSelectPlayer}
        />
      )}

      {socialTab === 'notifications' && (
        <NotificationsScreen
          userId={currentUser?.uid || currentUser?.id}
          onNotificationSelect={(notif) => {
            if (notif.entity_type === 'profile' && notif.actor_id) {
              onSelectPlayer(notif.actor_id);
            }
          }}
          onCountUpdated={(c) => setUnreadNotifsCount(c)}
        />
      )}

      {socialTab === 'clan' && (
        <div className="fade-in p-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="clash-card" style={{ padding: '20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <Shield size={36} style={{ color: '#FC4C02' }} />
            <h3 className="clash-title" style={{ margin: 0, fontSize: '18px', color: 'white', fontWeight: '800' }}>
              Clan Alliance Headquarters
            </h3>
            <p className="clash-body" style={{ margin: 0, fontSize: '12px', color: '#A0A0A0' }}>
              Current Clan Membership: <strong style={{ color: '#FC4C02' }}>{currentUser?.clan || currentUser?.clan_name || 'None'}</strong>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
