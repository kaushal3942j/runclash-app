import { useState } from 'react';
import { Edit3, LogOut } from 'lucide-react';
import { getClanColor, calculateLevelAndXp } from '../../utils/formatters';

export function ProfileView({
  currentUser,
  onLogout,
  onUpdateProfile
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [bio, setBio] = useState(currentUser?.bio || 'Strategic operative claiming city sectors.');

  const { level, xp } = calculateLevelAndXp(currentUser?.distance || 0);
  const clanColor = getClanColor(currentUser?.clan);

  const handleSave = () => {
    onUpdateProfile({ displayName, bio });
    setIsEditing(false);
  };

  return (
    <div className="space-y-5 pb-24 text-white">
      {/* Profile Header Card */}
      <div className="bg-slate-900/90 p-6 rounded-3xl border border-slate-800 text-center relative">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <Edit3 className="w-4 h-4" />
        </button>

        <div
          className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center font-black text-3xl border-2 shadow-lg mb-3"
          style={{ borderColor: clanColor, backgroundColor: `${clanColor}20` }}
        >
          {currentUser?.displayName?.[0]?.toUpperCase() || 'R'}
        </div>

        {isEditing ? (
          <div className="space-y-3 max-w-xs mx-auto my-3">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-center text-sm text-white focus:outline-none focus:border-orange-500"
            />
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-center text-xs text-white focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleSave}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 rounded-xl font-bold text-xs text-white transition-colors"
            >
              Save Profile
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-black text-white">{currentUser?.displayName || 'Operative'}</h2>
            <div className="text-xs font-semibold mt-1" style={{ color: clanColor }}>
              {currentUser?.clan || 'No Clan'} • Level {level}
            </div>
            <p className="text-xs text-slate-400 mt-2 max-w-xs mx-auto">{bio}</p>
          </>
        )}
      </div>

      {/* Stats Summary Grid */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 text-center">
          <div className="text-xs text-slate-400">Total Distance</div>
          <div className="text-lg font-black text-orange-500 mt-1">
            {currentUser?.distance || 0} KM
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 text-center">
          <div className="text-xs text-slate-400">Territories</div>
          <div className="text-lg font-black text-cyan-400 mt-1">
            {currentUser?.territoriesCount || 0}
          </div>
        </div>

        <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800 text-center">
          <div className="text-xs text-slate-400">Earned XP</div>
          <div className="text-lg font-black text-amber-400 mt-1">{xp}</div>
        </div>
      </div>

      {/* Account Logout Action */}
      <button
        onClick={onLogout}
        className="w-full py-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-sm flex items-center justify-center space-x-2 transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out Account</span>
      </button>
    </div>
  );
}
