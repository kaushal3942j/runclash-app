import React from 'react';
import { Compass, Radio, Coins, Zap, Target, Trophy } from 'lucide-react';

export const HomeScreen = ({
  currentUser,
  activeTab,
  setActiveTab,
  runState,
  getTodayLatestRun,
  formatDisplayDistance,
  territories = [],
  leaderboard = []
}) => {
  return (
    <div style={{ display: activeTab === 'dashboard' ? 'flex' : 'none', flexDirection: 'column', gap: '20px', padding: '18px' }} className="fade-in">
      
      {/* Greeting Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div>
          <span className="clash-label" style={{ fontSize: '10px' }}>
            {(() => {
              const hr = new Date().getHours();
              if (hr < 12) return 'Good Morning';
              if (hr < 17) return 'Good Afternoon';
              return 'Good Evening';
            })()}
          </span>
          <h3 className="clash-title" style={{ margin: '2px 0 0 0', fontSize: '24px' }}>
            {currentUser.displayName || 'Runner'}
          </h3>
        </div>
        <div style={{
          border: '1px solid #FC4C02',
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '9px',
          fontWeight: '800',
          color: '#FC4C02',
          textTransform: 'uppercase',
          letterSpacing: '0.8px'
        }}>
          {(!currentUser.clan || currentUser.clan === 'None') ? 'No Clan' : currentUser.clan}
        </div>
      </div>

      {/* CTA Hero Card - Start Run */}
      <div className="clash-card" style={{ gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <span className="clash-label" style={{ color: '#FC4C02', fontSize: '10px' }}>Quick Start</span>
            <h4 className="clash-subtitle" style={{ margin: '4px 0 0 0' }}>Ready for your next loop?</h4>
          </div>
          <Compass size={24} style={{ color: '#FC4C02' }} />
        </div>
        <p className="clash-body" style={{ margin: 0, fontSize: '12px' }}>
          Step outside, close a loop with GPS tracking, and expand your crew's sector holdings.
        </p>
        <button className="clash-btn-primary" onClick={() => setActiveTab('map')}>
          Start Run
        </button>
      </div>

      {/* Hero Card - Today's Real Activity */}
      <div className="clash-card" style={{ gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="clash-label" style={{ fontSize: '10px' }}>Today's Activity</span>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: runState.status === 'tracking' ? '#FC4C02' : 'rgba(255,255,255,0.1)' }}></div>
        </div>
        
        {runState.distance > 0 || runState.status === 'tracking' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
              <span style={{ fontSize: '32px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-family)' }}>{formatDisplayDistance(runState.distance)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', borderTop: '1px solid var(--clash-border)', paddingTop: '10px' }}>
              <div>
                <span className="clash-label" style={{ fontSize: '9px' }}>Duration</span>
                <div style={{ fontSize: '14px', fontWeight: '800', color: 'white', marginTop: '2px' }}>
                  {(() => {
                    const hrs = Math.floor(runState.duration / 3600);
                    const mins = Math.floor((runState.duration % 3600) / 60);
                    const secs = runState.duration % 60;
                    return hrs > 0 
                      ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
                      : `${mins}:${secs.toString().padStart(2, '0')}`;
                  })()}
                </div>
              </div>
              <div>
                <span className="clash-label" style={{ fontSize: '9px' }}>Avg Pace</span>
                <div style={{ fontSize: '14px', fontWeight: '800', color: 'white', marginTop: '2px' }}>{runState.pace} /km</div>
              </div>
            </div>
          </div>
        ) : getTodayLatestRun() ? (
          (() => {
            const latestRun = getTodayLatestRun();
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '9px', color: '#10B981', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ✓ Operation Completed Today
                  </span>
                  <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>
                    {new Date(latestRun.endTime || latestRun.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '32px', fontWeight: '800', color: 'white', fontFamily: 'var(--clash-font-family)' }}>
                    {formatDisplayDistance(latestRun.distance)}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', borderTop: '1px solid var(--clash-border)', paddingTop: '10px' }}>
                  <div>
                    <span className="clash-label" style={{ fontSize: '9px' }}>Duration</span>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'white', marginTop: '2px' }}>
                      {Math.floor(latestRun.duration / 60)}:{(latestRun.duration % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                  <div>
                    <span className="clash-label" style={{ fontSize: '9px' }}>Avg Pace</span>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'white', marginTop: '2px' }}>{latestRun.pace}</div>
                  </div>
                  <div>
                    <span className="clash-label" style={{ fontSize: '9px' }}>Calories</span>
                    <div style={{ fontSize: '13px', fontWeight: '800', color: 'white', marginTop: '2px' }}>{latestRun.calories} kcal</div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 0', textAlign: 'center', gap: '8px' }}>
            <Compass size={24} className="clash-body" style={{ opacity: 0.4 }} />
            <div className="clash-subtitle" style={{ fontSize: '13px' }}>No runs tracked today</div>
            <span className="clash-body" style={{ fontSize: '11px' }}>Recorded statistics from your active run will display here.</span>
          </div>
        )}
      </div>

      {/* Weekly Goal Status */}
      <div className="clash-card" style={{ gap: '12px' }}>
        <span className="clash-label" style={{ fontSize: '10px' }}>Weekly Progress</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700' }}>
            <span style={{ color: 'white' }}>Distance Goal</span>
            <span className="clash-body">0 / 15.0 km</span>
          </div>
          <div className="clash-progress-bar">
            <div className="clash-progress-bar-fill" style={{ width: '0%' }}></div>
          </div>
          <span className="clash-body" style={{ fontSize: '10px', fontStyle: 'italic', textAlign: 'center', marginTop: '4px' }}>
            Weekly goals are not configured yet. Start a run to establish your target!
          </span>
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        
        {/* Coins Stat Card */}
        <div className="clash-card" style={{ gap: '6px', cursor: 'pointer' }} onClick={() => setActiveTab('conquests')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Coins size={14} style={{ color: '#FC4C02' }} />
            <span className="clash-label" style={{ fontSize: '10px' }}>Coins</span>
          </div>
          <h4 className="clash-title" style={{ margin: 0, fontSize: '24px' }}>{currentUser.coins}</h4>
          <span className="clash-body" style={{ fontSize: '9px' }}>Spend in Armory &rarr;</span>
        </div>

        {/* Level / XP Stat Card */}
        <div className="clash-card" style={{ gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={14} style={{ color: '#FC4C02' }} />
            <span className="clash-label" style={{ fontSize: '10px' }}>XP Level</span>
          </div>
          <h4 className="clash-title" style={{ margin: 0, fontSize: '24px' }}>LVL {currentUser.level}</h4>
          <span className="clash-body" style={{ fontSize: '9px' }}>{currentUser.xp} total XP</span>
        </div>

        {/* Sectors Conquered Card */}
        <div className="clash-card" style={{ gap: '6px', cursor: 'pointer' }} onClick={() => setActiveTab('conquests')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Target size={14} style={{ color: '#FC4C02' }} />
            <span className="clash-label" style={{ fontSize: '10px' }}>Sectors</span>
          </div>
          <h4 className="clash-title" style={{ margin: 0, fontSize: '24px' }}>
            {territories.filter(t => t.ownerId === currentUser.uid).length}
          </h4>
          <span className="clash-body" style={{ fontSize: '9px' }}>View conquered loops &rarr;</span>
        </div>

        {/* Standing / Rank Card */}
        <div className="clash-card" style={{ gap: '6px', cursor: 'pointer' }} onClick={() => setActiveTab('clans')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Trophy size={14} style={{ color: '#FC4C02' }} />
            <span className="clash-label" style={{ fontSize: '10px' }}>Rank</span>
          </div>
          <h4 className="clash-title" style={{ margin: 0, fontSize: '24px' }}>
            {(() => {
              const userRankIndex = leaderboard.findIndex(p => p.displayName === currentUser.displayName);
              return userRankIndex !== -1 ? `#${userRankIndex + 1}` : '#5';
            })()}
          </h4>
          <span className="clash-body" style={{ fontSize: '9px' }}>View leaderboards &rarr;</span>
        </div>

      </div>

      {/* Current Territory */}
      <div className="clash-card" style={{ gap: '10px' }}>
        <span className="clash-label" style={{ fontSize: '10px' }}>Active Holding</span>
        {(() => {
          const userTerrs = territories.filter(t => t.ownerId === currentUser.uid);
          const latest = userTerrs[userTerrs.length - 1];
          if (latest) {
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="clash-subtitle" style={{ fontSize: '14px', color: 'white' }}>{latest.name}</div>
                  <span className="clash-body" style={{ fontSize: '11px' }}>{latest.area} sq m</span>
                </div>
                <span style={{ fontSize: '10px', color: '#FC4C02', border: '1px solid #FC4C02', padding: '3px 8px', borderRadius: '10px', fontWeight: '800' }}>
                  {latest.decayHours}h Shield
                </span>
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', textAlign: 'center', gap: '6px' }}>
              <Target size={18} className="clash-body" style={{ opacity: 0.4 }} />
              <div className="clash-subtitle" style={{ fontSize: '12px' }}>No captured sectors</div>
              <span className="clash-body" style={{ fontSize: '10px' }}>Conquer loops to claim sectors.</span>
            </div>
          );
        })()}
      </div>

      {/* Recent Activity / Captures */}
      <div className="clash-card" style={{ gap: '10px' }}>
        <span className="clash-label" style={{ fontSize: '10px' }}>Recent Captures</span>
        {(() => {
          const userTerrs = territories.filter(t => t.ownerId === currentUser.uid);
          if (userTerrs.length > 0) {
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {userTerrs.slice(-2).reverse().map((terr, index) => (
                  <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--clash-border)' }}>
                    <span style={{ fontSize: '12px', color: 'white', fontWeight: '700' }}>{terr.name}</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#FC4C02', fontFamily: 'var(--clash-font-family)' }}>{terr.area} sq m</span>
                  </div>
                ))}
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', textAlign: 'center', gap: '6px' }}>
              <Compass size={18} className="clash-body" style={{ opacity: 0.4 }} />
              <div className="clash-subtitle" style={{ fontSize: '12px' }}>No recent activities</div>
            </div>
          );
        })()}
      </div>

    </div>
  );
};
