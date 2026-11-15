import { useMemo, useState } from 'react';
import { Gym, PlayerState, SessionConfig, STAT_LABEL } from '../engine/types';
import { Prices } from '../engine/cost-model';
import { jumpRoi, STACK_HOURS } from '../engine/jump-roi';
import { usePro } from '../pro/usePro';
import { DAYS_PER_XANAX, PROFILE_URL, RECIPIENT_ID, XANAX_PER_FACTION_MONTH } from '../pro/entitlement';
import { track } from '../analytics';
import { fmtGain, fmtInt, fmtMoney, fmtPerPoint } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: number;
  config: SessionConfig;
  prices: Prices | null;
}

export function JumpRoi({ gyms, player, modifiers, config, prices }: Props) {
  const [edvds, setEdvds] = useState(5);
  const [novelties, setNovelties] = useState(false);
  const { status, checking, recheck } = usePro(player.playerId, player.factionId);

  const gym = gyms.find((g) => g.id === config.gymId);
  const dots = gym ? gym.dots[config.stat] : 0;

  const r = useMemo(
    () =>
      prices && gym && dots > 0
        ? jumpRoi(
            {
              statValue: player.stats[config.stat],
              baseHappy: player.happy.maximum,
              maxEnergy: player.energy.maximum,
              modifiers,
              dots,
              energyPerTrain: gym.energyPerTrain,
              edvds,
              edvdHappy: novelties ? 5_000 : 2_500,
            },
            prices,
          )
        : null,
    [prices, gym, dots, player, config.stat, modifiers, edvds, novelties],
  );

  if (!r) return null;
  const wins = r.extraGain > 0;

  return (
    <section className="panel">
      <h2>Happy jump ROI</h2>
      <p>
        <strong>{wins ? 'Jumping wins' : 'Energy training wins'}</strong> for {STAT_LABEL[config.stat]} in{' '}
        {gym!.name}: the jump trains {fmtGain(Math.abs(r.extraGain))} {wins ? 'more' : 'less'} than
        spending the same {STACK_HOURS} hours training normally.
      </p>

      <div className="roi-inputs">
        <label>
          eDVDs{' '}
          <input
            type="number"
            min="0"
            className="qty-input"
            value={edvds}
            onChange={(e) => setEdvds(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
        <label>
          <input type="checkbox" checked={novelties} onChange={(e) => setNovelties(e.target.checked)} /> 10★ Adult
          Novelties (5,000 happy per eDVD)
        </label>
      </div>

      {status?.pro ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Energy</th>
                  <th>Happy</th>
                  <th>Gain</th>
                  <th>Cost</th>
                  <th>$ / stat</th>
                </tr>
              </thead>
              <tbody>
                {(
                  [
                    ['Happy jump', r.jump],
                    ['No jump', r.noJump],
                  ] as const
                ).map(([name, s]) => (
                  <tr key={name}>
                    <td className="gym-name">{name}</td>
                    <td>{fmtInt(s.energy)}</td>
                    <td>{fmtInt(s.happy)}</td>
                    <td>+{fmtGain(s.gain)}</td>
                    <td>{fmtMoney(s.cost)}</td>
                    <td>{fmtPerPoint(s.perStat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            {r.extraPerStat != null
              ? `Each extra stat point the jump buys costs ${fmtPerPoint(r.extraPerStat)} in eDVDs and Ecstasy.`
              : 'The jump buys no extra stats at this level — the boosters are pure cost.'}{' '}
            Live market prices; both sides pay 4 Xanax and a refill. Pro until{' '}
            {new Date(status.expires!).toLocaleDateString()}.
          </p>
        </>
      ) : (
        <div className="pro-lock">
          <p>
            <strong>Pro:</strong> what each scenario costs at live market prices, $ per stat, and what
            every extra point from the jump really costs you.
          </p>
          <p>
            Send <strong>1 Xanax</strong> to{' '}
            <a href={PROFILE_URL} target="_blank" rel="noopener" onClick={() => track('pro_cta_click')}>
              [{RECIPIENT_ID}]
            </a>{' '}
            → {DAYS_PER_XANAX} days of Pro, stackable, including the Pro alerts in the browser extension (coming soon).
            Send <strong>{XANAX_PER_FACTION_MONTH} in one gift</strong> and your whole faction gets{' '}
            {DAYS_PER_XANAX} days. Credited automatically about a minute after it arrives.{' '}
            <a href="/pro">More about Pro</a>.
          </p>
          {player.playerId ? (
            <button type="button" onClick={recheck} disabled={checking}>
              {checking ? 'Checking…' : 'I sent it — check now'}
            </button>
          ) : (
            <p className="footnote">Load your API key above so the tool knows who you are.</p>
          )}
        </div>
      )}
    </section>
  );
}
