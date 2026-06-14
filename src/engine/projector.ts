import { StatKey, STAT_KEYS } from './types';
import { simulateSession } from './session';

export interface DailyPlan {
  naturalEnergy: number; // trainable natural energy per day
  useRefill: boolean; // 150 E, once/day
  xanax: number; // count/day (250 E each)
  edvd: number; // happy jump additive units (+2500 each)
  ecstasy: boolean; // ×2 happy after additive
}

export interface UnitPrices {
  xanax: number | null;
  edvd: number | null;
  ecstasy: number | null;
  refill: number | null; // points refill total cost (pointPrice × 25)
}

export interface GymForStat {
  energyPerTrain: number;
  dots: number;
}

export interface Goal {
  type: 'total' | StatKey;
  target: number;
}

export interface ProjectorInput {
  stats: Record<StatKey, number>;
  baseHappy: number; // daily happy before the jump (regenerates to max)
  happyCap: number; // 99999
  modifiers: Record<StatKey, number>;
  gymForStat: Record<StatKey, GymForStat>;
  allocation: Record<StatKey, number>; // weights, summing to 1
  plan: DailyPlan;
  prices: UnitPrices;
  horizonDays: number;
  goal: Goal;
}

export interface DayPoint {
  day: number;
  value: number; // goal metric
  total: number;
  spend: number | null; // cumulative
}

export interface ProjectionResult {
  series: DayPoint[];
  daysToGoal: number | null;
  spendAtGoal: number | null;
  finalValue: number;
  dailyEnergy: number;
  sessionHappy: number;
  dailySpend: number | null;
}

function dailyEnergyOf(plan: DailyPlan): number {
  return plan.naturalEnergy + (plan.useRefill ? 150 : 0) + plan.xanax * 250;
}

function sessionHappyOf(plan: DailyPlan, baseHappy: number, cap: number): number {
  const h = (baseHappy + plan.edvd * 2500) * (plan.ecstasy ? 2 : 1);
  return Math.min(cap, h);
}

/** Daily spend; null if a required consumable price is missing. */
function dailySpendOf(plan: DailyPlan, p: UnitPrices): number | null {
  let spend = 0;
  if (plan.useRefill) {
    if (p.refill == null) return null;
    spend += p.refill;
  }
  if (plan.xanax > 0) {
    if (p.xanax == null) return null;
    spend += plan.xanax * p.xanax;
  }
  if (plan.edvd > 0) {
    if (p.edvd == null) return null;
    spend += plan.edvd * p.edvd;
  }
  if (plan.ecstasy) {
    if (p.ecstasy == null) return null;
    spend += p.ecstasy;
  }
  return spend;
}

function goalValue(stats: Record<StatKey, number>, goal: Goal): number {
  if (goal.type === 'total') return STAT_KEYS.reduce((s, k) => s + stats[k], 0);
  return stats[goal.type];
}

/**
 * Day-by-day projection (spec §8). Each day is modelled as one session per
 * allocated stat at the jumped happy, with the full daily energy; the session
 * engine decays happy within the day. Stats carry over, so growth compounds
 * (gain rises with stat total). Happy regenerates to baseHappy each day.
 */
export function project(i: ProjectorInput): ProjectionResult {
  const stats = { ...i.stats };
  const dailyEnergy = dailyEnergyOf(i.plan);
  const sessionHappy = sessionHappyOf(i.plan, i.baseHappy, i.happyCap);
  const dailySpend = dailySpendOf(i.plan, i.prices);

  const series: DayPoint[] = [];
  let daysToGoal: number | null = null;
  let spendAtGoal: number | null = null;
  let cumulative = 0;

  for (let day = 1; day <= i.horizonDays; day++) {
    for (const stat of STAT_KEYS) {
      const w = i.allocation[stat] ?? 0;
      const gym = i.gymForStat[stat];
      const e = dailyEnergy * w;
      if (w <= 0 || !gym || gym.dots <= 0 || e <= 0) continue;
      const sim = simulateSession({
        statValue: stats[stat],
        happy: sessionHappy,
        modifiers: i.modifiers[stat],
        energyPerTrain: gym.energyPerTrain,
        dots: gym.dots,
        energyBudget: e,
        mode: 'expected',
      });
      stats[stat] += sim.totalGain;
    }
    cumulative = dailySpend == null ? cumulative : cumulative + dailySpend;
    const value = goalValue(stats, i.goal);
    const total = STAT_KEYS.reduce((s, k) => s + stats[k], 0);
    series.push({ day, value, total, spend: dailySpend == null ? null : cumulative });

    if (daysToGoal == null && value >= i.goal.target) {
      daysToGoal = day;
      spendAtGoal = dailySpend == null ? null : cumulative;
    }
  }

  return {
    series,
    daysToGoal,
    spendAtGoal,
    finalValue: series.length ? series[series.length - 1].value : goalValue(stats, i.goal),
    dailyEnergy,
    sessionHappy,
    dailySpend,
  };
}
