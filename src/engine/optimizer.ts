import { EnergySource, HappyBooster } from '../data/consumables';
import { Prices, primaryDrugSource } from './cost-model';
import { simulateSession } from './session';

export interface OptimizerInput {
  budget: number;
  // session
  statValue: number;
  baseHappy: number; // happy before the jump
  modifiers: number;
  energyPerTrain: number;
  dots: number;
  // energy
  freeEnergy: number; // natural energy available (free)
  maxStackEnergy: number; // cap on paid (drug/can) energy per session — default 1000
  maxHappy: number; // in-game happy cap — confirmed 99999
  prices: Prices;
  energySources: EnergySource[];
  happyBoosters: HappyBooster[];
  maxEdvd?: number; // grid bound — default 40
}

export interface BuyLine {
  label: string;
  qty: number;
  cost: number;
  energy?: number;
}

export interface OptimizerResult {
  buyList: BuyLine[];
  totalCost: number;
  totalEnergy: number;
  sessionHappy: number;
  totalGain: number;
  dollarsPerPoint: number | null;
  edvdQty: number;
  ecstasy: boolean;
  refillUsed: boolean;
  paidSource: string | null;
  paidUnits: number;
  happyCapped: boolean;
}

/**
 * Max stat gain for a budget (spec §7). Grids the stacked happy jump
 * (j × Erotic DVD additive, then optional Ecstasy ×2); for each candidate it
 * greedily buys the cheapest energy with the remaining budget. Gain is
 * monotonic in energy for realistic stats, so spending the remaining budget on
 * energy is optimal; the grid trades budget between the jump and energy.
 */
export function optimizeBudget(i: OptimizerInput): OptimizerResult {
  const maxEdvd = i.maxEdvd ?? 40;
  const edvd = i.happyBoosters.find((b) => b.id === 'edvd');
  const ecstasyB = i.happyBoosters.find((b) => b.id === 'ecstasy');
  const edvdPrice = edvd ? i.prices.items[edvd.itemName] ?? null : null;
  const ecstasyPrice = ecstasyB ? i.prices.items[ecstasyB.itemName] ?? null : null;
  const edvdAmount = edvd?.amount ?? 2500;
  const ecstasyMult = ecstasyB?.amount ?? 2;

  // Practical drug energy: per shared cooldown slot you take the biggest drug
  // (Xanax 250 > LSD 50), not the cheapest $/E — which would pick LSD and ignore
  // the ~3 doses/day cooldown cap.
  const primary = primaryDrugSource(i.energySources, i.prices);
  const paid = primary
    ? { s: primary.source, dpe: primary.dollarsPerEnergy }
    : null;

  const refill = i.energySources.find((s) => s.priceKind === 'points');
  const refillCost =
    refill && i.prices.pointPrice != null && refill.pointsCost
      ? i.prices.pointPrice * refill.pointsCost
      : null;

  let best: OptimizerResult | null = null;

  const ecstasyOptions = ecstasyPrice != null ? [false, true] : [false];
  const maxJ = edvdPrice != null ? maxEdvd : 0;

  for (const ecstasy of ecstasyOptions) {
    for (let j = 0; j <= maxJ; j++) {
      const jumpCost = (edvdPrice ?? 0) * j + (ecstasy ? ecstasyPrice ?? 0 : 0);
      if (jumpCost > i.budget) break; // j is increasing

      let remaining = i.budget - jumpCost;
      let energy = i.freeEnergy;
      let refillUsed = false;
      if (refill && refillCost != null && refillCost <= remaining) {
        energy += refill.energyGain;
        remaining -= refillCost;
        refillUsed = true;
      }

      let paidUnits = 0;
      let unitE = 0;
      let unitCost = 0;
      if (paid) {
        unitE = paid.s.energyGain;
        unitCost = (paid.dpe as number) * unitE;
        const maxByCap = Math.floor(i.maxStackEnergy / unitE);
        const maxByBudget = unitCost > 0 ? Math.floor(remaining / unitCost) : 0;
        paidUnits = Math.max(0, Math.min(maxByCap, maxByBudget));
        energy += paidUnits * unitE;
      }

      let H = (i.baseHappy + j * edvdAmount) * (ecstasy ? ecstasyMult : 1);
      const happyCapped = H > i.maxHappy;
      if (happyCapped) H = i.maxHappy;

      const sim = simulateSession({
        statValue: i.statValue,
        happy: H,
        modifiers: i.modifiers,
        energyPerTrain: i.energyPerTrain,
        dots: i.dots,
        energyBudget: energy,
        mode: 'expected',
      });

      const totalCost = jumpCost + paidUnits * unitCost + (refillUsed ? refillCost ?? 0 : 0);
      const candidate: OptimizerResult = {
        buyList: [],
        totalCost,
        totalEnergy: energy,
        sessionHappy: H,
        totalGain: sim.totalGain,
        dollarsPerPoint: sim.totalGain > 0 ? totalCost / sim.totalGain : null,
        edvdQty: j,
        ecstasy,
        refillUsed,
        paidSource: paid?.s.name ?? null,
        paidUnits,
        happyCapped,
      };

      if (!best || candidate.totalGain > best.totalGain) best = candidate;
    }
  }

  // Fallback: no prices at all — train free natural only.
  if (!best) {
    const sim = simulateSession({
      statValue: i.statValue,
      happy: i.baseHappy,
      modifiers: i.modifiers,
      energyPerTrain: i.energyPerTrain,
      dots: i.dots,
      energyBudget: i.freeEnergy,
      mode: 'expected',
    });
    best = {
      buyList: [],
      totalCost: 0,
      totalEnergy: i.freeEnergy,
      sessionHappy: i.baseHappy,
      totalGain: sim.totalGain,
      dollarsPerPoint: null,
      edvdQty: 0,
      ecstasy: false,
      refillUsed: false,
      paidSource: null,
      paidUnits: 0,
      happyCapped: false,
    };
  }

  best.buyList = buildBuyList(best, {
    freeEnergy: i.freeEnergy,
    refillEnergy: refill?.energyGain ?? 150,
    refillCost,
    paidUnitE: unitEnergyOf(paid),
    paidUnitCost: unitCostOf(paid),
    edvdPrice,
    ecstasyPrice,
  });

  return best;
}

