import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { gainPerTrain } from '../engine/vladar';
import {
  bestUsableGymIdForStat,
  evaluateGymEligibility,
  isUsable,
  GymGate,
} from '../engine/gym-eligibility';
import { trainingRegime, atGrowthCap, STAT_GROWTH_CAP } from '../engine/training-method';
import { rankEnergy, primaryDrugSource, Prices } from '../engine/cost-model';
import { ENERGY_SOURCES } from '../data/consumables';
import { fmtGain, fmtInt, fmtMoney } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  prices: Prices | null;
  gate: GymGate;
  standardGyms: Gym[];
  unlockedGymId: number | null;
  onUnlockedGym: (id: number) => void;
}

const HAPPY_CAP = 99_999;

function secondHighest(stats: Record<StatKey, number>): number {
  return STAT_KEYS.map((s) => stats[s]).sort((a, b) => b - a)[1];
}

export function TrainingPlan({
  gyms,
  player,
  modifiers,
  prices,
  gate,
  standardGyms,
  unlockedGymId,
  onUnlockedGym,
}: Props) {
  const [book, setBook] = useState(false);
  const maxHappy = player.happy.maximum;

  // Practical training energy: the biggest drug per cooldown slot (Xanax), not
  // the cheapest $/E (which can be LSD but is capped to ~3 doses/day).
  const drugEnergy = useMemo(() => {
    if (!prices) return null;
    return primaryDrugSource(ENERGY_SOURCES, prices);
  }, [prices]);
  const cheapestPerE = useMemo(() => {
    if (!prices) return null;
    return rankEnergy(ENERGY_SOURCES, prices).find(
      (r) => r.dollarsPerEnergy != null && r.dollarsPerEnergy > 0,
    );
  }, [prices]);

  const plans = useMemo(() => {
    return STAT_KEYS.map((stat) => {
      const usableId = bestUsableGymIdForStat(
        gyms,
        stat,
        player.stats,
        player.xanaxEcstasyTaken,
        gate,
      );
      const gym = gyms.find((g) => g.id === usableId);
      const dots = gym ? gym.dots[stat] : 0;
      const regime = trainingRegime(player.stats[stat]);
      const capped = atGrowthCap(player.stats[stat]);

      const gainAt = (happy: number) =>
        gym
          ? gainPerTrain({
              modifiers: modifiers[stat],
              dots,
              energyPerTrain: gym.energyPerTrain,
              happy,
              statValue: player.stats[stat],
            })
          : 0;

      const recommendedHappy = book ? HAPPY_CAP : maxHappy;

      // Best locked gym that would beat the usable one (upgrade target).
      let upgrade: { gym: Gym; requirement?: string; target?: number; gap?: number } | null = null;
      for (const g of gyms) {
        if (g.dots[stat] <= dots) continue;
        const el = evaluateGymEligibility(g, player.stats, player.xanaxEcstasyTaken, gate);
        if (isUsable(el.status)) continue;
        if (!upgrade || g.dots[stat] > upgrade.gym.dots[stat]) {
          let target: number | undefined;
          let gap: number | undefined;
          if (g.energyPerTrain === 50) {
            target = Math.ceil(1.25 * secondHighest(player.stats));
            gap = Math.max(0, target - player.stats[stat]);
          }
          upgrade = { gym: g, requirement: el.requirement, target, gap };
        }
      }

      return {
        stat,
        gym,
        dots,
        regime,
        capped,
        recommendedHappy,
        gainRecommended: gainAt(recommendedHappy),
        gainCap: gainAt(HAPPY_CAP),
        upgrade,
      };
    });
  }, [gyms, player, modifiers, book, maxHappy, gate]);

  return (
    <section className="panel">
      <h2>Optimal training plan</h2>
      <div className="plan-controls">
        <label className="plan-select">
          Highest unlocked gym
          <select
            value={unlockedGymId ?? ''}
            onChange={(e) => onUnlockedGym(Number(e.target.value))}
          >
            {standardGyms.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name || `Gym ${g.id}`}
              </option>
            ))}
          </select>
        </label>
        <label className="rule">
          <input type="checkbox" checked={book} onChange={(e) => setBook(e.target.checked)} />
          “Ignorance Is Bliss” book (sustained 99,999 happy)
        </label>
      </div>
      <p className="plan-gate-note">
        Standard gyms unlock by gym EXP (total energy spent training), which the API doesn’t expose —
        set your highest unlocked gym so the plan only recommends gyms you can actually use.
      </p>

      <div className="plan-grid">
        {plans.map((p) => (
          <div className="plan-card" key={p.stat}>
            <div className="plan-head">
              <span className="plan-stat">{STAT_LABEL[p.stat]}</span>
              <span className="plan-now">{fmtInt(player.stats[p.stat])}</span>
            </div>

            <div className={`plan-method method-${p.regime.regime}`}>{p.regime.label}</div>
            <div className="plan-rationale">{p.regime.rationale}</div>

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
                    {book
                      ? 'sustained 99,999 (book)'
                      : `train at your max ~${fmtInt(maxHappy)}${
                          p.regime.regime !== 'energy-training' ? '; jump when affordable' : '; optional 1 Ecstasy ×2'
                        }`}
                  </span>
                </div>
                <div className="plan-row">
                  <span className="plan-k">Energy</span>
                  <span className="plan-v">
                    {drugEnergy
                      ? `${drugEnergy.source.name} (${fmtMoney(drugEnergy.dollarsPerEnergy)}/E) + refill + natural`
                      : 'Xanax + refill + natural'}
                  </span>
                </div>
                <div className="plan-gain">
                  ≈ +{fmtGain(p.gainRecommended)}{' '}
                  <span className="plan-gain-lbl">per train{book ? ' (book)' : ' at max happy'}</span>
                </div>
                {!book && (
                  <div className="plan-ceiling">99k jump ceiling: +{fmtGain(p.gainCap)} / train</div>
                )}
                {p.capped && (
                  <div className="plan-cap-note">
                    ⚠ At {fmtInt(STAT_GROWTH_CAP)}+ the stat-growth term flattens — extra stat no longer
                    compounds (community-reported; verify).
                  </div>
                )}
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
        Method is chosen by stat level: 99k happy jumps win at low stats but lose to energy training
        as stats grow (you waste 32–35h of regen stacking for a jump, and the stat-growth term
        flattens near 50M). The “per train” figure uses your sustainable max happy — the realistic
        daily case — with the 99k ceiling shown for reference. For the budget-optimal buy-list of a
        single session, use the <strong>Budget optimizer</strong> panel.
      </p>
      {drugEnergy && cheapestPerE && cheapestPerE.source.id !== drugEnergy.source.id && (
        <p className="footnote">
          Note: {cheapestPerE.source.name} shows a lower $/E ({fmtMoney(cheapestPerE.dollarsPerEnergy)})
          than {drugEnergy.source.name} ({fmtMoney(drugEnergy.dollarsPerEnergy)}), but{' '}
          {drugEnergy.source.name} is recommended — drugs share one cooldown (~3 doses/day), so per
          slot the bigger drug wins (250 E vs 50). You can’t make up the difference with volume.
        </p>
      )}
    </section>
  );
}
