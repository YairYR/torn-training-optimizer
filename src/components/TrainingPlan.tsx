import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { gainPerTrain } from '../engine/vladar';
import {
  bestUsableGymIdForStat,
  evaluateGymEligibility,
  isUsable,
  ratioReachable,
  EligibilityStatus,
  GymGate,
} from '../engine/gym-eligibility';
import { trainingRegime, atGrowthCap } from '../engine/training-method';
import { STAT_SOFT_CAP } from '../engine/constants';
import { rankEnergy, primaryDrugSource, Prices } from '../engine/cost-model';
import { ENERGY_SOURCES } from '../data/consumables';
import { fmtGain, fmtInt, fmtMoney } from '../format';
import { Stage } from '../engine/stage';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  prices: Prices | null;
  gate: GymGate;
  standardGyms: Gym[];
  unlockedGymId: number | null;
  onUnlockedGym: (id: number) => void;
  /** Feeds the once-only method rationale, printed from stage.regime above
   *  the four cards — see the render below. */
  stage: Stage;
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
  stage,
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
      let upgrade: {
        gym: Gym;
        status: EligibilityStatus;
        requirement?: string;
        target?: number;
        gap?: number;
      } | null = null;
      for (const g of gyms) {
        if (g.dots[stat] <= dots) continue;
        const el = evaluateGymEligibility(g, player.stats, player.xanaxEcstasyTaken, gate);
        if (isUsable(el.status)) continue;
        // Fight Club (invite-only) and the Sports Science Lab (gated on a
        // lifetime drug count, permanent once exceeded) both out-dot every
        // real specialist, so without this filter one of them wins the
        // election for every stat and names a gym the player can never
        // train into. ratioReachable answers "can training alone ever open
        // this gym" — false for both — leaving the runner-up (a real
        // specialist with a real, trainable requirement) as the advice.
        if (!ratioReachable(g, player.stats, player.xanaxEcstasyTaken, gate)) continue;
        if (!upgrade || g.dots[stat] > upgrade.gym.dots[stat]) {
          let target: number | undefined;
          let gap: number | undefined;
          if (g.energyPerTrain === 50) {
            target = Math.ceil(1.25 * secondHighest(player.stats));
            gap = Math.max(0, target - player.stats[stat]);
          }
          upgrade = { gym: g, status: el.status, requirement: el.requirement, target, gap };
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

  // The rationale goes once per REGIME, not once per card. stage.regime is the
  // highest stat's, and the lower three commonly sit a regime below it — which
  // printed the identical paragraph three times under the shared one. Group the
  // off-regime stats instead, so each distinct rationale appears exactly once
  // and says which stats it is about.
  const sharedRegime = plans.find((p) => p.regime.regime === stage.regime)?.regime ?? plans[0].regime;
  const otherRegimes: { rationale: string; stats: StatKey[] }[] = [];
  for (const p of plans) {
    if (p.regime.regime === stage.regime) continue;
    const hit = otherRegimes.find((o) => o.rationale === p.regime.rationale);
    if (hit) hit.stats.push(p.stat);
    else otherRegimes.push({ rationale: p.regime.rationale, stats: [p.stat] });
  }

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
      <div className="plan-rationale">{sharedRegime.rationale}</div>
      {otherRegimes.map((o) => (
        <div className="plan-rationale" key={o.rationale}>
          <strong>{o.stats.map((s) => STAT_LABEL[s]).join(', ')}:</strong> {o.rationale}
        </div>
      ))}

      <div className="plan-grid">
        {plans.map((p) => (
          <div className="plan-card" key={p.stat}>
            <div className="plan-head">
              <span className="plan-stat">{STAT_LABEL[p.stat]}</span>
              <span className="plan-now">{fmtInt(player.stats[p.stat])}</span>
            </div>

            <div className={`plan-method method-${p.regime.regime}`}>{p.regime.label}</div>

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
                {!book && p.regime.regime !== 'energy-training' && (
                  <div className="plan-ceiling">99k jump ceiling: +{fmtGain(p.gainCap)} / train</div>
                )}
                {p.capped && (
                  <div className="plan-cap-note">
                    Above {fmtInt(STAT_SOFT_CAP)} the stat term compresses logarithmically — Torn
                    removed the hard cap in 2022 and replaced it with decelerating growth. These
                    numbers already model that curve.
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
        as stats grow (you waste 32–35h of regen stacking for a jump). The “per train” figure uses
        your sustainable max happy — the realistic
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
