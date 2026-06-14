// Domain types — single source of truth for the engine.
// No UI dependencies here (spec §3.3): reusable by web app, extension, bot.

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
