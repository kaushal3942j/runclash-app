import { Shield, Trophy, ChevronRight, Sparkles } from 'lucide-react';
import { getClanColor, calculateLevelAndXp } from '../../utils/formatters';

export function RunnerHQ({
  currentUser,
  clanStandings = [],
  onOpenClanModal,
  onOpenSubscriptionModal
}) {
  const { xp, level, progressPercent } = calculateLevelAndXp(currentUser?.distance || 0);
  const clanColor = getClanColor(currentUser?.clan);
  const hasClan = currentUser?.clan && currentUser.clan !== 'None';

  return (
    <div className="space-y-5 pb-24 text-white">
      {/* 1. Profile Status & Level Progress Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-5 rounded-3xl border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl border-2 shadow-md"
              style={{ borderColor: clanColor, backgroundColor: `${clanColor}20` }}
            >
              {currentUser?.displayName?.[0]?.toUpperCase() || 'R'}
            </div>
            <div>
              <h2 className="text-xl font-black text-white">{currentUser?.displayName || 'Operative'}</h2>
              <div className="flex items-center space-x-2 text-xs text-slate-400 mt-0.5">
                <span className="font-semibold" style={{ color: clanColor }}>
                  {currentUser?.clan || 'No Clan'}
                </span>
                <span>•</span>
                <span className="text-amber-400 font-bold">Level {level}</span>
              </div>
            </div>
          </div>

          <button
            onClick={onOpenSubscriptionModal}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-xs font-bold text-white shadow-md shadow-orange-500/20 transition-transform active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Upgrade</span>
          </button>
        </div>

        {/* Level XP Progress Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5 font-medium">
            <span>XP Progress</span>
            <span className="text-amber-400 font-bold">{progressPercent}% ({xp} XP)</span>
          </div>
          <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 2. Tactical Crew / Clan HQ Card */}
      <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2.5">
            <Shield className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold text-base text-white">Tactical Crew</h3>
          </div>
          <button
            onClick={onOpenClanModal}
            className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center"
          >
            <span>{hasClan ? 'Crew Details' : 'Join / Create'}</span>
            <ChevronRight className="w-4 h-4 ml-0.5" />
          </button>
        </div>

        {hasClan ? (
          <div className="flex items-center justify-between p-3.5 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <div>
              <div className="text-sm font-bold text-white">{currentUser.clan}</div>
              <div className="text-xs text-slate-400 mt-0.5">Active Operation Sector</div>
            </div>
            <span
              className="px-3 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: `${clanColor}30`, color: clanColor }}
            >
              Active
            </span>
          </div>
        ) : (
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-center">
            <div className="text-sm font-bold text-slate-300 mb-1">No Clan Assigned</div>
            <p className="text-xs text-slate-400 mb-3">
              Join forces with nearby runners to claim territory sectors and earn bonus XP.
            </p>
            <button
              onClick={onOpenClanModal}
              className="px-4 py-2 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/40 text-orange-400 text-xs font-bold transition-colors"
            >
              Browse Crews
            </button>
          </div>
        )}
      </div>

      {/* 3. Clan Standings Leaderboard */}
      {clanStandings.length > 0 && (
        <div className="bg-slate-900/90 p-5 rounded-3xl border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2.5">
              <Trophy className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-base text-white">City Dominance Standings</h3>
            </div>
          </div>

          <div className="space-y-2">
            {clanStandings.slice(0, 4).map((clan, idx) => {
              const color = getClanColor(clan.name);
              return (
                <div
                  key={clan.name}
                  className="flex items-center justify-between p-3 bg-slate-950/60 rounded-2xl border border-slate-800/60 text-xs"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-5 text-center font-bold text-slate-500">#{idx + 1}</span>
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></span>
                    <span className="font-bold text-white">{clan.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-orange-400">{clan.dominance}%</span>
                    <span className="text-slate-400 ml-1.5">({clan.territories} sectors)</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
