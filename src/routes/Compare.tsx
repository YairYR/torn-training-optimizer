import { GymComparator } from '../components/GymComparator';
import { BuildCompare } from '../components/BuildCompare';
import { RouteProps } from './types';

export function Compare(p: RouteProps) {
  return (
    <>
      <GymComparator gyms={p.gyms} player={p.player} modifiers={p.modifiers} gate={p.gate} config={p.config} />
      <BuildCompare
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers}
        gate={p.gate}
        energyPerDay={p.energyPerDay}
      />
    </>
  );
}
