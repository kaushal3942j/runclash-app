import React, { useState, useEffect } from 'react';
import * as ClanService from '../../services/clanService';

export const ClanManagement = ({ currentUser, onClanLeft, onClanUpdated }) => {
  const [clan, setClan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPublic, setEditPublic] = useState(true);

  useEffect(() => {
    loadClan();
  }, [currentUser]);

  const loadClan = async () => {
    setLoading(true);
    const res = await ClanService.getUserClan(currentUser.uid);
    if (res.success && res.data) {
      const details = await ClanService.getClanDetails(res.data.id);
      if (details.success) {
        setClan({ ...details.data, myRole: res.data.role });
        setEditName(details.data.name || '');
        setEditDesc(details.data.description || '');
        setEditPublic(details.data.is_public);
      }
    } else {
      setClan(null);
    }
    setLoading(false);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (clan.myRole !== 'owner' && clan.myRole !== 'officer') return;
    const res = await ClanService.updateClan(clan.id, {
      name: editName,
      description: editDesc,
      is_public: editPublic
    });
    if (res.success) {
      setIsEditing(false);
      loadClan();
      if (onClanUpdated) onClanUpdated(editName);
    }
  };

  const handleLeave = async () => {
    if (window.confirm("Are you sure you want to leave this clan?")) {
      const res = await ClanService.leaveClan(currentUser.uid, clan.id);
      if (res.success) {
        if (onClanLeft) onClanLeft();
      }
    }
  };

  const handleRequest = async (requestId, action) => {
    const res = await ClanService.handleJoinRequest(requestId, action);
    if (res.success) {
      loadClan();
    }
  };

  const handleUpdateRole = async (targetUserId, newRole) => {
    if (clan.myRole !== 'owner') return;
    if (window.confirm(`Are you sure you want to make this user an ${newRole}?`)) {
      const res = await ClanService.updateMemberRole(clan.id, targetUserId, newRole);
      if (res.success) loadClan();
      else alert(res.error || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (targetUserId) => {
    if (clan.myRole !== 'owner' && clan.myRole !== 'officer') return;
    if (window.confirm("Are you sure you want to remove this member?")) {
      const res = await ClanService.removeMember(clan.id, targetUserId);
      if (res.success) loadClan();
      else alert(res.error || 'Failed to remove member');
    }
  };

  const handleTransferOwnership = async (targetUserId) => {
    if (clan.myRole !== 'owner') return;
    if (window.confirm("Are you sure you want to transfer clan ownership? You will become an officer.")) {
      const res = await ClanService.transferOwnership(clan.id, targetUserId);
      if (res.success) loadClan();
      else alert(res.error || 'Failed to transfer ownership');
    }
  };

  const handleRegenerateCode = async () => {
    if (clan.myRole !== 'owner' && clan.myRole !== 'officer') return;
    if (window.confirm("Are you sure? Old invite codes will immediately stop working.")) {
      const res = await ClanService.regenerateInviteCode(clan.id);
      if (res.success) {
        setClan({ ...clan, invite_code: res.newCode });
      } else {
        alert(res.error || 'Failed to regenerate code');
      }
    }
  };

  if (loading) return <div style={{ color: 'white', padding: '20px' }}>Loading...</div>;
  if (!clan) return <div style={{ color: 'white', padding: '20px' }}>You are not in a clan.</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: 'white' }}>
      {!isEditing ? (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
          <h2 style={{ margin: '0 0 4px 0', color: '#FC4C02' }}>{clan.name}</h2>
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#A0A0A0' }}>{clan.description || "No description"}</p>
          <div style={{ display: 'flex', gap: '8px', fontSize: '10px' }}>
            <span style={{ background: '#2A2A2A', padding: '4px 8px', borderRadius: '4px' }}>
              {clan.is_public ? "Public" : "Private"}
            </span>
            <span style={{ background: '#2A2A2A', padding: '4px 8px', borderRadius: '4px' }}>
              Role: {clan.myRole.toUpperCase()}
            </span>
          </div>
          
          {(clan.myRole === 'owner' || clan.myRole === 'officer') && (
            <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => setIsEditing(true)}
                style={{ flex: 1, background: '#FC4C02', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                EDIT CLAN
              </button>
            </div>
          )}
        </div>
      ) : (
        <form onSubmit={handleUpdate} style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input 
            value={editName} onChange={e => setEditName(e.target.value)} 
            placeholder="Clan Name"
            style={{ background: '#111', color: 'white', border: '1px solid #333', padding: '8px', borderRadius: '6px' }}
          />
          <textarea 
            value={editDesc} onChange={e => setEditDesc(e.target.value)} 
            placeholder="Description"
            style={{ background: '#111', color: 'white', border: '1px solid #333', padding: '8px', borderRadius: '6px', minHeight: '60px' }}
          />
          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={editPublic} onChange={e => setEditPublic(e.target.checked)} />
            Public Clan
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="submit" style={{ flex: 1, background: '#FC4C02', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>Save</button>
            <button type="button" onClick={() => setIsEditing(false)} style={{ flex: 1, background: '#333', color: 'white', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </form>
      )}

      {/* Invite Code */}
      {!clan.is_public && clan.myRole !== 'member' && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
          <h4 style={{ margin: '0 0 8px 0' }}>Invite Code</h4>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <code style={{ background: '#111', padding: '8px', flex: 1, textAlign: 'center', borderRadius: '6px', fontSize: '14px', letterSpacing: '2px' }}>
              {clan.invite_code}
            </code>
            <button onClick={handleRegenerateCode} style={{ background: '#333', color: 'white', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}>
              ↻
            </button>
          </div>
        </div>
      )}

      {/* Member List */}
      <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
        <h4 style={{ margin: '0 0 12px 0' }}>Members ({clan.clan_members?.length || 0})</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {clan.clan_members?.map(m => (
            <div key={m.user_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '8px', borderRadius: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#333', overflow: 'hidden' }}>
                  {m.profiles?.avatar_url ? <img src={m.profiles.avatar_url} width="100%" height="100%" alt="avatar" /> : null}
                </div>
                <span style={{ fontSize: '12px' }}>{m.profiles?.display_name || 'Runner'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '10px', color: '#FC4C02', width: '50px', textAlign: 'right' }}>{m.role.toUpperCase()}</span>
                {clan.myRole === 'owner' && m.user_id !== currentUser.uid && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {m.role !== 'officer' && (
                      <button onClick={() => handleUpdateRole(m.user_id, 'officer')} style={{ background: '#333', color: 'white', border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px' }}>↑ Officer</button>
                    )}
                    {m.role === 'officer' && (
                      <button onClick={() => handleUpdateRole(m.user_id, 'member')} style={{ background: '#333', color: 'white', border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px' }}>↓ Demote</button>
                    )}
                    <button onClick={() => handleTransferOwnership(m.user_id)} style={{ background: '#F59E0B', color: 'white', border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px' }}>👑 Make Owner</button>
                  </div>
                )}
                {(clan.myRole === 'owner' || (clan.myRole === 'officer' && m.role !== 'owner' && m.role !== 'officer')) && m.user_id !== currentUser.uid && (
                   <button onClick={() => handleRemoveMember(m.user_id)} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '4px', borderRadius: '4px', cursor: 'pointer', fontSize: '9px' }}>X</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Join Requests */}
      {(clan.myRole === 'owner' || clan.myRole === 'officer') && clan.clan_join_requests?.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px' }}>
          <h4 style={{ margin: '0 0 12px 0', color: '#FC4C02' }}>Join Requests ({clan.clan_join_requests.length})</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {clan.clan_join_requests.map(r => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '8px', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#333', overflow: 'hidden' }}>
                    {r.profiles?.avatar_url ? <img src={r.profiles.avatar_url} width="100%" height="100%" alt="avatar" /> : null}
                  </div>
                  <span style={{ fontSize: '12px' }}>{r.profiles?.display_name || 'Runner'}</span>
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => handleRequest(r.id, 'accepted')} style={{ background: '#10B981', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>Accept</button>
                  <button onClick={() => handleRequest(r.id, 'rejected')} style={{ background: '#EF4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '10px' }}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <button 
        onClick={handleLeave}
        style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid #EF4444', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
      >
        Leave Clan
      </button>
    </div>
  );
};
