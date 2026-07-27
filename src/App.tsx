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
import { BuildCompare } from './components/BuildCompare';
import { ShareBar } from './components/ShareBar';
import { Fold } from './components/Fold';
import { DEMO } from './demo';
import { readSharedState, syncUrl, SharedState } from './url-state';
import { dailyEnergyCapacity } from './engine/energy-capacity';
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
  // Manual inputs are kept so the share link can reproduce them exactly.
  const [manual, setManual] = useState<ManualData | null>(null);
  // A stat/gym from the URL has to survive until a player is loaded — a visitor
  // from an SEO landing page arrives with a gym selected but no stats yet.
  const [pendingConfig, setPendingConfig] = useState<Partial<SessionConfig> | null>(null);
  // True while the visitor is looking at the sample player rather than their own.
  const [isDemo, setIsDemo] = useState(false);

  // A shared link (or an SEO landing page) fills the tool in before first paint,
  // so a visitor from search lands on real numbers instead of an empty form.
  useEffect(() => {
    const shared = readSharedState();
    if (shared?.modifiers) setModifiers(shared.modifiers);
    if (shared?.config) setPendingConfig(shared.config);
    if (shared?.manual) {
      loadManual(shared.manual);
    } else if (!shared) {
      // Nothing to restore — show the tool working on a sample player instead
      // of an empty form. Replaced the moment real data arrives.
      loadManual(DEMO);
      setIsDemo(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setIsDemo(false);
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
        ...pendingConfig,
      });
      setPendingConfig(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setLoading(false);
    }
  }

  function loadManual(data: ManualData) {
    setError(null);
    setPrices(null);
    setManual(data);
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
      ...pendingConfig,
    });
    setPendingConfig(null);
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

  const energyPerDay = useMemo(() => {
    if (!player) return 0;
    const xan = ENERGY_SOURCES.find((s) => s.id === 'xanax');
    if (!xan?.cooldownMinutes) return player.energy.maximum;
    return dailyEnergyCapacity({
      maxEnergy: player.energy.maximum,
      drugEnergyPerDose: xan.energyGain,
      drugCooldownMinutes: xan.cooldownMinutes,
    }).total;
  }, [player]);

  const shared: SharedState = useMemo(
    () => ({
      manual:
        manual ??
        (player
          ? {
              stats: player.stats,
              maxHappy: player.happy.maximum,
              maxEnergy: player.energy.maximum,
              xanaxEcstasy: player.xanaxEcstasyTaken ?? null,
              unlockedGymId: unlockedGymId ?? 24,
            }
          : undefined),
      config: config ?? undefined,
      modifiers,
    }),
    [manual, player, config, modifiers, unlockedGymId],
  );

  // Keep the address bar pasteable at all times, without polluting history.
  useEffect(() => {
    if (player && !isDemo) syncUrl(shared);
  }, [player, shared, isDemo]);

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
        <p className="tagline">The free Torn gym calculator — exact gains per train, happy jump vs energy training, best gym and unlock targets for every battle stat.</p>
      </header>

      <ApiKeyBar apiKey={apiKey} onApiKey={setApiKey} loading={loading} onLoad={load} error={error} />

      {isDemo && (
        <p className="demobar">
          <strong>Sample player.</strong> Everything below is live — the real formula on made-up
          stats. Load your API key above, or <a href="#own-numbers">enter your own numbers</a>, to
          replace it.
        </p>
      )}

      {player && gyms && config && (
        <>
          <SummaryCard gyms={gyms} player={player} modifiers={modifiers} gate={gate} />
          {!isDemo && (
            <ShareBar
              gyms={gyms}
              player={player}
              modifiers={modifiers}
              gate={gate}
              energyPerDay={energyPerDay}
              shared={shared}
            />
          )}
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

          <Fold label="Build roadmap" hint="Which gyms your ratio unlocks next">
            <BuildRoadmap gyms={gyms} player={player} modifiers={modifiers} gate={gate} />
          </Fold>
          <Fold label="Reach a target" hint="Energy, cash and days to a stat or a gym">
            <Planner gyms={gyms} player={player} modifiers={modifiers} prices={prices} gate={gate} />
          </Fold>
          <Fold label="Compare every gym" hint="Ranked for the stat you pick">
            <GymComparator gyms={gyms} player={player} modifiers={modifiers} gate={gate} />
          </Fold>
          <Fold label="Simulate one session" hint="Train by train, with the happy-loss band">
            <SessionSimulator
              gyms={gyms}
              player={player}
              modifiers={modifiers[config.stat]}
              config={config}
              onConfig={patchConfig}
            />
          </Fold>
          <Fold label="Cost of energy" hint="Cheapest source, and your daily ceiling">
            <Economics
              gyms={gyms}
              player={player}
              modifiers={modifiers[config.stat]}
              config={config}
              prices={prices}
            />
          </Fold>
          <Fold label="Spend a budget" hint="Best items to buy for the most gains">
            <Optimizer
              gyms={gyms}
              player={player}
              modifiers={modifiers[config.stat]}
              config={config}
              prices={prices}
            />
          </Fold>
          <Fold label="Project forward" hint="Multi-day stat growth">
            <Projector
              gyms={gyms}
              player={player}
              modifiers={modifiers}
              config={config}
              prices={prices}
              gate={gate}
            />
          </Fold>
          <Fold label="Compare two setups" hint="What a gym, happy level or perk is worth">
            <BuildCompare
              gyms={gyms}
              player={player}
              modifiers={modifiers}
              gate={gate}
              energyPerDay={energyPerDay}
            />
          </Fold>
          <Fold label="Gym-gain modifiers (M)" hint="Detected from your perks, editable">
            <Modifiers
              modifiers={modifiers}
              detected={player.detectedModifiers}
              contributions={player.modifierContributions}
              onChange={setMod}
              onDetect={detectMods}
            />
          </Fold>
          <Fold label="Your bars and stats" hint="What was read from the API">
            <PlayerSummary player={player} />
          </Fold>
          <Fold label="Track real vs predicted" hint="Check the formula against your own trains">
            <ProgressTracker player={player} gyms={gyms} modifiers={modifiers} gate={gate} />
          </Fold>
          <Fold label="Stats history" hint="Your curve over time">
            <HistoryChart player={player} />
          </Fold>
        </>
      )}

      {(!player || isDemo) && (
        <>
          <p className="getstarted" id="own-numbers">
            Two ways to use your own numbers: paste your Torn <strong>API key</strong> above and
            everything fills in instantly — stats, gyms, perks and prices. Or type your stats in
            below; no key needed.
          </p>
          <ManualEntry
            onSubmit={(d) => {
              setIsDemo(false);
              loadManual(d);
            }}
          />
          <AboutSection />
        </>
      )}

      <footer className="site-footer">
        <nav className="footer-nav">
          <a href="/guide/">Gym Training Guide</a>
          <a href="/happy-jump/">Happy Jump Calculator</a>
          <a href="/specialist-gyms/">Specialist Gyms</a>
          <a href="/gym-dots/">Gym Dots Chart</a>
          <a href="/stat-cap/">The 50M Stat Cap</a>
          <a href="/gyms/">All Gyms</a>
        </nav>
        Unofficial fan-made tool · not affiliated with Torn.com. Your API key stays in your browser
        and is sent only to api.torn.com — nothing is stored on any server.
      </footer>
    </div>
  );
}
