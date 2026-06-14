// Recommended training regime by stat level. The optimal method is NOT a fixed
// 99k happy jump — it depends on how high the stat already is (Torn community
// consensus, validated against multiple training guides):
//   - Low stat: happy dominates -> happy jump.
//   - Mid stat: energy training daily + a jump when the booster cooldown is open.
//   - High stat: pure energy training; stacking 35h for a jump wastes regen, and
//     the stat-growth term flattens near 50M. A sustained 99k jump only pays off
//     with the "Ignorance Is Bliss" book (happy stays above max for 31 days).
// Thresholds are approximate and editable.

export const STAT_GROWTH_CAP = 50_000_000; // stat-total contribution flattens here
export const HAPPY_JUMP_CEILING = 400_000; // below: happy jumps dominate
export const ENERGY_TRAINING_FLOOR = 12_000_000; // above: pure energy training

export type Regime = 'happy-jump' | 'hybrid' | 'energy-training';

export interface RegimeInfo {
  regime: Regime;
  label: string;
  rationale: string;
}

export function trainingRegime(statValue: number): RegimeInfo {
  if (statValue < HAPPY_JUMP_CEILING) {
    return {
      regime: 'happy-jump',
      label: 'Happy jump',
      rationale: 'Under ~400k, happy dominates — jump happy high and train a modest stack.',
    };
  }
  if (statValue < ENERGY_TRAINING_FLOOR) {
    return {
      regime: 'hybrid',
      label: 'Hybrid',
      rationale:
        'Energy-train daily (Xanax + refill + natural); add a happy jump when the booster cooldown is open.',
    };
  }
  return {
    regime: 'energy-training',
    label: 'Energy training',
    rationale:
      'Past ~12M, stacking 35h for a jump wastes regen. Train your full energy daily at max happy; a sustained 99k jump only pays off with the Ignorance Is Bliss book.',
  };
}

export function atGrowthCap(statValue: number): boolean {
  return statValue >= STAT_GROWTH_CAP;
}
