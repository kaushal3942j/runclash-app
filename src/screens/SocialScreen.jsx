import React from 'react';
import { Users, Trophy, Shield, Award, MessageSquare, AlertCircle, Sparkles, ChevronUp } from 'lucide-react';
import { SkeletonCard } from '../components/common/SkeletonCard';

export const SocialScreen = ({
  activeTab,
  setActiveTab,
  socialSubTab = 'crew',
  setSocialSubTab,
  currentUser,
  setCurrentUser,
  setShowClanModal,
  getClanColor,
  getClanStandings,
  leaderboard = [],
  isLoadingLeaderboard = false,
  INITIAL_PROFILES = [],
  territories = [],
  setSelectedProfileUser,
  socialNotifications = [],
  friendRequestsReceived = [],
  friendRequestsSent = [],
  acceptFriendRequest,
  rejectFriendRequest,
  sendFriendRequest,
  friendsList = [],
  followersList = [],
  friendsSearchQuery = '',
  setFriendsSearchQuery,
  discoverSearchQuery = '',
  setDiscoverSearchQuery,
  isEditingProfile,
  setIsEditingProfile,
  editDisplayName,
  setEditDisplayName,
  editBio,
  setEditBio,
  userBio,
  setUserBio,
  addLog
}) => {
  const standings = typeof getClanStandings === 'function' ? getClanStandings() : [];

  return (
    <div style={{ display: activeTab === 'clans' ? 'flex' : 'none', flexDirection: 'column', gap: '14px', padding: '16px' }} className="fade-in">
      
      {/* Social Sub-Tab header toggle */}
      <div style={{ display: 'flex', background: '#0B0B0D', borderRadius: '14px', padding: '3px', border: '1px solid #2A2A2A', marginBottom: '4px', flexShrink: 0 }}>
        <button 
          onClick={() => setSocialSubTab && setSocialSubTab('crew')}
          style={{
            flex: 1,
            background: socialSubTab === 'crew' ? '#FC4C02' : 'transparent',
            color: 'white',
            border: 'none',
            padding: '8px 0',
            borderRadius: '11px',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer'
          }}
          className="clash-btn-press"
        >
          Crew Arena
        </button>
        <button 
          onClick={() => setSocialSubTab && setSocialSubTab('network')}
          style={{
            flex: 1,
            background: socialSubTab === 'network' ? '#FC4C02' : 'transparent',
            color: 'white',
            border: 'none',
            padding: '8px 0',
            borderRadius: '11px',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer'
          }}
          className="clash-btn-press"
        >
          Friends Network
        </button>
      </div>

      {socialSubTab === 'crew' ? (
        /* SUB-TAB: CREW (ORIGINAL CLAN VIEW) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }} className="fade-in">
          
          {/* Crew Header / Alignment Check */}
          {(!currentUser || !currentUser.clan || currentUser.clan === 'None') ? (
            <div className="clash-card p-5 text-center shadow-lg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', borderColor: 'rgba(252, 76, 2, 0.2)' }}>
              <Users size={32} style={{ color: '#FC4C02', opacity: 0.8 }} />
              <h4 className="clash-subtitle" style={{ margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Unaligned Runner</h4>
              <p className="clash-body" style={{ margin: 0, fontSize: '11px', lineHeight: '1.5', maxWidth: '320px' }}>
                You have not aligned with any active tactical crew yet. Join forces with a clan to claim sectors and dominate the regional board.
              </p>
              <button 
                onClick={() => setShowClanModal && setShowClanModal(true)}
                className="clash-btn-primary"
                style={{ height: '36px', borderRadius: '18px', fontSize: '11px', fontWeight: '800', border: 'none', background: '#FC4C02', color: 'white', padding: '0 24px', cursor: 'pointer' }}
              >
                Create or Join Clan
              </button>
            </div>
          ) : (
            <div className="clash-card p-4 gap-3" style={{ borderLeft: `4px solid ${getClanColor ? getClanColor(currentUser.clan) : '#FC4C02'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '12px',
                  background: '#0B0B0B',
                  border: `1.5px solid ${getClanColor ? getClanColor(currentUser.clan) : '#FC4C02'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Users size={22} style={{ color: getClanColor ? getClanColor(currentUser.clan) : '#FC4C02' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <span className="clash-label" style={{ fontSize: '9px' }}>Active Tactical Crew</span>
                  <h3 className="clash-subtitle" style={{ margin: '0' }}>{currentUser.clan}</h3>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="clash-label" style={{ border: `1px solid ${getClanColor ? getClanColor(currentUser.clan) : '#FC4C02'}`, color: getClanColor ? getClanColor(currentUser.clan) : '#FC4C02', padding: '3px 8px', borderRadius: '10px', fontSize: '9px' }}>
                    ACTIVE CREW
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Clan Standings */}
          <div>
            <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
              <Trophy size={14} style={{ color: '#FC4C02' }} /> Crew Dominance Standings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {standings.length === 0 ? (
                <div className="clash-card p-6 text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', borderStyle: 'dashed', borderColor: 'var(--clash-border)' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0, 240, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Shield size={24} style={{ color: '#00F0FF' }} />
                  </div>
                  <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '15px' }}>No clans have been created yet</h4>
                  <p className="clash-body" style={{ margin: 0, fontSize: '11px', color: 'var(--clash-text-secondary)', maxWidth: '280px' }}>
                    Create the first clan and dominate your city.
                  </p>
                  <button 
                    onClick={() => setShowClanModal && setShowClanModal(true)} 
                    className="clash-btn-primary clash-btn-press" 
                    style={{ height: '34px', borderRadius: '17px', fontSize: '11px', padding: '0 20px', marginTop: '4px', fontWeight: '800', background: '#00F0FF', color: '#0B0B0B' }}
                  >
                    Create Clan
                  </button>
                </div>
              ) : (
                standings.map((c, index) => {
                  const color = getClanColor ? getClanColor(c.name) : '#FC4C02';
                  return (
                    <div key={c.name} className="clash-card p-3 gap-2" style={{ borderColor: `${color}40` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: '800', marginBottom: '2px' }}>
                        <span style={{ color: color, display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--clash-text-secondary)', fontWeight: 'bold' }}>#{index + 1}</span> {c.name}
                        </span>
                        <span style={{ color: 'white' }}>{c.percentage}% DOMAIN</span>
                      </div>
                      <div className="clash-progress-bar">
                        <div className="clash-progress-bar-fill" style={{ width: `${c.percentage}%`, backgroundColor: color }}></div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Leaderboard Section */}
          <div>
            <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
              <Award size={14} style={{ color: '#FC4C02' }} /> Elite Runners Leaderboard
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
              {(() => {
                if (isLoadingLeaderboard) {
                  return <SkeletonCard count={3} />;
                }

                const displayLeaderboard = [...leaderboard];
                if (currentUser) {
                  const userInBoard = displayLeaderboard.some(p => p.displayName === currentUser.displayName);
                  if (!userInBoard && (currentUser.xp > 0 || currentUser.level > 1)) {
                    displayLeaderboard.push({
                      displayName: currentUser.displayName,
                      clan: currentUser.clan || 'None',
                      level: currentUser.level || 1,
                      xp: currentUser.xp || 0
                    });
                  }
                }
                displayLeaderboard.sort((a, b) => b.xp - a.xp);

                if (displayLeaderboard.length === 0) {
                  return (
                    <div className="clash-card p-6 text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', borderStyle: 'dashed', borderColor: 'var(--clash-border)' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(252, 76, 2, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Trophy size={24} style={{ color: '#FC4C02' }} />
                      </div>
                      <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '15px' }}>🏆 No runners yet</h4>
                      <p className="clash-body" style={{ margin: 0, fontSize: '11px', color: 'var(--clash-text-secondary)', maxWidth: '260px' }}>
                        Complete your first run to appear on the leaderboard.
                      </p>
                      <button 
                        onClick={() => setActiveTab && setActiveTab('map')} 
                        className="clash-btn-primary clash-btn-press" 
                        style={{ height: '34px', borderRadius: '17px', fontSize: '11px', padding: '0 20px', marginTop: '4px', fontWeight: '800' }}
                      >
                        Start Running
                      </button>
                    </div>
                  );
                }

                return displayLeaderboard.map((player, idx) => {
                  const isSelf = player.displayName === currentUser?.displayName;
                  
                  let rankBorder = 'var(--clash-border)';
                  let rankColor = 'var(--clash-text-secondary)';
                  let badgeIcon = `#${idx + 1}`;
                  if (idx === 0) {
                    rankBorder = '#FC4C02';
                    rankColor = '#FC4C02';
                    badgeIcon = '👑';
                  } else if (idx === 1) {
                    rankBorder = '#FFFFFF';
                    rankColor = '#FFFFFF';
                    badgeIcon = '🥈';
                  } else if (idx === 2) {
                    rankBorder = '#A8A8A8';
                    rankColor = '#A8A8A8';
                    badgeIcon = '🥉';
                  }

                  return (
                    <div 
                      key={idx} 
                      className="clash-card clash-btn-press" 
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        borderLeft: `4px solid ${isSelf ? '#FC4C02' : rankBorder}`,
                        background: isSelf ? 'rgba(252, 76, 2, 0.05)' : 'var(--clash-card)',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        const found = INITIAL_PROFILES.find(p => p.displayName === player.displayName) || {
                          id: 'user_self',
                          displayName: player.displayName,
                          clan: player.clan,
                          level: player.level,
                          xp: player.xp,
                          distance: '12.4 km',
                          territories: territories.filter(t => t.ownerId === (currentUser ? currentUser.uid : null)).length,
                          bio: 'Strategic operative ready to claim territories.',
                          friendsCount: friendsList.length,
                          postsCount: 3,
                          online: true
                        };
                        setSelectedProfileUser && setSelectedProfileUser(found);
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: '800', color: rankColor, fontSize: '13px', width: '20px', textAlign: 'center', flexShrink: 0 }}>
                          {badgeIcon}
                        </span>
                        
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#0B0B0B',
                          border: `1.5px solid ${getClanColor ? getClanColor(player.clan) : '#FC4C02'}`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '800',
                          color: 'white',
                          flexShrink: 0
                        }}>
                          {(player.displayName || 'G')[0].toUpperCase()}
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                          <span style={{ fontWeight: '800', color: isSelf ? '#FC4C02' : 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {player.displayName} {isSelf && <span className="clash-body" style={{ fontSize: '9px' }}>(You)</span>}
                          </span>
                          <span className="clash-label" style={{ fontSize: '8px', color: 'var(--clash-text-secondary)' }}>
                            {(!player.clan || player.clan === 'None') ? 'No Clan' : player.clan}
                          </span>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                        <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', fontWeight: 'bold' }}>LVL {player.level}</span>
                        <span style={{ fontFamily: 'var(--clash-font-family)', color: '#FC4C02', fontWeight: '800', fontSize: '12px' }}>
                          {player.xp.toLocaleString()} XP
                        </span>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          <div className="clash-card text-center p-6" style={{ minHeight: '160px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <MessageSquare size={28} style={{ color: '#FC4C02', opacity: 0.7 }} />
            <h4 className="m-0 text-sm" style={{ fontWeight: '800', color: 'white', textTransform: 'uppercase' }}>Crew Comm Channel</h4>
            <span style={{ fontSize: '11px', color: 'var(--clash-text-secondary)' }}>🚧 Coming Soon in Alpha 2.0. Join factions and chat in real-time with your crew.</span>
          </div>
        </div>
      ) : (
        /* SUB-TAB: FRIENDS NETWORK */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} className="fade-in">
          
          {/* Notification feed widget */}
          {socialNotifications.length > 0 && (
            <div className="clash-card p-3 gap-2" style={{ borderLeft: '3px solid #FC4C02' }}>
              <span className="clash-label" style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '6px', color: '#FC4C02' }}>
                <AlertCircle size={11} /> Social Activity Log
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '90px', overflowY: 'auto' }}>
                {socialNotifications.map(notif => (
                  <div key={notif.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10px', paddingBottom: '4px', borderBottom: '1px solid #222222' }}>
                    <span style={{ color: 'white' }}>
                      <b>{notif.senderName}</b> {notif.type === 'friend_request' ? 'sent you a friend request.' : notif.type === 'friend_accepted' ? 'accepted your request!' : 'started following you.'}
                    </span>
                    <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)' }}>{notif.timestamp}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending requests incoming block */}
          {friendRequestsReceived.length > 0 && (
            <div className="clash-card p-3 gap-2" style={{ borderLeft: '4px solid #FC4C02', display: 'flex', flexDirection: 'column' }}>
              <span className="clash-label" style={{ fontSize: '9px', display: 'flex', alignItems: 'center', gap: '6px', color: '#FC4C02' }}>
                <AlertCircle size={11} /> Pending Incoming Requests ({friendRequestsReceived.length})
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {friendRequestsReceived.map(reqId => {
                  const sender = INITIAL_PROFILES.find(p => p.id === reqId) || { displayName: 'Sam', clan: 'None', level: 10 };
                  return (
                    <div key={reqId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0B0B0D', padding: '8px 12px', borderRadius: '12px', border: '1px solid #2A2A2A' }}>
                      <div 
                        onClick={() => setSelectedProfileUser && setSelectedProfileUser(sender)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                      >
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#FC4C02',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: '800',
                          color: 'white'
                        }}>
                          {sender.displayName[0].toUpperCase()}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'white' }}>{sender.displayName}</span>
                          <span style={{ fontSize: '8px', color: 'var(--clash-text-secondary)' }}>LVL {sender.level} • {sender.clan}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          onClick={() => rejectFriendRequest && rejectFriendRequest(reqId)}
                          style={{ background: '#222222', border: '1px solid #333333', color: 'white', fontSize: '9px', fontWeight: '800', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer' }}
                          className="clash-btn-press"
                        >
                          REJECT
                        </button>
                        <button 
                          onClick={() => acceptFriendRequest && acceptFriendRequest(reqId)}
                          style={{ background: '#FC4C02', border: 'none', color: 'white', fontSize: '9px', fontWeight: '800', padding: '4px 8px', borderRadius: '8px', cursor: 'pointer' }}
                          className="clash-btn-press"
                        >
                          ACCEPT
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Profile block (self) */}
          {currentUser && (
            <div className="clash-card p-4 gap-3">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#FC4C02',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: '800',
                  color: 'white'
                }}>
                  {(currentUser.displayName || 'G')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4 className="clash-title" style={{ margin: 0, fontSize: '16px' }}>{currentUser.displayName}</h4>
                    <span style={{ fontSize: '8px', fontWeight: '800', color: '#FC4C02', background: 'rgba(252, 76, 2, 0.08)', border: '1px solid rgba(252, 76, 2, 0.2)', padding: '2px 6px', borderRadius: '6px' }}>
                      LVL {currentUser.level}
                    </span>
                  </div>
                  <span className="clash-label" style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>
                    {(!currentUser.clan || currentUser.clan === 'None') ? 'No Clan' : currentUser.clan}
                  </span>
                </div>
                <button 
                  onClick={() => {
                    setEditDisplayName && setEditDisplayName(currentUser.displayName);
                    setEditBio && setEditBio(userBio);
                    setIsEditingProfile && setIsEditingProfile(true);
                  }}
                  className="clash-btn-secondary clash-btn-press"
                  style={{ padding: '6px 12px', fontSize: '9px', height: '28px', borderRadius: '14px', fontWeight: '800' }}
                >
                  EDIT PROFILE
                </button>
              </div>

              {isEditingProfile ? (
                <div style={{ background: '#0B0B0D', padding: '12px', borderRadius: '16px', border: '1px solid #2A2A2A', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                  <div>
                    <span className="clash-label" style={{ fontSize: '8px', marginBottom: '4px', display: 'block' }}>Display Name</span>
                    <input 
                      type="text" 
                      value={editDisplayName} 
                      onChange={(e) => setEditDisplayName && setEditDisplayName(e.target.value)} 
                      className="cyber-input" 
                      style={{ padding: '6px 10px', fontSize: '11px' }} 
                    />
                  </div>
                  <div>
                    <span className="clash-label" style={{ fontSize: '8px', marginBottom: '4px', display: 'block' }}>Bio</span>
                    <textarea 
                      value={editBio} 
                      onChange={(e) => setEditBio && setEditBio(e.target.value)} 
                      className="cyber-input" 
                      style={{ padding: '6px 10px', fontSize: '11px', height: '50px', resize: 'none' }} 
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                    <button 
                      onClick={() => setIsEditingProfile && setIsEditingProfile(false)} 
                      style={{ background: 'transparent', border: 'none', color: 'var(--clash-text-secondary)', fontSize: '10px', fontWeight: '800', cursor: 'pointer' }}
                    >
                      CANCEL
                    </button>
                    <button 
                      onClick={() => {
                        if (editDisplayName && editDisplayName.trim()) {
                          setCurrentUser && setCurrentUser(prev => ({ ...prev, displayName: editDisplayName.trim() }));
                        }
                        if (setUserBio && editBio) setUserBio(editBio.trim());
                        if (setIsEditingProfile) setIsEditingProfile(false);
                        if (addLog) addLog("Social: Profile updated successfully.");
                      }} 
                      style={{ background: '#FC4C02', border: 'none', color: 'white', fontSize: '10px', fontWeight: '800', padding: '4px 10px', borderRadius: '8px', cursor: 'pointer' }}
                    >
                      SAVE CHANGES
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="clash-body" style={{ margin: '4px 0 0 0', fontSize: '11px', fontStyle: 'italic', color: 'var(--clash-text-secondary)' }}>
                    "{userBio}"
                  </p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '6px', borderTop: '1px solid #2A2A2A', paddingTop: '10px', textAlign: 'center' }}>
                    <div>
                      <span className="clash-label" style={{ fontSize: '7.5px' }}>Territories</span>
                      <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', display: 'block', fontWeight: '800' }}>
                        {territories.filter(t => t.ownerId === currentUser.uid).length}
                      </span>
                    </div>
                    <div>
                      <span className="clash-label" style={{ fontSize: '7.5px' }}>Friends</span>
                      <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', display: 'block', fontWeight: '800' }}>
                        {friendsList.length}
                      </span>
                    </div>
                    <div>
                      <span className="clash-label" style={{ fontSize: '7.5px' }}>Followers</span>
                      <span className="clash-subtitle" style={{ fontSize: '12px', color: 'white', display: 'block', fontWeight: '800' }}>
                        {followersList.length}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Friends List section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <Users size={14} style={{ color: '#FC4C02' }} /> Friends ({friendsList.length})
              </h3>
              <input 
                type="text" 
                value={friendsSearchQuery} 
                onChange={(e) => setFriendsSearchQuery && setFriendsSearchQuery(e.target.value)} 
                placeholder="Search friends..." 
                className="cyber-input" 
                style={{ width: '130px', padding: '4px 8px', fontSize: '10px', height: '24px' }} 
              />
            </div>

            {(() => {
              if (friendsList.length === 0) {
                return (
                  <div className="clash-card p-6 text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', margin: '6px 0', borderStyle: 'dashed', borderColor: 'var(--clash-border)' }}>
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Users size={22} style={{ color: 'var(--clash-text-secondary)' }} />
                    </div>
                    <h4 className="clash-subtitle" style={{ margin: 0, fontSize: '14px' }}>You haven't added any friends</h4>
                    <p className="clash-body" style={{ margin: 0, fontSize: '11px', color: 'var(--clash-text-secondary)', maxWidth: '240px' }}>
                      Search for runners after they join RunClash.
                    </p>
                  </div>
                );
              }

              const filteredFriends = friendsList.filter(id => {
                const profile = INITIAL_PROFILES.find(p => p.id === id);
                return profile && profile.displayName.toLowerCase().includes(friendsSearchQuery.toLowerCase());
              });

              if (filteredFriends.length === 0) {
                return (
                  <div className="clash-card p-4 text-center clash-body" style={{ fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                    No friends matched your search.
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredFriends.map(friendId => {
                    const friend = INITIAL_PROFILES.find(p => p.id === friendId) || { id: friendId, displayName: 'Runner', level: 1, clan: 'None' };
                    return (
                      <div 
                        key={friendId} 
                        className="clash-card p-3 clash-btn-press" 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                        onClick={() => setSelectedProfileUser && setSelectedProfileUser(friend)}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ position: 'relative' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: '#FC4C02',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '13px',
                              fontWeight: '800',
                              color: 'white'
                            }}>
                              {friend.displayName[0].toUpperCase()}
                            </div>
                            <span style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: friend.online ? '#10B981' : '#888888',
                              border: '1.5px solid #151515'
                            }}></span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>{friend.displayName}</span>
                            <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>LVL {friend.level} • {friend.clan}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '8px', color: friend.online ? '#10B981' : 'var(--clash-text-secondary)', fontWeight: '800', textTransform: 'uppercase' }}>
                            {friend.online ? 'Online' : 'Offline'}
                          </span>
                          <ChevronUp size={16} style={{ transform: 'rotate(90deg)', color: 'var(--clash-text-secondary)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          {/* Discover Section */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h3 className="text-sm m-0" style={{ fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                <Sparkles size={14} style={{ color: '#FC4C02' }} /> Discover Runners
              </h3>
              <input 
                type="text" 
                value={discoverSearchQuery} 
                onChange={(e) => setDiscoverSearchQuery && setDiscoverSearchQuery(e.target.value)} 
                placeholder="Search network..." 
                className="cyber-input" 
                style={{ width: '130px', padding: '4px 8px', fontSize: '10px', height: '24px' }} 
              />
            </div>

            {(() => {
              const nonFriends = INITIAL_PROFILES.filter(p => !friendsList.includes(p.id));
              const filteredDiscover = nonFriends.filter(p => p.displayName.toLowerCase().includes(discoverSearchQuery.toLowerCase()));

              if (filteredDiscover.length === 0) {
                return (
                  <div className="clash-card p-5 text-center" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', margin: '6px 0', borderStyle: 'dashed', borderColor: 'var(--clash-border)' }}>
                    <Sparkles size={20} style={{ color: 'var(--clash-text-secondary)', opacity: 0.6 }} />
                    <span className="clash-body" style={{ fontSize: '11px', color: 'var(--clash-text-secondary)' }}>
                      No other runners registered in network.
                    </span>
                  </div>
                );
              }

              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {filteredDiscover.map(p => {
                    const isSent = friendRequestsSent.includes(p.id);
                    const isReceived = friendRequestsReceived.includes(p.id);
                    return (
                      <div 
                        key={p.id} 
                        className="clash-card p-3" 
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <div 
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flex: 1 }}
                          onClick={() => setSelectedProfileUser && setSelectedProfileUser(p)}
                        >
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#222222',
                            border: '1px solid #333333',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px',
                            fontWeight: '800',
                            color: 'white'
                          }}>
                            {p.displayName[0].toUpperCase()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>{p.displayName}</span>
                            <span style={{ fontSize: '9px', color: 'var(--clash-text-secondary)' }}>LVL {p.level} • {p.clan}</span>
                          </div>
                        </div>

                        <div>
                          {isSent ? (
                            <button 
                              disabled
                              style={{ background: 'transparent', border: '1px solid #333333', color: 'var(--clash-text-secondary)', fontSize: '8.5px', fontWeight: '800', padding: '6px 12px', borderRadius: '12px' }}
                            >
                              PENDING
                            </button>
                          ) : isReceived ? (
                            <button 
                              onClick={() => acceptFriendRequest && acceptFriendRequest(p.id)}
                              style={{ background: '#FC4C02', border: 'none', color: 'white', fontSize: '8.5px', fontWeight: '800', padding: '6px 12px', borderRadius: '12px', cursor: 'pointer' }}
                              className="clash-btn-press"
                            >
                              ACCEPT
                            </button>
                          ) : (
                            <button 
                              onClick={() => sendFriendRequest && sendFriendRequest(p.id)}
                              style={{ background: 'transparent', border: '1px solid #FC4C02', color: '#FC4C02', fontSize: '8.5px', fontWeight: '800', padding: '6px 12px', borderRadius: '12px', cursor: 'pointer' }}
                              className="clash-btn-press"
                            >
                              ADD FRIEND
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

        </div>
      )}
    </div>
  );
};
