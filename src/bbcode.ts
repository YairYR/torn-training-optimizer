// BBCode export.
//
// Torn's forums and most faction Discords accept BBCode. Players already paste
// their training numbers into build threads by hand; giving them a formatted
// block with the source link turns that habit into distribution — every post is
// a citation of the tool, and the reader gets a link that reproduces the exact
// numbers (see url-state.ts).

import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from './engine/types';
import { GymGate, bestUsableGymIdForStat } from './engine/gym-eligibility';
import { gainPerTrain } from './engine/vladar';
import { trainingRegime } from './engine/training-method';
import { fmtGain, fmtInt } from './format';

interface Input {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
  energyPerDay: number;
  shareUrl: string;
}

export function buildBbcode({
  gyms,
  player,
  modifiers,
  gate,
  energyPerDay,
  shareUrl,
}: Input): string {
  const happy = player.happy.maximum;
  const rows: string[] = [];

  for (const stat of STAT_KEYS) {
    const value = player.stats[stat];
    const gymId = bestUsableGymIdForStat(gyms, stat, player.stats, player.xanaxEcstasyTaken, gate);
    const gym = gyms.find((g) => g.id === gymId);
    if (!gym || gym.dots[stat] <= 0) {
      rows.push(`[*][b]${STAT_LABEL[stat]}[/b] ${fmtInt(value)} — no usable gym`);
      continue;
    }
    const perTrain = gainPerTrain({
      modifiers: modifiers[stat],
      dots: gym.dots[stat],
      energyPerTrain: gym.energyPerTrain,
      happy,
      statValue: value,
    });
    const perDay = (perTrain / gym.energyPerTrain) * energyPerDay;
    rows.push(
      `[*][b]${STAT_LABEL[stat]}[/b] ${fmtInt(value)} — ${gym.name} ` +
        `(${gym.dots[stat].toFixed(1)} dots, ${gym.energyPerTrain}E) · ` +
        `+${fmtGain(perTrain)}/train · +${fmtGain(perDay)}/day · ` +
        `${trainingRegime(value).label}`,
    );
  }

  return [
    '[b]Torn training plan[/b]',
    `Happy ${fmtInt(happy)} · ${fmtInt(energyPerDay)} energy/day`,
    '[list]',
    ...rows,
    '[/list]',
    `[url=${shareUrl}]Run these numbers for your own stats[/url]`,
  ].join('\n');
}
