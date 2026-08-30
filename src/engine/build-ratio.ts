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

import { Gym, StatKey, STAT_KEYS, STAT_LABEL } from './types';
import { evaluateGymEligibility, GymGate, isJailGym } from './gym-eligibility';

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

export interface GymTarget {
  gym: Gym;
  /** Which stat to train, and how much more of it, to meet the requirement. */
  stat: StatKey;
  pointsNeeded: number;
  requirement: string;
}

/**
 * The nearest locked specialist gym, and the stat gap that opens it.
 *
 * This is the payoff of tracking a ratio at all. Rather than "you are 2.3
 * points below target", it answers "train 1.4m more Defense and Mr. Isoyamas
 * opens" — which is the thing the player actually wants to know.
 *
 * The gap is found by bisection on the eligibility check itself, so it can
 * never drift from the real rule: whatever gym-eligibility says unlocks a gym
 * is what gets measured here.
 */
export function nearestGymTarget(
  gyms: Gym[],
  stats: Record<StatKey, number>,
  xanaxEcstasyTaken?: number | null,
  gate?: GymGate,
): GymTarget | null {
  const candidates: GymTarget[] = [];

  for (const gym of gyms) {
    if (isJailGym(gym)) continue;
    const current = evaluateGymEligibility(gym, stats, xanaxEcstasyTaken, gate);
    if (current.status !== 'locked' || !current.requirement) continue;

    for (const stat of STAT_KEYS) {
      if (gym.dots[stat] <= 0) continue;

      // Would training this stat alone ever unlock it? Probe a large multiple.
      const probe = { ...stats, [stat]: stats[stat] * 8 + 1e6 };
      if (evaluateGymEligibility(gym, probe, xanaxEcstasyTaken, gate).status === 'locked') continue;

      let lo = 0;
      let hi = probe[stat] - stats[stat];
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        const trial = { ...stats, [stat]: stats[stat] + mid };
        if (evaluateGymEligibility(gym, trial, xanaxEcstasyTaken, gate).status === 'locked') lo = mid;
        else hi = mid;
      }
      candidates.push({ gym, stat, pointsNeeded: hi, requirement: current.requirement });
    }
  }

  if (!candidates.length) return null;
  return candidates.sort((a, b) => a.pointsNeeded - b.pointsNeeded)[0];
}

/** One-line summary for the in-game overlay. */
export function ratioSummary(r: BuildRatioResult): string {
  if (r.onTrack) return 'On track for this build.';
  const worst = r.rows.find((x) => x.stat === r.trainNext)!;
  return `Train ${STAT_LABEL[worst.stat]} — ${worst.deltaPoints.toFixed(1)} points below target.`;
}
