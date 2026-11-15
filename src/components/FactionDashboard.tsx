import { useEffect, useState } from 'react';
import { STAT_KEYS, STAT_LABEL } from '../engine/types';
import { fetchFaction, FactionResult } from '../cloud/client';
import { PROFILE_URL, RECIPIENT_ID, XANAX_PER_FACTION_MONTH } from '../pro/entitlement';
import { fmtInt } from '../format';

/** Solo se muestra a líderes y co-líderes con seguimiento activo; el resto no ve nada. */
export function FactionDashboard({ refresh }: { refresh: number }) {
  const [r, setR] = useState<FactionResult | null>(null);
  useEffect(() => {
    void fetchFaction().then(setR);
  }, [refresh]);

  if (!r || (r.status !== 200 && r.status !== 402)) return null;

  if (r.status === 402 && 'factionId' in r) {
    return (
      <section className="panel">
        <h2>Faction dashboard</h2>
        <div className="pro-lock">
          <p>
            As leader of <strong>{r.faction}</strong> you can see every member who shares their stats:
            totals, each battle stat and 30-day growth.
          </p>
          <p>
            Send <strong>{XANAX_PER_FACTION_MONTH} Xanax in one gift</strong> to{' '}
            <a href={PROFILE_URL} target="_blank" rel="noopener">
              [{RECIPIENT_ID}]
            </a>{' '}
            → 30 days of Pro for the whole faction, dashboard included.
          </p>
        </div>
      </section>
    );
  }
  if (!('members' in r)) return null;

  return (
    <section className="panel">
      <h2>Faction dashboard · {r.faction.name}</h2>
      <p className="footnote">
        {r.members.length} of {r.memberCount} members share their stats. Members opt in from their own
        Progress tab. Faction pass until {new Date(r.expires).toLocaleDateString()}.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Member</th>
              <th>Total</th>
              {STAT_KEYS.map((k) => (
                <th key={k}>{STAT_LABEL[k]}</th>
              ))}
              <th>30 days</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {r.members.map((m) => (
              <tr key={m.playerId}>
                <td className="gym-name">
                  <a href={`https://www.torn.com/profiles.php?XID=${m.playerId}`} target="_blank" rel="noopener">
                    {m.name}
                  </a>
                </td>
                <td>{fmtInt(m.total)}</td>
                {STAT_KEYS.map((k) => (
                  <td key={k}>
                    {fmtInt(m.stats[k])} <span className="muted-cell">{Math.round((m.stats[k] / m.total) * 100)}%</span>
                  </td>
                ))}
                <td className={m.growth != null && m.growth > 0 ? 'cell-best' : 'muted-cell'}>
                  {m.growth == null ? '—' : `${m.growth >= 0 ? '+' : ''}${(m.growth * 100).toFixed(1)}%`}
                </td>
                <td className="muted-cell">{m.day}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
