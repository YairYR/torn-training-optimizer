import { useMemo } from 'react';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { GymGate, bestUsableGymIdForStat } from '../engine/gym-eligibility';
import { gainPerTrain } from '../engine/vladar';
import { buildRoadmap } from '../engine/build-roadmap';
import { planToTarget } from '../engine/planner';
import { dailyEnergyCapacity } from '../engine/energy-capacity';
import { ENERGY_SOURCES } from '../data/consumables';
import { fmtInt, fmtGain } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
}

/**
 * Lead-with-the-answer hero. Anchors on the player's primary (highest) stat —
 * their de-facto build — and distils the single best move: which stat, which
 * gym, the per-day gain, and the next gym to unlock. Everything below is detail.
 */
export function SummaryCard({ gyms, player, modifiers, gate }: Props) {
  const stats = player.stats;

  const primary = useMemo(
    () => STAT_KEYS.reduce((a, b) => (stats[b] > stats[a] ? b : a), STAT_KEYS[0]),
    [stats],
  );

  const dailyCap = useMemo(() => {
    const xan = ENERGY_SOURCES.find((s) => s.id === 'xanax');
    if (!xan?.cooldownMinutes) return 0;
    return dailyEnergyCapacity({
      maxEnergy: player.energy.maximum,
      drugEnergyPerDose: xan.energyGain,
      drugCooldownMinutes: xan.cooldownMinutes,
    }).total;
  }, [player.energy.maximum]);

  const rec = useMemo(() => {
    const gymId = bestUsableGymIdForStat(gyms, primary, stats, player.xanaxEcstasyTaken, gate);
    const gym = gyms.find((g) => g.id === gymId);
    if (!gym || gym.dots[primary] <= 0) return null;
    const perTrain = gainPerTrain({
      modifiers: modifiers[primary] ?? 1,
      dots: gym.dots[primary],
      energyPerTrain: gym.energyPerTrain,
      happy: player.happy.maximum,
      statValue: stats[primary],
    });
    const trainsPerDay = dailyCap > 0 ? dailyCap / gym.energyPerTrain : 0;
    const perDay = perTrain * trainsPerDay;
    return { gym, perTrain, perDay, trainsPerDay };
  }, [gyms, primary, stats, modifiers, player, gate, dailyCap]);

  const roadmap = useMemo(
    () => buildRoadmap(gyms, stats, primary, player.xanaxEcstasyTaken, gate),
    [gyms, stats, primary, player.xanaxEcstasyTaken, gate],
  );

  const next = useMemo(() => {
    const ns = roadmap.nextStage;
    if (!ns || ns.trainStat == null || ns.targetValue == null) return null;
    const ts = ns.trainStat;
    const gymId = bestUsableGymIdForStat(gyms, ts, stats, player.xanaxEcstasyTaken, gate);
    const g = gyms.find((x) => x.id === gymId);
    if (!g || g.dots[ts] <= 0) return { stage: ns, days: null as number | null };
    const plan = planToTarget({
      statValue: stats[ts],
      target: ns.targetValue,
      happy: player.happy.maximum,
      modifiers: modifiers[ts] ?? 1,
      dots: g.dots[ts],
      energyPerTrain: g.energyPerTrain,
    });
    const days = dailyCap > 0 ? plan.energy / dailyCap : null;
    return { stage: ns, days };
  }, [roadmap, gyms, stats, modifiers, player, gate, dailyCap]);

  if (!rec) return null;

  const buildKind = roadmap.isOffensive ? 'offensive' : 'defensive';

  return (
    <section className="panel summary-hero">
      <div className="summary-flag">▸ Your best move right now</div>

      <h2 className="summary-headline">
        Train <span className="summary-stat">{STAT_LABEL[primary]}</span> at{' '}
        <span className="summary-gym">{rec.gym.name || 'Fight Club'}</span>
      </h2>

      <div className="summary-figure">
        <span className="summary-figure-num">≈{fmtGain(rec.perDay)}</span>
        <span className="summary-figure-unit">{STAT_LABEL[primary]} / day</span>
      </div>

      <div className="summary-chips">
        <span className="summary-chip">
          <b>{rec.gym.dots[primary].toFixed(1)}</b> dots
        </span>
        <span className="summary-chip">
          <b>{rec.gym.energyPerTrain}</b> E / train
        </span>
        <span className="summary-chip">
          ≈<b>{fmtGain(rec.perTrain)}</b> / train
        </span>
        <span className="summary-chip">
          ≈<b>{fmtInt(Math.round(dailyCap))}</b> E / day
        </span>
        <span className="summary-chip summary-chip-muted">{buildKind} build</span>
      </div>

      <p className="summary-next">
        {next ? (
          <>
            <span className="summary-next-label">Next unlock</span>{' '}
            <b>{next.stage.gymName}</b> — {next.stage.requirement}
            {next.days != null && next.days > 0 && (
              <> · ≈{Math.ceil(next.days)} day{Math.ceil(next.days) === 1 ? '' : 's'} away</>
            )}
          </>
        ) : (
          <>
            <span className="summary-next-label">All set</span> You're already at your best gym for{' '}
            {STAT_LABEL[primary]} — just keep training.
          </>
        )}
      </p>

      <p className="summary-foot">
        Based on your highest stat ({STAT_LABEL[primary]}). Estimates assume max happy and a
        cooldown-limited day of Xanax energy; figures are approximate.
      </p>
    </section>
  );
}
