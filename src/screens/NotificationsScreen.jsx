import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { getNotifications, markAllRead, subscribeToNotifications } from '../services/notificationService';
import { NotificationItem } from '../components/notifications/NotificationItem';

export const NotificationsScreen = ({ userId, onNotificationSelect, onCountUpdated }) => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadNotifs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getNotifications();
      if (res.success) {
        setNotifications(res.data || []);
        if (onCountUpdated) {
          const unread = (res.data || []).filter(n => !n.is_read).length;
          onCountUpdated(unread);
        }
      }
    } finally {
      setIsLoading(false);
    }
  }, [onCountUpdated]);

  useEffect(() => {
    loadNotifs();
  }, [loadNotifs]);

  useEffect(() => {
    if (!userId) return;
    const sub = subscribeToNotifications(userId, () => {
      loadNotifs();
    });
    return () => sub.unsubscribe();
  }, [userId, loadNotifs]);

  const handleMarkAllRead = async () => {
    await markAllRead();
    loadNotifs();
  };

  return (
    <div className="fade-in p-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Bell size={16} style={{ color: '#FC4C02' }} />
          <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Comms Notifications
          </h4>
        </div>

        <button
          onClick={handleMarkAllRead}
          className="clash-btn-secondary"
          style={{ padding: '6px 12px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <CheckCheck size={12} />
          Mark All Read
        </button>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#FC4C02', display: 'flex', justifyContent: 'center' }}>
          <RefreshCw size={20} className="spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="clash-card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--clash-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Bell size={28} style={{ color: '#444' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>All caught up</span>
          <span style={{ fontSize: '11px' }}>Friend requests and tactical updates will appear here.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notifications.map(notif => (
            <NotificationItem
              key={notif.id}
              notification={notif}
              onSelect={onNotificationSelect}
              onMarkRead={() => loadNotifs()}
            />
          ))}
        </div>
      )}
    </div>
  );
};
