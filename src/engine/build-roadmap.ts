import { Gym, StatKey, STAT_KEYS, STAT_LABEL } from './types';
import { evaluateGymEligibility, GymGate, isUsable, georgesGymId } from './gym-eligibility';
import { resolveUnlockTarget } from './planner';

// Build roadmap: given the player's stats and a chosen primary stat, lays out
// the ladder of gyms that build unlocks — George's (7.3) -> paired specialist
// (7.5) -> single-stat specialist (8.0) — plus the parallel Sports Science Lab
// (9.0, drug-gated). Verified mechanics: single-stat 50E gyms need the stat at
// >=1.25x the second-highest; paired 25E gyms need the pair sum >=1.25x the
// other pair. Community build templates: Hank's ratio 1.25:1:1:0 (dump one
// stat, primary 8.0 / secondary 7.5) and Baldr's 1.25:1:0.75:0.75 (balanced).

// Offensive pair = Strength + Speed (Frontline). Defensive pair = Defense + Dexterity (Balboas).
export const PAIR_OF: Record<StatKey, StatKey> = {
  strength: 'speed',
  speed: 'strength',
  defense: 'dexterity',
  dexterity: 'defense',
};

export type StageStatus = 'baseline' | 'unlocked' | 'next' | 'locked';

export interface RoadmapStage {
  gymId: string;
  gymName: string;
  /** dots for the primary stat at this gym */
  dots: number;
  energyPerTrain: number;
  status: StageStatus;
  requirement: string;
  /** stat to train and value it must reach to unlock (locked specialist stages) */
  trainStat?: StatKey;
  targetValue?: number;
  gap?: number;
  parallel?: boolean; // SSL — not part of the linear ratio ladder
}

export interface BuildRoadmap {
  primary: StatKey;
  pair: StatKey;
  dumped: StatKey[];
  /** primary value / highest of the other three (1.25 unlocks the single-stat gym) */
  primaryRatio: number;
  isOffensive: boolean;
  stages: RoadmapStage[];
  /** first locked specialist in the ladder, the actionable next step */
  nextStage: RoadmapStage | null;
}

function trainedSet(g: Gym): StatKey[] {
  return STAT_KEYS.filter((s) => g.dots[s] > 0);
}

function sameSet(a: StatKey[], b: StatKey[]): boolean {
  return a.length === b.length && a.every((x) => b.includes(x));
}

function specialistStage(
  gym: Gym,
  primary: StatKey,
  stats: Record<StatKey, number>,
  xanaxEcstasy: number | null | undefined,
  gate: GymGate,
): RoadmapStage {
  const elig = evaluateGymEligibility(gym, stats, xanaxEcstasy, gate);
  const base: RoadmapStage = {
    gymId: gym.id,
    gymName: gym.name,
    dots: gym.dots[primary],
    energyPerTrain: gym.energyPerTrain,
    status: isUsable(elig.status) ? 'unlocked' : 'locked',
    requirement: elig.requirement ?? '',
  };
  if (base.status === 'locked') {
    const t = resolveUnlockTarget(gym, stats);
    if (t) {
      base.trainStat = t.stat;
      base.targetValue = t.target;
      base.gap = Math.max(0, t.target - stats[t.stat]);
    }
  }
  return base;
}

export function buildRoadmap(
  gyms: Gym[],
  stats: Record<StatKey, number>,
  primary: StatKey,
  xanaxEcstasy: number | null | undefined,
  gate: GymGate,
): BuildRoadmap {
  const pair = PAIR_OF[primary];
  const dumped = STAT_KEYS.filter((s) => s !== primary && s !== pair);
  const isOffensive = primary === 'strength' || primary === 'speed';

  const otherMax = Math.max(...STAT_KEYS.filter((s) => s !== primary).map((s) => stats[s]));
  const primaryRatio = otherMax > 0 ? stats[primary] / otherMax : Infinity;

  const gId = georgesGymId(gyms);
  const georges = gId != null ? gyms.find((g) => Number(g.id) === gId) : undefined;
  const pairedGym = gyms.find(
    (g) => g.energyPerTrain === 25 && sameSet(trainedSet(g), [primary, pair]),
  );
  const singleGym = gyms.find(
    (g) => g.energyPerTrain === 50 && trainedSet(g).length === 1 && g.dots[primary] > 0,
  );
  const ssl = gyms.find((g) => g.energyPerTrain === 25 && trainedSet(g).length === 4);

  const stages: RoadmapStage[] = [];

  if (georges) {
    const elig = evaluateGymEligibility(georges, stats, xanaxEcstasy, gate);
    stages.push({
      gymId: georges.id,
      gymName: georges.name,
      dots: georges.dots[primary],
      energyPerTrain: georges.energyPerTrain,
      status: isUsable(elig.status) ? 'baseline' : 'locked',
      requirement: isUsable(elig.status)
        ? 'Best all-round gym — your baseline'
        : elig.requirement ?? '',
    });
  }
  if (pairedGym) stages.push(specialistStage(pairedGym, primary, stats, xanaxEcstasy, gate));
  if (singleGym) stages.push(specialistStage(singleGym, primary, stats, xanaxEcstasy, gate));

  // The actionable next step is the locked specialist that unlocks soonest —
  // the smallest training gap, not necessarily the lowest-dot gym (a large
  // dumped pair can make the single-stat gym unlock before the paired one).
  const lockedWithGap = stages.filter((s) => s.status === 'locked' && s.gap != null);
  const nextStage = lockedWithGap.length
    ? lockedWithGap.reduce((a, b) => ((b.gap ?? Infinity) < (a.gap ?? Infinity) ? b : a))
    : null;
  if (nextStage) nextStage.status = 'next';

  // SSL as a parallel option (drug-gated, not ratio-gated).
  if (ssl) {
    const stage = specialistStage(ssl, primary, stats, xanaxEcstasy, gate);
    stage.parallel = true;
    stages.push(stage);
  }

  return { primary, pair, dumped, primaryRatio, isOffensive, stages, nextStage };
}

export const buildLabel = (primary: StatKey): string => `${STAT_LABEL[primary]} build`;
