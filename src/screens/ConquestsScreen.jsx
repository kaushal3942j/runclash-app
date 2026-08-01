import React from 'react';
import { Target, Compass, Shield, Coins, Award, RefreshCw, Zap } from 'lucide-react';

export const ConquestsScreen = ({
  currentUser,
  activeTab,
  setActiveTab,
  territories = [],
  getClanColor,
  useShield,
  buyItem,
  shopCosts = { shield: 50, boots: 75 },
  inventory = { shields: 0, boots: 0 }
}) => {
  const activeUserTerritories = territories.filter(t => t.ownerId === currentUser.uid && t.is_active !== false);
  const expiredUserTerritories = territories.filter(t => t.ownerId === currentUser.uid && t.is_active === false);

  return (
    <div style={{ display: activeTab === 'conquests' ? 'flex' : 'none', flexDirection: 'column', gap: '22px', padding: '16px', height: '100%', overflowY: 'auto' }} className="fade-in">
      
      {/* Controlled Sectors */}
      <div>
        <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
          <Target size={15} style={{ color: '#FC4C02' }} /> Controlled Sectors ({activeUserTerritories.length})
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {activeUserTerritories.length === 0 ? (
            <div className="clash-card" style={{ borderStyle: 'dashed', padding: '32px', textAlign: 'center' }}>
              <Compass size={32} style={{ color: '#FC4C02', margin: '0 auto 12px auto' }} />
              <h4 className="clash-subtitle" style={{ margin: '0 0 6px 0' }}>NO ACTIVE SECTORS DETECTED</h4>
              <p className="clash-body" style={{ margin: '0 0 16px 0' }}>
                Step outside, start your GPS run, and close a path loop to establish Udaipur crew dominance.
              </p>
              <button className="clash-btn-primary btn-sm" onClick={() => setActiveTab('map')}>
                Launch Tactical Map
              </button>
            </div>
          ) : (
            activeUserTerritories.map(terr => {
              const clanColor = typeof getClanColor === 'function' ? getClanColor(terr.clan) : '#FC4C02';
              const maxDecay = terr.maxDecayHours || 72;
              const currentDecay = terr.decayHours || 72;
              const percentage = Math.max(0, Math.min(100, (currentDecay / maxDecay) * 100));
              
              return (
                <div key={terr.id} className="clash-card p-4 gap-3" style={{ display: 'flex', flexDirection: 'column', borderLeft: `4px solid ${clanColor}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <h4 className="clash-subtitle" style={{ margin: '0' }}>{terr.name}</h4>
                        <span className="clash-label" style={{ background: 'rgba(252, 76, 2, 0.05)', border: '1px solid #FC4C02', padding: '2px 6px', borderRadius: '8px', color: '#FC4C02', fontSize: '8px' }}>SECURED</span>
                      </div>
                      <span className="clash-body" style={{ fontSize: '11px' }}>
                        Area: {terr.area}
                      </span>
                    </div>
                    <button 
                      onClick={() => useShield && useShield(terr.id)}
                      className="clash-btn-secondary btn-sm"
                      style={{ borderColor: '#FC4C02', color: '#FC4C02' }}
                    >
                      <Shield size={11} /> Fortify
                    </button>
                  </div>

                  {/* Rewards details */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--clash-border)', padding: '2px 8px', borderRadius: '12px' }}>
                      <Coins size={10} style={{ color: '#FC4C02' }} />
                      <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>+{terr.rate || 5} COINS/HR</span>
                    </div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--clash-border)', padding: '2px 8px', borderRadius: '12px' }}>
                      <Award size={10} style={{ color: 'white' }} />
                      <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>+150 XP CAPTURE</span>
                    </div>
                  </div>

                  {/* Shield integrity slider */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginBottom: '4px' }}>
                      <span className="clash-body">Shield integrity</span>
                      <span style={{ color: clanColor, fontWeight: '800' }}>{currentDecay}h remaining</span>
                    </div>
                    <div className="clash-progress-bar">
                      <div className="clash-progress-bar-fill" style={{ width: `${percentage}%`, backgroundColor: clanColor }}></div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Historical / Expired holdings */}
      {expiredUserTerritories.length > 0 && (
        <div>
          <h3 className="clash-label" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <RefreshCw size={14} style={{ color: '#FC4C02' }} /> Lost & Expired Sectors ({expiredUserTerritories.length})
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {expiredUserTerritories.map(terr => (
              <div key={terr.id} className="clash-card p-4 gap-3" style={{ display: 'flex', flexDirection: 'column', opacity: 0.65, borderLeft: '4px solid #555555' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h4 className="clash-subtitle" style={{ margin: '0' }}>{terr.name}</h4>
                      <span className="clash-label" style={{ border: '1px solid #555555', padding: '2px 6px', borderRadius: '8px', color: '#9CA3AF', fontSize: '8px' }}>DECAYED</span>
                    </div>
                    <span className="clash-body" style={{ fontSize: '10px' }}>Lost area: {terr.area}</span>
                  </div>
                  <button 
                    onClick={() => setActiveTab('map')}
                    className="clash-btn-secondary btn-sm"
                    style={{ borderColor: '#FC4C02', color: '#FC4C02' }}
                  >
                    Reclaim
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Power-up Shop */}
      <div>
        <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '14px' }}>
          <Coins size={15} style={{ color: '#FC4C02' }} /> Power-Up Armory
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div className="clash-card" onClick={() => buyItem && buyItem('shields', shopCosts.shield)} style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center', cursor: 'pointer' }}>
            <Shield size={24} style={{ color: '#FC4C02' }} />
            <span className="clash-subtitle" style={{ fontSize: '12px', marginTop: '2px' }}>Shield (24h)</span>
            <span className="clash-body" style={{ fontSize: '10px' }}>Inventory: {inventory.shields}</span>
            <button 
              className="clash-btn-secondary btn-sm"
              style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Coins size={10} style={{ color: '#FC4C02' }} /> {shopCosts.shield}
            </button>
          </div>

          <div className="clash-card" onClick={() => buyItem && buyItem('boots', shopCosts.boots)} style={{ padding: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textAlign: 'center', cursor: 'pointer' }}>
            <Zap size={24} style={{ color: '#FC4C02' }} />
            <span className="clash-subtitle" style={{ fontSize: '12px', marginTop: '2px' }}>Speed Boots</span>
            <span className="clash-body" style={{ fontSize: '10px' }}>Inventory: {inventory.boots}</span>
            <button 
              className="clash-btn-secondary btn-sm"
              style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Coins size={10} style={{ color: '#FC4C02' }} /> {shopCosts.boots}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
