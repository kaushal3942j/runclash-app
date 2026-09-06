import React from 'react';
import { Coins, Settings } from 'lucide-react';

export const GlobalHeader = ({
  currentUser,
  runState,
  trackingMode,
  setShowSettingsDrawer
}) => {
  if (!currentUser) {
    return (
      <div 
        style={{ 
          height: '64px', 
          width: '100%', 
          marginBottom: '4px', 
          borderRadius: '24px', 
          background: 'rgba(255,255,255,0.05)' 
        }} 
        className="animate-pulse" 
      />
    );
  }

  const displayName = currentUser?.displayName || 'Runner';
  const clanName = (!currentUser?.clan || currentUser?.clan === 'None') ? 'No Clan' : currentUser.clan;
  const initial = displayName[0].toUpperCase();
  const coins = currentUser?.coins ?? 0;
  const level = currentUser?.level ?? 1;

  return (
    <div
      className="clash-glass-panel animate-fade-in-down"
      style={{
        borderRadius: '24px',
        padding: '10px 12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.35)',
        gap: '6px',
        pointerEvents: 'auto',
        marginBottom: '4px' // Adding a small margin bottom so content below isn't flush
      }}
    >
      {/* LEFT: Profile & Clan Info */}
      <div
        onClick={() => setShowSettingsDrawer(true)}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flexShrink: 0 }}
      >
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: '#FC4C02',
          border: '1.5px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          fontWeight: '800',
          color: 'white',
          flexShrink: 0
        }}
        className="clash-btn-press"
        >
          {initial}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', lineHeight: 1 }}>
            {displayName}
          </span>
          <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--clash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {clanName}
          </span>
        </div>
      </div>

      {/* CENTER: Coin Counter */}
      <div style={{
        background: 'rgba(0, 0, 0, 0.25)',
        border: '1px solid rgba(255, 255, 255, 0.05)',
        height: '34px',
        padding: '0 10px',
        borderRadius: '17px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        flexShrink: 0
      }}>
        <Coins size={12} style={{ color: '#FC4C02' }} />
        <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-family)' }}>
          {coins}
        </span>
      </div>

      {/* RIGHT: Level, GPS Status & Settings */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        <span style={{ fontSize: '10px', fontWeight: '800', color: '#FC4C02', background: 'rgba(252, 76, 2, 0.08)', border: '1px solid rgba(252, 76, 2, 0.2)', padding: '4px 8px', borderRadius: '8px', flexShrink: 0 }}>
          LVL {level}
        </span>

        <div style={{
          background: 'rgba(0, 0, 0, 0.25)',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          height: '34px',
          padding: '0 10px',
          borderRadius: '17px',
          fontSize: '10px',
          fontWeight: '800',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          color: 'white',
          flexShrink: 0
        }}>
          {(() => {
            if (trackingMode === 'sim') {
              return (
                <>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FC4C02', display: 'inline-block' }} className="gps-pulse"></span>
                  <span>Sim</span>
                </>
              );
            }
            if (runState?.gpsAccuracy === null || runState?.gpsAccuracy === undefined) {
              return (
                <>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#888888', display: 'inline-block' }}></span>
                  <span>GPS</span>
                </>
              );
            }
            if (runState?.gpsAccuracy < 30) {
              return (
                <>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981', display: 'inline-block' }} className="gps-pulse"></span>
                  <span>GPS</span>
                </>
              );
            }
            return (
              <>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
                <span>Lost</span>
              </>
            );
          })()}
        </div>

        <button
          onClick={() => setShowSettingsDrawer?.(true)}
          style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            color: 'white',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0
          }}
          className="clash-btn-press"
          title="Tactical settings"
        >
          <Settings size={18} style={{ color: '#FC4C02' }} />
        </button>
      </div>
    </div>
  );
};
