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

const PANEL_ID = 'tto-panel';
const SITE = 'https://torntraining.com';

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
      'border:1px solid #2e3543',
      'border-left:3px solid #d99a4e',
      'border-radius:8px',
      'padding:12px 14px',
      'margin:0 0 12px',
      'color:#e8e4d9',
      'font:13px/1.55 Inter,system-ui,sans-serif',
    ].join(';');
    const anchor = document.querySelector('.content-wrapper, #mainContainer, body');
    anchor?.insertBefore(el, anchor.firstChild);
  }
  el.innerHTML = html;
}

async function main() {
  const { apiKey } = await chrome.storage.local.get('apiKey');
  if (!apiKey) {
    render(
      `<b style="color:#d99a4e">Torn Training Optimizer</b> — add your API key in the extension popup to see live gym recommendations.`,
    );
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

    const usable = gyms.filter((g) => {
      const s = evaluateGymEligibility(g, player.stats, player.xanaxEcstasyTaken).status;
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
      render(`<b style="color:#d99a4e">Torn Training Optimizer</b> — no usable gym found for your stats.`);
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

    render(
      `<b style="color:#d99a4e">Best train right now</b> — ${STAT_LABEL[best.stat]} in ${best.gym.name}
       (${best.gym.dots[best.stat].toFixed(1)} dots, ${best.gym.energyPerTrain}E)
       <span style="color:#8c95a4">at ${fmt(player.happy.current)} happy</span><br />
       <span style="font-family:'JetBrains Mono',monospace">+${fmt(best.perTrain)}</span> per train ·
       <span style="font-family:'JetBrains Mono',monospace">+${fmt(bar.totalGain)}</span> for your
       ${fmt(player.energy.current)}E bar (${bar.trains} trains)
       <a href="${SITE}/" target="_blank" rel="noopener" style="color:#d99a4e;margin-left:8px">full plan →</a>`,
    );
  } catch (e) {
    render(
      `<b style="color:#d99a4e">Torn Training Optimizer</b> — could not read the API (${
        e instanceof Error ? e.message : 'unknown error'
      }). Check the key in the extension popup.`,
    );
  }
}

void main();
