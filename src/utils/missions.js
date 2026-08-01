/**
 * Daily Missions utility definitions and progress evaluators.
 */

export const DEFAULT_DAILY_MISSIONS = [
  {
    id: 'm_dist_1km',
    title: 'Recruit Recon',
    description: 'Run at least 1.0 km in total',
    target: 1.0,
    unit: 'km',
    rewardCoins: 50,
    rewardXp: 100
  },
  {
    id: 'm_claim_1',
    title: 'Sector Conquest',
    description: 'Capture 1 valid territory sector',
    target: 1,
    unit: 'sector',
    rewardCoins: 100,
    rewardXp: 200
  },
  {
    id: 'm_loop_1',
    title: 'Tactical Loop',
    description: 'Complete 1 closed loop within 25m of start',
    target: 1,
    unit: 'loop',
    rewardCoins: 75,
    rewardXp: 150
  },
  {
    id: 'm_dur_15m',
    title: 'Endurance Patrol',
    description: 'Maintain active run tracking for 15 minutes',
    target: 900, // seconds
    unit: 'sec',
    rewardCoins: 80,
    rewardXp: 120
  }
];
