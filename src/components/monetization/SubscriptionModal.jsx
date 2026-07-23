import { useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { SUBSCRIPTION_TIERS, processSubscriptionPayment } from '../../services/paymentService';

export function SubscriptionModal({
  isOpen,
  onClose,
  currentUser,
  onUpdateSubscription
}) {
  const [loadingTier, setLoadingTier] = useState(null);
  const [paymentError, setPaymentError] = useState(null);

  if (!isOpen) return null;

  const handleSelectTier = (tier) => {
    setPaymentError(null);
    setLoadingTier(tier.id);

    processSubscriptionPayment({
      tierId: tier.id,
      userProfile: currentUser,
      onSuccess: (paymentData) => {
        setLoadingTier(null);
        if (onUpdateSubscription) onUpdateSubscription(tier.id, paymentData);
        onClose();
      },
      onCancel: () => {
        setLoadingTier(null);
      },
      onError: (err) => {
        setLoadingTier(null);
        setPaymentError(err);
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-white max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center my-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-lg shadow-orange-500/20 mb-2">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-wide">UPGRADE MEMBERSHIP</h2>
          <p className="text-xs text-slate-400 mt-1">Unlock unlimited territory capture, XP multipliers, and advanced tools</p>
        </div>

        {paymentError && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {paymentError}
          </div>
        )}

        {/* Plans Grid */}
        <div className="space-y-4 my-6">
          {Object.values(SUBSCRIPTION_TIERS).map((tier) => {
            const isCurrentTier = (currentUser?.tier || 'free') === tier.id;
            const isPopular = tier.id === 'premium';

            return (
              <div
                key={tier.id}
                className={`relative p-5 rounded-2xl border transition-all ${
                  isPopular
                    ? 'bg-slate-950 border-orange-500/80 shadow-lg shadow-orange-500/10'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                {isPopular && (
                  <span className="absolute -top-3 right-4 px-3 py-0.5 rounded-full bg-orange-500 text-[10px] font-black uppercase tracking-wider text-white">
                    Most Popular
                  </span>
                )}

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-black text-base text-white">{tier.name}</h3>
                    <div className="text-xs text-slate-400">
                      {tier.price === 0 ? 'Free Forever' : `₹${tier.price} / ${tier.period}`}
                    </div>
                  </div>

                  <button
                    disabled={isCurrentTier || loadingTier === tier.id}
                    onClick={() => handleSelectTier(tier)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      isCurrentTier
                        ? 'bg-slate-800 text-slate-400 cursor-default'
                        : isPopular
                        ? 'bg-orange-500 hover:bg-orange-600 text-white shadow-md shadow-orange-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                  >
                    {isCurrentTier ? 'Active Plan' : loadingTier === tier.id ? 'Processing...' : 'Select Plan'}
                  </button>
                </div>

                {/* Features List */}
                <ul className="space-y-1.5 pt-2 border-t border-slate-800/80 text-xs text-slate-300">
                  {tier.features.map((feat, idx) => (
                    <li key={idx} className="flex items-center space-x-2">
                      <Check className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
