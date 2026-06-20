import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { buildRoadmap } from '../engine/build-roadmap';
import { GymGate, bestUsableGymIdForStat } from '../engine/gym-eligibility';
import { planToTarget } from '../engine/planner';
import { dailyEnergyCapacity } from '../engine/energy-capacity';
import { ENERGY_SOURCES } from '../data/consumables';
import { fmtInt } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
}

const badgeText: Record<string, string> = {
  baseline: 'baseline',
  unlocked: '✓ unlocked',
  next: '→ next',
  locked: 'locked',
};

export function BuildRoadmap({ gyms, player, modifiers, gate }: Props) {
  const stats = player.stats;
  const defaultPrimary = useMemo(
    () => STAT_KEYS.reduce((a, b) => (stats[b] > stats[a] ? b : a), STAT_KEYS[0]),
    [stats],
  );
  const [primary, setPrimary] = useState<StatKey>(defaultPrimary);

  const roadmap = useMemo(
    () => buildRoadmap(gyms, stats, primary, player.xanaxEcstasyTaken, gate),
    [gyms, stats, primary, player.xanaxEcstasyTaken, gate],
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

  const eta = useMemo(() => {
    const ns = roadmap.nextStage;
    if (!ns || ns.trainStat == null || ns.targetValue == null) return null;
    const ts = ns.trainStat;
    const gymId = bestUsableGymIdForStat(gyms, ts, stats, player.xanaxEcstasyTaken, gate);
    const g = gyms.find((x) => x.id === gymId);
    if (!g || g.dots[ts] <= 0) return null;
    const plan = planToTarget({
      statValue: stats[ts],
      target: ns.targetValue,
      happy: player.happy.maximum,
      modifiers: modifiers[ts] ?? 1,
      dots: g.dots[ts],
      energyPerTrain: g.energyPerTrain,
    });
    const days = dailyCap > 0 ? plan.energy / dailyCap : null;
    return { plan, days, gymName: g.name };
  }, [roadmap, gyms, stats, modifiers, player, gate, dailyCap]);

  const ladder = roadmap.stages.filter((s) => !s.parallel);
  const ssl = roadmap.stages.find((s) => s.parallel);
  const baselineDots = ladder.find((s) => s.status === 'baseline')?.dots ?? 7.3;

  return (
    <section className="panel">
      <h2>Build roadmap</h2>

      <div className="roadmap-archetypes">
        {STAT_KEYS.map((s) => (
          <button
            key={s}
            className={s === primary ? 'active' : ''}
            onClick={() => setPrimary(s)}
          >
            {STAT_LABEL[s]} build
          </button>
        ))}
      </div>

      <p className="roadmap-desc">
        {roadmap.isOffensive ? 'Offensive' : 'Defensive'} build: push{' '}
        <strong>{STAT_LABEL[primary]}</strong> (with {STAT_LABEL[roadmap.pair]} as your pair) and
        leave <strong>{roadmap.dumped.map((d) => STAT_LABEL[d]).join(' & ')}</strong> behind to keep
        the ratio. {STAT_LABEL[primary]} is currently{' '}
        <strong>{roadmap.primaryRatio === Infinity ? '∞' : roadmap.primaryRatio.toFixed(2)}×</strong>{' '}
        your highest other stat — <strong>1.25×</strong> unlocks the single-stat gym.
      </p>

      <ol className="roadmap-ladder">
        {ladder.map((s) => (
          <li key={s.gymId} className={`stage stage-${s.status}`}>
            <span className="stage-dots">{s.dots.toFixed(1)}</span>
            <div className="stage-main">
              <div className="stage-head">
                <span className="stage-name">{s.gymName}</span>
                <span className={`stage-badge badge-${s.status}`}>{badgeText[s.status]}</span>
              </div>
              {s.status === 'next' && s.trainStat != null && s.targetValue != null && (
                <div className="stage-action">
                  Train {STAT_LABEL[s.trainStat]} to <strong>{fmtInt(s.targetValue)}</strong> (+
                  {fmtInt(s.gap ?? 0)}) to unlock — a {baselineDots.toFixed(1)}→{s.dots.toFixed(1)}{' '}
                  dot upgrade (+{(((s.dots - baselineDots) / baselineDots) * 100).toFixed(1)}% per
                  train).
                  {eta && (
                    <>
                      {' '}
                      ≈{fmtInt(eta.plan.energy)} energy
                      {eta.days != null && <> · ~{Math.ceil(eta.days)} days</>} training at{' '}
                      {eta.gymName}.
                    </>
                  )}
                </div>
              )}
              {s.status === 'locked' && (
                <div className="stage-req">{s.requirement || 'Locked'}</div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {ssl && (
        <p className="roadmap-ssl">
          <strong>Parallel option — {ssl.gymName} (9.0 dots):</strong>{' '}
          {ssl.status === 'unlocked'
            ? 'available now (drug-light). The highest dots you can train, no ratio needed.'
            : `${ssl.requirement || 'requires ≤150 Xanax + Ecstasy total'} — a one-way door, so it's only for accounts that stayed drug-light.`}
        </p>
      )}

      <p className="footnote">
        Specialist gyms unlock by stat ratio: single-stat (8.0 dots) needs that stat ≥1.25× your
        second-highest; the paired gym (7.5) needs its pair ≥1.25× the other pair. ETAs use your max
        happy and current best gym, so they're approximate — and slightly conservative, since the dot
        upgrades speed you up along the way.
      </p>
    </section>
  );
}
