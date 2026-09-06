import { PlayerState, STAT_KEYS } from './types';
import { Prices } from './cost-model';
import { Regime, trainingRegime } from './training-method';
import { BUILD_PRESETS, evaluateBuildRatio } from './build-ratio';

/**
 * En qué etapa del juego está el jugador, para que la interfaz muestre solo lo
 * que le aplica. Se deriva una vez en App y baja por props: la alternativa es
 * que cinco componentes recalculen lo mismo y se desincronicen.
 */
export interface Stage {
  /** Régimen del stat más alto: es el que manda en el consejo de método. */
  regime: Regime;
  /**
   * El reparto NO es parejo — el jugador ya renunció a algún stat, que es lo
   * que define tener un build. Falso solo para el jugador balanceado, al que
   * /build le explica la decisión en vez de mostrarle un tracker de ratio.
   */
  hasBuild: boolean;
  /** Tiene build pero no encaja con ningún preset: badge en el nav de /build. */
  offRatio: boolean;
  /** Hay precios de mercado cargados; sin esto /cost no puede calcular. */
  hasPrices: boolean;
}

export function playerStage(player: PlayerState, prices: Prices | null): Stage {
  const top = Math.max(...STAT_KEYS.map((s) => player.stats[s]));
  const regime = trainingRegime(top).regime;

  // BUILD_PRESETS[0] es 'balanced' = 1:1:1:1, o sea "ningún build": encajar
  // con ÉL es exactamente lo contrario de tener un build. Contarlo entre los
  // presets hacía que hasBuild fuera verdadero solo para el jugador parejo y
  // falso para todos los demás, justo al revés de lo que consume /build.
  // evaluateBuildRatio ya aplica la tolerancia de ±1 punto porcentual.
  const even = evaluateBuildRatio(player.stats, BUILD_PRESETS[0].weights).onTrack;
  const onSpecialist = BUILD_PRESETS.slice(1).some(
    (p) => evaluateBuildRatio(player.stats, p.weights).onTrack,
  );

  return {
    regime,
    hasBuild: !even,
    offRatio: !even && !onSpecialist,
    hasPrices: prices != null,
  };
}
