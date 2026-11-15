import { useEffect, useMemo, useState } from 'react';
import { PlayerState, STAT_LABEL } from '../engine/types';
import { HistoryPoint, withLivePoint } from '../engine/history';
import { pace, weekly, nextMilestone, etaDate, SERIES, Series } from '../cloud/insights';
import { fetchRank, RankResult } from '../cloud/client';
import { usePro } from '../pro/usePro';
import { PROFILE_URL, RECIPIENT_ID } from '../pro/entitlement';
import { track } from '../analytics';
import { fmtCompact } from '../format';

const label = (s: Series) => (s === 'total' ? 'Total' : STAT_LABEL[s]);
const pct = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}%`;
const day = (d: Date | null) => (d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

interface Props {
  player: PlayerState;
  /** Historial diario del servidor; vacío si el jugador no activó el seguimiento. */
  points: HistoryPoint[];
}

/** Resumen semanal, proyección a ritmo real y ranking en la facción. Pro. */
export function ProInsights({ player, points }: Props) {
  const { status } = usePro(player.playerId, player.factionId);
  const pro = status?.pro === true;
  const rows = useMemo(() => withLivePoint(points, player.stats), [points, player.stats]);
  const w = useMemo(() => weekly(rows), [rows]);
  const p = useMemo(() => pace(rows), [rows]);
  const [rank, setRank] = useState<RankResult | null>(null);

  useEffect(() => {
    if (pro && points.length) void fetchRank().then(setRank);
  }, [pro, points.length]);

  if (!points.length) return null;
  const now = rows[rows.length - 1];
  const value = (s: Series) =>
    s === 'total' ? now.strength + now.defense + now.speed + now.dexterity : now[s];

  if (!pro) {
    return (
      <section className="panel">
        <h2>
          Your progress insights <span className="pro-tag">PRO</span>
        </h2>
        <div className="pro-lock">
          <ul className="insight-list">
            <li><strong>This week</strong> — gain, best stat, and whether you are training faster or slower than your 30-day pace.</li>
            <li><strong>At your real pace</strong> — the date you hit your next milestone on every stat, from your own history.</li>
            <li><strong>Faction rank</strong> — where your 30-day growth sits among faction members who share.</li>
          </ul>
          <p>
            Send <strong>1 Xanax</strong> to{' '}
            <a href={PROFILE_URL} target="_blank" rel="noopener" onClick={() => track('pro_cta_click', { variant: 'personal', where: 'insights' })}>
              [{RECIPIENT_ID}]
            </a>{' '}
            → 30 days of Pro. Your history keeps being saved for free either way.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>
        Your progress insights <span className="pro-tag">PRO</span>
      </h2>

      <h3 className="subhead">This week</h3>
      {w ? (
        <p>
          <strong>+{fmtCompact(w.gain.total)}</strong> total ({pct(w.pct)}) in {Math.round(w.days)} days. Best stat:{' '}
          <strong>{label(w.best)}</strong> (+{fmtCompact(w.gain[w.best])}).
          {w.vsPace != null && (
            <>
              {' '}
              That is <strong>{Math.abs(Math.round(w.vsPace * 100))}% {w.vsPace >= 0 ? 'faster' : 'slower'}</strong> than your
              30-day pace.
            </>
          )}
        </p>
      ) : (
        <p className="footnote">Ready after a week of daily tracking.</p>
      )}

      <h3 className="subhead">At your real pace</h3>
      {p ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Stat</th>
                <th>Now</th>
                <th>Per day</th>
                <th>Next milestone</th>
                <th>Reached on</th>
              </tr>
            </thead>
            <tbody>
              {SERIES.map((s) => {
                const target = nextMilestone(value(s));
                return (
                  <tr key={s}>
                    <td className="gym-name">{label(s)}</td>
                    <td>{fmtCompact(value(s))}</td>
                    <td>{p[s] > 0 ? `+${fmtCompact(p[s])}` : '—'}</td>
                    <td>{fmtCompact(target)}</td>
                    <td>{day(etaDate(value(s), p[s], target, now.t))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="footnote">Ready after two days of daily tracking.</p>
      )}
      {p && (
        <p className="footnote">
          Straight-line projection from your own gains over the last 30 days. Gains grow as stats grow, so real dates
          usually come a little earlier.
        </p>
      )}

      {rank && rank.status !== 404 && rank.status !== 401 && (
        <>
          <h3 className="subhead">Faction rank</h3>
          {rank.status === 403 ? (
            <p className="footnote">Tick “share my stats with my faction” above to see where you rank.</p>
          ) : 'rankTotal' in rank ? (
            <p>
              {rank.rankGrowth != null && (
                <>
                  <strong>#{rank.rankGrowth} of {rank.sharers}</strong> by 30-day growth (you {pct(rank.myGrowth ?? 0)}
                  {rank.medianGrowth != null && <>, faction median {pct(rank.medianGrowth)}</>}).{' '}
                </>
              )}
              <strong>#{rank.rankTotal}</strong> by total stats.
            </p>
          ) : 'needed' in rank ? (
            <p className="footnote">
              Ranks appear once {rank.needed} faction members share their stats — {rank.sharers} do now.
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
