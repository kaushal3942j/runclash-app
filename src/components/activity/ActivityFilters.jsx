import React from 'react';
import { Users, Globe, User } from 'lucide-react';

export const ActivityFilters = ({ filter, onFilterChange }) => {
  const filters = [
    { id: 'friends', label: 'Friends', icon: Users },
    { id: 'global', label: 'Global', icon: Globe },
    { id: 'mine', label: 'Mine', icon: User }
  ];

  return (
    <div style={{ display: 'flex', gap: '6px', backgroundColor: '#141414', padding: '4px', borderRadius: '12px', border: '1px solid #2A2A2A' }}>
      {filters.map(f => {
        const IconC = f.icon;
        const active = filter === f.id;
        return (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            style={{
              flex: 1,
              height: '36px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: active ? '#FC4C02' : 'transparent',
              color: active ? 'white' : '#A0A0A0',
              fontSize: '11px',
              fontWeight: '800',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <IconC size={13} />
            {f.label}
          </button>
        );
      })}
    </div>
  );
};
