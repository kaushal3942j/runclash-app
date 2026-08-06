import React, { useState, useEffect } from 'react';
import { Search, MapPin, User, Shield } from 'lucide-react';
import { searchProfiles } from '../../services/profileService';
import { RelationshipButton } from './RelationshipButton';

export const PlayerSearch = ({ onSelectPlayer }) => {
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    let active = true;
    setIsSearching(true);

    const timer = setTimeout(() => {
      searchProfiles(query, { country: countryFilter, city: cityFilter })
        .then(res => {
          if (active && res.success) {
            setResults(res.data || []);
          }
        })
        .finally(() => {
          if (active) setIsSearching(false);
        });
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, countryFilter, cityFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Search Input Bar */}
      <div style={{ position: 'relative' }}>
        <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--clash-text-secondary)' }} />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by display name or @username..."
          className="cyber-input cyber-input-with-icon focus-ring"
          style={{ height: '46px', fontSize: '13px' }}
        />
      </div>

      {/* Filter Row */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={countryFilter}
          onChange={e => setCountryFilter(e.target.value)}
          placeholder="Filter by country..."
          className="cyber-input focus-ring"
          style={{ height: '36px', fontSize: '11px', flex: 1 }}
        />
        <input
          type="text"
          value={cityFilter}
          onChange={e => setCityFilter(e.target.value)}
          placeholder="Filter by city..."
          className="cyber-input focus-ring"
          style={{ height: '36px', fontSize: '11px', flex: 1 }}
        />
      </div>

      {/* Results List */}
      {isSearching ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--clash-text-secondary)', fontSize: '12px' }}>
          Searching sector database...
        </div>
      ) : results.length === 0 ? (
        <div className="clash-card" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--clash-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <User size={28} style={{ color: '#444' }} />
          <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>No runners found</span>
          <span style={{ fontSize: '11px' }}>Try searching for a display name or handle like @runner.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {results.map(player => (
            <div
              key={player.id}
              className="clash-card"
              style={{
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px'
              }}
            >
              <div
                onClick={() => onSelectPlayer && onSelectPlayer(player.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', flex: 1 }}
              >
                {/* Avatar */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#242424',
                  border: '1px solid #FC4C02',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0
                }}>
                  {player.avatar_url ? (
                    <img src={player.avatar_url} alt={player.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>
                      {(player.display_name || 'R')[0].toUpperCase()}
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '800', color: 'white' }}>{player.display_name || 'Runner'}</span>
                    {player.username && (
                      <span style={{ fontSize: '10px', color: '#FC4C02', fontWeight: '700' }}>@{player.username}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', color: 'var(--clash-text-secondary)' }}>
                    <span>LVL {player.level || 1}</span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                      <Shield size={10} style={{ color: '#FC4C02' }} />
                      {player.clan_name || 'None'}
                    </span>
                    {player.city && (
                      <>
                        <span>•</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                          <MapPin size={10} />
                          {player.city}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <RelationshipButton targetUserId={player.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
