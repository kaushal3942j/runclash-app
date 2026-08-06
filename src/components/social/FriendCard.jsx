import React, { useState } from 'react';
import { UserX, Shield } from 'lucide-react';
import { removeFriend } from '../../services/friendService';

export const FriendCard = ({ friend, onSelect, onRemoved }) => {
  const [isRemoving, setIsRemoving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!friend) return null;

  const displayName = friend.display_name || friend.displayName || 'Runner';
  const username = friend.username ? `@${friend.username}` : null;
  const avatarUrl = friend.avatar_url || friend.avatarUrl;
  const clan = friend.clan_name || friend.clan || 'None';
  const level = friend.level || 1;

  const isOnline = friend.last_active_at 
    ? (new Date().getTime() - new Date(friend.last_active_at).getTime()) < 300000 
    : false;

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      const res = await removeFriend(friend.id);
      if (res.success && onRemoved) {
        onRemoved(friend.id);
      }
    } finally {
      setIsRemoving(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="clash-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div
        onClick={() => onSelect && onSelect(friend.id)}
        style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}
      >
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#242424',
            border: '1px solid #FC4C02',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0
          }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>
                {displayName[0]?.toUpperCase() || 'R'}
              </span>
            )}
          </div>
          <div style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: isOnline ? '#10B981' : '#6B7280',
            border: '2px solid #141414'
          }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}>{displayName}</span>
            {username && <span style={{ fontSize: '10px', color: '#FC4C02', fontWeight: '700' }}>{username}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
            <span>LVL {level}</span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <Shield size={10} style={{ color: '#FC4C02' }} />
              {clan}
            </span>
          </div>
        </div>
      </div>

      {showConfirm ? (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: '700' }}>Remove?</span>
          <button
            onClick={handleRemove}
            disabled={isRemoving}
            className="clash-btn-primary"
            style={{ padding: '4px 8px', fontSize: '10px', backgroundColor: '#EF4444' }}
          >
            Yes
          </button>
          <button
            onClick={() => setShowConfirm(false)}
            className="clash-btn-secondary"
            style={{ padding: '4px 8px', fontSize: '10px' }}
          >
            No
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowConfirm(true)}
          style={{ background: 'transparent', border: '1px solid #2A2A2A', color: '#A0A0A0', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
          title="Remove Friend"
        >
          <UserX size={14} />
        </button>
      )}
    </div>
  );
};
