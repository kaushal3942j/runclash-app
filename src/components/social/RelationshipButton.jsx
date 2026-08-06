import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, UserCheck, Clock, UserX, Ban } from 'lucide-react';
import { getRelationshipState, sendFriendRequest, acceptFriendRequest, removeFriend, blockUser, unblockUser } from '../../services/friendService';

export const RelationshipButton = ({ targetUserId, onStateChange }) => {
  const [relState, setRelState] = useState('none'); // 'none' | 'self' | 'friends' | 'outgoing_pending' | 'incoming_pending' | 'blocked'
  const [requestId, setRequestId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadState = useCallback(async () => {
    if (!targetUserId) return;
    setIsLoading(true);
    const res = await getRelationshipState(targetUserId);
    setRelState(res.state);
    setRequestId(res.requestId);
    setIsLoading(false);
  }, [targetUserId]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const handleAction = async (action) => {
    setIsLoading(true);
    try {
      if (action === 'send') {
        const res = await sendFriendRequest(targetUserId);
        if (res.success) {
          setRelState('outgoing_pending');
        }
      } else if (action === 'accept') {
        if (requestId) {
          const res = await acceptFriendRequest(requestId);
          if (res.success) {
            setRelState('friends');
          }
        }
      } else if (action === 'remove') {
        const res = await removeFriend(targetUserId);
        if (res.success) {
          setRelState('none');
        }
      } else if (action === 'block') {
        const res = await blockUser(targetUserId);
        if (res.success) {
          setRelState('blocked');
        }
      } else if (action === 'unblock') {
        const res = await unblockUser(targetUserId);
        if (res.success) {
          setRelState('none');
        }
      }

      if (onStateChange) {
        onStateChange();
      }
    } catch (e) {
      console.error('[RELATIONSHIP BUTTON ERROR]', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (relState === 'self') return null;

  if (isLoading) {
    return (
      <button className="clash-btn-secondary" disabled style={{ padding: '6px 12px', fontSize: '11px', opacity: 0.6 }}>
        Processing...
      </button>
    );
  }

  if (relState === 'friends') {
    return (
      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={() => handleAction('remove')}
          className="clash-btn-secondary"
          style={{ padding: '6px 12px', fontSize: '11px', borderColor: '#10B981', color: '#10B981', display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <UserCheck size={13} />
          Friends
        </button>
        <button
          onClick={() => handleAction('block')}
          style={{ background: 'transparent', border: '1px solid #2A2A2A', color: '#EF4444', borderRadius: '8px', padding: '6px', cursor: 'pointer' }}
          title="Block User"
        >
          <Ban size={13} />
        </button>
      </div>
    );
  }

  if (relState === 'outgoing_pending') {
    return (
      <button
        disabled
        className="clash-btn-secondary"
        style={{ padding: '6px 12px', fontSize: '11px', opacity: 0.8, display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <Clock size={13} style={{ color: '#F59E0B' }} />
        Request Pending
      </button>
    );
  }

  if (relState === 'incoming_pending') {
    return (
      <button
        onClick={() => handleAction('accept')}
        className="clash-btn-primary"
        style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <UserPlus size={13} />
        Accept Request
      </button>
    );
  }

  if (relState === 'blocked') {
    return (
      <button
        onClick={() => handleAction('unblock')}
        className="clash-btn-secondary"
        style={{ padding: '6px 12px', fontSize: '11px', borderColor: '#EF4444', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        <UserX size={13} />
        Unblock
      </button>
    );
  }

  // State === 'none'
  return (
    <button
      onClick={() => handleAction('send')}
      className="clash-btn-primary"
      style={{ padding: '6px 14px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}
    >
      <UserPlus size={13} />
      Add Friend
    </button>
  );
};
