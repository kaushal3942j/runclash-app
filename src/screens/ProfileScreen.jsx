import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { loadProfileStats } from '../services/profileService';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileStatsGrid } from '../components/profile/ProfileStatsGrid';
import { PrivacySettings } from '../components/profile/PrivacySettings';
import { EditProfileModal } from '../components/profile/EditProfileModal';

export const ProfileScreen = ({ profile, onUpdateProfile, onSignOut }) => {
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [error, setError] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const userId = profile?.uid || profile?.id;

  const fetchStats = useCallback(async (mountedRef) => {
    if (!userId) {
      setIsLoadingStats(false);
      return;
    }
    setIsLoadingStats(true);
    setError(null);
    try {
      const res = await loadProfileStats(userId);
      if (mountedRef && !mountedRef.current) return;
      if (res.success) {
        setStats(res.data || {});
      } else {
        setError(res.error || 'Failed to load stats');
      }
    } catch (err) {
      if (mountedRef && !mountedRef.current) return;
      setError(err.message || 'Error fetching stats');
    } finally {
      if (!mountedRef || mountedRef.current) {
        setIsLoadingStats(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    const mountedRef = { current: true };
    fetchStats(mountedRef);
    return () => {
      mountedRef.current = false;
    };
  }, [fetchStats]);

  return (
    <div className="fade-in p-4" style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '80px' }}>
      {/* Profile Header */}
      <ProfileHeader
        profile={profile}
        onEditClick={() => setIsEditModalOpen(true)}
      />

      {/* Stats Grid */}
      {isLoadingStats ? (
        <div style={{ padding: '32px', textAlign: 'center', color: '#FC4C02', display: 'flex', justifyContent: 'center' }}>
          <RefreshCw size={20} className="spin" />
        </div>
      ) : error ? (
        <div className="clash-card" style={{ padding: '20px', textAlign: 'center', color: '#EF4444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={24} />
          <span style={{ fontSize: '12px', fontWeight: '700' }}>{error}</span>
          <button
            onClick={() => fetchStats({ current: true })}
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
      ) : (
        <ProfileStatsGrid stats={stats} />
      )}

      {/* Privacy Settings & Preferences */}
      <PrivacySettings
        profile={profile}
        onUpdateProfile={onUpdateProfile}
      />

      {/* Sign Out Action Button */}
      <button
        onClick={onSignOut}
        style={{
          width: '100%',
          height: '44px',
          borderRadius: '10px',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          color: '#EF4444',
          fontSize: '13px',
          fontWeight: '700',
          cursor: 'pointer',
          marginTop: '8px'
        }}
      >
        Sign Out
      </button>

      {/* Edit Profile Modal */}
      {isEditModalOpen && (
        <EditProfileModal
          profile={profile}
          onClose={() => setIsEditModalOpen(false)}
          onSaved={(updated) => {
            if (onUpdateProfile) onUpdateProfile(updated);
            fetchStats({ current: true });
          }}
        />
      )}
    </div>
  );
};
