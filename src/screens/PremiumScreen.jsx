import React from 'react';
import { Sparkles, Check, Crown } from 'lucide-react';
import { FEATURE_REGISTRY } from '../config/premiumConfig';

export const PremiumScreen = ({ currentUser, onUpgrade }) => {
  const premiumFeatures = Object.values(FEATURE_REGISTRY).filter(f => f.isPremium);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '16px', height: '100%', overflowY: 'auto' }} className="fade-in">
      <div className="clash-card" style={{
        background: 'linear-gradient(135deg, rgba(252, 76, 2, 0.15), rgba(15, 23, 42, 0.95))',
        border: '1.5px solid #FC4C02',
        gap: '12px',
        textAlign: 'center',
        padding: '24px 16px'
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(252, 76, 2, 0.2)',
          border: '2px solid #FC4C02',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FC4C02'
        }}>
          <Crown size={28} />
        </div>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          RunClash Pro Membership
        </h3>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--clash-text-secondary)', lineHeight: 1.4, maxWidth: '300px', alignSelf: 'center' }}>
          Unlock AI strategy guidance, territory radar overlays, unlimited history analytics, and custom mission routes.
        </p>

        <button
          onClick={onUpgrade}
          style={{
            background: 'linear-gradient(135deg, #FC4C02 0%, #E04000 100%)',
            color: 'white',
            border: 'none',
            padding: '14px 24px',
            borderRadius: '14px',
            fontSize: '12px',
            fontWeight: '900',
            cursor: 'pointer',
            marginTop: '8px',
            boxShadow: '0 6px 20px rgba(252, 76, 2, 0.4)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          Upgrade to Pro • $4.99 / mo
        </button>
      </div>

      <div className="clash-card" style={{ gap: '12px' }}>
        <span className="clash-label" style={{ fontSize: '10px' }}>Included Tactical Pro Advantages</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {premiumFeatures.map((feat, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid #10B981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px'
              }}>
                <Check size={12} style={{ color: '#10B981' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>{feat.name}</span>
                <span style={{ fontSize: '10px', color: 'var(--clash-text-secondary)' }}>{feat.description}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
