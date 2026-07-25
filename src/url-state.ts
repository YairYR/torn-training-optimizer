// Shareable state in the query string.
//
// Two jobs, one module:
//  1. Distribution. Torn players trade advice in forum threads and Discord. A
//     result you cannot paste as a link does not travel, so every panel's input
//     lives in the URL and "Copy link" reproduces the exact readout.
//  2. Landing pages. The generated SEO pages (see scripts/gen-seo.mjs) link
//     into the calculator with a stat and gym pre-selected, so a visitor from
//     search lands on a filled-in tool instead of an empty form.
//
// Nothing sensitive goes in the URL: stats and gym choices only, never the API
// key.

import { SessionConfig } from './session-config';
import { StatKey, STAT_KEYS } from './engine/types';
import { ManualData } from './components/ManualEntry';

const STAT_PARAM: Record<StatKey, string> = {
  strength: 'str',
  defense: 'def',
  speed: 'spd',
  dexterity: 'dex',
};

export interface SharedState {
  manual?: ManualData;
  config?: Partial<SessionConfig>;
  modifiers?: Record<StatKey, number>;
}

const num = (p: URLSearchParams, k: string): number | null => {
  const raw = p.get(k);
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** Read shared state from the current URL. Returns null when there is none. */
export function readSharedState(search = window.location.search): SharedState | null {
  const p = new URLSearchParams(search);
  if (![...p.keys()].length) return null;

  const stats = {} as Record<StatKey, number>;
  let anyStat = false;
  for (const s of STAT_KEYS) {
    const v = num(p, STAT_PARAM[s]);
    stats[s] = v != null && v > 0 ? v : 0;
    if (stats[s] > 0) anyStat = true;
  }

  const mods = {} as Record<StatKey, number>;
  let anyMod = false;
  for (const s of STAT_KEYS) {
    const v = num(p, `m_${STAT_PARAM[s]}`);
    mods[s] = v != null && v > 0 ? v : 1;
    if (v != null) anyMod = true;
  }

  const statParam = p.get('stat');
  const stat = STAT_KEYS.find((s) => s === statParam);
  const gym = p.get('gym');
  const energy = num(p, 'e');
  const happy = num(p, 'h');

  const config: Partial<SessionConfig> = {};
  if (stat) config.stat = stat;
  if (gym) config.gymId = gym;
  if (energy != null) config.energy = energy;
  if (happy != null) config.happy = happy;

  const state: SharedState = {};
  if (Object.keys(config).length) state.config = config;
  if (anyMod) state.modifiers = mods;
  if (anyStat) {
    state.manual = {
      stats,
      maxHappy: num(p, 'mh') ?? 5025,
      maxEnergy: num(p, 'me') ?? 150,
      xanaxEcstasy: num(p, 'xe'),
      unlockedGymId: num(p, 'cap') ?? 24,
    };
  }
  return Object.keys(state).length ? state : null;
}

/** Absolute, pasteable URL that reproduces the current view. */
export function buildShareUrl(state: SharedState, origin = window.location.origin): string {
  const p = new URLSearchParams();
  const m = state.manual;
  if (m) {
    for (const s of STAT_KEYS) if (m.stats[s] > 0) p.set(STAT_PARAM[s], String(Math.round(m.stats[s])));
    p.set('mh', String(Math.round(m.maxHappy)));
    p.set('me', String(Math.round(m.maxEnergy)));
    if (m.xanaxEcstasy != null) p.set('xe', String(Math.round(m.xanaxEcstasy)));
    p.set('cap', String(m.unlockedGymId));
  }
  const c = state.config;
  if (c?.stat) p.set('stat', c.stat);
  if (c?.gymId) p.set('gym', c.gymId);
  if (c?.energy != null) p.set('e', String(Math.round(c.energy)));
  if (c?.happy != null) p.set('h', String(Math.round(c.happy)));
  if (state.modifiers) {
    for (const s of STAT_KEYS) {
      const v = state.modifiers[s];
      if (v !== 1) p.set(`m_${STAT_PARAM[s]}`, v.toFixed(4).replace(/0+$/, '').replace(/\.$/, ''));
    }
  }
  return `${origin}/?${p.toString()}`;
}

/** Keep the address bar in sync without adding history entries. */
export function syncUrl(state: SharedState): void {
  const url = buildShareUrl(state, window.location.origin);
  window.history.replaceState(null, '', url.slice(window.location.origin.length));
}
