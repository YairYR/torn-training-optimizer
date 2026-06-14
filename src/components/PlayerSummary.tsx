import { PlayerState, STAT_KEYS, STAT_LABEL } from '../engine/types';
import { fmtInt } from '../format';

export function PlayerSummary({ player }: { player: PlayerState }) {
  return (
    <section className="panel">
      <h2>Player</h2>
      <div className="statgrid">
        {STAT_KEYS.map((s) => (
          <div className="stat-card" key={s}>
            <div className="k">{STAT_LABEL[s]}</div>
            <div className="v">{fmtInt(player.stats[s])}</div>
          </div>
        ))}
        <div className="stat-card">
          <div className="k">Happy</div>
          <div className="v">{fmtInt(player.happy.current)}</div>
          <div className="sub">/ {fmtInt(player.happy.maximum)}</div>
        </div>
        <div className="stat-card">
          <div className="k">Energy</div>
          <div className="v">{fmtInt(player.energy.current)}</div>
          <div className="sub">/ {fmtInt(player.energy.maximum)}</div>
        </div>
      </div>
    </section>
  );
}
