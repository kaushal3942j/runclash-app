import React, { useState } from 'react';
import { Camera, Shield, Users, Globe, X } from 'lucide-react';
import { uploadMedia, createPost } from '../../services/socialService';

export const SocialComposerModal = ({ composerData, currentUser, runState, onClose, onPostSuccess }) => {
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState('public'); // 'public', 'friends', 'private'
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handlePost = async () => {
    setIsUploading(true);
    setErrorMsg('');
    try {
      const mediaUrl = await uploadMedia(composerData.base64, composerData.mediaType, composerData.format, currentUser.uid || currentUser.id);
      const res = await createPost(
        currentUser.uid || currentUser.id, 
        mediaUrl, 
        composerData.mediaType, 
        caption, 
        visibility, 
        runState?.runId || null, 
        null
      );
      if (res.success) {
        if (onPostSuccess) onPostSuccess();
        onClose();
      } else {
        setErrorMsg("Failed to create post. Please try again.");
      }
    } catch (e) {
      console.error(e);
      setErrorMsg("Failed to upload media. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(8px)',
      zIndex: 99999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div className="clash-card" style={{
        width: '100%',
        maxWidth: '400px',
        maxHeight: '90vh',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '20px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="clash-subtitle" style={{ margin: 0, color: 'white' }}>New Recon Post</h3>
          <button onClick={onClose} disabled={isUploading} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>

        {/* Media Preview */}
        <div style={{
          width: '100%',
          height: '250px',
          borderRadius: '12px',
          overflow: 'hidden',
          background: '#0B0B0D',
          border: '1px solid #2A2A2A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {composerData.mediaType === 'photo' ? (
            <img src={`data:image/${composerData.format};base64,${composerData.base64}`} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <video src={`data:video/${composerData.format};base64,${composerData.base64}`} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          )}
        </div>

        {/* Caption */}
        <textarea
          value={caption}
          onChange={e => setCaption(e.target.value)}
          placeholder="Add a tactical report... (optional)"
          className="cyber-input"
          style={{ width: '100%', height: '80px', resize: 'none', background: 'rgba(0,0,0,0.4)', color: 'white' }}
          disabled={isUploading}
        />

        {/* Visibility Selection */}
        <div>
          <label style={{ fontSize: '10px', color: 'var(--clash-text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Visibility</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            <button
              onClick={() => setVisibility('public')}
              style={{
                background: visibility === 'public' ? '#FC4C02' : '#151515',
                color: visibility === 'public' ? 'white' : 'var(--clash-text-secondary)',
                border: '1px solid',
                borderColor: visibility === 'public' ? '#FC4C02' : '#2A2A2A',
                borderRadius: '8px',
                padding: '10px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              disabled={isUploading}
            >
              <Globe size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800' }}>Global</span>
            </button>
            <button
              onClick={() => setVisibility('friends')}
              style={{
                background: visibility === 'friends' ? '#FC4C02' : '#151515',
                color: visibility === 'friends' ? 'white' : 'var(--clash-text-secondary)',
                border: '1px solid',
                borderColor: visibility === 'friends' ? '#FC4C02' : '#2A2A2A',
                borderRadius: '8px',
                padding: '10px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              disabled={isUploading}
            >
              <Users size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800' }}>Squad</span>
            </button>
            <button
              onClick={() => setVisibility('private')}
              style={{
                background: visibility === 'private' ? '#FC4C02' : '#151515',
                color: visibility === 'private' ? 'white' : 'var(--clash-text-secondary)',
                border: '1px solid',
                borderColor: visibility === 'private' ? '#FC4C02' : '#2A2A2A',
                borderRadius: '8px',
                padding: '10px 4px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              disabled={isUploading}
            >
              <Shield size={18} />
              <span style={{ fontSize: '9px', fontWeight: '800' }}>Private</span>
            </button>
          </div>
        </div>

        {errorMsg && (
          <div style={{ color: '#EF4444', fontSize: '11px', textAlign: 'center', fontWeight: '800' }}>{errorMsg}</div>
        )}

        <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
          <button
            onClick={onClose}
            disabled={isUploading}
            className="clash-btn-secondary"
            style={{ flex: 1, borderRadius: '24px', height: '48px', border: '1px solid #2A2A2A', color: 'rgba(255,255,255,0.6)', fontWeight: '800' }}
          >
            Retake
          </button>
          <button
            onClick={handlePost}
            disabled={isUploading}
            className="clash-btn-primary"
            style={{ flex: 1.5, borderRadius: '24px', height: '48px', fontWeight: '800', background: isUploading ? '#888' : '#FC4C02' }}
          >
            {isUploading ? 'UPLOADING...' : 'POST RECON'}
          </button>
        </div>
      </div>
    </div>
  );
};
