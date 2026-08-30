// In-game overlay for torn.com/gym.php.
//
// Distribution, not features. Torn players do not leave the game to consult a
// calculator — the tools that get adopted in this niche are the ones that show
// up inside the page they are already looking at. This injects one compact
// panel above the gym: the best stat to train right now, the gain per train at
// the player's current happy, and what a full energy bar is worth.
//
// It reuses the same engine as the web app (src/engine/*), so there is exactly
// one implementation of the maths. It never clicks anything — reading and
// computing only, per Torn's scripting rules.

import { Gym, StatKey, STAT_KEYS, STAT_LABEL } from '../../src/engine/types';
import { gainPerTrain } from '../../src/engine/vladar';
import { simulateSession } from '../../src/engine/session';
import { normalizeGyms, normalizePlayer } from '../../src/api/normalize';
import { evaluateGymEligibility } from '../../src/engine/gym-eligibility';
import {
  BUILD_PRESETS,
  evaluateBuildRatio,
  nearestGymTarget,
} from '../../src/engine/build-ratio';

const PANEL_ID = 'tto-panel';
const SITE = 'https://torntraining.com';
const BUILD_KEY = 'buildPreset';
const COLLAPSED_KEY = 'panelCollapsed';

const C = {
  accent: '#d99a4e',
  muted: '#98a1b0',
  best: '#5ec0a8',
  danger: '#e07d72',
  line: '#2e3543',
};

const fmt = (n: number) =>
  n >= 100 ? Math.round(n).toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 });

async function call<T>(path: string, key: string): Promise<T> {
  const res = await fetch(`https://api.torn.com${path}&key=${encodeURIComponent(key)}&comment=TrainingOptimizer`);
  const data = await res.json();
  if (data.error) throw new Error(`${data.error.code}: ${data.error.error}`);
  return data as T;
}

function render(html: string) {
  let el = document.getElementById(PANEL_ID);
  if (!el) {
    el = document.createElement('div');
    el.id = PANEL_ID;
    el.style.cssText = [
      'background:#1b1f27',
      `border:1px solid ${C.line}`,
      `border-left:3px solid ${C.accent}`,
      'border-radius:8px',
      'padding:10px 14px',
      'margin:0 0 12px',
      'color:#e8e4d9',
      'font:13px/1.55 Inter,system-ui,sans-serif',
    ].join(';');
    const anchor = document.querySelector('.content-wrapper, #mainContainer, body');
    anchor?.insertBefore(el, anchor.firstChild);
  }
  el.innerHTML = html;
}

/**
 * Wraps the panel body in a header that can be collapsed, and remembers the
 * choice. A competing gym script drew the complaint that it shoves the page
 * down every time you open the gym for a quick train; a panel you can fold
 * away once and forget is the difference between useful and annoying.
 */
async function renderPanel(body: string) {
  const { [COLLAPSED_KEY]: collapsed } = await chrome.storage.local.get(COLLAPSED_KEY);
  render(
    `<div id="tto-head" style="display:flex;align-items:center;gap:8px;cursor:pointer">
       <b style="color:${C.accent};flex:1">Torn Training Optimizer</b>
       <span style="color:${C.muted};font-size:12px">${collapsed ? 'show' : 'hide'}</span>
     </div>
     <div id="tto-body" style="margin-top:${collapsed ? 0 : 8}px;display:${collapsed ? 'none' : 'block'}">${body}</div>`,
  );
  document.getElementById('tto-head')?.addEventListener('click', async () => {
    await chrome.storage.local.set({ [COLLAPSED_KEY]: !collapsed });
    void renderPanel(body);
  });
}

/**
 * Build-ratio tracker.
 *
 * Shows the stat split against the chosen build, and — the part the existing
 * ratio scripts stop short of — the concrete stat gap to the next specialist
 * gym, computed from the same eligibility rules the site uses.
 */
