import { useMemo } from 'react';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { gainPerTrain } from '../engine/vladar';
import { simulateBand } from '../engine/session';
import { SessionConfig } from '../session-config';
import { fmtGain, fmtInt } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: number;
  config: SessionConfig;
  onConfig: (patch: Partial<SessionConfig>) => void;
}

export function SessionSimulator({ gyms, player, modifiers, config, onConfig }: Props) {
  const gym = useMemo(() => gyms.find((g) => g.id === config.gymId), [gyms, config.gymId]);
  const dots = gym ? gym.dots[config.stat] : 0;
  const statValue = player.stats[config.stat];

  const single = gym
    ? gainPerTrain({ modifiers, dots, energyPerTrain: gym.energyPerTrain, happy: config.happy, statValue })
    : 0;

  const band = gym
    ? simulateBand({
        statValue,
        happy: config.happy,
        modifiers,
        energyPerTrain: gym.energyPerTrain,
        dots,
        energyBudget: config.energy,
      })
    : null;

  return (
    <section className="panel">
      <h2>Session simulator</h2>
      <div className="sim-grid">
        <div>
          <label htmlFor="sim-stat">Stat</label>
          <select
            id="sim-stat"
            value={config.stat}
            onChange={(e) => onConfig({ stat: e.target.value as StatKey })}
          >
            {STAT_KEYS.map((s) => (
              <option key={s} value={s}>
                {STAT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sim-gym">Gym</label>
          <select id="sim-gym" value={config.gymId} onChange={(e) => onConfig({ gymId: e.target.value })}>
            {gyms.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.energyPerTrain}E)
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="sim-energy">Energy to spend</label>
          <input
            id="sim-energy"
            type="number"
            min="0"
            value={config.energy}
            onChange={(e) => onConfig({ energy: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
        <div>
          <label htmlFor="sim-happy">Happy</label>
          <input
            id="sim-happy"
            type="number"
            min="0"
            value={config.happy}
            onChange={(e) => onConfig({ happy: Math.max(0, Number(e.target.value) || 0) })}
          />
        </div>
      </div>

      <div className="readouts">
        <div className="readout hero">
          <div className="k">Single train · {STAT_LABEL[config.stat]}</div>
          <div className="readout-value">{dots > 0 ? `+${fmtGain(single)}` : '—'}</div>
          <p className="note">
            Validation hook: this should match Torn's predicted gain for one train in{' '}
            {gym?.name ?? '—'}. If it differs, the parsed gym dots or M are off.
          </p>
        </div>

        <div className="readout">
          <div className="k">Session gain (expected)</div>
          <div className="readout-value">{band ? `+${fmtGain(band.expected.totalGain)}` : '—'}</div>
          {band && (
            <div className="band">
              range {fmtGain(band.worst.totalGain)} – {fmtGain(band.best.totalGain)}
            </div>
          )}
        </div>

        <div className="readout">
          <div className="k">After session</div>
          <div className="readout-value">{band ? `${band.expected.trains} trains` : '—'}</div>
          {band && (
            <div className="band">
              happy {fmtInt(config.happy)} → {fmtInt(band.expected.finalHappy)}
            </div>
          )}
        </div>
      </div>
      {gym && dots <= 0 && (
        <p className="footnote">
          {gym.name} does not train {STAT_LABEL[config.stat].toLowerCase()}.
        </p>
      )}
    </section>
  );
}
