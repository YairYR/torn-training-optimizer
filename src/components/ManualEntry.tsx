import { useState } from 'react';
import { STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { STATIC_GYMS } from '../data/gyms';
import { standardGyms, georgesGymId } from '../engine/gym-eligibility';

const STD_GYMS = standardGyms(STATIC_GYMS);
const DEFAULT_GYM = georgesGymId(STATIC_GYMS) ?? Number(STD_GYMS[STD_GYMS.length - 1].id);

export interface ManualData {
  stats: Record<StatKey, number>;
  maxHappy: number;
  maxEnergy: number;
  xanaxEcstasy: number | null;
  unlockedGymId: number;
}

interface Props {
  onSubmit: (data: ManualData) => void;
}

export function ManualEntry({ onSubmit }: Props) {
  const [stats, setStats] = useState<Record<StatKey, number>>({
    strength: 0,
    defense: 0,
    speed: 0,
    dexterity: 0,
  });
  const [maxHappy, setMaxHappy] = useState(5025);
  const [maxEnergy, setMaxEnergy] = useState(150);
  const [xanEcstasy, setXanEcstasy] = useState<string>('');
  const [unlockedGymId, setUnlockedGymId] = useState<number>(DEFAULT_GYM);

  const valid = STAT_KEYS.some((s) => stats[s] > 0);

  const submit = () => {
    if (!valid) return;
    onSubmit({
      stats,
      maxHappy: Math.max(0, maxHappy),
      maxEnergy: Math.max(1, maxEnergy),
      xanaxEcstasy: xanEcstasy.trim() === '' ? null : Math.max(0, Number(xanEcstasy) || 0),
      unlockedGymId,
    });
  };

  return (
    <section className="panel">
      <h2>Or enter your stats manually</h2>
      <p className="footnote" style={{ marginTop: 0 }}>
        No API key needed. Type your battle stats and you'll get your full plan — gym, method,
        unlock targets and projections. (Live energy/booster prices and perk auto-detection need a
        key; you can still enter your gym-gain modifiers by hand afterwards.)
      </p>

      <div className="sim-grid">
        {STAT_KEYS.map((s) => (
          <div key={s}>
            <label htmlFor={`man-${s}`}>{STAT_LABEL[s]}</label>
            <input
              id={`man-${s}`}
              type="number"
              min="0"
              placeholder="0"
              value={stats[s] || ''}
              onChange={(e) =>
                setStats((p) => ({ ...p, [s]: Math.max(0, Number(e.target.value) || 0) }))
              }
            />
          </div>
        ))}
      </div>

      <div className="sim-grid" style={{ marginTop: 12 }}>
        <div>
          <label htmlFor="man-happy">Max happy</label>
          <input
            id="man-happy"
            type="number"
            min="0"
            value={maxHappy}
            onChange={(e) => setMaxHappy(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <div>
          <label htmlFor="man-energy">Max energy</label>
          <input
            id="man-energy"
            type="number"
            min="1"
            value={maxEnergy}
            onChange={(e) => setMaxEnergy(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>
        <div>
          <label htmlFor="man-xe">Xanax + Ecstasy taken (optional)</label>
          <input
            id="man-xe"
            type="number"
            min="0"
            placeholder="for SSL eligibility"
            value={xanEcstasy}
            onChange={(e) => setXanEcstasy(e.target.value)}
          />
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <label htmlFor="man-gym">Highest unlocked gym</label>
        <select
          id="man-gym"
          value={unlockedGymId}
          onChange={(e) => setUnlockedGymId(Number(e.target.value))}
        >
          {STD_GYMS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name || `Gym ${g.id}`}
            </option>
          ))}
        </select>
        <p className="footnote" style={{ marginTop: 6 }}>
          Standard gyms unlock by total energy ever trained (not exposed without a key). Pick the best
          gym you've opened so the plan only suggests gyms you can use. George's also gates the 50-energy
          specialist gyms.
        </p>
      </div>

      <div className="mod-actions">
        <button onClick={submit} disabled={!valid}>
          Use these stats
        </button>
      </div>
      {!valid && <p className="footnote">Enter at least one battle stat to continue.</p>}
    </section>
  );
}
