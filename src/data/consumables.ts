// Consumable catalog for the economic layer (spec §7, §11).
//
// Effect values CONFIRMED against the Torn wiki / training guides (not memory):
//   - Xanax: 250 energy. LSD: 50 energy. Energy drinks: 5-30 energy (base).
//   - Points refill: 150 energy for 25 points, once per day.
//   - Ecstasy: doubles current happy (multiplier). Erotic DVD: +2500 happy each.
//   - Happy loss per train: 40-60% of energy (handled in the session engine).
//
// PRICES are NOT stored here — they are fetched live (src/api/market.ts) and
// matched to `itemName`. If a name does not resolve, the UI shows "price n/a"
// rather than guessing (spec §13).

export interface EnergySource {
  id: string;
  name: string;
  /** Energy granted per unit. */
  energyGain: number;
  /** How the unit is priced. */
  priceKind: 'free' | 'points' | 'item';
  /** Exact Torn item name, when priceKind === 'item'. */
  itemName?: string;
  /** Points spent per unit, when priceKind === 'points'. */
  pointsCost?: number;
  /** Optional daily cap (units/day). null = uncapped here. */
  dailyLimit?: number | null;
  note?: string;
}

export interface HappyBooster {
  id: string;
  name: string;
  kind: 'add' | 'mult';
  /** 'add': happy added per unit. 'mult': multiplier applied to current happy. */
  amount: number;
  itemName: string;
  defaultQty: number;
  note?: string;
}

export const ENERGY_SOURCES: EnergySource[] = [
  {
    id: 'natural',
    name: 'Natural energy',
    energyGain: 1,
    priceKind: 'free',
    note: 'Regenerates 5 / 15 min up to your max. Always use first.',
  },
  {
    id: 'refill',
    name: 'Points refill',
    energyGain: 150,
    priceKind: 'points',
    pointsCost: 25,
    dailyLimit: 1,
    note: 'Once per day. Priced from the live points market.',
  },
  { id: 'xanax', name: 'Xanax', energyGain: 250, priceKind: 'item', itemName: 'Xanax' },
  { id: 'lsd', name: 'LSD', energyGain: 50, priceKind: 'item', itemName: 'Lysergic Acid Diethylamide' },
  { id: 'can_munster', name: 'Can of Munster', energyGain: 20, priceKind: 'item', itemName: 'Can of Munster' },
];

export const HAPPY_BOOSTERS: HappyBooster[] = [
  { id: 'edvd', name: 'Erotic DVD', kind: 'add', amount: 2500, itemName: 'Erotic DVD', defaultQty: 5 },
  { id: 'ecstasy', name: 'Ecstasy', kind: 'mult', amount: 2, itemName: 'Ecstasy', defaultQty: 1, note: 'Doubles current happy. Apply after additive boosters.' },
];
