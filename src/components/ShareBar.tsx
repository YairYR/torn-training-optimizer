import { useState } from 'react';
import { Gym, PlayerState, StatKey } from '../engine/types';
import { GymGate } from '../engine/gym-eligibility';
import { buildBbcode } from '../bbcode';
import { buildShareUrl, SharedState } from '../url-state';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
  energyPerDay: number;
  shared: SharedState;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Turns a session into something that travels: a link that reproduces the exact
 * readout, and a BBCode block for Torn's forums and faction Discords.
 */
export function ShareBar({ gyms, player, modifiers, gate, energyPerDay, shared }: Props) {
  const [msg, setMsg] = useState<string | null>(null);

  const flash = (text: string) => {
    setMsg(text);
    window.setTimeout(() => setMsg(null), 2500);
  };

  async function copyLink() {
    const url = buildShareUrl(shared);
    flash((await copy(url)) ? 'Link copied.' : url);
  }

  async function copyBbcode() {
    const text = buildBbcode({
      gyms,
      player,
      modifiers,
      gate,
      energyPerDay,
      shareUrl: buildShareUrl(shared),
    });
    flash((await copy(text)) ? 'BBCode copied — paste it into a Torn forum post.' : 'Copy failed.');
  }

  return (
    <div className="sharebar">
      <button type="button" className="toggle-btn" onClick={copyLink}>
        Copy link
      </button>
      <button type="button" className="toggle-btn" onClick={copyBbcode}>
        Copy as BBCode
      </button>
      <span className="sharebar-hint">
        {msg ?? 'The link carries your stats and gym choice — never your API key.'}
      </span>
    </div>
  );
}
