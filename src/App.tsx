import { useEffect, useMemo, useState } from 'react';
import { Gym, PlayerState, StatKey, STAT_KEYS } from './engine/types';
import { fetchGyms, fetchPlayer } from './api/client';
import { fetchPrices } from './api/market';
import { Prices } from './engine/cost-model';
import {
  bestUsableGymIdForStat,
  standardGyms,
  georgesGymId,
  GymGate,
} from './engine/gym-eligibility';
import { flatModifiers } from './engine/modifiers';
import { ENERGY_SOURCES, HAPPY_BOOSTERS } from './data/consumables';
import { SessionConfig } from './session-config';
import { ApiKeyBar } from './components/ApiKeyBar';
import { SummaryCard } from './components/SummaryCard';
import { HistoryChart } from './components/HistoryChart';
import { Modifiers } from './components/Modifiers';
import { PlayerSummary } from './components/PlayerSummary';
import { TrainingPlan } from './components/TrainingPlan';
import { Planner } from './components/Planner';
import { BuildRoadmap } from './components/BuildRoadmap';
import { GymComparator } from './components/GymComparator';
import { SessionSimulator } from './components/SessionSimulator';
import { Economics } from './components/Economics';
import { Optimizer } from './components/Optimizer';
import { Projector } from './components/Projector';
import { ProgressTracker } from './components/ProgressTracker';
import { AboutSection } from './components/AboutSection';
import { ManualEntry, ManualData } from './components/ManualEntry';
import { STATIC_GYMS } from './data/gyms';
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
  const [unlockedGymId, setUnlockedGymId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => localStorage.setItem(KEY_STORE, apiKey), [apiKey]);
  useEffect(() => localStorage.setItem(MOD_STORE, JSON.stringify(modifiers)), [modifiers]);

  const georgesId = useMemo(() => (gyms ? georgesGymId(gyms) : null), [gyms]);

  const gate: GymGate = useMemo(
    () => ({
      unlockedCapId: unlockedGymId,
      georgesUnlocked: georgesId == null || unlockedGymId == null ? true : unlockedGymId >= georgesId,
    }),
    [unlockedGymId, georgesId],
  );

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

      // Default the unlocked cap from the active gym if it's a standard gym,
      // otherwise assume fully progressed (George's).
      const std = standardGyms(g);
      const stdIds = new Set(std.map((x) => Number(x.id)));
      const gId = georgesGymId(g);
      const defaultCap =
        p.activeGymId != null && stdIds.has(p.activeGymId) ? p.activeGymId : gId;
      setUnlockedGymId(defaultCap);

      const localGate: GymGate = {
        unlockedCapId: defaultCap,
        georgesUnlocked: gId == null || defaultCap == null ? true : defaultCap >= gId,
      };
      setConfig({
        stat: 'defense',
        gymId: bestUsableGymIdForStat(g, 'defense', p.stats, p.xanaxEcstasyTaken, localGate),
        energy: p.energy.current,
        happy: p.happy.current,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setLoading(false);
    }
  }

  function loadManual(data: ManualData) {
    setError(null);
    setPrices(null);
    const ps: PlayerState = {
      stats: data.stats,
      happy: { current: data.maxHappy, maximum: data.maxHappy },
      energy: { current: data.maxEnergy, maximum: data.maxEnergy },
      xanaxEcstasyTaken: data.xanaxEcstasy,
      activeGymId: null,
    };
    setPlayer(ps);
    setGyms(STATIC_GYMS);
    const gId = georgesGymId(STATIC_GYMS);
    const cap = data.unlockedGymId;
    setUnlockedGymId(cap);
    const localGate: GymGate = {
      unlockedCapId: cap,
      georgesUnlocked: gId == null || cap >= gId,
    };
    setConfig({
      stat: 'defense',
      gymId: bestUsableGymIdForStat(STATIC_GYMS, 'defense', ps.stats, ps.xanaxEcstasyTaken, localGate),
      energy: ps.energy.current,
      happy: ps.happy.current,
    });
  }

  const patchConfig = (patch: Partial<SessionConfig>) =>
    setConfig((c) => {
      if (!c) return c;
      const next = { ...c, ...patch };
      if (patch.stat && patch.gymId === undefined && gyms && player) {
        next.gymId = bestUsableGymIdForStat(
          gyms,
          patch.stat,
          player.stats,
          player.xanaxEcstasyTaken,
          gate,
        );
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
        <p className="tagline">Free gym-training planner for Torn — the best gym, method, energy and unlock targets for every stat.</p>
      </header>

      <ApiKeyBar apiKey={apiKey} onApiKey={setApiKey} loading={loading} onLoad={load} error={error} />

      {!player && (
        <>
          <p className="getstarted">
            Two ways to start: paste your Torn <strong>API key</strong> above and everything fills in
            instantly — your stats, gyms, perks and prices. Or enter your stats by hand below — no key
            needed.
          </p>
          <ManualEntry onSubmit={loadManual} />
          <AboutSection />
        </>
      )}

      {player && gyms && config && (
        <>
          <SummaryCard gyms={gyms} player={player} modifiers={modifiers} gate={gate} />
          <Modifiers
            modifiers={modifiers}
            detected={player.detectedModifiers}
            contributions={player.modifierContributions}
            onChange={setMod}
            onDetect={detectMods}
          />
          <PlayerSummary player={player} />
          <TrainingPlan
            gyms={gyms}
            player={player}
            modifiers={modifiers}
            prices={prices}
            gate={gate}
            standardGyms={standardGyms(gyms)}
            unlockedGymId={unlockedGymId}
            onUnlockedGym={setUnlockedGymId}
          />
          <BuildRoadmap gyms={gyms} player={player} modifiers={modifiers} gate={gate} />
          <Planner gyms={gyms} player={player} modifiers={modifiers} prices={prices} gate={gate} />
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
          <Projector
            gyms={gyms}
            player={player}
            modifiers={modifiers}
            config={config}
            prices={prices}
            gate={gate}
          />
          <GymComparator gyms={gyms} player={player} modifiers={modifiers} gate={gate} />
          <ProgressTracker player={player} gyms={gyms} modifiers={modifiers} gate={gate} />
          <HistoryChart player={player} />
        </>
      )}

      <footer className="site-footer">
        Unofficial fan-made tool · not affiliated with Torn.com. Your API key stays in your browser
        and is sent only to api.torn.com — nothing is stored on any server.
      </footer>
    </div>
  );
}
