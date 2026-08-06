import React from 'react';
import { Trophy, Shield } from 'lucide-react';

export const LeaderboardRow = ({ player, isCurrentUser = false, metric = 'xp', onSelect }) => {
  if (!player) return null;

  const rank = player.rank || 1;
  const displayName = player.display_name || player.displayName || 'Runner';
  const username = player.username ? `@${player.username}` : null;
  const avatarUrl = player.avatar_url || player.avatarUrl;
  const clan = player.clan_name || player.clan || 'None';
  const level = player.level || 1;

  let metricDisplay = `${player.xp || 0} XP`;
  if (metric === 'distance') {
    metricDisplay = `${Number(player.total_distance || 0).toFixed(1)} km`;
  } else if (metric === 'territories') {
    metricDisplay = `${player.territories_owned || 0} Territories`;
  }

  const getRankBadge = (r) => {
    if (r === 1) return { bg: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: 'black', text: '🥇 1' };
    if (r === 2) return { bg: 'linear-gradient(135deg, #9CA3AF 0%, #4B5563 100%)', color: 'black', text: '🥈 2' };
    if (r === 3) return { bg: 'linear-gradient(135deg, #B45309 0%, #78350F 100%)', color: 'white', text: '🥉 3' };
    return { bg: '#1E1E1E', color: '#A0A0A0', text: `#${r}` };
  };

  const rankInfo = getRankBadge(rank);

  return (
    <div
      onClick={() => onSelect && onSelect(player.id)}
      className="clash-card"
      style={{
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        border: isCurrentUser ? '1px solid #FC4C02' : '1px solid var(--clash-border)',
        backgroundColor: isCurrentUser ? 'rgba(252, 76, 2, 0.08)' : '#141414',
        cursor: 'pointer'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        {/* Rank Badge */}
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '8px',
          background: rankInfo.bg,
          color: rankInfo.color,
          fontSize: '11px',
          fontWeight: '900',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {rankInfo.text}
        </div>

        {/* Avatar */}
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          backgroundColor: '#242424',
          border: '1px solid #FC4C02',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          flexShrink: 0
        }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: '15px', fontWeight: '800', color: 'white' }}>
              {displayName[0]?.toUpperCase() || 'R'}
            </span>
          )}
        </div>

        {/* Name Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}>{displayName}</span>
            {isCurrentUser && (
              <span style={{ fontSize: '9px', backgroundColor: '#FC4C02', color: 'white', padding: '1px 6px', borderRadius: '4px', fontWeight: '900' }}>
                YOU
              </span>
            )}
            {username && <span style={{ fontSize: '10px', color: '#FC4C02', fontWeight: '700' }}>{username}</span>}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
            <span>LVL {level}</span>
            <span>•</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
              <Shield size={10} style={{ color: '#FC4C02' }} />
              {clan}
            </span>
          </div>
        </div>
      </div>

      {/* Metric Display */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: '14px', fontWeight: '900', color: '#FC4C02' }}>
          {metricDisplay}
        </div>
      </div>
    </div>
  );
};
