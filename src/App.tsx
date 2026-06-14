import { useEffect, useState } from 'react';
import { Gym, PlayerState, StatKey } from './engine/types';
import { fetchGyms, fetchPlayer } from './api/client';
import { fetchPrices } from './api/market';
import { Prices } from './engine/cost-model';
import { ENERGY_SOURCES, HAPPY_BOOSTERS } from './data/consumables';
import { SessionConfig } from './session-config';
import { ApiKeyBar } from './components/ApiKeyBar';
import { PlayerSummary } from './components/PlayerSummary';
import { GymComparator } from './components/GymComparator';
import { SessionSimulator } from './components/SessionSimulator';
import { Economics } from './components/Economics';
import { Optimizer } from './components/Optimizer';
import { Projector } from './components/Projector';
import './styles.css';

const KEY_STORE = 'tto.apiKey';
const MOD_STORE = 'tto.modifiers';

const PRICED_ITEMS = [
  ...ENERGY_SOURCES.filter((s) => s.itemName).map((s) => s.itemName!),
  ...HAPPY_BOOSTERS.map((b) => b.itemName),
];

// Best gym for a stat = highest dots (energy cancels in gain-per-energy, so the
// gym with the most dots is always the most efficient choice).
function bestGymIdForStat(gyms: Gym[], stat: StatKey): string {
  let bestId = gyms[0]?.id ?? '';
  let bestDots = -1;
  for (const g of gyms) {
    if (g.dots[stat] > bestDots) {
      bestDots = g.dots[stat];
      bestId = g.id;
    }
  }
  return bestId;
}

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(KEY_STORE) ?? '');
  const [modifiers, setModifiers] = useState<number>(() => Number(localStorage.getItem(MOD_STORE)) || 1);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [gyms, setGyms] = useState<Gym[] | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => localStorage.setItem(KEY_STORE, apiKey), [apiKey]);
  useEffect(() => localStorage.setItem(MOD_STORE, String(modifiers)), [modifiers]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [p, g, pr] = await Promise.all([
        fetchPlayer(apiKey),
        fetchGyms(apiKey),
        fetchPrices(apiKey, PRICED_ITEMS).catch(() => null),
      ]);
      setPlayer(p);
      setGyms(g);
      setPrices(pr);
      setConfig({
        stat: 'defense',
        gymId: bestGymIdForStat(g, 'defense'),
        energy: p.energy.current,
        happy: p.happy.current,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setLoading(false);
    }
  }

  const patchConfig = (patch: Partial<SessionConfig>) =>
    setConfig((c) => {
      if (!c) return c;
      const next = { ...c, ...patch };
      // Changing stat (without an explicit gym pick) follows the best gym.
      if (patch.stat && patch.gymId === undefined && gyms) {
        next.gymId = bestGymIdForStat(gyms, patch.stat);
      }
      return next;
    });

  return (
    <div className="app">
      <header className="masthead">
        <h1>
          Torn <span className="mark">Training</span> Optimizer
        </h1>
        <span className="phase">Phase 3 · comparator + economics + optimizer + projector</span>
      </header>

      <ApiKeyBar
        apiKey={apiKey}
        onApiKey={setApiKey}
        modifiers={modifiers}
        onModifiers={setModifiers}
        loading={loading}
        onLoad={load}
        error={error}
      />

      {player && gyms && config && (
        <>
          <PlayerSummary player={player} />
          <SessionSimulator
            gyms={gyms}
            player={player}
            modifiers={modifiers}
            config={config}
            onConfig={patchConfig}
          />
          <Economics
            gyms={gyms}
            player={player}
            modifiers={modifiers}
            config={config}
            prices={prices}
          />
          <Optimizer
            gyms={gyms}
            player={player}
            modifiers={modifiers}
            config={config}
            prices={prices}
          />
          <Projector
            gyms={gyms}
            player={player}
            modifiers={modifiers}
            config={config}
            prices={prices}
          />
          <GymComparator gyms={gyms} player={player} modifiers={modifiers} />
        </>
      )}
    </div>
  );
}
