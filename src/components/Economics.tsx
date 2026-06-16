import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_LABEL } from '../engine/types';
import { ENERGY_SOURCES, HAPPY_BOOSTERS } from '../data/consumables';
import { Prices, rankEnergy, boosterValue } from '../engine/cost-model';
import { dailyEnergyCapacity, dosesPerDay } from '../engine/energy-capacity';
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

  const capacity = useMemo(() => {
    const xan = ENERGY_SOURCES.find((s) => s.id === 'xanax');
    const lsd = ENERGY_SOURCES.find((s) => s.id === 'lsd');
    if (!xan?.cooldownMinutes) return null;
    const cap = dailyEnergyCapacity({
      maxEnergy: player.energy.maximum,
      drugEnergyPerDose: xan.energyGain,
      drugCooldownMinutes: xan.cooldownMinutes,
    });
    const lsdEnergy = lsd?.cooldownMinutes ? dosesPerDay(lsd.cooldownMinutes) * lsd.energyGain : 0;
    return { cap, lsdEnergy };
  }, [player.energy.maximum]);

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

      {capacity && (
        <>
          <h3 className="subhead">Daily energy capacity (cooldown-limited)</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Per day</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="gym-name">Natural regen</td>
                  <td>{fmtInt(capacity.cap.natural)}</td>
                </tr>
                <tr>
                  <td className="gym-name">Points refill (1/day)</td>
                  <td>{fmtInt(capacity.cap.refill)}</td>
                </tr>
                <tr>
                  <td className="gym-name">Xanax ({capacity.cap.drugDoses} doses × 250)</td>
                  <td className="cell-best">{fmtInt(capacity.cap.drugEnergy)}</td>
                </tr>
                <tr>
                  <td className="gym-name">— same slots with LSD ({capacity.cap.drugDoses} × 50)</td>
                  <td className="muted-cell">{fmtInt(capacity.lsdEnergy)}</td>
                </tr>
                <tr>
                  <td className="gym-name">
                    <strong>Total (Xanax path)</strong>
                  </td>
                  <td className="cell-best">
                    <strong>{fmtInt(capacity.cap.total)}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="footnote">
            Drugs share <strong>one</strong> cooldown (~6-8h), so you get ~{capacity.cap.drugDoses}{' '}
            doses/day total — you pick one drug per slot, not both. Per slot Xanax gives 250 E vs
            LSD's 50, i.e. 5× the energy. So even if LSD looks cheaper per-$ above, the cooldown caps
            daily drug energy at {fmtInt(capacity.lsdEnergy)} (LSD) vs {fmtInt(capacity.cap.drugEnergy)}{' '}
            (Xanax) — which the $/energy ranking alone doesn't show. Natural assumes you train often
            enough not to waste regen.
          </p>
        </>
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
