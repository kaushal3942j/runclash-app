import { Play, Square, Pause, Flame, Clock, Navigation, Radio, RefreshCw } from 'lucide-react';
import { formatDuration } from '../../utils/formatters';

export function RunHud({
  runState,
  trackingMode,
  setTrackingMode,
  simulationRouteKey,
  setSimulationRouteKey,
  onStartRun,
  onPauseRun,
  onResumeRun,
  onCompleteRun,
  onCancelRun
}) {
  const isTracking = runState.status === 'tracking';
  const isPaused = runState.status === 'paused';
  const isIdle = runState.status === 'idle';

  return (
    <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 shadow-2xl text-white">
      {/* Dev Mode Simulator Toggle */}
      {isIdle && (
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800 text-xs">
          <div className="flex items-center space-x-2">
            <Radio className="w-4 h-4 text-orange-500" />
            <span className="text-slate-300 font-semibold">Mode:</span>
            <button
              onClick={() => setTrackingMode('gps')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                trackingMode === 'gps' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              GPS
            </button>
            <button
              onClick={() => setTrackingMode('sim')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${
                trackingMode === 'sim' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400'
              }`}
            >
              SIM
            </button>
          </div>

          {trackingMode === 'sim' && (
            <select
              value={simulationRouteKey}
              onChange={(e) => setSimulationRouteKey(e.target.value)}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1 text-xs"
            >
              <option value="lake">Fateh Sagar Loop (3.2k)</option>
              <option value="foothills">Sajjan Garh (2.1k)</option>
              <option value="monument">Castle Park (1.4k)</option>
              <option value="micro">Micro Loop (Test)</option>
            </select>
          )}
        </div>
      )}

      {/* Main Metrics Display */}
      <div className="text-center my-2">
        <div className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">
          Total Distance
        </div>
        <div className="text-5xl font-black tracking-tight text-white">
          {runState.distance.toFixed(2)}{' '}
          <span className="text-2xl text-orange-500 font-bold">KM</span>
        </div>
      </div>

      {/* Grid Stats: Duration, Pace, Calories */}
      <div className="grid grid-cols-3 gap-3 my-4 py-3 bg-slate-950/60 rounded-2xl border border-slate-800/80 text-center">
        <div>
          <div className="flex items-center justify-center text-slate-400 text-xs mb-1">
            <Clock className="w-3.5 h-3.5 mr-1 text-cyan-400" /> Duration
          </div>
          <div className="text-base font-bold text-white">
            {formatDuration(runState.duration)}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-center text-slate-400 text-xs mb-1">
            <Navigation className="w-3.5 h-3.5 mr-1 text-orange-400" /> Pace
          </div>
          <div className="text-base font-bold text-white">{runState.pace}</div>
        </div>

        <div>
          <div className="flex items-center justify-center text-slate-400 text-xs mb-1">
            <Flame className="w-3.5 h-3.5 mr-1 text-rose-500" /> Calories
          </div>
          <div className="text-base font-bold text-white">{runState.calories}</div>
        </div>
      </div>

      {/* Action Buttons Controls */}
      <div className="flex items-center justify-center space-x-4 mt-4">
        {isIdle && (
          <button
            onClick={onStartRun}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 font-black text-lg tracking-wider uppercase text-white shadow-lg shadow-orange-500/30 flex items-center justify-center space-x-2 transition-transform active:scale-95"
          >
            <Play className="w-6 h-6 fill-current" />
            <span>START CONQUEST RUN</span>
          </button>
        )}

        {isTracking && (
          <>
            <button
              onClick={onPauseRun}
              className="flex-1 py-3.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-400 font-bold flex items-center justify-center space-x-2 transition-colors"
            >
              <Pause className="w-5 h-5 fill-current" />
              <span>PAUSE</span>
            </button>
            <button
              onClick={onCompleteRun}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-colors"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>FINISH & CLAIM</span>
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={onResumeRun}
              className="flex-1 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 transition-colors"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>RESUME</span>
            </button>
            <button
              onClick={onCompleteRun}
              className="flex-1 py-3.5 rounded-2xl bg-orange-500 hover:bg-orange-600 text-white font-bold flex items-center justify-center space-x-2 transition-colors"
            >
              <Square className="w-5 h-5 fill-current" />
              <span>FINISH</span>
            </button>
            <button
              onClick={onCancelRun}
              className="p-3.5 rounded-2xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-400 font-bold transition-colors"
              title="Discard Run"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
