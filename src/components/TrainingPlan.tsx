import { useMemo } from 'react';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { gainPerTrain } from '../engine/vladar';
import {
  bestUsableGymIdForStat,
  evaluateGymEligibility,
  isUsable,
} from '../engine/gym-eligibility';
import { rankEnergy, Prices } from '../engine/cost-model';
import { ENERGY_SOURCES } from '../data/consumables';
import { fmtGain, fmtInt, fmtMoney } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  prices: Prices | null;
}

const HAPPY_CAP = 99_999;

function secondHighest(stats: Record<StatKey, number>): number {
  return STAT_KEYS.map((s) => stats[s]).sort((a, b) => b - a)[1];
}

export function TrainingPlan({ gyms, player, modifiers, prices }: Props) {
  const baseHappy = player.happy.maximum;
  const edvdForCap = Math.max(0, Math.ceil((HAPPY_CAP / 2 - baseHappy) / 2500));

  const cheapestEnergy = useMemo(() => {
    if (!prices) return null;
    return rankEnergy(ENERGY_SOURCES, prices).find(
      (r) => r.dollarsPerEnergy != null && r.dollarsPerEnergy > 0,
    );
  }, [prices]);

  const plans = useMemo(() => {
    return STAT_KEYS.map((stat) => {
      const usableId = bestUsableGymIdForStat(gyms, stat, player.stats, player.xanaxEcstasyTaken);
      const gym = gyms.find((g) => g.id === usableId);
      const dots = gym ? gym.dots[stat] : 0;
      const perTrain = gym
        ? gainPerTrain({
            modifiers: modifiers[stat],
            dots,
            energyPerTrain: gym.energyPerTrain,
            happy: HAPPY_CAP,
            statValue: player.stats[stat],
          })
        : 0;

      // Best locked gym that would beat the usable one (an upgrade target).
      let upgrade: { gym: Gym; requirement?: string; target?: number; gap?: number } | null = null;
      for (const g of gyms) {
        if (g.dots[stat] <= dots) continue;
        const el = evaluateGymEligibility(g, player.stats, player.xanaxEcstasyTaken);
        if (isUsable(el.status)) continue;
        if (!upgrade || g.dots[stat] > upgrade.gym.dots[stat]) {
          // Numeric target for 50E single-stat specialists.
          let target: number | undefined;
          let gap: number | undefined;
          if (g.energyPerTrain === 50) {
            target = Math.ceil(1.25 * secondHighest(player.stats));
            gap = Math.max(0, target - player.stats[stat]);
          }
          upgrade = { gym: g, requirement: el.requirement, target, gap };
        }
      }

      return { stat, gym, dots, perTrain, upgrade };
    });
  }, [gyms, player, modifiers]);

  return (
    <section className="panel">
      <h2>Optimal training plan</h2>
      <div className="plan-grid">
        {plans.map((p) => (
          <div className="plan-card" key={p.stat}>
            <div className="plan-head">
              <span className="plan-stat">{STAT_LABEL[p.stat]}</span>
              <span className="plan-now">{fmtInt(player.stats[p.stat])}</span>
            </div>

            {p.gym ? (
              <>
                <div className="plan-row">
                  <span className="plan-k">Gym</span>
                  <span className="plan-v">
                    {p.gym.name || 'Fight Club'} · {p.dots.toFixed(1)} dots · {p.gym.energyPerTrain}E
                  </span>
                </div>
                <div className="plan-row">
                  <span className="plan-k">Happy</span>
                  <span className="plan-v">
                    jump to 99,999 (≈ {edvdForCap} Erotic DVD + Ecstasy)
                  </span>
                </div>
                <div className="plan-row">
                  <span className="plan-k">Energy</span>
                  <span className="plan-v">
                    {cheapestEnergy
                      ? `${cheapestEnergy.source.name} (${fmtMoney(cheapestEnergy.dollarsPerEnergy)}/E)`
                      : 'cheapest available'}
                  </span>
                </div>
                <div className="plan-gain">
                  ≈ +{fmtGain(p.perTrain)} <span className="plan-gain-lbl">per train at cap</span>
                </div>
                {p.upgrade && (
                  <div className="plan-upgrade">
                    Next upgrade: <strong>{p.upgrade.gym.name || 'Fight Club'}</strong> (
                    {p.upgrade.gym.dots[p.stat].toFixed(1)} dots) —{' '}
                    {p.upgrade.target != null
                      ? p.upgrade.gap === 0
                        ? 'requirement met, join it'
                        : `need ${STAT_LABEL[p.stat]} ≥ ${fmtInt(p.upgrade.target)} (gap ${fmtInt(
                            p.upgrade.gap ?? 0,
                          )})`
                      : p.upgrade.requirement}
                  </div>
                )}
              </>
            ) : (
              <div className="plan-row">No gym trains this stat.</div>
            )}
          </div>
        ))}
      </div>
      <p className="footnote">
        For each stat: the best gym you can use right now, the happy jump to the 99,999 cap, the
        cheapest energy, and the resulting per-train gain (at your stats, capped happy and your M).
        "Next upgrade" is the better gym you don't qualify for yet and what it takes.
      </p>
    </section>
  );
}