function unitEnergyOf(paid: { s: EnergySource; dpe: number | null } | null): number {
  return paid ? paid.s.energyGain : 0;
}
function unitCostOf(paid: { s: EnergySource; dpe: number | null } | null): number {
  return paid && paid.dpe != null ? paid.dpe * paid.s.energyGain : 0;
}

function buildBuyList(
  r: OptimizerResult,
  ctx: {
    freeEnergy: number;
    refillEnergy: number;
    refillCost: number | null;
    paidUnitE: number;
    paidUnitCost: number;
    edvdPrice: number | null;
    ecstasyPrice: number | null;
  },
): BuyLine[] {
  const lines: BuyLine[] = [];
  if (ctx.freeEnergy > 0)
    lines.push({ label: 'Natural energy', qty: ctx.freeEnergy, cost: 0, energy: ctx.freeEnergy });
  if (r.refillUsed)
    lines.push({
      label: 'Points refill (25 pts)',
      qty: 1,
      cost: ctx.refillCost ?? 0,
      energy: ctx.refillEnergy,
    });
  if (r.paidUnits > 0 && r.paidSource)
    lines.push({
      label: r.paidSource,
      qty: r.paidUnits,
      cost: r.paidUnits * ctx.paidUnitCost,
      energy: r.paidUnits * ctx.paidUnitE,
    });
  if (r.edvdQty > 0)
    lines.push({ label: 'Erotic DVD', qty: r.edvdQty, cost: r.edvdQty * (ctx.edvdPrice ?? 0) });
  if (r.ecstasy) lines.push({ label: 'Ecstasy', qty: 1, cost: ctx.ecstasyPrice ?? 0 });
  return lines;
}
