import { Shield, Coins, Bell, Settings, Award } from 'lucide-react';
import { getClanColor, calculateLevelAndXp } from '../../utils/formatters';

export function Header({
  currentUser,
  activeTab,
  onOpenSettings,
  onOpenNotifications,
  unreadNotificationCount = 0
}) {
  const { level } = calculateLevelAndXp(currentUser?.distance || 0);
  const clanColor = getClanColor(currentUser?.clan);

  const getTabTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Runner HQ';
      case 'map': return 'Tactical Map';
      case 'conquests': return 'Crew Conquests';
      case 'clans': return 'Social Hub';
      case 'coach': return 'AI Run Coach';
      default: return 'RunClash';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 text-white">
      {/* Brand & Tab Title */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 shadow-lg shadow-orange-500/20">
          <Shield className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-black tracking-wider uppercase bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            {getTabTitle()}
          </h1>
          {currentUser && (
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <span className="flex items-center font-medium" style={{ color: clanColor }}>
                ● {currentUser.clan || 'No Clan'}
              </span>
              <span>•</span>
              <span className="flex items-center font-bold text-amber-400">
                <Award className="w-3 h-3 mr-0.5 inline" /> Lvl {level}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Right Controls: User Pill & Quick Actions */}
      <div className="flex items-center space-x-2">
        {currentUser && (
          <div className="hidden sm:flex items-center bg-slate-800/80 rounded-full px-3 py-1 border border-slate-700/60 text-xs text-slate-200">
            <Coins className="w-3.5 h-3.5 text-amber-400 mr-1.5" />
            <span className="font-bold text-white">{currentUser.coins || 120}</span>
            <span className="ml-1 text-slate-400">RC</span>
          </div>
        )}

        <button
          onClick={onOpenNotifications}
          className="relative p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/50 transition-colors"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          {unreadNotificationCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-slate-900"></span>
          )}
        </button>

        <button
          onClick={onOpenSettings}
          className="p-2 text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/50 transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
