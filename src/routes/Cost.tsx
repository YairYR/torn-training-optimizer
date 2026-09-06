import { Economics } from '../components/Economics';
import { Optimizer } from '../components/Optimizer';
import { SessionSimulator } from '../components/SessionSimulator';
import { RouteProps } from './types';

export function Cost(p: RouteProps) {
  return (
    <>
      {!p.stage.hasPrices && (
        <p className="footnote">
          These figures need live market prices. Load your API key above — any
          key works, prices are public.
        </p>
      )}
      <Economics
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers[p.config.stat]}
        config={p.config}
        prices={p.prices}
      />
      <Optimizer
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers[p.config.stat]}
        config={p.config}
        prices={p.prices}
      />
      <SessionSimulator
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers[p.config.stat]}
        config={p.config}
        onConfig={p.onConfig}
      />
    </>
  );
}
