import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { planToTarget, resolveUnlockTarget } from '../engine/planner';
import {
  bestUsableGymIdForStat,
  evaluateGymEligibility,
  GymGate,
} from '../engine/gym-eligibility';
import { rankEnergy, Prices } from '../engine/cost-model';
import { dailyEnergyCapacity } from '../engine/energy-capacity';
import { ENERGY_SOURCES } from '../data/consumables';
import { fmtInt, fmtMoney } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  prices: Prices | null;
  gate: GymGate;
}

const HAPPY_CAP = 99_999;

export function Planner({ gyms, player, modifiers, prices, gate }: Props) {
  const [mode, setMode] = useState<'gym' | 'stat'>('gym');
  const [book, setBook] = useState(false);
  const [energyPerDay, setEnergyPerDay] = useState(() => {
    const xan = ENERGY_SOURCES.find((s) => s.id === 'xanax');
    if (!xan?.cooldownMinutes) return 1000;
    return dailyEnergyCapacity({
      maxEnergy: player.energy.maximum,
      drugEnergyPerDose: xan.energyGain,
      drugCooldownMinutes: xan.cooldownMinutes,
    }).total;
  });
  const [targetStat, setTargetStat] = useState<StatKey>('dexterity');
  const [targetValue, setTargetValue] = useState<number>(
    Math.round(player.stats.dexterity * 1.1),
  );

  // Locked, stat-trainable specialists (exclude SSL / invite).
  const lockedGyms = useMemo(() => {
    return gyms
      .map((g) => ({ g, t: resolveUnlockTarget(g, player.stats) }))
      .filter(({ g, t }) => {
        if (!t) return false;
        const el = evaluateGymEligibility(g, player.stats, player.xanaxEcstasyTaken, gate);
        return el.status === 'locked' && t.target > player.stats[t.stat];
      });
  }, [gyms, player, gate]);

  const [gymId, setGymId] = useState<string>('');
  const effectiveGymId = gymId || lockedGyms[0]?.g.id || '';

  const cheapestEnergy = useMemo(() => {
    if (!prices) return null;
    return rankEnergy(ENERGY_SOURCES, prices).find(
      (r) => r.dollarsPerEnergy != null && r.dollarsPerEnergy > 0,
    );
  }, [prices]);

  const resolved = useMemo(() => {
    if (mode === 'gym') {
      const entry = lockedGyms.find((x) => x.g.id === effectiveGymId);
      if (!entry || !entry.t) return null;
      return { stat: entry.t.stat, target: entry.t.target, gymName: entry.g.name };
    }
    return { stat: targetStat, target: targetValue, gymName: null as string | null };
  }, [mode, effectiveGymId, lockedGyms, targetStat, targetValue]);

  const result = useMemo(() => {
    if (!resolved) return null;
    const { stat, target } = resolved;
    const trainGymId = bestUsableGymIdForStat(
      gyms,
      stat,
      player.stats,
      player.xanaxEcstasyTaken,
      gate,
    );
    const trainGym = gyms.find((g) => g.id === trainGymId);
    if (!trainGym) return null;
    const happy = book ? HAPPY_CAP : player.happy.maximum;
    const plan = planToTarget({
      statValue: player.stats[stat],
      target,
      happy,
      modifiers: modifiers[stat],
      dots: trainGym.dots[stat],
      energyPerTrain: trainGym.energyPerTrain,
    });
    const cost =
      cheapestEnergy && cheapestEnergy.dollarsPerEnergy != null
        ? plan.energy * cheapestEnergy.dollarsPerEnergy
        : null;
    const days = energyPerDay > 0 ? plan.energy / energyPerDay : null;
    return { stat, target, trainGym, plan, cost, days };
  }, [resolved, gyms, player, modifiers, gate, book, cheapestEnergy, energyPerDay]);

  return (
    <section className="panel">
      <h2>Unlock planner</h2>

      <div className="plan-controls">
        <label className="plan-select">
          Goal
          <select value={mode} onChange={(e) => setMode(e.target.value as 'gym' | 'stat')}>
            <option value="gym">Unlock a gym</option>
            <option value="stat">Reach a stat value</option>
          </select>
        </label>

        {mode === 'gym' ? (
          lockedGyms.length > 0 ? (
            <label className="plan-select">
              Gym
              <select value={effectiveGymId} onChange={(e) => setGymId(e.target.value)}>
                {lockedGyms.map(({ g, t }) => (
                  <option key={g.id} value={g.id}>
                    {g.name || `Gym ${g.id}`} — train {STAT_LABEL[t!.stat]} to {fmtInt(t!.target)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="planner-none">No stat-locked specialists — all reachable ones are open.</span>
          )
        ) : (
          <>
            <label className="plan-select">
              Stat
              <select
                value={targetStat}
                onChange={(e) => setTargetStat(e.target.value as StatKey)}
              >
                {STAT_KEYS.map((s) => (
                  <option key={s} value={s}>
                    {STAT_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="plan-select">
              Target value
              <input
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          </>
        )}

        <label className="plan-select">
          Energy / day
          <input
            type="number"
            value={energyPerDay}
            onChange={(e) => setEnergyPerDay(Math.max(1, Number(e.target.value) || 1))}
          />
        </label>

        <label className="rule">
          <input type="checkbox" checked={book} onChange={(e) => setBook(e.target.checked)} />
          99k happy (book)
        </label>
      </div>

      {result ? (
        result.plan.gap === 0 ? (
          <p className="planner-met">Target already met — this is unlocked / reached.</p>
        ) : (
          <>
            <p className="planner-line">
              Train <strong>{STAT_LABEL[result.stat]}</strong> at{' '}
              <strong>{result.trainGym.name || 'Fight Club'}</strong> (
              {result.trainGym.dots[result.stat].toFixed(1)} dots, {result.trainGym.energyPerTrain}E)
              from {fmtInt(player.stats[result.stat])} to {fmtInt(result.target)}
              {book ? ' at 99,999 happy' : ` at ~${fmtInt(player.happy.maximum)} happy`}.
            </p>
            <div className="planner-tiles">
              <div className="ptile">
                <span className="ptile-k">Gap</span>
                <span className="ptile-v">{fmtInt(result.plan.gap)}</span>
              </div>
              <div className="ptile">
                <span className="ptile-k">Trains</span>
                <span className="ptile-v">
                  {result.plan.reachable ? fmtInt(result.plan.trains) : `${fmtInt(result.plan.trains)}+`}
                </span>
              </div>
              <div className="ptile">
                <span className="ptile-k">Energy</span>
                <span className="ptile-v">{fmtInt(result.plan.energy)}</span>
              </div>
              <div className="ptile">
                <span className="ptile-k">Cost (energy)</span>
                <span className="ptile-v">{result.cost != null ? fmtMoney(result.cost) : '—'}</span>
              </div>
              <div className="ptile">
                <span className="ptile-k">Days</span>
                <span className="ptile-v">
                  {result.days != null ? result.days.toFixed(1) : '—'}
                </span>
              </div>
            </div>
            {!result.plan.reachable && (
              <p className="footnote">Beyond the planning horizon — the gap is larger than a single push models well.</p>
            )}
          </>
        )
      ) : (
        <p className="planner-none">Pick a goal to plan.</p>
      )}

      <p className="footnote">
        Trains compound (each train grows the stat, so gain rises). Cost prices the energy at your
        cheapest source ({cheapestEnergy ? cheapestEnergy.source.name : 'n/a'}); booster cost for a
        99k jump isn’t included here — see the Budget optimizer. Days assume the energy/day you set.
      </p>
    </section>
  );
}
