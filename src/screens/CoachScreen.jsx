import React from 'react';
import { Sparkles, Brain, TrendingUp, ShieldAlert, Award } from 'lucide-react';
import { PremiumGate } from '../components/premium/PremiumGate';
import { FEATURE_KEYS } from '../config/premiumConfig';

export const CoachScreen = ({ currentUser, onUpgradeClick }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px', height: '100%', overflowY: 'auto' }} className="fade-in">
      {/* Coach Header Banner */}
      <div className="clash-card p-3" style={{ display: 'flex', alignItems: 'center', gap: '12px', borderLeft: '4px solid #FC4C02' }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          background: '#0B0B0B',
          border: '1.5px solid #FC4C02',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Brain size={20} style={{ color: '#FC4C02' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <h4 className="clash-subtitle" style={{ margin: '0', fontSize: '14px' }}>Synergy Tactical AI Coach</h4>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#FC4C02' }}></span>
          </div>
          <p className="clash-body" style={{ margin: '2px 0 0 0', fontSize: '11px' }}>
            Rule-Based Strategy Engine • Active
          </p>
        </div>
      </div>

      <PremiumGate
        currentUser={currentUser}
        feature={FEATURE_KEYS.AI_COACH}
        onUpgradeClick={onUpgradeClick}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Tactical Recommendation Card 1 */}
          <div className="clash-card" style={{ gap: '8px', borderLeft: '3px solid #10B981' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={16} style={{ color: '#10B981' }} />
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>
                Pace Consistency Analysis
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--clash-text-secondary)', lineHeight: 1.4 }}>
              Your average pace is steady. Try maintaining a 5:30 /km rhythm over 1.2 km to maximize area capture efficiency.
            </p>
          </div>

          {/* Tactical Recommendation Card 2 */}
          <div className="clash-card" style={{ gap: '8px', borderLeft: '3px solid #F59E0B' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={16} style={{ color: '#F59E0B' }} />
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>
                Expiring Territory Warning
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--clash-text-secondary)', lineHeight: 1.4 }}>
              Two of your claimed sectors will decay within 24 hours. Complete a quick loop nearby to renew holding duration.
            </p>
          </div>

          {/* Tactical Recommendation Card 3 */}
          <div className="clash-card" style={{ gap: '8px', borderLeft: '3px solid #3B82F6' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={16} style={{ color: '#3B82F6' }} />
              <span style={{ fontSize: '12px', fontWeight: '800', color: 'white' }}>
                Daily Mission Goal
              </span>
            </div>
            <p style={{ margin: 0, fontSize: '11px', color: 'var(--clash-text-secondary)', lineHeight: 1.4 }}>
              You are 1 sector away from completing today's "Sector Conquest" daily mission for +100 Coins & +200 XP.
            </p>
          </div>
        </div>
      </PremiumGate>
    </div>
  );
};
