import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_LABEL } from '../engine/types';
import { ENERGY_SOURCES, HAPPY_BOOSTERS } from '../data/consumables';
import { Prices, rankEnergy, boosterValue } from '../engine/cost-model';
import { SessionConfig } from '../session-config';
import { fmtInt, fmtMoney, fmtPerPoint, fmtGain } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: number;
  config: SessionConfig;
  prices: Prices | null;
}

export function Economics({ gyms, player, modifiers, config, prices }: Props) {
  const [qty, setQty] = useState<Record<string, number>>(
    Object.fromEntries(HAPPY_BOOSTERS.map((b) => [b.id, b.defaultQty])),
  );

  const gym = useMemo(() => gyms.find((g) => g.id === config.gymId), [gyms, config.gymId]);
  const dots = gym ? gym.dots[config.stat] : 0;
  const statValue = player.stats[config.stat];

  const energyRanked = useMemo(
    () => (prices ? rankEnergy(ENERGY_SOURCES, prices) : []),
    [prices],
  );

  const cheapestPaid = energyRanked.find((r) => r.dollarsPerEnergy != null && r.dollarsPerEnergy > 0);

  const boosterRows = useMemo(() => {
    if (!prices || !gym || dots <= 0) return [];
    const ctx = {
      statValue,
      baseHappy: config.happy,
      modifiers,
      energyPerTrain: gym.energyPerTrain,
      dots,
      energyBudget: config.energy,
    };
    return HAPPY_BOOSTERS.map((b) => boosterValue(b, qty[b.id] ?? b.defaultQty, ctx, prices)).sort(
      (a, b) => {
        if (a.dollarsPerPoint == null) return 1;
        if (b.dollarsPerPoint == null) return -1;
        return a.dollarsPerPoint - b.dollarsPerPoint;
      },
    );
  }, [prices, gym, dots, statValue, config.happy, config.energy, modifiers, qty]);

  if (!prices) {
    return (
      <section className="panel">
        <h2>Economics</h2>
        <p className="footnote">Live prices not loaded yet. Click “Load data”.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Economics</h2>

      <h3 className="subhead">Energy cost ($ per energy)</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Source</th>
              <th>Energy / unit</th>
              <th>$ / energy</th>
            </tr>
          </thead>
          <tbody>
            {energyRanked.map((r, i) => (
              <tr key={r.source.id}>
                <td className="gym-name">{r.source.name}</td>
                <td>{r.source.energyGain === 1 ? '—' : fmtInt(r.source.energyGain)}</td>
                <td
                  className={
                    r.dollarsPerEnergy == null
                      ? 'muted-cell'
                      : i === 0 || (cheapestPaid && r.source.id === cheapestPaid.source.id)
                        ? 'cell-best'
                        : ''
                  }
                >
                  {r.dollarsPerEnergy == null
                    ? 'price n/a'
                    : r.dollarsPerEnergy === 0
                      ? 'free'
                      : fmtMoney(r.dollarsPerEnergy)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cheapestPaid && (
        <p className="footnote">
          Cheapest paid energy: <span className="cell-best" /> {cheapestPaid.source.name} at{' '}
          {fmtMoney(cheapestPaid.dollarsPerEnergy)} / E → your {fmtInt(config.energy)} energy ≈{' '}
          {fmtMoney((cheapestPaid.dollarsPerEnergy ?? 0) * config.energy)}.
        </p>
      )}

      <h3 className="subhead">
        Happy boosters · {STAT_LABEL[config.stat]} in {gym?.name ?? '—'} ({fmtInt(config.energy)} E)
      </h3>
      {dots <= 0 ? (
        <p className="footnote">Selected gym does not train this stat — pick another in the simulator.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Booster</th>
                <th>Qty</th>
                <th>Happy →</th>
                <th>Extra gain</th>
                <th>Cost</th>
                <th>$ / point</th>
              </tr>
            </thead>
            <tbody>
              {boosterRows.map((v, i) => (
                <tr key={v.booster.id}>
                  <td className="gym-name">{v.booster.name}</td>
                  <td>
                    <input
                      type="number"
                      min="0"
                      className="qty-input"
                      value={qty[v.booster.id] ?? v.booster.defaultQty}
                      onChange={(e) =>
                        setQty((q) => ({ ...q, [v.booster.id]: Math.max(0, Number(e.target.value) || 0) }))
                      }
                    />
                  </td>
                  <td>{fmtInt(v.resultingHappy)}</td>
                  <td>+{fmtGain(v.marginalGain)}</td>
                  <td>{fmtMoney(v.cost)}</td>
                  <td className={v.dollarsPerPoint == null ? 'muted-cell' : i === 0 ? 'cell-best' : ''}>
                    {fmtPerPoint(v.dollarsPerPoint)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="footnote">
        Prices are live market value. <code>$ / point</code> is marginal: extra session gain the
        booster produces across all {fmtInt(config.energy)} energy, valued against its cost — lowest
        is best. Quantities are independent here; stacking (additive then Ecstasy ×2) is the full
        happy-jump and will be modelled in the optimizer step.
      </p>
    </section>
  );
}
