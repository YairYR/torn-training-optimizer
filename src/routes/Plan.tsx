import { SummaryCard } from '../components/SummaryCard';
import { TrainingPlan } from '../components/TrainingPlan';
import { Modifiers } from '../components/Modifiers';
import { standardGyms } from '../engine/gym-eligibility';
import { RouteProps } from './types';

export function Plan(p: RouteProps) {
  return (
    <>
      <SummaryCard gyms={p.gyms} player={p.player} modifiers={p.modifiers} gate={p.gate} />
      <TrainingPlan
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers}
        prices={p.prices}
        gate={p.gate}
        stage={p.stage}
        standardGyms={standardGyms(p.gyms)}
        unlockedGymId={p.unlockedGymId}
        onUnlockedGym={p.onUnlockedGym}
      />
      <Modifiers
        modifiers={p.modifiers}
        detected={p.player.detectedModifiers}
        contributions={p.player.modifierContributions}
        onChange={p.onMod}
        onDetect={p.onDetect}
      />
    </>
  );
}
