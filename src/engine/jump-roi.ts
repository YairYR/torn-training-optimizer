import { Prices } from './cost-model';
import { simulateSession } from './session';
import { naturalEnergyPerDay } from './energy-capacity';

// Happy jump vs no jump, en dólares. Mismo marco que /happy-jump#when-to-stop:
// durante el stack (~36 h) o haces el jump, o entrenas esa energía a happy normal.
//   jump:     4 Xanax apilados (1,000 E) + refill, a happy boosteado
//   no jump:  los mismos 4 Xanax + refill + la regen natural de esas horas, a happy normal
// Los dos pagan Xanax y refill; el jump suma eDVDs y Ecstasy.

export const STACK_HOURS = 36;
const XANAX_PER_STACK = 4;
const REFILL_ENERGY = 150;
const REFILL_POINTS = 25;
export const HAPPY_CAP = 99_999;

export interface JumpRoiInput {
  statValue: number;
  baseHappy: number;
  maxEnergy: number;
  modifiers: number;
  dots: number;
  energyPerTrain: number;
  edvds: number;
  /** 5,000 por eDVD con trabajo en Adult Novelties de 10★; 2,500 si no. */
  edvdHappy: number;
}

export interface Scenario {
  energy: number;
  happy: number;
  gain: number;
  /** null si falta algún precio. */
  cost: number | null;
  perStat: number | null;
}

export interface JumpRoi {
  jump: Scenario;
  noJump: Scenario;
  /** Ganancia extra del jump; negativa = conviene no saltar. */
  extraGain: number;
  /** Dólares por cada stat extra que compra el jump. null si no hay extra o falta precio. */
  extraPerStat: number | null;
}

export function jumpRoi(i: JumpRoiInput, prices: Prices): JumpRoi {
  const p = (name: string) => prices.items[name];
  const xanaxCost = p('Xanax') == null ? null : p('Xanax') * XANAX_PER_STACK;
  const refillCost = prices.pointPrice == null ? null : prices.pointPrice * REFILL_POINTS;
  const base = xanaxCost == null || refillCost == null ? null : xanaxCost + refillCost;
  const boosters =
    p('Erotic DVD') == null || p('Ecstasy') == null ? null : p('Erotic DVD') * i.edvds + p('Ecstasy');

  const run = (energy: number, happy: number, cost: number | null): Scenario => {
    const { totalGain: gain } = simulateSession({
      statValue: i.statValue,
      happy,
      modifiers: i.modifiers,
      energyPerTrain: i.energyPerTrain,
      dots: i.dots,
      energyBudget: energy,
      mode: 'expected',
    });
    return { energy, happy, gain, cost, perStat: cost == null || gain <= 0 ? null : cost / gain };
  };

  const stacked = XANAX_PER_STACK * 250 + REFILL_ENERGY;
  const jumpHappy = Math.min(HAPPY_CAP, (i.baseHappy + i.edvds * i.edvdHappy) * 2);
  const regen = Math.round((naturalEnergyPerDay(i.maxEnergy) * STACK_HOURS) / 24);

  const jump = run(stacked, jumpHappy, base == null || boosters == null ? null : base + boosters);
  const noJump = run(stacked + regen, i.baseHappy, base);
  const extraGain = jump.gain - noJump.gain;
  const extraPerStat =
    jump.cost == null || noJump.cost == null || extraGain <= 0 ? null : (jump.cost - noJump.cost) / extraGain;

  return { jump, noJump, extraGain, extraPerStat };
}
