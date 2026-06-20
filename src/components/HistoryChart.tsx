import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Brush,
  ResponsiveContainer,
} from 'recharts';
import { PlayerState, StatKey } from '../engine/types';
import {
  HistoryPoint,
  loadHistory,
  saveHistory,
  clearHistory,
  parseTornStatsHistory,
  withLivePoint,
} from '../engine/history';
import { fmtInt, fmtGain } from '../format';

interface Props {
  player: PlayerState;
}

type SeriesKey = StatKey | 'total';

const SERIES: { key: SeriesKey; label: string; color: string }[] = [
  { key: 'strength', label: 'Strength', color: '#e0594f' },
  { key: 'defense', label: 'Defense', color: '#5b8def' },
  { key: 'speed', label: 'Speed', color: '#e0a94e' },
  { key: 'dexterity', label: 'Dexterity', color: '#5ec0a8' },
  { key: 'total', label: 'Total', color: '#b07bd9' },
];

const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });

const compact = (n: number) =>
  Math.abs(n) >= 1e6
    ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`
    : Math.abs(n) >= 1e3
      ? `${(n / 1e3).toFixed(0)}k`
      : `${n}`;

export function HistoryChart({ player }: Props) {
  const [history, setHistory] = useState<HistoryPoint[]>(() => loadHistory());
  const [logScale, setLogScale] = useState(false);
  const [hidden, setHidden] = useState<Set<SeriesKey>>(() => new Set(['total']));
  const [draft, setDraft] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  // Imported history + the live "today" point.
  const rows = useMemo(() => withLivePoint(history, player.stats), [history, player.stats]);

  const data = useMemo(
    () =>
      rows.map((r) => {
        const total = r.strength + r.defense + r.speed + r.dexterity;
        const v = (n: number) => (logScale && n <= 0 ? null : n);
        return {
          t: r.t,
          strength: v(r.strength),
          defense: v(r.defense),
          speed: v(r.speed),
          dexterity: v(r.dexterity),
          total: v(total),
        };
      }),
    [rows, logScale],
  );

  const summary = useMemo(() => {
    if (rows.length < 2) return null;
    const first = rows[0];
    const lastRow = rows[rows.length - 1];
    const firstTotal = first.strength + first.defense + first.speed + first.dexterity;
    const lastTotal =
      lastRow.strength + lastRow.defense + lastRow.speed + lastRow.dexterity;
    return {
      gained: lastTotal - firstTotal,
      from: first.t,
      to: lastRow.t,
      points: rows.length,
    };
  }, [rows]);

  function toggle(key: SeriesKey) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function doImport() {
    const parsed = parseTornStatsHistory(draft);
    if (!parsed.length) {
      setImportMsg('No stat history found in that text. Paste the full TornStats page.');
      return;
    }
    setHistory(parsed);
    saveHistory(parsed);
    setDraft('');
    setImportOpen(false);
    setImportMsg(`Imported ${parsed.length} snapshots (${fmtDate(parsed[0].t)} → today).`);
  }

  function doClear() {
    clearHistory();
    setHistory([]);
    setImportMsg('Imported history cleared.');
  }

  const yDomain: [number | string, number | string] = logScale ? [1, 'auto'] : [0, 'auto'];

  return (
    <section className="panel">
      <div className="history-head">
        <h2>Stats history</h2>
        <div className="history-controls">
          <button
            type="button"
            className={`toggle-btn ${logScale ? 'on' : ''}`}
            onClick={() => setLogScale((v) => !v)}
            title="Log scale makes early growth readable when stats span 100s to millions"
          >
            {logScale ? 'Log' : 'Linear'}
          </button>
          <button type="button" className="toggle-btn" onClick={() => setImportOpen((v) => !v)}>
            Import
          </button>
        </div>
      </div>

      <div className="series-toggles">
        {SERIES.map((s) => (
          <button
            key={s.key}
            type="button"
            className={`series-toggle ${hidden.has(s.key) ? 'off' : ''}`}
            style={{ ['--dot' as string]: s.color }}
            onClick={() => toggle(s.key)}
          >
            <span className="series-dot" />
            {s.label}
          </button>
        ))}
      </div>

      {rows.length < 2 ? (
        <p className="history-empty">
          Only your current stats are on record. Import your TornStats history below to backfill the
          full curve — the Torn API only exposes current stats, so this is the one way to chart the
          past.
        </p>
      ) : (
        <div className="history-chart">
          <ResponsiveContainer width="100%" height={340}>
            <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
              <CartesianGrid stroke="#2e3543" strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={['dataMin', 'dataMax']}
                tickFormatter={fmtDate}
                tick={{ fill: '#8c95a4', fontSize: 11 }}
                stroke="#2e3543"
                minTickGap={48}
              />
              <YAxis
                scale={logScale ? 'log' : 'linear'}
                domain={yDomain}
                allowDataOverflow
                tickFormatter={compact}
                tick={{ fill: '#8c95a4', fontSize: 11 }}
                stroke="#2e3543"
                width={48}
              />
              <Tooltip
                contentStyle={{
                  background: '#181b22',
                  border: '1px solid #2e3543',
                  borderRadius: 8,
                  color: '#e9ecf1',
                  fontSize: 12,
                }}
                labelFormatter={(t) => fmtDate(Number(t))}
                formatter={(value: number, name: string) => [fmtInt(value), name]}
              />
              {SERIES.filter((s) => !hidden.has(s.key)).map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={1.6}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
              <Brush
                dataKey="t"
                height={22}
                travellerWidth={8}
                stroke="#d99a4e"
                fill="#14161b"
                tickFormatter={fmtDate}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {summary && (
        <p className="history-summary">
          <b>+{fmtGain(summary.gained)}</b> total since {fmtDate(summary.from)} ·{' '}
          {summary.points} snapshots
        </p>
      )}

      {importOpen && (
        <div className="import-box">
          <p className="import-hint">
            On <strong>tornstats.com</strong>, open your <em>Battle Stats</em> page, select all
            (Ctrl/Cmd+A), copy, and paste it here. Only the stat numbers are read; nothing is sent
            anywhere — it's stored locally in your browser.
          </p>
          <textarea
            className="import-textarea"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Paste the full TornStats Battle Stats page here…"
            rows={4}
          />
          <div className="import-actions">
            <button type="button" className="btn-primary" onClick={doImport} disabled={!draft.trim()}>
              Import history
            </button>
            <button type="button" className="toggle-btn" onClick={doClear}>
              Clear
            </button>
          </div>
        </div>
      )}

      {importMsg && <p className="import-msg">{importMsg}</p>}
    </section>
  );
}
