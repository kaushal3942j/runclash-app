import { useState } from 'react';
import { UserPlus, Search } from 'lucide-react';
import { INITIAL_PROFILES } from '../../constants/appConstants';
import { getClanColor } from '../../utils/formatters';

export function SocialFeed() {
  const [activeSubTab, setActiveSubTab] = useState('crew'); // 'crew' or 'network'
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProfiles = INITIAL_PROFILES.filter(p =>
    p.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.clan.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-4 pb-24 text-white">
      {/* Sub-tab Navigation */}
      <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800">
        <button
          onClick={() => setActiveSubTab('crew')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'crew' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          Tactical Crews
        </button>
        <button
          onClick={() => setActiveSubTab('network')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
            activeSubTab === 'network' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          Runner Network
        </button>
      </div>

      {/* Runner Search Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search runners by name or clan..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-slate-900/90 border border-slate-800 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
        />
      </div>

      {/* Runner Directory List */}
      <div className="space-y-3">
        {filteredProfiles.map((profile) => {
          const color = getClanColor(profile.clan);
          return (
            <div
              key={profile.id}
              className="flex items-center justify-between p-4 bg-slate-900/90 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border"
                  style={{ borderColor: color, backgroundColor: `${color}20` }}
                >
                  {profile.displayName[0]}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm text-white">{profile.displayName}</span>
                    {profile.online && (
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400">
                    <span style={{ color }}>{profile.clan}</span> • Lvl {profile.level} • {profile.distance}
                  </div>
                </div>
              </div>

              <button className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors">
                <UserPlus className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
