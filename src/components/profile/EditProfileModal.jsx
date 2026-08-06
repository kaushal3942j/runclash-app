import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { AvatarUploader } from './AvatarUploader';
import { PrivacySettings } from './PrivacySettings';
import { updateProfile, checkUsernameAvailability } from '../../services/profileService';

export const EditProfileModal = ({ profile, onClose, onSaveSuccess }) => {
  const [displayName, setDisplayName] = useState(profile?.displayName || profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [state, setState] = useState(profile?.state || '');
  const [city, setCity] = useState(profile?.city || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl || profile?.avatar_url || null);
  
  const [privacy, setPrivacy] = useState({
    isProfilePublic: profile?.is_profile_public ?? true,
    showActivity: profile?.show_activity ?? true,
    allowFriendRequests: profile?.allow_friend_requests ?? true
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg('');

    try {
      if (username && username.trim()) {
        const avail = await checkUsernameAvailability(username.trim());
        if (!avail.available && avail.normalized !== profile?.username) {
          setErrorMsg(avail.error || 'Username unavailable.');
          setIsSaving(false);
          return;
        }
      }

      const res = await updateProfile({
        displayName: displayName.trim() || 'Runner',
        username: username.trim() || null,
        bio: bio.trim(),
        avatarUrl,
        country: country.trim(),
        state: state.trim(),
        city: city.trim(),
        isProfilePublic: privacy.isProfilePublic,
        showActivity: privacy.showActivity,
        allowFriendRequests: privacy.allowFriendRequests
      });

      if (res.success && res.data) {
        if (onSaveSuccess) {
          onSaveSuccess(res.data);
        }
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to update profile.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error updating profile.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fade-in" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 35000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="clash-card" style={{
        maxWidth: '480px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        backgroundColor: '#141414',
        border: '1px solid #2A2A2A'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="clash-title" style={{ margin: 0, fontSize: '18px', color: 'white', fontWeight: '800' }}>
            Edit Runner Profile
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#A0A0A0', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #EF4444', color: '#EF4444', padding: '10px 14px', borderRadius: '10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <AvatarUploader
          currentAvatarUrl={avatarUrl}
          onAvatarUploaded={(url) => setAvatarUrl(url)}
        />

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Display Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="clash-label" style={{ fontSize: '9px' }}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              placeholder="Display Name"
              className="cyber-input focus-ring"
            />
          </div>

          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="clash-label" style={{ fontSize: '9px' }}>Unique Username (@handle)</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              placeholder="e.g. runner_one (letters, numbers, _)"
              className="cyber-input focus-ring"
            />
          </div>

          {/* Bio */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="clash-label" style={{ fontSize: '9px' }}>Bio / Motto</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={3}
              placeholder="Share your running goals..."
              className="cyber-input focus-ring"
              style={{ resize: 'none', padding: '10px' }}
            />
          </div>

          {/* Location */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="clash-label" style={{ fontSize: '8px' }}>Country</label>
              <input
                type="text"
                value={country}
                onChange={e => setCountry(e.target.value)}
                placeholder="Country"
                className="cyber-input focus-ring"
                style={{ fontSize: '11px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="clash-label" style={{ fontSize: '8px' }}>State / Region</label>
              <input
                type="text"
                value={state}
                onChange={e => setState(e.target.value)}
                placeholder="State"
                className="cyber-input focus-ring"
                style={{ fontSize: '11px' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label className="clash-label" style={{ fontSize: '8px' }}>City</label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                placeholder="City"
                className="cyber-input focus-ring"
                style={{ fontSize: '11px' }}
              />
            </div>
          </div>

          <PrivacySettings
            settings={privacy}
            onChange={setPrivacy}
          />

          <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
            <button type="button" onClick={onClose} className="clash-btn-secondary" style={{ flex: 1, height: '44px' }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="clash-btn-primary" style={{ flex: 1.2, height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Save size={16} />
              {isSaving ? 'SAVING...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
