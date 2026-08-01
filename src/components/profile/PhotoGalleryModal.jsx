import React, { useState, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Upload, Trash2, AlertCircle } from 'lucide-react';

export const PhotoGalleryModal = ({ isOpen, onClose, currentUser }) => {
  const [photos, setPhotos] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = JSON.parse(localStorage.getItem('clash_user_photos')) || [];
        setPhotos(stored);
      } catch (e) {
        setPhotos([]);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Invalid file format. Please choose an image file.');
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setUploadError('Image file is too large (max 1.5 MB). Please select a smaller photo.');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      const newPhoto = {
        id: 'photo_' + Date.now(),
        url: base64,
        timestamp: new Date().toISOString(),
        caption: 'RunClash Moment'
      };

      const updated = [newPhoto, ...photos];
      try {
        localStorage.setItem('clash_user_photos', JSON.stringify(updated));
        setPhotos(updated);
        setUploadError(null);
      } catch (err) {
        console.error('LocalStorage quota error:', err);
        setUploadError('Local device storage quota exceeded. Please delete existing photos before uploading more.');
      } finally {
        setIsUploading(false);
      }
    };

    reader.onerror = () => {
      setUploadError('Failed to read photo file.');
      setIsUploading(false);
    };

    reader.readAsDataURL(file);
  };

  const handleDeletePhoto = (id) => {
    const updated = photos.filter(p => p.id !== id);
    setPhotos(updated);
    try {
      localStorage.setItem('clash_user_photos', JSON.stringify(updated));
    } catch (e) {}
    if (selectedPhoto && selectedPhoto.id === id) {
      setSelectedPhoto(null);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(11, 11, 13, 0.92)',
        backdropFilter: 'blur(12px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px'
      }}
    >
      <div 
        className="clash-card animate-slide-in-up"
        style={{
          width: '100%',
          maxWidth: '460px',
          maxHeight: '85vh',
          background: '#0B0B0D',
          border: '1px solid #FC4C02',
          borderRadius: '24px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto',
          boxShadow: '0 0 30px rgba(252, 76, 2, 0.2)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(252, 76, 2, 0.2)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Camera size={18} style={{ color: '#FC4C02' }} />
            <h3 className="clash-subtitle" style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              My Photos ({photos.length})
            </h3>
          </div>
          <button 
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.2)',
              color: 'white',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Clear Storage Disclosure Banner */}
        <div style={{ background: 'rgba(252, 76, 2, 0.06)', border: '1px solid rgba(252, 76, 2, 0.25)', borderRadius: '12px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={14} style={{ color: '#FC4C02', flexShrink: 0 }} />
          <span style={{ fontSize: '9.5px', color: 'var(--clash-text-secondary)', lineHeight: '1.4' }}>
            Photos are stored locally on this device only. No cloud upload or media server is configured.
          </span>
        </div>

        {/* Upload Action Shell */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              background: 'rgba(252, 76, 2, 0.1)',
              border: '1px dashed #FC4C02',
              borderRadius: '14px',
              padding: '10px 16px',
              color: '#FC4C02',
              fontWeight: '800',
              fontSize: '11px',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            <Upload size={14} />
            {isUploading ? 'Saving Photo...' : 'Upload Photo'}
            <input 
              type="file" 
              accept="image/*" 
              onChange={handleFileChange}
              disabled={isUploading}
              style={{ display: 'none' }}
            />
          </label>

          {uploadError && (
            <span style={{ fontSize: '10px', color: '#EF4444', textAlign: 'center', fontWeight: 'bold' }}>
              {uploadError}
            </span>
          )}
        </div>

        {/* Photo Grid */}
        {photos.length === 0 ? (
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              padding: '32px 16px', 
              textAlign: 'center', 
              gap: '10px',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '16px'
            }}
          >
            <ImageIcon size={32} style={{ color: 'var(--clash-text-secondary)', opacity: 0.4 }} />
            <span className="clash-subtitle" style={{ fontSize: '13px' }}>No photos uploaded yet</span>
            <span className="clash-body" style={{ fontSize: '10px' }}>
              Upload local photos from your runs to build your personal gallery.
            </span>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
            {photos.map(p => (
              <div 
                key={p.id}
                style={{
                  position: 'relative',
                  width: '100%',
                  paddingTop: '100%',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedPhoto(p)}
              >
                <img 
                  src={p.url} 
                  alt="User Upload"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                />
              </div>
            ))}
          </div>
        )}

        {/* Full Image Preview Modal */}
        {selectedPhoto && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.95)',
              zIndex: 100000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
          >
            <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '80vh' }}>
              <img 
                src={selectedPhoto.url} 
                alt="Enlarged preview"
                style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '16px', border: '1px solid #FC4C02' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '10px', color: 'white' }}>
                  {new Date(selectedPhoto.timestamp).toLocaleDateString()}
                </span>
                <button
                  onClick={() => handleDeletePhoto(selectedPhoto.id)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #EF4444',
                    color: '#EF4444',
                    borderRadius: '10px',
                    padding: '6px 12px',
                    fontSize: '10px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </div>
            <button
              onClick={() => setSelectedPhoto(null)}
              style={{
                marginTop: '16px',
                background: '#FC4C02',
                color: 'white',
                border: 'none',
                padding: '8px 24px',
                borderRadius: '16px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Back to Gallery
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
