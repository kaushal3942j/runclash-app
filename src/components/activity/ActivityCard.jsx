import React from 'react';
import { Flame, Map, Users, Shield, Clock } from 'lucide-react';

export const ActivityCard = ({ activity, onActorClick, onTerritoryClick }) => {
  if (!activity) return null;

  const actor = activity.actor || { display_name: 'Runner', level: 1 };
  const displayName = actor.display_name || actor.displayName || 'Runner';
  const username = actor.username ? `@${actor.username}` : null;
  const avatarUrl = actor.avatar_url || actor.avatarUrl;

  const timeString = new Date(activity.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const renderContent = () => {
    switch (activity.activity_type) {
      case 'run_completed': {
        const dist = activity.metadata?.distance ? Number(activity.metadata.distance).toFixed(2) : '0.00';
        const dur = activity.metadata?.duration ? Math.floor(activity.metadata.duration / 60) : 0;
        const cal = activity.metadata?.calories || 0;
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '13px', fontWeight: '700' }}>
              <Flame size={14} style={{ color: '#FC4C02' }} />
              Completed a {dist} km tactical run!
            </div>
            <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
              <span>Duration: {dur} mins</span>
              <span>•</span>
              <span>Energy: {cal} kcal</span>
            </div>
          </div>
        );
      }
      case 'territory_claimed': {
        const name = activity.metadata?.name || 'Sector';
        const area = activity.metadata?.area ? `${Math.round(activity.metadata.area).toLocaleString()} m²` : '';
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div
              onClick={() => onTerritoryClick && onTerritoryClick(activity.territory_id)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '13px', fontWeight: '700', cursor: onTerritoryClick ? 'pointer' : 'default' }}
            >
              <Map size={14} style={{ color: '#8B5CF6' }} />
              Captured territory: <span style={{ color: '#FC4C02', textDecoration: 'underline' }}>{name}</span> ({area})
            </div>
          </div>
        );
      }
      case 'friendship_created': {
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '12px', fontWeight: '600' }}>
            <Users size={14} style={{ color: '#10B981' }} />
            Connected as friends on RunClash!
          </div>
        );
      }
      case 'clan_joined': {
        const clanName = activity.metadata?.clan_name || 'a Clan';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white', fontSize: '12px', fontWeight: '600' }}>
            <Shield size={14} style={{ color: '#F59E0B' }} />
            Joined alliance <span style={{ color: '#F59E0B' }}>{clanName}</span>!
          </div>
        );
      }
      default:
        return <div style={{ fontSize: '12px', color: 'white' }}>Updated profile activities.</div>;
    }
  };

  return (
    <div className="clash-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div
          onClick={() => onActorClick && onActorClick(activity.actor_id)}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div style={{
            width: '36px',
            height: '36px',
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
              <span style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>
                {displayName[0]?.toUpperCase() || 'R'}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>{displayName}</span>
              {username && <span style={{ fontSize: '9px', color: '#FC4C02', fontWeight: '700' }}>{username}</span>}
            </div>
            <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>LVL {actor.level || 1}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
          <Clock size={11} />
          {timeString}
        </div>
      </div>

      {/* Activity Body */}
      <div style={{ padding: '8px 12px', backgroundColor: '#1A1A1A', borderRadius: '12px', border: '1px solid #2A2A2A' }}>
        {renderContent()}
      </div>
    </div>
  );
};
