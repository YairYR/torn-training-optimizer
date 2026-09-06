import { useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_LABEL, StatKey } from '../engine/types';
import {
  evaluateGymEligibility,
  GymGate,
  isJailGym,
  ratioReachable,
} from '../engine/gym-eligibility';
import { resolveUnlockTarget } from '../engine/planner';
import { BUILD_PRESETS, evaluateBuildRatio } from '../engine/build-ratio';
import { fmtGain, fmtInt } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  gate: GymGate;
  /** stage.hasBuild — false only for the even 1:1:1:1 player, who has not
   *  made the decision yet and gets the explainer instead of the table. */
  hasBuild: boolean;
}

interface NearestUnlock {
  gym: Gym;
  stat: StatKey;
  pointsNeeded: number;
  requirement: string;
}

/**
 * Nearest locked specialist gym and the stat gap that opens it, using the
 * closed-form ratio rules (resolveUnlockTarget) instead of bisecting the
 * eligibility check. resolveUnlockTarget returns null for non-stat gates
 * (SSL's drug count, Fight Club's invite) — those gyms just aren't candidates
 * here, same as before. ratioReachable drops the gyms whose real blocker is
 * the progression gate rather than the ratio — see it for why.
 */
export function nearestUnlock(
  gyms: Gym[],
  stats: Record<StatKey, number>,
  xanaxEcstasyTaken: number | null | undefined,
  gate: GymGate,
): NearestUnlock | null {
  let best: NearestUnlock | null = null;
  for (const gym of gyms) {
    if (isJailGym(gym)) continue;
    const elig = evaluateGymEligibility(gym, stats, xanaxEcstasyTaken, gate);
    if (elig.status !== 'locked' || !elig.requirement) continue;
    if (!ratioReachable(gym, stats, xanaxEcstasyTaken, gate)) continue;
    const t = resolveUnlockTarget(gym, stats);
    if (!t) continue;
    const pointsNeeded = Math.max(0, t.target - stats[t.stat]);
    if (!best || pointsNeeded < best.pointsNeeded) {
      best = { gym, stat: t.stat, pointsNeeded, requirement: elig.requirement };
    }
  }
  return best;
}

/**
 * Are you still on your build?
 *
 * Specialist gyms gate on ratios rather than size, so a few days of training
 * the wrong stat can quietly cost access to the gym the whole build exists
 * for. This shows the current split against the target and, unlike the
 * userscripts that do the same job, the actual stat gap to the next gym —
 * measured against the same eligibility rules used everywhere else.
 */
export function BuildRatio({ gyms, player, gate, hasBuild }: Props) {
  const [presetId, setPresetId] = useState(BUILD_PRESETS[0].id);
  const preset = BUILD_PRESETS.find((p) => p.id === presetId)!;

  const result = useMemo(
    () => evaluateBuildRatio(player.stats, preset.weights),
    [player.stats, preset],
  );
  const target = useMemo(
    () => nearestUnlock(gyms, player.stats, player.xanaxEcstasyTaken, gate),
    [gyms, player.stats, player.xanaxEcstasyTaken, gate],
  );

  return (
    <section className="panel">
      <h2>Build ratio</h2>

      <label className="cmp-field" style={{ maxWidth: 420 }}>
        <span>Target build</span>
        <select
          className="plan-select"
          value={presetId}
          onChange={(e) => setPresetId(e.target.value)}
        >
          {BUILD_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      <p className="subhead">{preset.note}</p>

      {hasBuild ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Stat</th>
                  <th>Now</th>
                  <th>Share</th>
                  <th>Target</th>
                  <th>To target</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row) => (
                  <tr key={row.stat}>
                    <td>{STAT_LABEL[row.stat]}</td>
                    <td className="num">{fmtInt(row.value)}</td>
                    <td
                      className="num"
                      style={{
                        color:
                          row.status === 'behind'
                            ? 'var(--danger)'
                            : row.status === 'on-track'
                              ? 'var(--best)'
                              : 'var(--muted)',
                      }}
                    >
                      {(row.share * 100).toFixed(1)}%
                    </td>
                    <td className="num">{(row.targetShare * 100).toFixed(1)}%</td>
                    <td className="num">
                      {row.pointsBehind != null ? `+${fmtGain(row.pointsBehind)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className={result.onTrack ? 'cmp-verdict' : 'plan-cap-note'}>
            {result.onTrack
              ? 'You are on track for this build.'
              : `Train ${STAT_LABEL[result.trainNext as StatKey]} next — it is furthest below target.`}
          </p>
        </>
      ) : (
        <p className="footnote">
          Your four stats are even, so you are not on a build yet. A build is a
          decision: you give up one stat so another sits 25% above it and a
          specialist gym opens. The roadmap below shows what each one unlocks.
        </p>
      )}

      {target && (
        <p className="footnote">
          <strong>+{fmtGain(target.pointsNeeded)} {STAT_LABEL[target.stat]}</strong> unlocks{' '}
          {target.gym.name} ({target.requirement}).
        </p>
      )}
    </section>
  );
}
