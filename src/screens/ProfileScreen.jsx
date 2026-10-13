import React, { useState, useEffect, useCallback } from 'react';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileStatsGrid } from '../components/profile/ProfileStatsGrid';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import { ProtectAccountModal } from '../components/profile/ProtectAccountModal';
import { loadProfileStats } from '../services/profileService';
import { LogOut, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
import { PullToRefresh } from '../components/PullToRefresh';

export const ProfileScreen = ({
  currentProfile,
  onUpdateProfile,
  onSignOut,
  onRefresh,
  authUser,
  onUpgradeAccount
}) => {
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isProtectModalOpen, setIsProtectModalOpen] = useState(false);

  const isGuestUser = Boolean(
    currentProfile?.isAnonymous ||
    currentProfile?.is_guest ||
    authUser?.is_anonymous ||
    (!currentProfile?.email && !currentProfile?.is_phone_verified)
  );

  const fetchStats = useCallback(async () => {
    if (currentProfile?.uid) {
      setIsLoadingStats(true);
      const res = await loadProfileStats(currentProfile.uid);
      if (res.success) {
        setStats(res.data);
      }
      setIsLoadingStats(false);
    }
  }, [currentProfile?.uid]);

  const handleRefresh = async () => {
    if (onRefresh) {
      try {
        await onRefresh();
      } catch (e) {
        console.error(e);
      }
    }
    await fetchStats();
  };

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (!currentProfile) return null;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="fade-in p-4" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '80px' }}>
        {/* Profile Header Card */}
        <ProfileHeader
          profile={currentProfile}
          isOwnProfile={true}
          onEditClick={() => setIsEditing(true)}
        />

        {/* Guest Account Protection Callout */}
        {isGuestUser && (
          <div
            className="clash-card"
            style={{
              padding: '16px',
              border: '1px solid #FC4C02',
              background: 'rgba(252, 76, 2, 0.08)',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 4px 20px rgba(252, 76, 2, 0.12)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ backgroundColor: 'rgba(252, 76, 2, 0.15)', padding: '8px', borderRadius: '10px' }}>
                <ShieldAlert size={20} style={{ color: '#FC4C02' }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: '800', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Guest Account Unsecured
                </div>
                <div style={{ fontSize: '11px', color: '#D1D5DB', marginTop: '2px', lineHeight: '1.4' }}>
                  Link an email to protect your run history, stats, and conquered sectors from browser storage clearing.
                </div>
              </div>
            </div>
            <button
              id="profile-protect-account-btn"
              onClick={() => setIsProtectModalOpen(true)}
              className="clash-btn-primary"
              style={{
                height: '40px',
                fontSize: '11px',
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                borderRadius: '10px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <ShieldCheck size={14} />
              Protect Account (Link Email)
            </button>
          </div>
        )}

        {/* Running Statistics Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Tactical Performance Stats
            </h4>
            {isLoadingStats && <RefreshCw size={12} className="spin" style={{ color: '#FC4C02' }} />}
          </div>
          <ProfileStatsGrid stats={stats} isLoading={isLoadingStats} />
        </div>

        {/* Account Security / Sign Out Action */}
        <div style={{ paddingTop: '16px', borderTop: '1px solid var(--clash-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {!isGuestUser ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                backgroundColor: 'rgba(16, 185, 129, 0.08)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                borderRadius: '12px',
                fontSize: '11px',
                color: '#D1D5DB'
              }}
            >
              <ShieldCheck size={16} style={{ color: '#10B981', flexShrink: 0 }} />
              <span>
                Account Secured: <strong style={{ color: 'white' }}>{currentProfile.email || authUser?.email || 'Permanent Login Active'}</strong>
              </span>
            </div>
          ) : (
            <button
              onClick={() => setIsProtectModalOpen(true)}
              className="clash-btn-secondary"
              style={{ borderColor: '#FC4C02', color: '#FC4C02', width: '100%', height: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
              <ShieldCheck size={16} />
              Protect Account (Link Email)
            </button>
          )}

          <button
            onClick={onSignOut}
            className="clash-btn-secondary"
            style={{ borderColor: '#2A2A2A', color: '#A0A0A0', width: '100%', height: '44px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <LogOut size={16} />
            Sign Out Account
          </button>

          <div style={{ textAlign: 'center', fontSize: '9px', color: 'var(--clash-text-secondary)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            RunClash v2.0.0 • Secured Database Sync
          </div>
        </div>

        {/* Edit Profile Modal Overlay */}
        {isEditing && (
          <EditProfileModal
            profile={currentProfile}
            onClose={() => setIsEditing(false)}
            onSaveSuccess={(updated) => {
              if (onUpdateProfile) {
                onUpdateProfile(updated);
              }
            }}
          />
        )}

        {/* Protect Account Modal Overlay */}
        {isProtectModalOpen && (
          <ProtectAccountModal
            isOpen={isProtectModalOpen}
            onClose={() => setIsProtectModalOpen(false)}
            onUpgrade={onUpgradeAccount}
            currentDisplayName={currentProfile.displayName || currentProfile.display_name}
          />
        )}
      </div>
    </PullToRefresh>
  );
};
