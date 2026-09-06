import sys

filepath = r"C:\Users\Kaushal\.gemini\antigravity-ide\scratch\runclash-app\src\App.jsx"

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# We need to find the specific blocks and replace them.
# The layout starts at:
# {/* Segmented Map Mode Switch (SOLO MAP / CLAN MAP - TASK 3) */}
# And ends after:
# {/* Floating top Command Header */}

start_idx = -1
end_idx = -1
active_banner_idx = -1
active_banner_end_idx = -1

for i, line in enumerate(lines):
    if "{/* Segmented Map Mode Switch (SOLO MAP / CLAN MAP - TASK 3) */}" in line:
        start_idx = i
    if "{/* Floating top Command Header */}" in line:
        # we found the start of floating top command header. we need to find its end.
        pass
    if "{/* Accuracy floating indicator (Hidden/relegated to Top HUD capsule in 2.0) */}" in line:
        end_idx = i
    if "{/* DYNAMIC TERRITORY NOTIFICATION BANNER */}" in line:
        active_banner_idx = i
    if "{/* FLOATING CAMERA ACTION SHEET */}" in line:
        active_banner_end_idx = i

if start_idx == -1 or end_idx == -1:
    print("Could not find start or end index.")
    sys.exit(1)

# Extract original blocks just to check if we found them (optional, we're replacing the whole section anyway)

new_layout = """              {/* MAP TOP HUD STACK (Prevents Overlap & Handles Safe Area) */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                paddingTop: 'calc(16px + env(safe-area-inset-top, 0px))',
                paddingLeft: '16px',
                paddingRight: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                zIndex: 1001,
                pointerEvents: 'none'
              }}>
                {/* 1. Floating top Command Header */}
                {runState.status === 'idle' && (
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
                      pointerEvents: 'auto'
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
                        {(currentUser.displayName || 'R')[0].toUpperCase()}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', flexShrink: 0 }}>
                        <span style={{ fontSize: '12px', fontWeight: '800', color: 'white', lineHeight: 1 }}>
                          {currentUser.displayName}
                        </span>
                        <span style={{ fontSize: '9px', fontWeight: '800', color: 'var(--clash-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {(!currentUser.clan || currentUser.clan === 'None') ? 'No Clan' : currentUser.clan}
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
                        {currentUser.coins}
                      </span>
                    </div>

                    {/* RIGHT: Level, GPS Status & Settings */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      <span style={{ fontSize: '10px', fontWeight: '800', color: '#FC4C02', background: 'rgba(252, 76, 2, 0.08)', border: '1px solid rgba(252, 76, 2, 0.2)', padding: '4px 8px', borderRadius: '8px', flexShrink: 0 }}>
                        LVL {currentUser.level}
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
                          if (runState.gpsAccuracy === null) {
                            return (
                              <>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#888888', display: 'inline-block' }}></span>
                                <span>GPS</span>
                              </>
                            );
                          }
                          if (runState.gpsAccuracy < 30) {
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
                        onClick={() => setShowSettingsDrawer(true)}
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
                )}

                {/* 2. Segmented Map Mode Switch (SOLO MAP / CLAN MAP - TASK 3) */}
                <div style={{
                  alignSelf: 'center',
                  display: 'flex',
                  background: 'rgba(11, 11, 13, 0.88)',
                  backdropFilter: 'blur(8px)',
                  padding: '3px',
                  borderRadius: '16px',
                  border: '1.5px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
                  pointerEvents: 'auto'
                }}>
                  <button
                    onClick={() => setMapMode('solo')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '800',
                      border: 'none',
                      cursor: 'pointer',
                      background: mapMode === 'solo' ? '#FC4C02' : 'transparent',
                      color: mapMode === 'solo' ? 'white' : 'var(--clash-text-secondary)',
                      transition: 'all 0.2s ease',
                      letterSpacing: '0.5px'
                    }}
                  >
                    SOLO MAP
                  </button>
                  <button
                    onClick={() => setMapMode('clan')}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      fontWeight: '800',
                      border: 'none',
                      cursor: 'pointer',
                      background: mapMode === 'clan' ? '#3B82F6' : 'transparent',
                      color: mapMode === 'clan' ? 'white' : 'var(--clash-text-secondary)',
                      transition: 'all 0.2s ease',
                      letterSpacing: '0.5px'
                    }}
                  >
                    CLAN MAP
                  </button>
                </div>

                {/* 3. CLAN MAP: No Clan Overlay Banner */}
                {mapMode === 'clan' && (!currentUser.clan || currentUser.clan === 'None') && (
                  <div style={{
                    background: 'rgba(15, 23, 42, 0.92)',
                    backdropFilter: 'blur(10px)',
                    border: '1.5px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: '16px',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                    pointerEvents: 'auto'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <Shield size={20} style={{ color: '#3B82F6', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: '800', color: 'white' }}>
                        Join or create a clan to access Clan Map
                      </span>
                    </div>
                    <button
                      onClick={() => setActiveTab('clans')}
                      style={{
                        background: '#3B82F6',
                        color: 'white',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        fontWeight: '800',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      Go to Social
                    </button>
                  </div>
                )}

                {/* 4. Empty World State Banner */}
                {runState.status === 'idle' && (() => {
                  const hasPlayerTerritories = territories.some(t => !t.isLandmark);
                  return !hasPlayerTerritories;
                })() && (
                  <div
                    className="animate-slide-down"
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      pointerEvents: 'auto'
                    }}
                  >
                    <div
                      style={{
                        background: 'rgba(11, 11, 13, 0.9)',
                        backdropFilter: 'blur(8px)',
                        border: '1.5px solid #2A2A2A',
                        borderRadius: '16px',
                        padding: '12px 18px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        maxWidth: '400px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                      }}
                    >
                      <span style={{ fontSize: '18px', flexShrink: 0 }}>🌍</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '800', color: 'white', letterSpacing: '0.3px' }}>
                          No territories exist yet.
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
                          Be the first runner to create one.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. DYNAMIC TERRITORY NOTIFICATION BANNER */}
                {activeBanner && (
                  <div
                    className="animate-slide-down"
                    style={{
                      display: 'flex',
                      justifyContent: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    <div
                      style={{
                        background: '#0B0B0B',
                        border: (() => {
                          if (activeBanner.type === 'entering_friendly') return '1px solid #10B981';
                          if (activeBanner.type === 'entering_enemy') return '1px solid #EF4444';
                          if (activeBanner.type === 'entering_neutral') return '1px solid #FC4C02';
                          if (activeBanner.type === 'captured') return '1px solid #FC4C02';
                          if (activeBanner.type === 'lost') return '1px solid #EF4444';
                          return '1px solid #2A2A2A';
                        })(),
                        borderRadius: '16px',
                        padding: '10px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                        maxWidth: '320px',
                        width: '100%',
                        pointerEvents: 'auto'
                      }}
                    >
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: (() => {
                          if (activeBanner.type === 'entering_friendly') return 'rgba(16, 185, 129, 0.1)';
                          if (activeBanner.type === 'entering_enemy') return 'rgba(239, 68, 68, 0.1)';
                          if (activeBanner.type === 'entering_neutral') return 'rgba(252, 76, 2, 0.1)';
                          if (activeBanner.type === 'captured') return 'rgba(252, 76, 2, 0.1)';
                          if (activeBanner.type === 'lost') return 'rgba(239, 68, 68, 0.1)';
                          return 'rgba(255, 255, 255, 0.05)';
                        })(),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: (() => {
                          if (activeBanner.type === 'entering_friendly') return '#10B981';
                          if (activeBanner.type === 'entering_enemy') return '#EF4444';
                          return '#FC4C02';
                        })()
                      }}>
                        {activeBanner.type === 'captured' ? <Trophy size={14} /> : <Compass size={14} />}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)', textTransform: 'uppercase', fontWeight: '800', letterSpacing: '0.5px' }}>
                          {(() => {
                            if (activeBanner.type === 'entering_friendly') return 'Entering Friendly Sector';
                            if (activeBanner.type === 'entering_enemy') return 'Entering Hostile Sector';
                            if (activeBanner.type === 'entering_neutral') return 'Entering Neutral Sector';
                            if (activeBanner.type === 'captured') return 'Sector Secured';
                            if (activeBanner.type === 'lost') return 'Sector Compromised';
                            if (activeBanner.type === 'leaving') return 'Leaving Sector';
                            return 'Sector Alert';
                          })()}
                        </span>
                        <span style={{ fontSize: '11px', color: 'white', fontWeight: '800' }}>
                          {activeBanner.sectorName}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>\n"""

