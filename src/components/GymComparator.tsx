import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { compareGyms } from '../engine/gym-comparator';
import { fmtGain } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: number;
}

type Metric = 'gpe' | 'gpt';

export function GymComparator({ gyms, player, modifiers }: Props) {
  const [focus, setFocus] = useState<StatKey>('defense');
  const [metric, setMetric] = useState<Metric>('gpe');

  const rows = useMemo(
    () =>
      compareGyms({
        gyms,
        stats: player.stats,
        happy: player.happy.current,
        modifiers,
      }),
    [gyms, player, modifiers],
  );

  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.perStat[focus][metric] - a.perStat[focus][metric]),
    [rows, focus, metric],
  );

  return (
    <section className="panel">
      <h2>Gym comparator</h2>
      <div className="controls">
        <div>
          <label htmlFor="focus">Focus stat (sort)</label>
          <select id="focus" value={focus} onChange={(e) => setFocus(e.target.value as StatKey)}>
            {STAT_KEYS.map((s) => (
              <option key={s} value={s}>
                {STAT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="metric">Metric</label>
          <select id="metric" value={metric} onChange={(e) => setMetric(e.target.value as Metric)}>
            <option value="gpe">Gain / energy</option>
            <option value="gpt">Gain / train</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Gym</th>
              <th>E</th>
              {STAT_KEYS.map((s) => (
                <th key={s}>{STAT_LABEL[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={r.gym.id}>
                <td className="gym-name">{r.gym.name}</td>
                <td>
                  <span className="e-chip">{r.gym.energyPerTrain}</span>
                </td>
                {STAT_KEYS.map((s) => {
                  const m = r.perStat[s];
                  const v = m[metric];
                  const cls = [
                    v <= 0 ? 'muted-cell' : '',
                    m.isBest ? 'cell-best' : '',
                    s === focus ? 'col-focus' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <td key={s} className={cls}>
                      {v > 0 ? fmtGain(v) : '—'}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        Gain / energy normalises across 5 / 10 / 25 / 50 E gyms. <span className="cell-best" /> marks
        the best gym per stat at your current stats and happy. Ranking ignores M (it scales every gym
        equally).
      </p>
    </section>
  );
}
