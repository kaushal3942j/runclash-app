import React from 'react';
import { Eye, Activity, UserPlus } from 'lucide-react';

export const PrivacySettings = ({ settings, onChange }) => {
  const current = settings || {
    isProfilePublic: true,
    showActivity: true,
    allowFriendRequests: true
  };

  const handleToggle = (key) => {
    if (onChange) {
      onChange({
        ...current,
        [key]: !current[key]
      });
    }
  };

  return (
    <div className="clash-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '1px' }}>
        Privacy Controls
      </h4>

      {/* Public Profile Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Eye size={16} style={{ color: '#FC4C02' }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'white' }}>Public Profile</div>
            <div style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>Allow other runners to view your profile and stats</div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={!!current.isProfilePublic}
          onChange={() => handleToggle('isProfilePublic')}
          style={{ width: '18px', height: '18px', accentColor: '#FC4C02', cursor: 'pointer' }}
        />
      </div>

      {/* Activity Visibility Toggle */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Activity size={16} style={{ color: '#F59E0B' }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'white' }}>Show Activity in Feed</div>
            <div style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>Publish run & territory achievements to activity feed</div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={!!current.showActivity}
          onChange={() => handleToggle('showActivity')}
          style={{ width: '18px', height: '18px', accentColor: '#FC4C02', cursor: 'pointer' }}
        />
      </div>

      {/* Friend Request Permission */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserPlus size={16} style={{ color: '#10B981' }} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: '700', color: 'white' }}>Allow Friend Requests</div>
            <div style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>Allow other runners to send friend requests</div>
          </div>
        </div>
        <input
          type="checkbox"
          checked={!!current.allowFriendRequests}
          onChange={() => handleToggle('allowFriendRequests')}
          style={{ width: '18px', height: '18px', accentColor: '#FC4C02', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
};
