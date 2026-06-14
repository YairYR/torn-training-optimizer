import { Gym, PlayerState, StatKey } from '../engine/types';

/**
 * Maps the raw `torn/gyms` (v1) response to domain Gym objects.
 *
 * Both fields below are CONFIRMED against the live API (spec §11 closed):
 *  - dots scaling: the API stores gains ×10 (e.g. Premier Fitness "strength": 20
 *    means 2.0 dots), so we divide by 10. The `energy` field is the exact energy
 *    cost per train (5/10/25/50) and is NOT scaled.
 *  - `energy` = energy per train; `cost` = money cost to join (informational).
 *
 * Confirmed response shape per gym id:
 *   { "name": "Premier Fitness", "energy": 5, "cost": 20,
 *     "strength": 20, "speed": 20, "defense": 20, "dexterity": 20 }
 */
export function normalizeGyms(raw: Record<string, RawGym>): Gym[] {
  return Object.entries(raw).map(([id, g]) => ({
    id,
    name: g.name,
    energyPerTrain: Number(g.energy),
    dots: {
      strength: toDots(g.strength),
      defense: toDots(g.defense),
      speed: toDots(g.speed),
      dexterity: toDots(g.dexterity),
    },
    unlockStage: g.stage != null ? Number(g.stage) : null,
    joinCost: g.cost != null ? Number(g.cost) : null,
  }));
}

function toDots(v: string | number | undefined): number {
  const n = Number(v);
  return Number.isFinite(n) ? n / 10 : 0;
}

export function normalizePlayer(raw: RawUser): PlayerState {
  const stats: Record<StatKey, number> = {
    strength: Number(raw.strength),
    defense: Number(raw.defense),
    speed: Number(raw.speed),
    dexterity: Number(raw.dexterity),
  };
  return {
    stats,
    happy: { current: Number(raw.happy.current), maximum: Number(raw.happy.maximum) },
    energy: { current: Number(raw.energy.current), maximum: Number(raw.energy.maximum) },
  };
}

// ---- Raw API shapes (loose; exact field names per swagger / live response) ----

export interface RawGym {
  name: string;
  stage?: number;
  cost?: number;
  energy?: number;
  strength?: string | number;
  speed?: string | number;
  defense?: string | number;
  dexterity?: string | number;
}

export interface RawBar {
  current: number;
  maximum: number;
}

export interface RawUser {
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
  happy: RawBar;
  energy: RawBar;
}
