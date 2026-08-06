import React, { useState } from 'react';
import { UserCheck, UserX } from 'lucide-react';
import { acceptFriendRequest, rejectFriendRequest, cancelFriendRequest } from '../../services/friendService';

export const FriendRequestCard = ({ request, type = 'incoming', onUpdated }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const isIncoming = type === 'incoming';
  const person = isIncoming ? request.sender : request.receiver;
  if (!person) return null;

  const displayName = person.display_name || person.displayName || 'Runner';
  const username = person.username ? `@${person.username}` : null;
  const avatarUrl = person.avatar_url || person.avatarUrl;
  const clan = person.clan_name || person.clan || 'None';
  const level = person.level || 1;

  const handleAccept = async () => {
    setIsProcessing(true);
    try {
      const res = await acceptFriendRequest(request.id);
      if (res.success && onUpdated) {
        onUpdated();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      const res = await rejectFriendRequest(request.id);
      if (res.success && onUpdated) {
        onUpdated();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancel = async () => {
    setIsProcessing(true);
    try {
      const res = await cancelFriendRequest(request.id);
      if (res.success && onUpdated) {
        onUpdated();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="clash-card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}>{displayName}</span>
            {username && <span style={{ fontSize: '10px', color: '#FC4C02', fontWeight: '700' }}>{username}</span>}
          </div>
          <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
            LVL {level} • Clan: {clan}
          </span>
        </div>
      </div>

      {isIncoming ? (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleAccept}
            disabled={isProcessing}
            className="clash-btn-primary"
            style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <UserCheck size={13} />
            Accept
          </button>
          <button
            onClick={handleReject}
            disabled={isProcessing}
            className="clash-btn-secondary"
            style={{ padding: '6px 10px', fontSize: '11px', color: '#EF4444', borderColor: '#EF4444' }}
          >
            <UserX size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={handleCancel}
          disabled={isProcessing}
          className="clash-btn-secondary"
          style={{ padding: '6px 12px', fontSize: '11px', color: '#A0A0A0' }}
        >
          Cancel Request
        </button>
      )}
    </div>
  );
};
