import { Trophy, Shield, X } from 'lucide-react';
import { formatDuration } from '../../utils/formatters';

export function RunSummaryModal({
  isOpen,
  onClose,
  runData
}) {
  if (!isOpen || !runData) return null;

  const { distance, duration, pace, calories, loopResult } = runData;
  const isTerritoryClaimed = loopResult?.isLoop;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Badge */}
        <div className="flex flex-col items-center text-center my-2">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 mb-3">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-wide">CONQUEST COMPLETE</h2>
          <p className="text-xs text-slate-400 mt-1">Run summary & strategic evaluation</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 my-5">
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="text-xs text-slate-400">Distance</div>
            <div className="text-2xl font-black text-orange-500">{distance} KM</div>
          </div>
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="text-xs text-slate-400">Duration</div>
            <div className="text-2xl font-black text-cyan-400">{formatDuration(duration)}</div>
          </div>
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="text-xs text-slate-400">Avg Pace</div>
            <div className="text-xl font-bold text-slate-200">{pace}</div>
          </div>
          <div className="bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="text-xs text-slate-400">Calories</div>
            <div className="text-xl font-bold text-rose-400">{calories} kcal</div>
          </div>
        </div>

        {/* Territory Claim Status Card */}
        <div className={`p-4 rounded-2xl border mb-5 ${
          isTerritoryClaimed
            ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
            : 'bg-slate-950/60 border-slate-800 text-slate-400'
        }`}>
          <div className="flex items-center space-x-3">
            <Shield className={`w-6 h-6 flex-shrink-0 ${isTerritoryClaimed ? 'text-emerald-400' : 'text-slate-500'}`} />
            <div>
              <div className="text-sm font-bold">
                {isTerritoryClaimed ? 'New Sector Claimed!' : 'No Closed Loop Detected'}
              </div>
              <div className="text-xs mt-0.5 opacity-90">
                {isTerritoryClaimed
                  ? `Area: ${Math.round(loopResult.areaSqMeters || 150)} m² captured for your crew.`
                  : loopResult?.reason || 'Complete a perimeter loop to claim a new territory sector.'}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="w-full py-3 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl text-white transition-colors"
          >
            Save & Return
          </button>
        </div>
      </div>
    </div>
  );
}
