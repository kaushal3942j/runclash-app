import React, { useState, useEffect, useCallback } from 'react';
import { Users, UserPlus, Search, RefreshCw } from 'lucide-react';
import { getFriends, getIncomingRequests, getOutgoingRequests, subscribeToFriendRequests, subscribeToFriendships } from '../services/friendService';
import { PlayerSearch } from '../components/social/PlayerSearch';
import { FriendCard } from '../components/social/FriendCard';
import { FriendRequestCard } from '../components/social/FriendRequestCard';

export const FriendsScreen = ({ currentUserId, onSelectPlayer }) => {
  const [activeTab, setActiveTab] = useState('friends'); // 'friends' | 'requests' | 'search'
  const [friends, setFriends] = useState([]);
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSocialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [fRes, inRes, outRes] = await Promise.all([
        getFriends(),
        getIncomingRequests(),
        getOutgoingRequests()
      ]);

      if (fRes.success) setFriends(fRes.data || []);
      if (inRes.success) setIncoming(inRes.data || []);
      if (outRes.success) setOutgoing(outRes.data || []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSocialData();
  }, [loadSocialData]);

  // Realtime subscriptions for friend requests and friendship changes
  useEffect(() => {
    if (!currentUserId) return;

    const reqSub = subscribeToFriendRequests(currentUserId, () => {
      loadSocialData();
    });

    const friendSub = subscribeToFriendships(currentUserId, () => {
      loadSocialData();
    });

    return () => {
      reqSub.unsubscribe();
      friendSub.unsubscribe();
    };
  }, [currentUserId, loadSocialData]);

  return (
    <div className="fade-in p-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
      {/* Sub Tab Switching Bar */}
      <div style={{ display: 'flex', gap: '6px', backgroundColor: '#141414', padding: '4px', borderRadius: '12px', border: '1px solid #2A2A2A' }}>
        <button
          onClick={() => setActiveTab('friends')}
          style={{
            flex: 1,
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'friends' ? '#FC4C02' : 'transparent',
            color: activeTab === 'friends' ? 'white' : '#A0A0A0',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Users size={13} />
          Friends ({friends.length})
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          style={{
            flex: 1,
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'requests' ? '#FC4C02' : 'transparent',
            color: activeTab === 'requests' ? 'white' : '#A0A0A0',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            position: 'relative'
          }}
        >
          <UserPlus size={13} />
          Requests ({incoming.length})
          {incoming.length > 0 && (
            <span style={{ position: 'absolute', top: '4px', right: '4px', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
          )}
        </button>

        <button
          onClick={() => setActiveTab('search')}
          style={{
            flex: 1,
            height: '36px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: activeTab === 'search' ? '#FC4C02' : 'transparent',
            color: activeTab === 'search' ? 'white' : '#A0A0A0',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Search size={13} />
          Discover
        </button>
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#FC4C02', display: 'flex', justifyContent: 'center' }}>
          <RefreshCw size={20} className="spin" />
        </div>
      ) : activeTab === 'friends' ? (
        friends.length === 0 ? (
          <div className="clash-card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--clash-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Users size={28} style={{ color: '#444' }} />
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>No friends added yet</span>
            <span style={{ fontSize: '11px' }}>Use the Discover tab to search for runners and send friend requests.</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {friends.map(friend => (
              <FriendCard
                key={friend.id}
                friend={friend}
                onSelect={onSelectPlayer}
                onRemoved={() => loadSocialData()}
              />
            ))}
          </div>
        )
      ) : activeTab === 'requests' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Incoming Requests */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Incoming Requests ({incoming.length})
            </h4>
            {incoming.length === 0 ? (
              <div className="clash-card" style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                No pending incoming requests.
              </div>
            ) : (
              incoming.map(req => (
                <FriendRequestCard
                  key={req.id}
                  request={req}
                  type="incoming"
                  onUpdated={() => loadSocialData()}
                />
              ))
            )}
          </div>

          {/* Outgoing Requests */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Sent Requests ({outgoing.length})
            </h4>
            {outgoing.length === 0 ? (
              <div className="clash-card" style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                No pending sent requests.
              </div>
            ) : (
              outgoing.map(req => (
                <FriendRequestCard
                  key={req.id}
                  request={req}
                  type="outgoing"
                  onUpdated={() => loadSocialData()}
                />
              ))
            )}
          </div>
        </div>
      ) : (
        <PlayerSearch onSelectPlayer={onSelectPlayer} />
      )}
    </div>
  );
};
