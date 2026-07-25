import { StatKey, STAT_KEYS } from './types';

// Computes the gym-gain modifier M per stat from the API perk strings.
//
// Perks COMPOUND: M = Π(1 + perkᵢ), not 1 + Σperkᵢ. This is explicit in the
// community reference (Vladar, "Training Formula V2.0"): the formula ends in
// `(1+PERK%A) * (1+PERK%B) * (Etc)`, and the thread spells out that +2%, +15%
// and +1% together give +19.65%, not +18%. The difference is small per train
// but compounds across a multi-day projection, and it is exactly the kind of
// detail an end-game player will check.
//
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
  perStat: Record<StatKey, number>; // M = Π(1 + %/100)
  contributions: ModifierContribution[];
}

export function parseGymGainModifiers(perksBySource: Record<string, string[] | undefined>): ModifierResult {
  // Running product per stat, one factor per matched perk.
  const products: Record<StatKey, number> = { strength: 1, defense: 1, speed: 1, dexterity: 1 };
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

      const factor = 1 + percent / 100;
      if (stat === 'all') {
        for (const s of STAT_KEYS) products[s] *= factor;
      } else {
        products[stat] *= factor;
      }
      contributions.push({ source, stat, percent, text: text.trim() });
    }
  }

  const perStat = {} as Record<StatKey, number>;
  for (const s of STAT_KEYS) perStat[s] = products[s];
  return { perStat, contributions };
}

export function flatModifiers(value = 1): Record<StatKey, number> {
  return { strength: value, defense: value, speed: value, dexterity: value };
}
