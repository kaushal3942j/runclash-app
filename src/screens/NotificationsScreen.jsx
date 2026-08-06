import React, { useState, useEffect, useCallback } from 'react';
import { Bell, CheckCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { getNotifications, markAllRead, subscribeToNotifications } from '../services/notificationService';
import { NotificationItem } from '../components/notifications/NotificationItem';

export const NotificationsScreen = ({ currentUserId, onSelectPlayer }) => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadNotifications = useCallback(async (mountedRef) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getNotifications();
      if (mountedRef && !mountedRef.current) return;
      if (res.success) {
        setNotifications(res.data || []);
      } else {
        setError(res.error || 'Failed to load notifications.');
      }
    } catch (err) {
      if (mountedRef && !mountedRef.current) return;
      setError(err.message || 'Error loading alerts.');
    } finally {
      if (!mountedRef || mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const mountedRef = { current: true };
    loadNotifications(mountedRef);
    return () => {
      mountedRef.current = false;
    };
  }, [loadNotifications]);

  // Realtime Notification Listener
  useEffect(() => {
    if (!currentUserId) return;
    const sub = subscribeToNotifications(currentUserId, () => {
      loadNotifications({ current: true });
    });
    return () => {
      sub.unsubscribe();
    };
  }, [currentUserId, loadNotifications]);

  const handleMarkAllRead = async () => {
    await markAllRead();
    loadNotifications({ current: true });
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="fade-in p-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
      {/* Header Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Bell size={16} style={{ color: '#FC4C02' }} />
          <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            System Comms ({notifications.length})
          </h4>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#141414',
              border: '1px solid #2A2A2A',
              color: '#A0A0A0',
              fontSize: '11px',
              fontWeight: '700',
              padding: '6px 10px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            <CheckCheck size={12} style={{ color: '#FC4C02' }} />
            Mark All Read
          </button>
        )}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#FC4C02', display: 'flex', justifyContent: 'center' }}>
          <RefreshCw size={20} className="spin" />
        </div>
      ) : error ? (
        <div className="clash-card" style={{ padding: '24px', textAlign: 'center', color: '#EF4444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={24} />
          <span style={{ fontSize: '12px', fontWeight: '700' }}>{error}</span>
          <button
            onClick={() => loadNotifications({ current: true })}
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
      ) : notifications.length === 0 ? (
        <div className="clash-card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--clash-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <Bell size={28} style={{ color: '#444' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>No comms notifications</span>
          <span style={{ fontSize: '11px' }}>Friend requests and territory alerts will appear here.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notifications.map(item => (
            <NotificationItem
              key={item.id}
              notification={item}
              onSelect={onSelectPlayer}
              onUpdated={() => loadNotifications({ current: true })}
            />
          ))}
        </div>
      )}
    </div>
  );
};