async function ratioSection(
  stats: Record<StatKey, number>,
  gyms: Gym[],
  xanaxEcstasy?: number | null,
): Promise<string> {
  const { [BUILD_KEY]: savedId } = await chrome.storage.local.get(BUILD_KEY);
  const preset = BUILD_PRESETS.find((p) => p.id === savedId) ?? BUILD_PRESETS[0];
  const r = evaluateBuildRatio(stats, preset.weights);

  const cell = (row: (typeof r.rows)[number]) => {
    const colour =
      row.status === 'behind' ? C.danger : row.status === 'on-track' ? C.best : C.muted;
    const gap =
      row.pointsBehind != null
        ? `<span style="color:${C.muted}"> · +${fmt(row.pointsBehind)} to target</span>`
        : '';
    return (
      `<div style="display:flex;gap:6px;align-items:baseline">` +
      `<span style="width:64px;color:${C.muted}">${STAT_LABEL[row.stat]}</span>` +
      `<span style="font-family:'JetBrains Mono',monospace;color:${colour};width:52px">` +
      `${(row.share * 100).toFixed(1)}%</span>` +
      `<span style="color:${C.muted};width:52px">/ ${(row.targetShare * 100).toFixed(1)}%</span>` +
      gap +
      `</div>`
    );
  };

  const options = BUILD_PRESETS.map(
    (p) => `<option value="${p.id}"${p.id === preset.id ? ' selected' : ''}>${p.label}</option>`,
  ).join('');

  const target = nearestGymTarget(gyms, stats, xanaxEcstasy, {
    georgesUnlocked: true,
  });
  const targetLine = target
    ? `<div style="margin-top:6px;color:${C.accent}">` +
      `+${fmt(target.pointsNeeded)} ${STAT_LABEL[target.stat]} unlocks ${target.gym.name} ` +
      `<span style="color:${C.muted}">(${target.requirement})</span></div>`
    : '';

  setTimeout(() => {
    document.getElementById('tto-build')?.addEventListener('change', async (ev) => {
      await chrome.storage.local.set({
        [BUILD_KEY]: (ev.target as HTMLSelectElement).value,
      });
      void main();
    });
  }, 0);

  return (
    `<div style="margin-top:10px;padding-top:8px;border-top:1px solid ${C.line}">` +
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">` +
    `<b style="color:${C.accent}">Build ratio</b>` +
    `<select id="tto-build" style="background:#14161b;color:#e8e4d9;border:1px solid ${C.line};` +
    `border-radius:4px;padding:2px 6px;font:12px Inter,system-ui,sans-serif">${options}</select>` +
    `<span style="color:${r.onTrack ? C.best : C.danger};font-size:12px">` +
    `${r.onTrack ? 'on track' : `train ${STAT_LABEL[r.trainNext!]}`}</span></div>` +
    r.rows.map(cell).join('') +
    targetLine +
    `<div style="margin-top:6px;color:${C.muted};font-size:12px">${preset.note}</div>` +
    `<a href="${SITE}/" target="_blank" rel="noopener" style="color:${C.accent};font-size:12px">` +
    `full plan →</a></div>`
  );
}

async function main() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) {
    void renderPanel('Add your API key in the extension popup to see live gym recommendations.');
    return;
  }

  try {
    const [rawUser, rawGyms] = await Promise.all([
      call<any>('/user/?selections=battlestats,bars,personalstats,perks,gym', apiKey),
      call<{ gyms: Record<string, any> }>('/torn/?selections=gyms', apiKey),
    ]);

    const player = normalizePlayer(rawUser);
    const gyms: Gym[] = normalizeGyms(rawGyms.gyms);
    const modifiers = player.detectedModifiers ?? ({ strength: 1, defense: 1, speed: 1, dexterity: 1 } as Record<StatKey, number>);

    // The overlay runs on gym.php and on jailview.php. In jail, Crims is the
    // only gym that works — and it is unusable anywhere else — so the page we
    // are on is itself the signal, which is more reliable than the API status
    // for a player who was just jailed seconds ago.
    const inJail = /jailview\.php/.test(location.pathname) || player.inJail === true;

    const usable = gyms.filter((g) => {
      const s = evaluateGymEligibility(g, player.stats, player.xanaxEcstasyTaken, {
        inJail,
      }).status;
      return s === 'accessible' || s === 'eligible';
    });

    // Best (stat, gym) pair by gain per energy at the player's current happy.
    let best: { stat: StatKey; gym: Gym; perTrain: number } | null = null;
    for (const stat of STAT_KEYS) {
      for (const gym of usable) {
        if (gym.dots[stat] <= 0) continue;
        const perTrain = gainPerTrain({
          modifiers: modifiers[stat],
          dots: gym.dots[stat],
          energyPerTrain: gym.energyPerTrain,
          happy: player.happy.current,
          statValue: player.stats[stat],
        });
        const perEnergy = perTrain / gym.energyPerTrain;
        if (!best || perEnergy > best.perTrain / best.gym.energyPerTrain) best = { stat, gym, perTrain };
      }
    }

    if (!best) {
      void renderPanel('No usable gym found for your stats.');
      return;
    }

    const bar = simulateSession({
      statValue: player.stats[best.stat],
      happy: player.happy.current,
      modifiers: modifiers[best.stat],
      energyPerTrain: best.gym.energyPerTrain,
      dots: best.gym.dots[best.stat],
      energyBudget: player.energy.current,
      mode: 'expected',
    });

    const advice =
      (inJail ? `<span style="color:${C.muted}">In jail — Crims Gym only.</span><br />` : '') +
      `<b>Best train now</b> — ${STAT_LABEL[best.stat]} in ${best.gym.name} ` +
      `(${best.gym.dots[best.stat].toFixed(1)} dots, ${best.gym.energyPerTrain}E) ` +
      `<span style="color:${C.muted}">at ${fmt(player.happy.current)} happy</span><br />` +
      `<span style="font-family:'JetBrains Mono',monospace">+${fmt(best.perTrain)}</span> per train · ` +
      `<span style="font-family:'JetBrains Mono',monospace">+${fmt(bar.totalGain)}</span> for your ` +
      `${fmt(player.energy.current)}E bar (${bar.trains} trains)`;

    void renderPanel(advice + (await ratioSection(player.stats, gyms, player.xanaxEcstasyTaken)));
  } catch (e) {
    void renderPanel(
      `Could not read the API (${
        e instanceof Error ? e.message : 'unknown error'
      }). Check the key in the extension popup.`,
    );
  }
}

void main();
