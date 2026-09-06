import { Gym, PlayerState, SessionConfig, StatKey } from '../engine/types';
import { GymGate } from '../engine/gym-eligibility';
import { Prices } from '../engine/cost-model';
import { Stage } from '../engine/stage';

/** Todo lo que cualquier ruta puede necesitar. Un solo objeto: los componentes
 *  ya pedían subconjuntos de esto y prop-drilling por separado no compra nada. */
export interface RouteProps {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
  config: SessionConfig;
  prices: Prices | null;
  energyPerDay: number;
  stage: Stage;
  unlockedGymId: number | null;
  onConfig: (patch: Partial<SessionConfig>) => void;
  onUnlockedGym: (id: number) => void;
  onMod: (stat: StatKey, value: number) => void;
  onDetect: () => void;
}
