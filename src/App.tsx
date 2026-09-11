import { useEffect, useMemo, useState } from 'react';
import { Gym, PlayerState, STAT_KEYS, SessionConfig, StatKey, ManualData } from './engine/types';
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
import { YourData } from './components/YourData';
import { ShareBar } from './components/ShareBar';
import { Nav } from './components/Nav';
import { AnswerBar } from './components/AnswerBar';
import { Plan } from './routes/Plan';
import { Build } from './routes/Build';
import { Compare } from './routes/Compare';
import { Cost } from './routes/Cost';
import { Progress } from './routes/Progress';
import { DEMO } from './demo';
import { readSharedState, syncUrl, navigate, readRoute, Route, SharedState } from './url-state';
import { xanaxDailyEnergy } from './engine/energy-capacity';
import { playerStage } from './engine/stage';
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
  // True while the visitor is looking at the sample player rather than their own.
  const [isDemo, setIsDemo] = useState(false);
  const [route, setRoute] = useState<Route>(() => readRoute());

  // Back/forward move between sections, not between state snapshots: the
  // player's stats are session state shared by all five routes, so only the
  // section is restored here. (The syncUrl effect then rewrites the query of
  // the entry we land on with the current stats — deliberate: the address bar
  // stays pasteable, and "back" never silently swaps the player out from
  // under you.)
  useEffect(() => {
    const onPop = () => setRoute(readRoute());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // A shared link (or an SEO landing page) fills the tool in before first paint,
  // so a visitor from search lands on real numbers instead of an empty form.
  // A landing-page CTA carries a stat/gym but no stats (/compare?stat=defense&
  // gym=25): that still has to reach a working calculator, so the sample player
  // loads on every route unless the URL brought real stats of its own.
  useEffect(() => {
    const shared = readSharedState();
    if (shared?.modifiers) setModifiers(shared.modifiers);
    // The config goes in as an argument, not through state: loadManual runs
    // synchronously here and would read the pre-update value of any setState.
    loadManual(shared?.manual ?? DEMO, shared?.config ?? null);
    setIsDemo(!shared?.manual);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => localStorage.setItem(KEY_STORE, apiKey), [apiKey]);
  useEffect(() => localStorage.setItem(MOD_STORE, JSON.stringify(modifiers)), [modifiers]);

  const georgesId = useMemo(() => (gyms ? georgesGymId(gyms) : null), [gyms]);

  const gate: GymGate = useMemo(
    () => ({
      unlockedCapId: unlockedGymId,
      georgesUnlocked:
        georgesId == null || unlockedGymId == null ? true : unlockedGymId >= georgesId,
      inJail: player?.inJail === true,
    }),
    [unlockedGymId, georgesId, player],
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
      // Otherwise `manual` still holds the sample player from the mount
      // effect (or an earlier "enter your own numbers" session), and the
      // `shared` memo below keeps returning ITS stats instead of the real
      // API player's — the address bar and ShareBar would publish the wrong
      // numbers, and reloading that URL would find a `manual` and never show
      // the "Sample player" banner. See the `shared` memo.
      setManual(null);
      if (p.detectedModifiers) setModifiers(p.detectedModifiers);

      // Default the unlocked cap from the active gym if it's a standard gym,
      // otherwise assume fully progressed (George's).
      const std = standardGyms(g);
      const stdIds = new Set(std.map((x) => Number(x.id)));
      const gId = georgesGymId(g);
      const defaultCap = p.activeGymId != null && stdIds.has(p.activeGymId) ? p.activeGymId : gId;
      setUnlockedGymId(defaultCap);

      const localGate: GymGate = {
        unlockedCapId: defaultCap,
        georgesUnlocked: gId == null || defaultCap == null ? true : defaultCap >= gId,
        inJail: p.inJail === true,
      };
      // Keep whatever stat is on screen (the URL's, or the one the visitor
      // picked while looking at the sample player); the gym is recomputed,
      // since only now do we know which gyms this account can actually use.
      const stat = config?.stat ?? 'defense';
      setConfig({
        stat,
        gymId: bestUsableGymIdForStat(g, stat, p.stats, p.xanaxEcstasyTaken, localGate),
        energy: p.energy.current,
        happy: p.happy.current,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error.');
    } finally {
      setLoading(false);
    }
  }

  /** `cfg` is the stat/gym a link arrived with, if any — see the mount effect. */
  function loadManual(data: ManualData, cfg: Partial<SessionConfig> | null = null) {
    setError(null);
    setPrices(null);
    setManual(data);
    const ps: PlayerState = {
      stats: data.stats,
      happy: { current: data.maxHappy, maximum: data.maxHappy },
      energy: { current: data.maxEnergy, maximum: data.maxEnergy },
      xanaxEcstasyTaken: data.xanaxEcstasy,
      activeGymId: null,
      inJail: data.inJail === true,
    };
    setPlayer(ps);
    setGyms(STATIC_GYMS);
    const gId = georgesGymId(STATIC_GYMS);
    const cap = data.unlockedGymId;
    setUnlockedGymId(cap);
    const localGate: GymGate = {
      unlockedCapId: cap,
      georgesUnlocked: gId == null || cap >= gId,
      inJail: data.inJail === true,
    };
    // The gym default follows the stat already on screen: `cfg` when a link
    // brought one in (the mount effect), else whatever `config` already has
    // (the "enter your own numbers" form, called with no `cfg` — see its call
    // site below). At mount `config` is still null so this yields 'defense'
    // unchanged; by the time the form calls in, `config` is settled. Without
    // this fallback, typing your own stats after landing on e.g.
    // /compare?stat=speed silently flipped the visible stat to Defense.
    const stat = cfg?.stat ?? config?.stat ?? 'defense';
    setConfig({
      stat,
      gymId: bestUsableGymIdForStat(STATIC_GYMS, stat, ps.stats, ps.xanaxEcstasyTaken, localGate),
      energy: ps.energy.current,
      happy: ps.happy.current,
      ...cfg,
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

  const energyPerDay = useMemo(
    () => (player ? xanaxDailyEnergy(player.energy.maximum) : 0),
    [player],
  );

  const stage = useMemo(
    () => (player ? playerStage(player, prices) : null),
    [player, prices],
  );

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
              inJail: player.inJail === true,
            }
          : undefined),
      config: config ?? undefined,
      modifiers,
    }),
    [manual, player, config, modifiers, unlockedGymId],
  );

  // Keep the address bar pasteable at all times, without polluting history.
  useEffect(() => {
    if (player && !isDemo) syncUrl(shared, route);
  }, [player, shared, isDemo, route]);

  // Aquí NO va un noindex por ruta, y es deliberado. Las cuatro rutas
  // profundas se reescriben a index.html (vercel.json), que sirve
  // <link rel="canonical" href="https://torntraining.com/">. Esa canónica ya
  // consolida las cinco URLs en la home. Añadir además noindex mezcla dos
  // señales que Google documenta como contradictorias sobre la misma URL, y
  // en el peor caso el noindex se propaga al destino canónico, que es
  // precisamente la página que sí queremos indexada.

  const setMod = (stat: StatKey, value: number) => setModifiers((m) => ({ ...m, [stat]: value }));
  const detectMods = () => {
    if (player?.detectedModifiers) setModifiers(player.detectedModifiers);
  };

  const go = (r: Route) => {
    // Same guard as syncUrl above: the sample player's stats must never end up
    // in the address bar, or reloading that link presents them as the
    // visitor's own (readSharedState finds a `manual`, so isDemo stays false
    // and the "Sample player" banner is gone).
    navigate(r, isDemo ? {} : shared);
    setRoute(r);
    window.scrollTo(0, 0);
  };

  // Construido dentro del if, no en la guarda `&&` del JSX: TS solo estrecha
  // player/gyms/config/stage a no-nulos dentro del mismo bloque que los revisa.
  let routeSection: JSX.Element | null = null;
  if (player && gyms && config && stage) {
    const routeProps = {
      gyms, player, modifiers, gate, config, prices, energyPerDay, stage,
      unlockedGymId,
      onConfig: patchConfig,
      onUnlockedGym: setUnlockedGymId,
      onMod: setMod,
      onDetect: detectMods,
    };
    routeSection = (
      <>
        {!isDemo && (
          <ShareBar
            gyms={gyms}
            player={player}
            modifiers={modifiers}
            gate={gate}
            energyPerDay={energyPerDay}
            shared={shared}
            route={route}
          />
        )}
        {route !== '/' && (
          <AnswerBar
            gyms={gyms}
            player={player}
            modifiers={modifiers}
            gate={gate}
            energyPerDay={energyPerDay}
          />
        )}
        <Nav route={route} stage={stage} onNavigate={go} />
        {route === '/' && <Plan {...routeProps} />}
        {route === '/build' && <Build {...routeProps} />}
        {route === '/compare' && <Compare {...routeProps} />}
        {route === '/cost' && <Cost {...routeProps} />}
        {route === '/progress' && <Progress {...routeProps} />}
      </>
    );
  }

  return (
    <div className="app">
      <header className="masthead">
        {/* La keyword principal vive en el H1, no solo en el shell SSR de
            index.html. React sustituye ese shell al montar, así que el H1 que
            Google indexa es este; sin la segunda línea el H1 renderizado se
            quedaba en "Torn Training Optimizer" y perdía "Torn gym calculator",
            que es el término por el que se busca la herramienta. */}
        <h1>
          Torn <span className="mark">Training</span> Optimizer
          <span className="h1-sub">the free Torn gym calculator</span>
        </h1>
        <p className="tagline">
          Exact gains per train, happy jump vs energy training, best gym and unlock targets for
          every battle stat.
        </p>
      </header>

      <main>
        <YourData
          apiKey={apiKey}
          onApiKey={setApiKey}
          loading={loading}
          onLoad={load}
          error={error}
          onManual={(d) => {
            setIsDemo(false);
            loadManual(d);
          }}
        />

        {isDemo && (
          <p className="demobar">
            <strong>Sample player.</strong> Everything below is live — the real formula on made-up
            stats. Load your API key above, or <a href="#own-numbers">enter your own numbers</a>, to
            replace it.
          </p>
        )}

        {routeSection}
      </main>

      <footer className="site-footer">
        <nav className="footer-nav">
          <a href="/guide">Gym Training Guide</a>
          <a href="/happy-jump">Happy Jump Calculator</a>
          <a href="/specialist-gyms">Specialist Gyms</a>
          <a href="/gym-dots">Gym Dots Chart</a>
          <a href="/stat-cap">The 50M Stat Cap</a>
          <a href="/gyms">All Gyms</a>
        </nav>
        Unofficial fan-made tool · not affiliated with Torn.com. Your API key stays in your browser
        and is sent only to api.torn.com. Your stats are never stored on any server.
      </footer>
    </div>
  );
}
