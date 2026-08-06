import React from 'react';
import { Shield, MapPin, Calendar, Award } from 'lucide-react';

export const ProfileHeader = ({ profile, isOwnProfile = false, onEditClick }) => {
  if (!profile) return null;

  const displayName = profile.displayName || profile.display_name || 'Runner';
  const username = profile.username ? `@${profile.username}` : null;
  const bio = profile.bio || 'Runner on RunClash.';
  const clan = profile.clan || profile.clan_name || 'None';
  const avatarUrl = profile.avatarUrl || profile.avatar_url;
  const level = profile.level || 1;
  const xp = profile.xp || 0;
  const coins = profile.coins || 0;

  const locationParts = [profile.city, profile.state, profile.country].filter(Boolean);
  const locationString = locationParts.length > 0 ? locationParts.join(', ') : 'Planet Earth';

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(252, 76, 2, 0.15) 0%, rgba(20, 20, 20, 0.95) 100%)',
      border: '1px solid var(--clash-border)',
      borderRadius: '20px',
      padding: '24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Avatar */}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#242424',
            border: '2px solid #FC4C02',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            boxShadow: '0 8px 16px rgba(0,0,0,0.5)'
          }}>
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '28px', fontWeight: '900', color: 'white' }}>
                {displayName[0]?.toUpperCase() || 'R'}
              </span>
            )}
          </div>
          {profile.premium && (
            <div style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              backgroundColor: '#F59E0B',
              color: 'black',
              borderRadius: '50%',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Award size={12} />
            </div>
          )}
        </div>

        {/* User Info Header */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 className="clash-title" style={{ margin: 0, fontSize: '22px', color: 'white', fontWeight: '800' }}>
              {displayName}
            </h2>
            {isOwnProfile && onEditClick && (
              <button
                onClick={onEditClick}
                className="clash-btn-secondary"
                style={{ padding: '6px 12px', fontSize: '11px', height: '32px' }}
              >
                Edit Profile
              </button>
            )}
          </div>

          {username && (
            <span style={{ fontSize: '12px', color: '#FC4C02', fontWeight: '700' }}>{username}</span>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '2px', fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={12} style={{ color: '#FC4C02' }} />
              {locationString}
            </span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'white', fontWeight: '700' }}>
              <Shield size={12} style={{ color: '#FC4C02' }} />
              Clan: {clan}
            </span>
          </div>
        </div>
      </div>

      {/* Bio */}
      {bio && (
        <p className="clash-body" style={{ margin: 0, fontSize: '12px', color: '#D1D5DB', lineHeight: '1.5' }}>
          {bio}
        </p>
      )}

      {/* Level / XP Progress Bar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          <span style={{ color: '#FC4C02' }}>LEVEL {level} RUNNER</span>
          <span style={{ color: 'var(--clash-text-secondary)' }}>{xp} XP TOTAL</span>
        </div>
        <div style={{ width: '100%', height: '6px', backgroundColor: '#1A1A1A', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (xp % 1000) / 10)}%`, height: '100%', backgroundColor: '#FC4C02', borderRadius: '3px' }} />
        </div>
      </div>
    </div>
  );
};
