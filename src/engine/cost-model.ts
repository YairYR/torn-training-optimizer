import { EnergySource, HappyBooster } from '../data/consumables';
import { simulateSession } from './session';

export interface Prices {
  /** Exact item name -> market value. */
  items: Record<string, number>;
  /** Cheapest point market price. */
  pointPrice: number | null;
}

export interface EnergyRank {
  source: EnergySource;
  /** Dollars per energy point. null when the price is unavailable. */
  dollarsPerEnergy: number | null;
}

/** $/energy for a single source (spec §4.4). null if price unknown. */
export function dollarsPerEnergy(source: EnergySource, prices: Prices): number | null {
  if (source.priceKind === 'free') return 0;
  if (source.priceKind === 'points') {
    if (prices.pointPrice == null || !source.pointsCost) return null;
    return (prices.pointPrice * source.pointsCost) / source.energyGain;
  }
  // item
  const p = source.itemName ? prices.items[source.itemName] : undefined;
  if (p == null) return null;
  return p / source.energyGain;
}

/** Energy sources ranked cheapest-first; unavailable prices sink to the bottom. */
export function rankEnergy(sources: EnergySource[], prices: Prices): EnergyRank[] {
  return sources
    .map((source) => ({ source, dollarsPerEnergy: dollarsPerEnergy(source, prices) }))
    .sort((a, b) => {
      if (a.dollarsPerEnergy == null) return 1;
      if (b.dollarsPerEnergy == null) return -1;
      return a.dollarsPerEnergy - b.dollarsPerEnergy;
    });
}

/** Resulting happy after applying additive then multiplicative boosters. */
export function applyHappyPlan(
  baseHappy: number,
  plan: { booster: HappyBooster; qty: number }[],
): number {
  let add = 0;
  let mult = 1;
  for (const { booster, qty } of plan) {
    if (booster.kind === 'add') add += booster.amount * qty;
    else mult *= Math.pow(booster.amount, qty);
  }
  return (baseHappy + add) * mult;
}

export interface SessionContext {
  statValue: number;
  baseHappy: number;
  modifiers: number;
  energyPerTrain: number;
  dots: number;
  energyBudget: number;
}

export interface BoosterValue {
  booster: HappyBooster;
  qty: number;
  resultingHappy: number;
  /** Extra session gain vs the same session without this booster. */
  marginalGain: number;
  cost: number | null;
  /** Dollars per extra stat point. null if price unknown or no marginal gain. */
  dollarsPerPoint: number | null;
}

/**
 * Marginal value of a happy booster for a session (spec §4.4 / §7): the happy
 * boost benefits every train, so it is valued by the extra total gain it
 * produces, not per happy unit.
 */
export function boosterValue(
  booster: HappyBooster,
  qty: number,
  ctx: SessionContext,
  prices: Prices,
): BoosterValue {
  const base = simulateSession({
    statValue: ctx.statValue,
    happy: ctx.baseHappy,
    modifiers: ctx.modifiers,
    energyPerTrain: ctx.energyPerTrain,
    dots: ctx.dots,
    energyBudget: ctx.energyBudget,
    mode: 'expected',
  });

  const resultingHappy = applyHappyPlan(ctx.baseHappy, [{ booster, qty }]);
  const boosted = simulateSession({
    statValue: ctx.statValue,
    happy: resultingHappy,
    modifiers: ctx.modifiers,
    energyPerTrain: ctx.energyPerTrain,
    dots: ctx.dots,
    energyBudget: ctx.energyBudget,
    mode: 'expected',
  });

  const marginalGain = boosted.totalGain - base.totalGain;
  const unit = prices.items[booster.itemName];
  const cost = unit == null ? null : unit * qty;
  const dollarsPerPoint = cost == null || marginalGain <= 0 ? null : cost / marginalGain;

  return { booster, qty, resultingHappy, marginalGain, cost, dollarsPerPoint };
}
