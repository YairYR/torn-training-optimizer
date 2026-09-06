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
  /**
   * Whether the player is in jail right now. Crims Gym is the only gym usable
   * there, and it is unusable anywhere else, so this flips a real branch of the
   * recommendation rather than being cosmetic. null when unknown.
   */
  inJail?: boolean | null;
}

export interface Gym {
  id: string;
  name: string;
  /**
   * Crims Gym, reachable only from inside jail. It is real, trainable game
   * data — good defence dots for a new player — but it sits outside the
   * gym-EXP progression, so it must never be treated as a standard gym or
   * recommended to a player who is walking free.
   */
  jailOnly?: boolean;
  /** Energy consumed per train (5 / 10 / 25 / 50). */
  energyPerTrain: number;
  /** Real dots per stat = API value / 10 (spec §11, validated vs wiki). */
  dots: Record<StatKey, number>;
  /** Raw unlock stage / requirement from API (informational). */
  unlockStage: number | null;
  /** Money cost to join (informational). */
  joinCost: number | null;
}

/** What one simulated training session is configured with (stat, gym, bars). */
export interface SessionConfig {
  stat: StatKey;
  gymId: string;
  energy: number;
  happy: number;
}

export interface ManualData {
  stats: Record<StatKey, number>;
  maxHappy: number;
  maxEnergy: number;
  xanaxEcstasy: number | null;
  unlockedGymId: number;
  /** Crims Gym is only reachable from inside jail. */
  inJail?: boolean;
}
