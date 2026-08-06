import React, { useState, useEffect, useCallback } from 'react';
import { X, Shield, Award, MapPin, RefreshCw, AlertCircle } from 'lucide-react';
import { getPublicProfile, loadProfileStats } from '../services/profileService';
import { RelationshipButton } from '../components/social/RelationshipButton';
import { ProfileStatsGrid } from '../components/profile/ProfileStatsGrid';

export const PublicProfileScreen = ({ targetUserId, onClose }) => {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async (mountedRef) => {
    if (!targetUserId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [pRes, sRes] = await Promise.all([
        getPublicProfile(targetUserId),
        loadProfileStats(targetUserId)
      ]);

      if (mountedRef && !mountedRef.current) return;

      if (pRes.success && pRes.data) {
        setProfile(pRes.data);
      } else {
        setError(pRes.error || 'Profile unavailable or private.');
      }

      if (sRes.success) {
        setStats(sRes.data || {});
      }
    } catch (err) {
      if (mountedRef && !mountedRef.current) return;
      setError(err.message || 'Error loading runner dossier.');
    } finally {
      if (!mountedRef || mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [targetUserId]);

  useEffect(() => {
    const mountedRef = { current: true };
    loadData(mountedRef);
    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px'
      }}
    >
      <div
        className="clash-card fade-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: '24px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: '#A0A0A0',
            cursor: 'pointer'
          }}
        >
          <X size={20} />
        </button>

        {isLoading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#FC4C02', display: 'flex', justifyContent: 'center' }}>
            <RefreshCw size={24} className="spin" />
          </div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center', color: '#EF4444', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={28} />
            <span style={{ fontSize: '13px', fontWeight: '700' }}>{error}</span>
            <button
              onClick={() => loadData({ current: true })}
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
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#2A2A2A',
                  border: '2px solid #FC4C02',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  color: 'white',
                  fontSize: '24px',
                  overflow: 'hidden'
                }}
              >
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  (profile?.display_name || 'R').charAt(0).toUpperCase()
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h3 style={{ margin: 0, fontSize: '18px', color: 'white', fontWeight: '800' }}>
                  {profile?.display_name || 'Runner'}
                </h3>
                {profile?.username && (
                  <span style={{ fontSize: '12px', color: '#A0A0A0' }}>@{profile.username}</span>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                  <span style={{ fontSize: '10px', color: '#FC4C02', fontWeight: '700', textTransform: 'uppercase' }}>
                    Level {profile?.level || 1}
                  </span>
                  <span style={{ fontSize: '10px', color: '#666' }}>•</span>
                  <span style={{ fontSize: '10px', color: '#A0A0A0', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Shield size={10} /> {profile?.clan_name || 'No Clan'}
                  </span>
                </div>
              </div>
            </div>

            {/* Bio & Location */}
            {profile?.bio && (
              <p style={{ margin: 0, fontSize: '12px', color: '#CCCCCC', fontStyle: 'italic', lineHeight: '1.4' }}>
                "{profile.bio}"
              </p>
            )}

            {(profile?.city || profile?.country) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#A0A0A0' }}>
                <MapPin size={12} style={{ color: '#FC4C02' }} />
                <span>{[profile.city, profile.country].filter(Boolean).join(', ')}</span>
              </div>
            )}

            {/* Relationship Action Button */}
            <RelationshipActions targetUserId={targetUserId} />

            {/* Public Stats */}
            {profile?.is_profile_public ? (
              <ProfileStatsGrid stats={stats} />
            ) : (
              <div style={{ padding: '16px', backgroundColor: '#141414', borderRadius: '10px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                🔒 This runner's stats are private.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const RelationshipActions = ({ targetUserId }) => {
  return (
    <div style={{ margin: '4px 0' }}>
      <RelationshipButton targetUserId={targetUserId} />
    </div>
  );
};
