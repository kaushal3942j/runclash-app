import React, { useState } from 'react';
import { Camera, Upload, AlertCircle, Check } from 'lucide-react';
import { uploadAvatar } from '../../services/avatarService';

export const AvatarUploader = ({ currentAvatarUrl, onAvatarUploaded }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    setSuccessMessage(null);

    try {
      const res = await uploadAvatar(file);
      if (res.success && res.url) {
        setSuccessMessage('Avatar updated!');
        if (onAvatarUploaded) {
          onAvatarUploaded(res.url);
        }
      } else {
        setUploadError(res.error || 'Avatar upload failed.');
      }
    } catch (err) {
      setUploadError(err.message || 'Error uploading file.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          backgroundColor: '#1E1E1E',
          border: '2px solid #FC4C02',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {currentAvatarUrl ? (
            <img src={currentAvatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <Camera size={32} style={{ color: '#FC4C02' }} />
          )}
        </div>

        <label style={{
          position: 'absolute',
          bottom: '0',
          right: '0',
          backgroundColor: '#FC4C02',
          color: 'white',
          borderRadius: '50%',
          padding: '6px',
          cursor: isUploading ? 'wait' : 'pointer',
          boxShadow: '0 4px 8px rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Upload size={14} />
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
        Max file size: 3 MB (JPEG, PNG, WebP)
      </span>

      {uploadError && (
        <div style={{ fontSize: '11px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <AlertCircle size={12} />
          <span>{uploadError}</span>
        </div>
      )}

      {successMessage && (
        <div style={{ fontSize: '11px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Check size={12} />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
};
