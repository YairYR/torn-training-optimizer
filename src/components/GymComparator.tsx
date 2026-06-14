import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { compareGyms } from '../engine/gym-comparator';
import { evaluateGymEligibility, GymEligibility, isUsable, GymGate } from '../engine/gym-eligibility';
import { fmtGain } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
}

type Metric = 'gpe' | 'gpt';

const STATUS_LABEL: Record<GymEligibility['status'], string> = {
  accessible: 'open',
  eligible: 'eligible',
  locked: 'locked',
  invite: 'invite',
  unknown: '?',
};

export function GymComparator({ gyms, player, modifiers, gate }: Props) {
  const [focus, setFocus] = useState<StatKey>('defense');
  const [metric, setMetric] = useState<Metric>('gpe');

  const rows = useMemo(
    () => compareGyms({ gyms, stats: player.stats, happy: player.happy.current, modifiers }),
    [gyms, player, modifiers],
  );

  const eligibility = useMemo(() => {
    const m = new Map<string, GymEligibility>();
    for (const g of gyms) m.set(g.id, evaluateGymEligibility(g, player.stats, player.xanaxEcstasyTaken, gate));
    return m;
  }, [gyms, player, gate]);

  // Best gym per stat among those the player can actually use (overrides the
  // engine's raw isBest, which ignores unlock requirements).
  const bestUsableByStat = useMemo(() => {
    const out = {} as Record<StatKey, string | null>;
    for (const s of STAT_KEYS) {
      let id: string | null = null;
      let best = -1;
      for (const r of rows) {
        const el = eligibility.get(r.gym.id);
        if (el && isUsable(el.status) && r.perStat[s].gpe > best && r.perStat[s].gpe > 0) {
          best = r.perStat[s].gpe;
          id = r.gym.id;
        }
      }
      out[s] = id;
    }
    return out;
  }, [rows, eligibility]);

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
              <th>Access</th>
              {STAT_KEYS.map((s) => (
                <th key={s}>{STAT_LABEL[s]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const el = eligibility.get(r.gym.id);
              const status = el?.status ?? 'unknown';
              return (
                <tr key={r.gym.id} className={!isUsable(status) ? 'row-locked' : ''}>
                  <td className="gym-name">{r.gym.name || 'Fight Club'}</td>
                  <td>
                    <span className="e-chip">{r.gym.energyPerTrain}</span>
                  </td>
                  <td>
                    <span className={`access access-${status}`} title={el?.requirement ?? ''}>
                      {STATUS_LABEL[status]}
                    </span>
                  </td>
                  {STAT_KEYS.map((s) => {
                    const m = r.perStat[s];
                    const v = m[metric];
                    const best = bestUsableByStat[s] === r.gym.id;
                    const cls = [
                      v <= 0 ? 'muted-cell' : '',
                      best ? 'cell-best' : '',
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
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="footnote">
        <span className="cell-best" /> marks the best gym per stat <strong>you can actually use</strong>.
        Access: <span className="access access-eligible">eligible</span>/
        <span className="access access-accessible">open</span> are usable;{' '}
        <span className="access access-locked">locked</span> specialists show their requirement on
        hover. Standard-gym unlock (cost/progression through George's) is assumed; only specialist
        stat-ratio requirements are checked.
      </p>
    </section>
  );
}
