import { lazy, Suspense } from 'react';
import { Planner } from '../components/Planner';
import { RouteProps } from './types';

const HistoryChart = lazy(() =>
  import('../components/HistoryChart').then((m) => ({ default: m.HistoryChart })),
);
const ProgressTracker = lazy(() =>
  import('../components/ProgressTracker').then((m) => ({ default: m.ProgressTracker })),
);
const Projector = lazy(() =>
  import('../components/Projector').then((m) => ({ default: m.Projector })),
);

const ChartFallback = () => <p className="footnote">Loading chart…</p>;

export function Progress(p: RouteProps) {
  return (
    <>
      <Suspense fallback={<ChartFallback />}>
        <HistoryChart player={p.player} />
        <ProgressTracker
          player={p.player}
          gyms={p.gyms}
          modifiers={p.modifiers}
          gate={p.gate}
        />
        <Projector
          gyms={p.gyms}
          player={p.player}
          modifiers={p.modifiers}
          gate={p.gate}
          config={p.config}
          prices={p.prices}
        />
      </Suspense>
      {/* Planner no es lazy: dentro del Suspense se lo tragaba el fallback y
          la ruta entera quedaba en "Loading chart…" hasta que bajaba el chunk
          de 383 KB del grafico. */}
      <Planner
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers}
        prices={p.prices}
        gate={p.gate}
      />
    </>
  );
}
