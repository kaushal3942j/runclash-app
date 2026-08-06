import React, { useState, useEffect } from 'react';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileStatsGrid } from '../components/profile/ProfileStatsGrid';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import { loadProfileStats } from '../services/profileService';
import { LogOut, RefreshCw } from 'lucide-react';

export const ProfileScreen = ({ currentProfile, onUpdateProfile, onSignOut }) => {
  const [stats, setStats] = useState(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    let active = true;
    if (currentProfile?.uid) {
      setIsLoadingStats(true);
      loadProfileStats(currentProfile.uid).then(res => {
        if (active && res.success) {
          setStats(res.data);
        }
      }).finally(() => {
        if (active) setIsLoadingStats(false);
      });
    }
    return () => { active = false; };
  }, [currentProfile]);

  if (!currentProfile) return null;

  return (
    <div className="fade-in p-4" style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '80px' }}>
      {/* Profile Header Card */}
      <ProfileHeader
        profile={currentProfile}
        isOwnProfile={true}
        onEditClick={() => setIsEditing(true)}
      />

      {/* Running Statistics Grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Tactical Performance Stats
          </h4>
          {isLoadingStats && <RefreshCw size={12} className="spin" style={{ color: '#FC4C02' }} />}
        </div>
        <ProfileStatsGrid stats={stats} />
      </div>

      {/* Account Settings Action */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid var(--clash-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <button
          onClick={onSignOut}
          className="clash-btn-secondary"
          style={{ borderColor: '#FC4C02', color: '#FC4C02', width: '100%', height: '48px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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
    </div>
  );
};
