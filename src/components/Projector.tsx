import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { bestUsableGymIdForStat, GymGate } from '../engine/gym-eligibility';
import { project, DailyPlan, GymForStat, Goal } from '../engine/projector';
import { Prices } from '../engine/cost-model';
import { SessionConfig } from '../session-config';
import { fmtInt, fmtMoney } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
  config: SessionConfig;
  prices: Prices | null;
}

const HAPPY_CAP = 99_999;
const COLORS = { casual: '#8c95a4', hardcore: '#d99a4e', whale: '#5ec0a8' };

function edvdToCap(baseHappy: number, ecstasy: boolean): number {
  const need = HAPPY_CAP / (ecstasy ? 2 : 1) - baseHappy;
  return Math.max(0, Math.ceil(need / 2500));
}

export function Projector({ gyms, player, modifiers, config, prices, gate }: Props) {
  const [goalType, setGoalType] = useState<'total' | StatKey>('total');
  const [horizon, setHorizon] = useState<number>(180);
  const [alloc, setAlloc] = useState<'focus' | 'balanced'>('balanced');

  const currentTotal = STAT_KEYS.reduce((s, k) => s + player.stats[k], 0);
  const currentValue = goalType === 'total' ? currentTotal : player.stats[goalType];
  const [target, setTarget] = useState<number>(Math.round(currentTotal * 1.5));

  // Best usable gym per stat (respects specialist unlock requirements).
  const gymForStat = useMemo<Record<StatKey, GymForStat>>(() => {
    const out = {} as Record<StatKey, GymForStat>;
    for (const s of STAT_KEYS) {
      const id = bestUsableGymIdForStat(gyms, s, player.stats, player.xanaxEcstasyTaken, gate);
      const g = gyms.find((x) => x.id === id);
      out[s] = g ? { energyPerTrain: g.energyPerTrain, dots: g.dots[s] } : { energyPerTrain: 10, dots: 0 };
    }
    return out;
  }, [gyms, player, gate]);

  const allocation = useMemo<Record<StatKey, number>>(() => {
    if (alloc === 'focus') {
      return STAT_KEYS.reduce(
        (o, s) => ({ ...o, [s]: s === config.stat ? 1 : 0 }),
        {} as Record<StatKey, number>,
      );
    }
    return STAT_KEYS.reduce((o, s) => ({ ...o, [s]: 0.25 }), {} as Record<StatKey, number>);
  }, [alloc, config.stat]);

  const unitPrices = useMemo(
    () => ({
      xanax: prices?.items['Xanax'] ?? null,
      edvd: prices?.items['Erotic DVD'] ?? null,
      ecstasy: prices?.items['Ecstasy'] ?? null,
      refill: prices?.pointPrice != null ? prices.pointPrice * 25 : null,
    }),
    [prices],
  );

  const baseHappy = player.happy.maximum;
  const goal: Goal = { type: goalType, target };

  const scenarios = useMemo(() => {
    const plans: Record<'casual' | 'hardcore' | 'whale', DailyPlan> = {
      casual: { naturalEnergy: 480, useRefill: true, xanax: 0, edvd: 0, ecstasy: false },
      hardcore: { naturalEnergy: 480, useRefill: true, xanax: 3, edvd: edvdToCap(baseHappy, true), ecstasy: true },
      whale: { naturalEnergy: 480, useRefill: true, xanax: 4, edvd: edvdToCap(baseHappy, true), ecstasy: true },
    };
    return (Object.keys(plans) as (keyof typeof plans)[]).map((key) => ({
      key,
      result: project({
        stats: player.stats,
        baseHappy,
        happyCap: HAPPY_CAP,
        modifiers,
        gymForStat,
        allocation,
        plan: plans[key],
        prices: unitPrices,
        horizonDays: horizon,
        goal,
      }),
    }));
  }, [player.stats, baseHappy, modifiers, gymForStat, allocation, unitPrices, horizon, goalType, target]);

  const chartData = useMemo(() => {
    const len = scenarios[0]?.result.series.length ?? 0;
    const rows: Record<string, number>[] = [];
    for (let d = 0; d < len; d++) {
      const row: Record<string, number> = { day: d + 1 };
      for (const s of scenarios) row[s.key] = Math.round(s.result.series[d].value);
      rows.push(row);
    }
    return rows;
  }, [scenarios]);

  const fmtAxis = (n: number) =>
    n >= 1e9 ? `${(n / 1e9).toFixed(1)}b` : n >= 1e6 ? `${(n / 1e6).toFixed(0)}m` : `${(n / 1e3).toFixed(0)}k`;

  return (
    <section className="panel">
      <h2>Multi-day projector</h2>
      <div className="sim-grid">
        <div>
          <label htmlFor="pj-goal">Goal metric</label>
          <select id="pj-goal" value={goalType} onChange={(e) => setGoalType(e.target.value as 'total' | StatKey)}>
            <option value="total">Total stats</option>
            {STAT_KEYS.map((s) => (
              <option key={s} value={s}>
                {STAT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="pj-target">Target ({fmtInt(currentValue)} now)</label>
          <input
            id="pj-target"
            type="number"
            min="0"
            value={target}
            onChange={(e) => setTarget(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div>
          <label htmlFor="pj-alloc">Allocation</label>
          <select id="pj-alloc" value={alloc} onChange={(e) => setAlloc(e.target.value as 'focus' | 'balanced')}>
            <option value="balanced">Balanced (25% each)</option>
            <option value="focus">Focus {STAT_LABEL[config.stat]}</option>
          </select>
        </div>
        <div>
          <label htmlFor="pj-horizon">Horizon (days)</label>
          <input
            id="pj-horizon"
            type="number"
            min="1"
            max="730"
            value={horizon}
            onChange={(e) => setHorizon(Math.min(730, Math.max(1, Number(e.target.value) || 1)))}
          />
        </div>
      </div>

      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
            <CartesianGrid stroke="#2e3543" strokeDasharray="2 4" />
            <XAxis dataKey="day" stroke="#8c95a4" tick={{ fontSize: 11 }} />
            <YAxis stroke="#8c95a4" tick={{ fontSize: 11 }} tickFormatter={fmtAxis} width={44} />
            <Tooltip
              contentStyle={{ background: '#1b1f27', border: '1px solid #2e3543', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: '#8c95a4' }}
              formatter={(v: number) => fmtInt(v)}
              labelFormatter={(d) => `Day ${d}`}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="casual" stroke={COLORS.casual} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="hardcore" stroke={COLORS.hardcore} dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="whale" stroke={COLORS.whale} dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Energy / day</th>
              <th>Days to goal</th>
              <th>Cost at goal</th>
              <th>$ / day</th>
              <th>Final ({horizon}d)</th>
            </tr>
          </thead>
          <tbody>
            {scenarios.map((s) => (
              <tr key={s.key}>
                <td className="gym-name" style={{ color: COLORS[s.key] }}>
                  {s.key[0].toUpperCase() + s.key.slice(1)}
                </td>
                <td>{fmtInt(s.result.dailyEnergy)}</td>
                <td>{s.result.daysToGoal ?? `>${horizon}`}</td>
                <td>{fmtMoney(s.result.spendAtGoal)}</td>
                <td>{fmtMoney(s.result.dailySpend)}</td>
                <td>{fmtInt(s.result.finalValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        Each day is one session per allocated stat at a happy jump to{' '}
        {fmtInt(Math.min(HAPPY_CAP, (baseHappy + edvdToCap(baseHappy, true) * 2500) * 2))} (cap 99,999),
        with stats carried over so growth compounds. Casual = natural + refill; Hardcore = +3 Xanax +
        jump; Whale = +4 Xanax + jump. Happy regenerates to your max ({fmtInt(baseHappy)}) each day.
        Best gym per stat is auto-selected by gain-per-energy. Costs use live prices; cans and drug
        cooldown limits are not modelled.
      </p>
    </section>
  );
}
