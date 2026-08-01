/**
 * Rank Progression utility functions.
 */

export const RANKS = [
  { name: 'Recruit', minXp: 0, icon: '🎖️', badgeColor: '#9CA3AF' },
  { name: 'Scout', minXp: 500, icon: '🪖', badgeColor: '#10B981' },
  { name: 'Runner', minXp: 1500, icon: '🏃', badgeColor: '#3B82F6' },
  { name: 'Hunter', minXp: 3500, icon: '🎯', badgeColor: '#8B5CF6' },
  { name: 'Commander', minXp: 7500, icon: '⚔️', badgeColor: '#FC4C02' },
  { name: 'Legend', minXp: 15000, icon: '👑', badgeColor: '#F59E0B' }
];

export const getRankFromXp = (xp = 0) => {
  const currentXp = Number(xp) || 0;
  for (let i = RANKS.length - 1; i >= 0; i--) {
    if (currentXp >= RANKS[i].minXp) {
      const currentRank = RANKS[i];
      const nextRank = RANKS[i + 1] || null;
      const prevXp = currentRank.minXp;
      const nextXp = nextRank ? nextRank.minXp : prevXp + 10000;
      const progress = Math.min(100, Math.max(0, Math.round(((currentXp - prevXp) / (nextXp - prevXp)) * 100)));
      return {
        ...currentRank,
        progress,
        nextRankName: nextRank ? nextRank.name : 'Max Level',
        xpToNext: nextRank ? nextXp - currentXp : 0
      };
    }
  }
  return { ...RANKS[0], progress: 0, nextRankName: RANKS[1].name, xpToNext: 500 };
};
