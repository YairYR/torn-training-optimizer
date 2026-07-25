import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { GymGate, evaluateGymEligibility } from '../engine/gym-eligibility';
import { simulateSession } from '../engine/session';
import { fmtGain, fmtInt } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
  energyPerDay: number;
}

interface Side {
  stat: StatKey;
  gymId: string;
  statValue: number;
  happy: number;
  modifier: number;
}

/** One column's projected daily gain, simulated train by train. */
function project(side: Side, gyms: Gym[], energyPerDay: number) {
  const gym = gyms.find((g) => g.id === side.gymId);
  if (!gym || gym.dots[side.stat] <= 0) return null;
  const day = simulateSession({
    statValue: side.statValue,
    happy: side.happy,
    modifiers: side.modifier,
    energyPerTrain: gym.energyPerTrain,
    dots: gym.dots[side.stat],
    energyBudget: energyPerDay,
    mode: 'expected',
  });
  return { gym, day, perMonth: day.totalGain * 30 };
}

/**
 * Side-by-side "what if". The single question every Torn player argues about in
 * faction chat — is my setup better than theirs, or than mine six months from
 * now — answered from the same engine, with no account and no server.
 */
export function BuildCompare({ gyms, player, modifiers, gate, energyPerDay }: Props) {
  const usable = useMemo(
    () =>
      gyms.filter((g) => {
        const e = evaluateGymEligibility(g, player.stats, player.xanaxEcstasyTaken, gate);
        return e.status === 'accessible' || e.status === 'eligible';
      }),
    [gyms, player.stats, player.xanaxEcstasyTaken, gate],
  );

  const primary = STAT_KEYS.reduce((a, b) => (player.stats[b] > player.stats[a] ? b : a), STAT_KEYS[0]);
  const defaultGym = usable.find((g) => g.dots[primary] > 0) ?? gyms[0];

  const base: Side = {
    stat: primary,
    gymId: defaultGym?.id ?? '',
    statValue: player.stats[primary],
    happy: player.happy.maximum,
    modifier: modifiers[primary],
  };

  const [a, setA] = useState<Side>(base);
  const [b, setB] = useState<Side>({ ...base, happy: 99_999 });

  const ra = useMemo(() => project(a, gyms, energyPerDay), [a, gyms, energyPerDay]);
  const rb = useMemo(() => project(b, gyms, energyPerDay), [b, gyms, energyPerDay]);

  const verdict = useMemo(() => {
    if (!ra || !rb || ra.day.totalGain <= 0) return null;
    const pct = (rb.day.totalGain / ra.day.totalGain - 1) * 100;
    if (Math.abs(pct) < 0.5) return 'The two setups are within half a percent — pick either.';
    const better = pct > 0 ? 'B' : 'A';
    return `Setup ${better} gains ${Math.abs(pct).toFixed(1)}% more per day.`;
  }, [ra, rb]);

  const column = (label: string, side: Side, set: (s: Side) => void, res: ReturnType<typeof project>) => (
    <div className="cmp-col">
      <h3>Setup {label}</h3>

      <label className="cmp-field">
        <span>Stat</span>
        <select
          className="plan-select"
          value={side.stat}
          onChange={(e) => {
            const stat = e.target.value as StatKey;
            const gym = usable.find((g) => g.dots[stat] > 0);
            set({ ...side, stat, statValue: player.stats[stat], modifier: modifiers[stat], gymId: gym?.id ?? side.gymId });
          }}
        >
          {STAT_KEYS.map((s) => (
            <option key={s} value={s}>
              {STAT_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      <label className="cmp-field">
        <span>Gym</span>
        <select className="plan-select" value={side.gymId} onChange={(e) => set({ ...side, gymId: e.target.value })}>
          {gyms
            .filter((g) => g.dots[side.stat] > 0)
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} — {g.dots[side.stat].toFixed(1)} dots, {g.energyPerTrain}E
              </option>
            ))}
        </select>
      </label>

      <label className="cmp-field">
        <span>Stat value</span>
        <input
          className="qty-input"
          type="number"
          min={0}
          value={side.statValue}
          onChange={(e) => set({ ...side, statValue: Math.max(0, Number(e.target.value)) })}
        />
      </label>

      <label className="cmp-field">
        <span>Happy</span>
        <input
          className="qty-input"
          type="number"
          min={0}
          max={99999}
          value={side.happy}
          onChange={(e) => set({ ...side, happy: Math.min(99_999, Math.max(0, Number(e.target.value))) })}
        />
      </label>

      <label className="cmp-field">
        <span>Modifier M</span>
        <input
          className="qty-input"
          type="number"
          step={0.01}
          min={0.1}
          value={side.modifier}
          onChange={(e) => set({ ...side, modifier: Math.max(0.1, Number(e.target.value)) })}
        />
      </label>

      <div className="cmp-out">
        {res ? (
          <>
            <div className="ptile">
              <span className="ptile-k">Per day</span>
              <span className="ptile-v">+{fmtGain(res.day.totalGain)}</span>
            </div>
            <div className="ptile">
              <span className="ptile-k">Per month</span>
              <span className="ptile-v">+{fmtGain(res.perMonth)}</span>
            </div>
            <div className="ptile">
              <span className="ptile-k">Trains / day</span>
              <span className="ptile-v">{fmtInt(res.day.trains)}</span>
            </div>
            <div className="ptile">
              <span className="ptile-k">Happy left</span>
              <span className="ptile-v">{fmtInt(res.day.finalHappy)}</span>
            </div>
          </>
        ) : (
          <p className="planner-none">That gym does not train {STAT_LABEL[side.stat]}.</p>
        )}
      </div>
    </div>
  );

  return (
    <section className="panel">
      <h2>Compare two setups</h2>
      <p className="subhead">
        Same engine, two configurations, {fmtInt(energyPerDay)} energy a day each. Change a gym, a
        happy level or a perk modifier and see what it is actually worth.
      </p>

      <div className="cmp-grid">
        {column('A', a, setA, ra)}
        {column('B', b, setB, rb)}
      </div>

      {verdict && <p className="cmp-verdict">{verdict}</p>}
    </section>
  );
}
