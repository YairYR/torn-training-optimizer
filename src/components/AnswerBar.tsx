import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { GymGate, bestUsableGymIdForStat } from '../engine/gym-eligibility';
import { gainPerTrain } from '../engine/vladar';
import { fmtInt } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
  energyPerDay: number;
}

export function AnswerBar({ gyms, player, modifiers, gate, energyPerDay }: Props) {
  const primary = STAT_KEYS.reduce((a, b) =>
    player.stats[a] >= player.stats[b] ? a : b,
  );
  const gymId = bestUsableGymIdForStat(
    gyms,
    primary,
    player.stats,
    player.xanaxEcstasyTaken,
    gate,
  );
  const gym = gyms.find((g) => g.id === gymId);
  if (!gym || gym.dots[primary] <= 0) return null;

  const perTrain = gainPerTrain({
    modifiers: modifiers[primary] ?? 1,
    dots: gym.dots[primary],
    energyPerTrain: gym.energyPerTrain,
    happy: player.happy.maximum,
    statValue: player.stats[primary],
  });
  const perDay = (perTrain / gym.energyPerTrain) * energyPerDay;

  return (
    <div className="answerbar">
      <span className="answerbar-what">
        {STAT_LABEL[primary]} · {gym.name}
      </span>
      <span className="answerbar-figure">{fmtInt(perDay)}</span>
      <span className="k">per day</span>
    </div>
  );
}
