import { Route, ROUTES } from '../url-state';
import { Stage } from '../engine/stage';

const LABEL: Record<Route, string> = {
  '/': 'Plan',
  '/build': 'Build',
  '/compare': 'Compare',
  '/cost': 'Cost',
  '/progress': 'Progress',
};

interface Props {
  route: Route;
  stage: Stage;
  onNavigate: (r: Route) => void;
}

export function Nav({ route, stage, onNavigate }: Props) {
  return (
    <nav className="nav" aria-label="Sections">
      {ROUTES.map((r) => (
        <button
          key={r}
          type="button"
          className={`nav-tab${r === route ? ' on' : ''}${
            r === '/cost' && !stage.hasPrices ? ' dim' : ''
          }`}
          aria-current={r === route ? 'page' : undefined}
          onClick={() => onNavigate(r)}
        >
          {LABEL[r]}
          {r === '/build' && stage.offRatio && <span className="nav-dot" aria-hidden="true" />}
        </button>
      ))}
    </nav>
  );
}
