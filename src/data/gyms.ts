import { Gym } from '../engine/types';
import rows from './gyms.json';

// Full Torn gym list with verified dots, energy and unlock cost (Torn wiki,
// "Standard Gyms Overview" + "Specialist Gyms & Requirements", read 2026).
// Used for the no-API "manual mode" — gym dots are fixed game data, not
// player-specific, so they can be bundled. Dots are the real values (the API
// stores them x10). "-" in the wiki (can't train a stat) is 0 here.
//
// The numbers live in gyms.json, not in this file, because scripts/gen-seo.mjs
// needs the same table to build the static pages and JSON is the one format
// both a bundler and a plain node script can read. One table, two readers, no
// parser.
//
// Standard gyms are ordered by progression and keep ids 1..24 (George's = 24,
// the top standard gym), so the gym-EXP gate and "highest unlocked" selector
// work the same as with API data. Specialists follow with higher ids (25..32),
// and Crims Gym is last and flagged jailOnly: free, automatic, and genuinely
// the best Defense in the early game, but outside the gym-EXP progression — so
// it is reference data everywhere and never a recommendation.

export const STATIC_GYMS: Gym[] = rows.map((r) => ({
  ...r,
  id: String(r.id),
  unlockStage: null,
}));
