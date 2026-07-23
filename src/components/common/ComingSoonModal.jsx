import { X, Sparkles } from 'lucide-react';

export function ComingSoonModal({ isOpen, onClose, title, description }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Sparkles className="w-7 h-7 text-white" />
        </div>

        <h3 className="text-xl font-black uppercase tracking-wide mb-1">
          {title || 'Coming Soon'}
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          {description || 'This strategic feature is undergoing tactical field testing and will launch in an upcoming update.'}
        </p>

        <button
          onClick={onClose}
          className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 font-bold rounded-xl text-xs text-white transition-colors"
        >
          Acknowledge
        </button>
      </div>
    </div>
  );
}
