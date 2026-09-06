import { useState } from 'react';
import { STAT_KEYS, STAT_LABEL, StatKey, ManualData } from '../engine/types';
import { STATIC_GYMS } from '../data/gyms';
import { standardGyms, georgesGymId } from '../engine/gym-eligibility';

const STD_GYMS = standardGyms(STATIC_GYMS);
const DEFAULT_GYM = georgesGymId(STATIC_GYMS) ?? Number(STD_GYMS[STD_GYMS.length - 1].id);

interface Props {
  apiKey: string;
  onApiKey: (v: string) => void;
  loading: boolean;
  onLoad: () => void;
  error: string | null;
  onManual: (data: ManualData) => void;
}

/**
 * Both ways to get your numbers in, in one place: paste an API key, or —
 * behind a <details>, since it's an alternative path rather than content to
 * hide — type stats by hand. Lives in the shell, above the AnswerBar, so it's
 * reachable no matter which route you're on; the manual form stays collapsed
 * so it doesn't shout at a player whose data is already loaded.
 */
export function YourData({ apiKey, onApiKey, loading, onLoad, error, onManual }: Props) {
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
  const [inJail, setInJail] = useState(false);

  const valid = STAT_KEYS.some((s) => stats[s] > 0);

  const submit = () => {
    if (!valid) return;
    onManual({
      stats,
      maxHappy: Math.max(0, maxHappy),
      maxEnergy: Math.max(1, maxEnergy),
      xanaxEcstasy: xanEcstasy.trim() === '' ? null : Math.max(0, Number(xanEcstasy) || 0),
      unlockedGymId,
      inJail,
    });
  };

  return (
    <section className="panel" id="own-numbers">
      <h2>Your data</h2>
      <div className="apibar">
        <input
          type="password"
          placeholder="Torn API key (battle stats access)"
          value={apiKey}
          onChange={(e) => onApiKey(e.target.value)}
          aria-label="Torn API key"
        />
        <button onClick={onLoad} disabled={loading || !apiKey}>
          {loading ? 'Loading…' : 'Load data'}
        </button>
        <p className="hint">
          The key stays in your browser and is sent only to api.torn.com. It needs a Limited or Full
          key — stats, perks and personal stats are private. Your gym-gain modifiers are detected
          from your perks on load and can be edited below.
        </p>
      </div>
      {error && <p className="error">{error}</p>}

      <details>
        <summary>I'd rather type my stats in</summary>
        <p className="footnote">
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
            Standard gyms unlock by total energy ever trained (not exposed without a key). Pick the
            best gym you've opened so the plan only suggests gyms you can use. Cha Cha's gates the
            25-energy two-stat gyms, Last Round gates the Sports Science Lab, and George's gates the
            50-energy single-stat ones.
          </p>

          <label className="jail-check">
            <input type="checkbox" checked={inJail} onChange={(e) => setInJail(e.target.checked)} />
            <span>
              I'm in jail right now — include Crims Gym
              <span className="footnote"> (4.5 Defense, better than any lightweight gym)</span>
            </span>
          </label>
        </div>

        <div className="mod-actions">
          <button onClick={submit} disabled={!valid}>
            Use these stats
          </button>
        </div>
        {!valid && <p className="footnote">Enter at least one battle stat to continue.</p>}
      </details>
    </section>
  );
}
