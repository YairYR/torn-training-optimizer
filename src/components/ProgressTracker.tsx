import { useEffect, useMemo, useState } from 'react';
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
import { Snapshot, buildIntervals, sortSnapshots, predictedGain } from '../engine/progress';
import { bestUsableGymIdForStat, GymGate } from '../engine/gym-eligibility';
import { atGrowthCap } from '../engine/training-method';
import { fmtInt, fmtGain } from '../format';

interface Props {
  player: PlayerState;
  gyms: Gym[];
  modifiers: Record<StatKey, number>;
  gate: GymGate;
}

const STORE = 'tto.snapshots';
const COLORS: Record<StatKey, string> = {
  strength: '#d99a4e',
  defense: '#5ec0a8',
  speed: '#7c9cdf',
  dexterity: '#c77fb5',
};

function loadSnapshots(): Snapshot[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE) ?? '[]');
    if (Array.isArray(raw)) return raw;
  } catch {
    /* ignore */
  }
  return [];
}

export function ProgressTracker({ player, gyms, modifiers, gate }: Props) {
  const [snaps, setSnaps] = useState<Snapshot[]>(loadSnapshots);
  useEffect(() => localStorage.setItem(STORE, JSON.stringify(snaps)), [snaps]);

  const sorted = useMemo(() => sortSnapshots(snaps), [snaps]);
  const intervals = useMemo(() => buildIntervals(snaps), [snaps]);

  const saveSnapshot = () => {
    const snap: Snapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: new Date().toISOString(),
      stats: { ...player.stats },
    };
    setSnaps((s) => [...s, snap]);
  };
  const remove = (id: string) => setSnaps((s) => s.filter((x) => x.id !== id));
  const clearAll = () => setSnaps([]);

  const chartData = useMemo(
    () =>
      sorted.map((s) => ({
        date: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        ...s.stats,
      })),
    [sorted],
  );

  // Validation: actual vs predicted gain for an interval + stat + energy trained.
  const [valStat, setValStat] = useState<StatKey>('dexterity');
  const [valIntervalIdx, setValIntervalIdx] = useState(0);
  const [valEnergy, setValEnergy] = useState(10_000);

  const validation = useMemo(() => {
    const iv = intervals[valIntervalIdx];
    if (!iv) return null;
    const gymId = bestUsableGymIdForStat(
      gyms,
      valStat,
      player.stats,
      player.xanaxEcstasyTaken,
      gate,
    );
    const gym = gyms.find((g) => g.id === gymId);
    if (!gym) return null;
    const actual = iv.perStat[valStat];
    const predicted = predictedGain({
      statValue: iv.from.stats[valStat],
      energy: valEnergy,
      happy: player.happy.maximum,
      modifiers: modifiers[valStat],
      dots: gym.dots[valStat],
      energyPerTrain: gym.energyPerTrain,
    });
    const ratio = predicted > 0 ? actual / predicted : null;
    return { actual, predicted, ratio, gym, capped: atGrowthCap(iv.from.stats[valStat]) };
  }, [intervals, valIntervalIdx, valStat, valEnergy, gyms, player, modifiers, gate]);

  return (
    <section className="panel">
      <h2>Progress tracking</h2>

      <div className="plan-controls">
        <button onClick={saveSnapshot}>Save snapshot (now)</button>
        {snaps.length > 0 && (
          <button className="ghost" onClick={clearAll}>
            Clear all
          </button>
        )}
        <span className="footnote" style={{ margin: 0 }}>
          {snaps.length} snapshot{snaps.length === 1 ? '' : 's'} · stored in this browser only.
        </span>
      </div>

      {sorted.length >= 2 ? (
        <>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="date" stroke="#8c95a4" fontSize={12} />
              <YAxis
                stroke="#8c95a4"
                fontSize={12}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}M`}
              />
              <Tooltip
                contentStyle={{ background: '#14161b', border: '1px solid #2a2e37' }}
                formatter={(v: number) => fmtInt(v)}
              />
              <Legend />
              {STAT_KEYS.map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={STAT_LABEL[s]}
                  stroke={COLORS[s]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  {STAT_KEYS.map((s) => (
                    <th key={s}>{STAT_LABEL[s]}</th>
                  ))}
                  <th>Δ total / day</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => {
                  const iv = i > 0 ? intervals[i - 1] : null;
                  return (
                    <tr key={s.id}>
                      <td className="gym-name">
                        {new Date(s.date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      {STAT_KEYS.map((k) => (
                        <td key={k}>
                          {fmtInt(s.stats[k])}
                          {iv && (
                            <span className="delta-up"> +{fmtInt(iv.perStat[k])}</span>
                          )}
                        </td>
                      ))}
                      <td>
                        {iv
                          ? `+${fmtInt(
                              STAT_KEYS.reduce((a, k) => a + iv.gainPerDay[k], 0),
                            )}`
                          : '—'}
                      </td>
                      <td>
                        <button className="ghost" onClick={() => remove(s.id)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 className="subhead">Validate engine (actual vs predicted)</h3>
          <div className="plan-controls">
            <label className="plan-select">
              Interval
              <select
                value={valIntervalIdx}
                onChange={(e) => setValIntervalIdx(Number(e.target.value))}
              >
                {intervals.map((iv, idx) => (
                  <option key={idx} value={idx}>
                    {new Date(iv.from.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}{' '}
                    →{' '}
                    {new Date(iv.to.date).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </option>
                ))}
              </select>
            </label>
            <label className="plan-select">
              Stat
              <select value={valStat} onChange={(e) => setValStat(e.target.value as StatKey)}>
                {STAT_KEYS.map((s) => (
                  <option key={s} value={s}>
                    {STAT_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className="plan-select">
              Energy trained on it
              <input
                type="number"
                value={valEnergy}
                onChange={(e) => setValEnergy(Math.max(0, Number(e.target.value) || 0))}
              />
            </label>
          </div>

          {validation && (
            <div className="planner-tiles">
              <div className="ptile">
                <span className="ptile-k">Actual gain</span>
                <span className="ptile-v">+{fmtGain(validation.actual)}</span>
              </div>
              <div className="ptile">
                <span className="ptile-k">Predicted</span>
                <span className="ptile-v">+{fmtGain(validation.predicted)}</span>
              </div>
              <div className="ptile">
                <span className="ptile-k">Actual / predicted</span>
                <span className="ptile-v">
                  {validation.ratio != null ? `${(validation.ratio * 100).toFixed(0)}%` : '—'}
                </span>
              </div>
            </div>
          )}
          {validation?.capped && (
            <p className="plan-cap-note">
              ⚠ This stat started above {fmtInt(50_000_000)} — if actual lands well under predicted, that
              supports the community-reported stat-growth cap (the engine still assumes it keeps scaling).
            </p>
          )}
          <p className="footnote">
            Enter how much energy you trained on the chosen stat during the interval. Predicted uses
            your best usable gym at your max happy and the interval’s starting stat — real training
            varies happy, so treat this as a sanity check, not an exact match.
          </p>
        </>
      ) : (
        <p className="footnote">
          Save a snapshot now and another after a few days of training to see your growth and check
          it against the engine.
        </p>
      )}
    </section>
  );
}