# Remember that CLAN MAP: Legend Overlay also exists inside the `start_idx` to `end_idx` range, and we need to PRESERVE it, outside the Top HUD Stack (or we could just put it inside, but it has `bottom: 120px`, so we should keep it outside, placed BEFORE the Top HUD Stack).

legend_overlay = """
              {/* CLAN MAP: Legend Overlay */}
              {mapMode === 'clan' && (
                <div style={{
                  position: 'absolute',
                  bottom: '120px',
                  left: '16px',
                  zIndex: 1000,
                  background: 'rgba(11, 11, 13, 0.85)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '6px 10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#3B82F6' }}></div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>Your Clan</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }}></div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>Rival Clan</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6B7280' }}></div>
                    <span style={{ fontSize: '9px', fontWeight: '800', color: 'white' }}>Neutral</span>
                  </div>
                </div>
              )}
"""

final_replacement = legend_overlay + "\n" + new_layout

new_lines = lines[:start_idx] + [final_replacement] + lines[end_idx:]

# Now remove active banner from its original place
if active_banner_idx != -1 and active_banner_end_idx != -1:
    # Need to remove from active_banner_idx up to active_banner_end_idx (exclusive)
    # But indices will be shifted because we replaced start_idx..end_idx with ONE element!
    # So we do the replacement based on original lines first:
    new_lines_phase2 = []
    for i, line in enumerate(new_lines):
        # We need to find the new index of active banner... 
        pass

# It's easier to just do it in one pass if we delete the original active banner.
# Let's rebuild new_lines:
new_lines = lines[:start_idx] + [final_replacement] + lines[end_idx:active_banner_idx] + lines[active_banner_end_idx:]

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("SUCCESS")
