import React, { useState, useEffect } from 'react';
import { X, Lock, RefreshCw } from 'lucide-react';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { ProfileStatsGrid } from '../components/profile/ProfileStatsGrid';
import { RelationshipButton } from '../components/social/RelationshipButton';
import { getPublicProfile, loadProfileStats } from '../services/profileService';

export const PublicProfileScreen = ({ targetUserId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let active = true;
    if (!targetUserId) return;

    setIsLoading(true);
    setErrorMsg(null);

    Promise.all([
      getPublicProfile(targetUserId),
      loadProfileStats(targetUserId)
    ]).then(([pRes, sRes]) => {
      if (active) {
        if (pRes.success && pRes.data) {
          setProfile(pRes.data);
        } else {
          setErrorMsg(pRes.error || 'Unable to load profile.');
        }

        if (sRes.success) {
          setStats(sRes.data);
        }
      }
    }).finally(() => {
      if (active) setIsLoading(false);
    });

    return () => { active = false; };
  }, [targetUserId]);

  if (!targetUserId) return null;

  return (
    <div className="fade-in" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 35000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="clash-card" style={{
        maxWidth: '480px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        backgroundColor: '#141414',
        border: '1px solid #2A2A2A',
        position: 'relative'
      }}>
        {/* Top Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="clash-title" style={{ margin: 0, fontSize: '16px', color: 'white', fontWeight: '800' }}>
            Runner Dossier
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#A0A0A0', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#FC4C02', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <RefreshCw size={24} className="spin" />
            <span style={{ fontSize: '12px', color: '#A0A0A0' }}>Loading dossier data...</span>
          </div>
        ) : errorMsg ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#EF4444', fontSize: '13px' }}>
            {errorMsg}
          </div>
        ) : !profile ? null : (
          <>
            {/* Header */}
            <ProfileHeader profile={profile} isOwnProfile={false} />

            {/* Relationship Action Button */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <RelationshipButton targetUserId={targetUserId} />
            </div>

            {/* Stats */}
            {profile.is_profile_public ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Runner Performance Stats
                </h4>
                <ProfileStatsGrid stats={stats} />
              </div>
            ) : (
              <div className="clash-card" style={{ padding: '32px 16px', textAlign: 'center', color: '#A0A0A0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                <Lock size={28} style={{ color: '#FC4C02' }} />
                <span style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>Private Dossier</span>
                <span style={{ fontSize: '11px' }}>This runner has set their performance statistics to private.</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
