// Type-only: keeps this module free of React so the engine tests can import it.
import type { ManualData } from './components/ManualEntry';

/**
 * The player the site loads for a first-time visitor.
 *
 * The landing page used to open on an empty API-key box, which asks a stranger
 * from a search result to go fetch a credential before seeing anything work.
 * Loading a plausible mid-game player instead means every panel — best gym,
 * per-day gain, unlock targets, projections — is already filled in, and the
 * ask becomes "swap in your own numbers" rather than "prove you're a player".
 *
 * Chosen deliberately: mid-game (past the happy-jump regime, well under the
 * 50M soft cap), a slightly lopsided Strength build so the specialist-gym
 * eligibility logic has something real to say, and a Private Island happy of
 * 4,475 with donator energy. Round-ish numbers so nobody mistakes it for their
 * own data.
 */
export const DEMO: ManualData = {
  stats: { strength: 3_200_000, defense: 2_450_000, speed: 2_100_000, dexterity: 1_800_000 },
  maxHappy: 4475,
  maxEnergy: 150,
  xanaxEcstasy: 220,
  unlockedGymId: 20, // Atlas — leaves George's and the specialists as visible next steps
};
