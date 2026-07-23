import { Shield, Mail, Lock, User, AlertCircle } from 'lucide-react';

export function AuthModal({
  authMode,
  setAuthMode,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authName,
  setAuthName,
  authClan,
  setAuthClan,
  authError,
  onLogin,
  onRegister,
  onGuestLogin
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30 mb-3">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-wider bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            RUNCLASH
          </h2>
          <p className="text-xs text-slate-400 mt-1">Conquer sectors • Defend territories • Run together</p>
        </div>

        {/* Error Alert */}
        {authError && (
          <div className="flex items-center space-x-2 p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-5">
          <button
            onClick={() => setAuthMode('login')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
              authMode === 'login' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Log In
          </button>
          <button
            onClick={() => setAuthMode('signup')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
              authMode === 'signup' ? 'bg-orange-500 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
        </div>

        {/* Form Fields */}
        <form onSubmit={authMode === 'login' ? onLogin : onRegister} className="space-y-4">
          {authMode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Runner Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  required
                  placeholder="Enter your runner callsign"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                placeholder="runner@runclash.app"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {/* Dynamic Clan Selector for Signup Flow */}
          {authMode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Join a Clan (Optional)
              </label>
              <select
                value={authClan}
                onChange={(e) => setAuthClan(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-orange-500"
              >
                <option value="None">Skip for now</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-orange-500/20 transition-transform active:scale-95"
          >
            {authMode === 'login' ? 'Authenticate' : 'Create Account'}
          </button>
        </form>

        {/* Guest Access Divider */}
        <div className="relative my-5 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800"></div>
          </div>
          <span className="relative px-3 bg-slate-900 text-[10px] uppercase font-bold text-slate-500">
            Or Quick Access
          </span>
        </div>

        <button
          onClick={onGuestLogin}
          className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold text-xs transition-colors"
        >
          Continue as Guest Operative
        </button>
      </div>
    </div>
  );
}
