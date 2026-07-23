import { Home, MapPin, Shield, Users, Sparkles } from 'lucide-react';

export function NavigationBar({ activeTab, setActiveTab }) {
  const tabs = [
    { id: 'dashboard', label: 'HQ', icon: Home },
    { id: 'map', label: 'Map', icon: MapPin },
    { id: 'conquests', label: 'Conquests', icon: Shield },
    { id: 'clans', label: 'Social', icon: Users },
    { id: 'coach', label: 'Coach', icon: Sparkles }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-950/95 backdrop-blur-lg border-t border-slate-800/80 px-2 py-1.5 sm:py-2">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center justify-center flex-1 py-1.5 px-2 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'text-orange-500 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1.5 w-8 h-1 rounded-full bg-orange-500 shadow-md shadow-orange-500/50"></span>
              )}
              <Icon className={`w-5 h-5 mb-0.5 transition-transform ${isActive ? 'scale-110' : ''}`} />
              <span className="text-[10px] tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
