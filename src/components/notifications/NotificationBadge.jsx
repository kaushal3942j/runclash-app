import React from 'react';

export const NotificationBadge = ({ count }) => {
  if (!count || count <= 0) return null;

  return (
    <span style={{
      backgroundColor: '#FC4C02',
      color: 'white',
      borderRadius: '10px',
      padding: '2px 6px',
      fontSize: '9px',
      fontWeight: '900',
      lineHeight: '1',
      boxShadow: '0 2px 4px rgba(0,0,0,0.5)'
    }}>
      {count > 99 ? '99+' : count}
    </span>
  );
};
