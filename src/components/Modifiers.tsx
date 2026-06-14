import { useState } from 'react';
import { STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { ModifierContribution } from '../engine/modifiers';

interface Props {
  modifiers: Record<StatKey, number>;
  detected?: Record<StatKey, number>;
  contributions?: ModifierContribution[];
  onChange: (stat: StatKey, value: number) => void;
  onDetect: () => void;
}

const pct = (m: number) => `${m >= 1 ? '+' : ''}${((m - 1) * 100).toFixed(1)}%`;

export function Modifiers({ modifiers, detected, contributions, onChange, onDetect }: Props) {
  const [open, setOpen] = useState(false);
  const hasDetected = detected && STAT_KEYS.some((s) => detected[s] !== 1);

  return (
    <section className="panel">
      <h2>Gym-gain modifiers (M)</h2>
      <div className="sim-grid">
        {STAT_KEYS.map((s) => (
          <div key={s}>
            <label htmlFor={`mod-${s}`}>
              {STAT_LABEL[s]} · <span className="mod-pct">{pct(modifiers[s])}</span>
            </label>
            <input
              id={`mod-${s}`}
              type="number"
              step="0.001"
              min="1"
              value={Number(modifiers[s].toFixed(4))}
              onChange={(e) => onChange(s, Math.max(0, Number(e.target.value) || 0))}
            />
          </div>
        ))}
      </div>
      <div className="mod-actions">
        <button className="ghost" onClick={onDetect} disabled={!detected}>
          ↻ Detect from perks
        </button>
        {contributions && contributions.length > 0 && (
          <button className="ghost" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'Show'} breakdown ({contributions.length})
          </button>
        )}
      </div>

      {open && contributions && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Source</th>
                <th>Applies to</th>
                <th>Perk</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {contributions.map((c, i) => (
                <tr key={i}>
                  <td className="gym-name">{c.source.replace(/_perks$/, '')}</td>
                  <td>{c.stat === 'all' ? 'all stats' : STAT_LABEL[c.stat]}</td>
                  <td className="gym-name">{c.text}</td>
                  <td>+{c.percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="footnote">
        {hasDetected
          ? 'Detected from your perks (gym-gain bonuses summed). Edit any value if a perk was missed — M affects absolute gains, not the gym ranking.'
          : 'No gym-gain perks detected (or perks not readable with this key). Enter your modifiers manually — e.g. 1.186 for +18.6%.'}
      </p>
    </section>
  );
}
