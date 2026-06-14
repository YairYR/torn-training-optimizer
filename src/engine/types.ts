// Domain types — single source of truth for the engine.
// No UI dependencies here (spec §3.3): reusable by web app, extension, bot.

import type { ModifierContribution } from './modifiers';

export type StatKey = 'strength' | 'defense' | 'speed' | 'dexterity';

export const STAT_KEYS: readonly StatKey[] = ['strength', 'defense', 'speed', 'dexterity'];

export const STAT_LABEL: Record<StatKey, string> = {
  strength: 'Strength',
  defense: 'Defense',
  speed: 'Speed',
  dexterity: 'Dexterity',
};

export interface Bar {
  current: number;
  maximum: number;
}

export interface PlayerState {
  stats: Record<StatKey, number>; // current value of each battle stat
  happy: Bar;
  energy: Bar;
  /** Total Xanax + Ecstasy taken (for SSL eligibility). null if unavailable. */
  xanaxEcstasyTaken?: number | null;
  /** Gym-gain modifier M per stat, parsed from perks. */
  detectedModifiers?: Record<StatKey, number>;
  modifierContributions?: ModifierContribution[];
  /** Active gym id from the API (a sensible default for the unlocked cap). */
  activeGymId?: number | null;
}

export interface Gym {
  id: string;
  name: string;
  /** Energy consumed per train (5 / 10 / 25 / 50). */
  energyPerTrain: number;
  /** Real dots per stat = API value / 10 (spec §11, validated vs wiki). */
  dots: Record<StatKey, number>;
  /** Raw unlock stage / requirement from API (informational). */
  unlockStage: number | null;
  /** Money cost to join (informational). */
  joinCost: number | null;
}
