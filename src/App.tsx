import { useEffect, useState } from 'react';
import { Gym, PlayerState, StatKey, STAT_KEYS } from './engine/types';
import { fetchGyms, fetchPlayer } from './api/client';
import { fetchPrices } from './api/market';
import { Prices } from './engine/cost-model';
import { bestUsableGymIdForStat } from './engine/gym-eligibility';
import { flatModifiers } from './engine/modifiers';
import { ENERGY_SOURCES, HAPPY_BOOSTERS } from './data/consumables';
import { SessionConfig } from './session-config';
import { ApiKeyBar } from './components/ApiKeyBar';
import { Modifiers } from './components/Modifiers';
import { PlayerSummary } from './components/PlayerSummary';
import { TrainingPlan } from './components/TrainingPlan';
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

function loadModifiers(): Record<StatKey, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(MOD_STORE) ?? '');
    if (raw && STAT_KEYS.every((s) => typeof raw[s] === 'number')) return raw;
  } catch {
    /* ignore */
  }
  return flatModifiers(1);
}

export default function App() {
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem(KEY_STORE) ?? '');
  const [modifiers, setModifiers] = useState<Record<StatKey, number>>(loadModifiers);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [gyms, setGyms] = useState<Gym[] | null>(null);
  const [prices, setPrices] = useState<Prices | null>(null);
  const [config, setConfig] = useState<SessionConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => localStorage.setItem(KEY_STORE, apiKey), [apiKey]);
  useEffect(() => localStorage.setItem(MOD_STORE, JSON.stringify(modifiers)), [modifiers]);

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
      if (p.detectedModifiers) setModifiers(p.detectedModifiers);
      setConfig({
        stat: 'defense',
        gymId: bestUsableGymIdForStat(g, 'defense', p.stats, p.xanaxEcstasyTaken),
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
      if (patch.stat && patch.gymId === undefined && gyms && player) {
        next.gymId = bestUsableGymIdForStat(gyms, patch.stat, player.stats, player.xanaxEcstasyTaken);
      }
      return next;
    });

  const setMod = (stat: StatKey, value: number) => setModifiers((m) => ({ ...m, [stat]: value }));
  const detectMods = () => {
    if (player?.detectedModifiers) setModifiers(player.detectedModifiers);
  };

  return (
    <div className="app">
      <header className="masthead">
        <h1>
          Torn <span className="mark">Training</span> Optimizer
        </h1>
        <span className="phase">Phase 3 · plan + comparator + economics + optimizer + projector</span>
      </header>

      <ApiKeyBar apiKey={apiKey} onApiKey={setApiKey} loading={loading} onLoad={load} error={error} />

      {player && gyms && config && (
        <>
          <Modifiers
            modifiers={modifiers}
            detected={player.detectedModifiers}
            contributions={player.modifierContributions}
            onChange={setMod}
            onDetect={detectMods}
          />
          <PlayerSummary player={player} />
          <TrainingPlan gyms={gyms} player={player} modifiers={modifiers} prices={prices} />
          <SessionSimulator
            gyms={gyms}
            player={player}
            modifiers={modifiers[config.stat]}
            config={config}
            onConfig={patchConfig}
          />
          <Economics
            gyms={gyms}
            player={player}
            modifiers={modifiers[config.stat]}
            config={config}
            prices={prices}
          />
          <Optimizer
            gyms={gyms}
            player={player}
            modifiers={modifiers[config.stat]}
            config={config}
            prices={prices}
          />
          <Projector gyms={gyms} player={player} modifiers={modifiers} config={config} prices={prices} />
          <GymComparator gyms={gyms} player={player} modifiers={modifiers} />
        </>
      )}
    </div>
  );
}
