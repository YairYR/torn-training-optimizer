import { StatKey } from './engine/types';

export interface SessionConfig {
  stat: StatKey;
  gymId: string;
  energy: number;
  happy: number;
}
