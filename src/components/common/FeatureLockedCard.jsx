import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { FEATURE_REGISTRY } from '../../config/premiumConfig';

export const FeatureLockedCard = ({ featureKey, onUpgradeClick }) => {
  const featureInfo = FEATURE_REGISTRY[featureKey] || { name: 'Premium Feature', description: 'Unlock this tactical advantage.' };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(20, 20, 25, 0.95), rgba(10, 10, 15, 0.95))',
      border: '1.5px solid rgba(252, 76, 2, 0.3)',
      borderRadius: '20px',
      padding: '24px 20px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: '12px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
    }}>
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '50%',
        background: 'rgba(252, 76, 2, 0.12)',
        border: '1.5px solid #FC4C02',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FC4C02'
      }}>
        <Lock size={22} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <span style={{ fontSize: '15px', fontWeight: '800', color: 'white', letterSpacing: '0.3px' }}>
            {featureInfo.name}
          </span>
          <span style={{
            background: 'linear-gradient(135deg, #FC4C02, #F59E0B)',
            color: 'white',
            fontSize: '8px',
            fontWeight: '900',
            padding: '2px 6px',
            borderRadius: '6px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            PRO
          </span>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--clash-text-secondary)', margin: 0, lineHeight: 1.4, maxWidth: '280px' }}>
          {featureInfo.description}
        </p>
      </div>

      <button
        onClick={onUpgradeClick}
        style={{
          background: 'linear-gradient(135deg, #FC4C02 0%, #E04000 100%)',
          color: 'white',
          border: 'none',
          padding: '10px 18px',
          borderRadius: '12px',
          fontSize: '11px',
          fontWeight: '800',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '4px',
          boxShadow: '0 4px 16px rgba(252, 76, 2, 0.3)'
        }}
      >
        <Sparkles size={14} />
        Unlock Tactical Pro
      </button>
    </div>
  );
};
