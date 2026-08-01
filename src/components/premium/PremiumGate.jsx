import React from 'react';
import { usePremiumAccess } from '../../hooks/usePremiumAccess';
import { FeatureLockedCard } from '../common/FeatureLockedCard';

export const PremiumGate = ({ currentUser, feature, children, fallback, onUpgradeClick }) => {
  const { canUse } = usePremiumAccess(currentUser);

  if (canUse(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <FeatureLockedCard
      featureKey={feature}
      onUpgradeClick={onUpgradeClick}
    />
  );
};
