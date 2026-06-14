import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_LABEL } from '../engine/types';
import { ENERGY_SOURCES, HAPPY_BOOSTERS } from '../data/consumables';
import { Prices } from '../engine/cost-model';
import { optimizeBudget } from '../engine/optimizer';
import { SessionConfig } from '../session-config';
import { fmtInt, fmtMoney, fmtPerPoint, fmtGain } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: number;
  config: SessionConfig;
  prices: Prices | null;
}

export function Optimizer({ gyms, player, modifiers, config, prices }: Props) {
  const [budget, setBudget] = useState<number>(10_000_000);
  const [maxStack, setMaxStack] = useState<number>(1000);
  const [maxHappy, setMaxHappy] = useState<number>(99_999);

  const gym = useMemo(() => gyms.find((g) => g.id === config.gymId), [gyms, config.gymId]);
  const dots = gym ? gym.dots[config.stat] : 0;
  const statValue = player.stats[config.stat];

  const result = useMemo(() => {
    if (!prices || !gym || dots <= 0) return null;
    return optimizeBudget({
      budget,
      statValue,
      baseHappy: config.happy,
      modifiers,
      energyPerTrain: gym.energyPerTrain,
      dots,
      freeEnergy: player.energy.current,
      maxStackEnergy: maxStack,
      maxHappy,
      prices,
      energySources: ENERGY_SOURCES,
      happyBoosters: HAPPY_BOOSTERS,
    });
  }, [prices, gym, dots, statValue, config.happy, modifiers, budget, maxStack, maxHappy, player.energy.current]);

  if (!prices) {
    return (
      <section className="panel">
        <h2>Budget optimizer</h2>
        <p className="footnote">Live prices not loaded yet. Click “Load data”.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Budget optimizer</h2>
      <div className="sim-grid">
        <div>
          <label htmlFor="opt-budget">Budget ($)</label>
          <input
            id="opt-budget"
            type="number"
            min="0"
            value={budget}
            onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div>
          <label htmlFor="opt-stack">Max paid energy (stack cap)</label>
          <input
            id="opt-stack"
            type="number"
            min="0"
            value={maxStack}
            onChange={(e) => setMaxStack(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div>
          <label htmlFor="opt-happy">Happy cap</label>
          <input
            id="opt-happy"
            type="number"
            min="0"
            value={maxHappy}
            onChange={(e) => setMaxHappy(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
      </div>

      {dots <= 0 ? (
        <p className="footnote">Selected gym does not train this stat — pick another in the simulator.</p>
      ) : result ? (
        <>
          <div className="readouts">
            <div className="readout hero">
              <div className="k">Best session gain · {STAT_LABEL[config.stat]}</div>
              <div className="readout-value">+{fmtGain(result.totalGain)}</div>
              <p className="note">
                Jump to {fmtInt(result.sessionHappy)} happy
                {result.happyCapped ? ' (capped)' : ''}, train {fmtInt(result.totalEnergy)} energy in{' '}
                {gym?.name}.
              </p>
            </div>
            <div className="readout">
              <div className="k">Total cost</div>
              <div className="readout-value">{fmtMoney(result.totalCost)}</div>
              <div className="band">of {fmtMoney(budget)} budget</div>
            </div>
            <div className="readout">
              <div className="k">Effective $ / point</div>
              <div className="readout-value">{fmtPerPoint(result.dollarsPerPoint)}</div>
            </div>
          </div>

          <h3 className="subhead">Buy list</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Energy</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {result.buyList.map((l) => (
                  <tr key={l.label}>
                    <td className="gym-name">{l.label}</td>
                    <td>{fmtInt(l.qty)}</td>
                    <td>{l.energy ? fmtInt(l.energy) : '—'}</td>
                    <td>{l.cost === 0 ? 'free' : fmtMoney(l.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            Maximises stat gain within budget. The happy jump is additive (Erotic DVD) then Ecstasy
            ×2, amortised over the whole stack; remaining budget goes to the cheapest energy. Stack
            cap and happy cap are assumptions you can adjust — drug cooldown/overdose limits are not
            modelled, so treat the paid-energy quantity as a cost-optimal target, not a one-sitting
            instruction.
          </p>
        </>
      ) : null}
    </section>
  );
}
