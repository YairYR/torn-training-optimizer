import { StatKey, STAT_KEYS } from './types';

// Computes the gym-gain modifier M per stat from the API perk strings.
// Gym-gain bonuses are summed (additive) and applied as M = 1 + Σ%, which
// matches how the community and the validated single-train (M≈1.186) behave.
// The parser is heuristic over free-text perks ("...gym gains"); anything it
// misses can be corrected in the editable M fields.

const STAT_WORDS: { word: string; key: StatKey }[] = [
  { word: 'strength', key: 'strength' },
  { word: 'defense', key: 'defense' },
  { word: 'defence', key: 'defense' },
  { word: 'speed', key: 'speed' },
  { word: 'dexterity', key: 'dexterity' },
];

export interface ModifierContribution {
  source: string;
  stat: StatKey | 'all';
  percent: number;
  text: string;
}

export interface ModifierResult {
  perStat: Record<StatKey, number>; // M = 1 + Σ%/100
  contributions: ModifierContribution[];
}

export function parseGymGainModifiers(perksBySource: Record<string, string[] | undefined>): ModifierResult {
  const sums: Record<StatKey, number> = { strength: 0, defense: 0, speed: 0, dexterity: 0 };
  const contributions: ModifierContribution[] = [];

  for (const [source, arr] of Object.entries(perksBySource)) {
    for (const text of arr ?? []) {
      if (!/gym\s+gain/i.test(text)) continue;
      const pct = text.match(/([\d.]+)\s*%/);
      if (!pct) continue;
      const percent = parseFloat(pct[1]);
      if (!Number.isFinite(percent)) continue;

      let stat: StatKey | 'all' = 'all';
      for (const { word, key } of STAT_WORDS) {
        if (new RegExp(`\\b${word}\\b`, 'i').test(text)) {
          stat = key;
          break;
        }
      }

      if (stat === 'all') {
        for (const s of STAT_KEYS) sums[s] += percent;
      } else {
        sums[stat] += percent;
      }
      contributions.push({ source, stat, percent, text: text.trim() });
    }
  }

  const perStat = {} as Record<StatKey, number>;
  for (const s of STAT_KEYS) perStat[s] = 1 + sums[s] / 100;
  return { perStat, contributions };
}

export function flatModifiers(value = 1): Record<StatKey, number> {
  return { strength: value, defense: value, speed: value, dexterity: value };
}
