// Daily energy capacity. Drug energy is gated by a single shared drug cooldown
// (you can only have one drug active), so the per-unit $/energy ranking alone
// is misleading: with ~6-8h cooldowns you get ~3 doses/day, and each Xanax
// (250E) gives 5x an LSD (50E) per slot. This module makes the cap explicit.

export function naturalEnergyPerDay(maxEnergy: number): number {
  // Donator (max 150): 5 / 10 min. Else (max 100): 5 / 15 min. (wiki)
  const perMin = maxEnergy >= 150 ? 5 / 10 : 5 / 15;
  return Math.round(perMin * 60 * 24);
}

export function dosesPerDay(cooldownMinutes: number): number {
  if (cooldownMinutes <= 0) return 0;
  return Math.floor((24 * 60) / cooldownMinutes);
}

export interface CapacityInput {
  maxEnergy: number;
  drugEnergyPerDose: number;
  drugCooldownMinutes: number;
  refillEnergy?: number;
  refillsPerDay?: number;
}

export interface CapacityResult {
  natural: number;
  drugDoses: number;
  drugEnergy: number;
  refill: number;
  total: number;
}

export function dailyEnergyCapacity(i: CapacityInput): CapacityResult {
  const natural = naturalEnergyPerDay(i.maxEnergy);
  const drugDoses = dosesPerDay(i.drugCooldownMinutes);
  const drugEnergy = drugDoses * i.drugEnergyPerDose;
  const refill = (i.refillEnergy ?? 150) * (i.refillsPerDay ?? 1);
  return { natural, drugDoses, drugEnergy, refill, total: natural + drugEnergy + refill };
}
