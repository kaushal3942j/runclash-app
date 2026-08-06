import React from 'react';
import { UserPlus, UserCheck, Bell, Shield, Map } from 'lucide-react';
import { markRead } from '../../services/notificationService';

export const NotificationItem = ({ notification, onSelect, onMarkRead }) => {
  if (!notification) return null;

  const isRead = !!notification.is_read;
  const timeString = new Date(notification.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const getIcon = () => {
    switch (notification.notification_type) {
      case 'friend_request_received':
        return <UserPlus size={16} style={{ color: '#FC4C02' }} />;
      case 'friend_request_accepted':
        return <UserCheck size={16} style={{ color: '#10B981' }} />;
      case 'territory_contested':
        return <Map size={16} style={{ color: '#8B5CF6' }} />;
      case 'clan_invite':
        return <Shield size={16} style={{ color: '#F59E0B' }} />;
      default:
        return <Bell size={16} style={{ color: '#3B82F6' }} />;
    }
  };

  const handleItemClick = async () => {
    if (!isRead) {
      await markRead(notification.id);
      if (onMarkRead) onMarkRead(notification.id);
    }
    if (onSelect) {
      onSelect(notification);
    }
  };

  return (
    <div
      onClick={handleItemClick}
      className="clash-card"
      style={{
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        borderLeft: isRead ? '1px solid var(--clash-border)' : '4px solid #FC4C02',
        backgroundColor: isRead ? '#141414' : 'rgba(252, 76, 2, 0.05)',
        cursor: 'pointer'
      }}
    >
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        backgroundColor: 'rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {getIcon()}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}>{notification.title}</span>
          <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>{timeString}</span>
        </div>
        <p className="clash-body" style={{ margin: 0, fontSize: '11px', color: '#D1D5DB', lineHeight: '1.4' }}>
          {notification.message}
        </p>
      </div>
    </div>
  );
};
