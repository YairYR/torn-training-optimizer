import { Gym } from '../engine/types';

// Full Torn gym list with verified dots, energy and unlock cost (Torn wiki,
// "Standard Gyms Overview" + "Specialist Gyms & Requirements", read 2026).
// Used for the no-API "manual mode" — gym dots are fixed game data, not
// player-specific, so they can be bundled. Dots are the real values (the API
// stores them x10). "-" in the wiki (can't train a stat) is 0 here.
// Standard gyms are ordered by progression and keep ids 1..24 (George's = 24,
// the top standard gym), so the gym-EXP gate and "highest unlocked" selector
// work the same as with API data. Specialists follow with higher ids.

const g = (
  id: number,
  name: string,
  energyPerTrain: number,
  joinCost: number,
  s: number,
  sp: number,
  d: number,
  dx: number,
): Gym => ({
  id: String(id),
  name,
  energyPerTrain,
  unlockStage: null,
  joinCost,
  dots: { strength: s, speed: sp, defense: d, dexterity: dx },
});

export const STATIC_GYMS: Gym[] = [
  // Light-weight (5E)
  g(1, 'Premier Fitness', 5, 10, 2.0, 2.0, 2.0, 2.0),
  g(2, 'Average Joes', 5, 100, 2.4, 2.4, 2.8, 2.4),
  g(3, "Woody's Workout", 5, 250, 2.8, 3.2, 3.0, 2.8),
  g(4, 'Beach Bods', 5, 500, 3.2, 3.2, 3.2, 0),
  g(5, 'Silver Gym', 5, 1000, 3.4, 3.6, 3.4, 3.2),
  g(6, 'Pour Femme', 5, 2500, 3.4, 3.6, 3.6, 3.8),
  g(7, 'Davies Den', 5, 5000, 3.7, 0, 3.7, 3.7),
  g(8, 'Global Gym', 5, 10000, 4.0, 4.0, 4.0, 4.0),
  // Middle-weight (10E)
  g(9, 'Knuckle Heads', 10, 50000, 4.8, 4.4, 4.0, 4.2),
  g(10, 'Pioneer Fitness', 10, 100000, 4.4, 4.5, 4.8, 4.4),
  g(11, 'Anabolic Anomalies', 10, 250000, 5.0, 4.5, 5.2, 4.5),
  g(12, 'Core', 10, 500000, 5.0, 5.2, 5.0, 5.0),
  g(13, 'Racing Fitness', 10, 1000000, 5.0, 5.4, 4.8, 5.2),
  g(14, 'Complete Cardio', 10, 2000000, 5.5, 5.8, 5.5, 5.2),
  g(15, 'Legs, Bums and Tums', 10, 3000000, 0, 5.6, 5.6, 5.8),
  g(16, 'Deep Burn', 10, 5000000, 6.0, 6.0, 6.0, 6.0),
  // Heavy-weight (10E)
  g(17, 'Apollo Gym', 10, 7500000, 6.0, 6.2, 6.4, 6.2),
  g(18, 'Gun Shop', 10, 10000000, 6.6, 6.4, 6.2, 6.2),
  g(19, 'Force Training', 10, 15000000, 6.4, 6.6, 6.4, 6.8),
  g(20, "Cha Cha's", 10, 20000000, 6.4, 6.4, 6.8, 7.0),
  g(21, 'Atlas', 10, 30000000, 7.0, 6.4, 6.4, 6.6),
  g(22, 'Last Round', 10, 50000000, 6.8, 6.6, 7.0, 6.6),
  g(23, 'The Edge', 10, 75000000, 6.8, 7.0, 7.0, 6.8),
  g(24, "George's", 10, 100000000, 7.3, 7.3, 7.3, 7.3),
  // Specialists
  g(25, 'Balboas Gym', 25, 50000000, 0, 0, 7.5, 7.5),
  g(26, 'Frontline Fitness', 25, 50000000, 7.5, 7.5, 0, 0),
  g(27, 'Gym 3000', 50, 100000000, 8.0, 0, 0, 0),
  g(28, 'Mr. Isoyamas', 50, 100000000, 0, 0, 8.0, 0),
  g(29, 'Total Rebound', 50, 100000000, 0, 8.0, 0, 0),
  g(30, 'The Elites', 50, 100000000, 0, 0, 0, 8.0),
  g(31, 'The Sports Science Lab', 25, 500000000, 9.0, 9.0, 9.0, 9.0),
  g(32, 'Fight Club', 10, 2147483647, 10.0, 10.0, 10.0, 10.0),
];
