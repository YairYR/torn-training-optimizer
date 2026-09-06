// Build-ratio tracking.
//
// The single most-requested thing in this niche: two separate userscripts do
// nothing but show your stat split against a target build, and both are
// popular. The reason is that Torn's specialist gyms gate on RATIOS, not on
// size, so a player committed to a build has to keep checking whether their
// last few days of training pushed them off it.
//
// What those scripts do not do is close the loop: they show the percentages
// and stop. Because this codebase already knows every gym's ratio requirement
// (gym-eligibility.ts), it can answer the question the percentages are a proxy
// for — how much of which stat until the gym I am building toward opens.

import { StatKey, STAT_KEYS } from './types';

export interface BuildPreset {
  id: string;
  label: string;
  /** Relative weights per stat; only the proportions matter. */
  weights: Record<StatKey, number>;
  note: string;
}

const w = (strength: number, defense: number, speed: number, dexterity: number) => ({
  strength,
  defense,
  speed,
  dexterity,
});

/**
 * The builds players actually run, from the Torn training guides.
 *
 * "Hank's ratio" is 1.25 : 1 : 1 : 0 — one stat a quarter above the other two
 * and a fourth abandoned entirely, which is exactly what a single-stat
 * specialist demands. The balanced build trades specialist access for not
 * having a stat of zero, which matters if you get attacked.
 */
export const BUILD_PRESETS: BuildPreset[] = [
  {
    id: 'balanced',
    label: 'Balanced',
    weights: w(1, 1, 1, 1),
    note: "No specialist access — George's at 7.3 dots is your ceiling, but nothing is left at zero.",
  },
  {
    id: 'hank-str',
    label: "Hank's — Strength",
    weights: w(1.25, 1, 0, 1),
    note: 'Speed abandoned. Targets Gym 3000 (8.0 Strength).',
  },
  {
    id: 'hank-def',
    label: "Hank's — Defense",
    weights: w(1, 1.25, 1, 0),
    note: 'Dexterity abandoned. Targets Mr. Isoyamas (8.0 Defense).',
  },
  {
    id: 'hank-spd',
    label: "Hank's — Speed",
    weights: w(1, 0, 1.25, 1),
    note: 'Defense abandoned. Targets Total Rebound (8.0 Speed).',
  },
  {
    id: 'hank-dex',
    label: "Hank's — Dexterity",
    weights: w(0, 1, 1, 1.25),
    note: 'Strength abandoned. Targets The Elites (8.0 Dexterity).',
  },
  {
    id: 'frontline',
    label: 'Two-stat — Str + Spd',
    weights: w(1.25, 1, 1.25, 1),
    note: 'Frontline Fitness (7.5 Strength and Speed). A softer commitment than a single-stat build.',
  },
  {
    id: 'balboas',
    label: 'Two-stat — Def + Dex',
    weights: w(1, 1.25, 1, 1.25),
    note: 'Balboas Gym (7.5 Defense and Dexterity).',
  },
];

export interface StatRatioRow {
  stat: StatKey;
  value: number;
  /** Share of total battle stats, 0–1. */
  share: number;
  targetShare: number;
  /** targetShare − share, in percentage points. Positive means behind. */
  deltaPoints: number;
  /**
   * Stat points to add to THIS stat to reach its target share, holding the
   * others still. Null when already at or above target — you cannot untrain.
   */
  pointsBehind: number | null;
  status: 'behind' | 'on-track' | 'ahead';
}

export interface BuildRatioResult {
  rows: StatRatioRow[];
  total: number;
  /** The stat furthest below target — what to train next. Null when on track. */
  trainNext: StatKey | null;
  onTrack: boolean;
}

/** Percentage points either side of target that still count as on track. */
const TOLERANCE_POINTS = 1;

export function evaluateBuildRatio(
  stats: Record<StatKey, number>,
  weights: Record<StatKey, number>,
): BuildRatioResult {
  const total = STAT_KEYS.reduce((a, s) => a + stats[s], 0);
  const weightSum = STAT_KEYS.reduce((a, s) => a + Math.max(0, weights[s]), 0);

  const rows: StatRatioRow[] = STAT_KEYS.map((stat) => {
    const share = total > 0 ? stats[stat] / total : 0;
    const targetShare = weightSum > 0 ? Math.max(0, weights[stat]) / weightSum : 0;
    const deltaPoints = (targetShare - share) * 100;

    // Solve (value + x) / (total + x) = targetShare for x. At targetShare = 1
    // there is no finite answer, but that build does not exist.
    const pointsBehind =
      deltaPoints > 0 && targetShare < 1
        ? (targetShare * total - stats[stat]) / (1 - targetShare)
        : null;

    const status: StatRatioRow['status'] =
      Math.abs(deltaPoints) <= TOLERANCE_POINTS ? 'on-track' : deltaPoints > 0 ? 'behind' : 'ahead';

    return { stat, value: stats[stat], share, targetShare, deltaPoints, pointsBehind, status };
  });

  const behind = rows.filter((r) => r.status === 'behind').sort((a, b) => b.deltaPoints - a.deltaPoints);

  return {
    rows,
    total,
    trainNext: behind[0]?.stat ?? null,
    onTrack: behind.length === 0,
  };
}

