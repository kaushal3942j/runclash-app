import React from 'react';

// Skeleton Loader Component for loading states across tabs
export function SkeletonCard({ count = 3 }) {
  const items = Array.from({ length: count });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {items.map((_, idx) => (
        <div 
          key={idx} 
          className="clash-card p-3" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between', 
            opacity: 0.6,
            animation: 'pulse 1.5s infinite ease-in-out' 
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255, 255, 255, 0.1)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ width: '100px', height: '12px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.15)' }} />
              <div style={{ width: '60px', height: '10px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.08)' }} />
            </div>
          </div>
          <div style={{ width: '50px', height: '14px', borderRadius: '4px', background: 'rgba(255, 255, 255, 0.12)' }} />
        </div>
      ))}
    </div>
  );
}
