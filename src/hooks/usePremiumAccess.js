import { useMemo } from 'react';
import { FEATURE_REGISTRY } from '../config/premiumConfig';

export const usePremiumAccess = (currentUser) => {
  const isPremium = useMemo(() => {
    if (!currentUser) return false;
    const tier = (currentUser.subscription_tier || currentUser.subscriptionTier || 'free').toLowerCase();
    if (tier === 'premium' || tier === 'pro') {
      const until = currentUser.premium_until || currentUser.premiumUntil;
      if (!until) return true;
      return new Date(until).getTime() > Date.now();
    }
    return false;
  }, [currentUser]);

  const canUse = (featureKey) => {
    const config = FEATURE_REGISTRY[featureKey];
    if (!config) return true;
    if (!config.isPremium) return true;
    return isPremium;
  };

  const requirePremium = (featureKey, callback) => {
    if (canUse(featureKey)) {
      if (typeof callback === 'function') callback();
      return true;
    }
    return false;
  };

  return {
    isPremium,
    canUse,
    requirePremium
  };
};
