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
  /** URL real de cada sección, con el estado del jugador ya en la query. */
  hrefFor: (r: Route) => string;
  onNavigate: (r: Route) => void;
}

/**
 * Anchors, no buttons. Las cinco secciones son URLs de verdad y la gente las
 * pega en hilos de foro y en Discord, así que tienen que soportar clic central,
 * cmd-clic, "copiar dirección del enlace" y ver el destino en la barra de
 * estado. Con <button> no existía nada de eso, y además aria-current="page"
 * sobre un elemento que no navega es semánticamente falso.
 */
export function Nav({ route, stage, hrefFor, onNavigate }: Props) {
  return (
    <nav className="nav" aria-label="Sections">
      {ROUTES.map((r) => (
        <a
          key={r}
          href={hrefFor(r)}
          className={`nav-tab${r === route ? ' on' : ''}${
            r === '/cost' && !stage.hasPrices ? ' dim' : ''
          }`}
          aria-current={r === route ? 'page' : undefined}
          onClick={(e) => {
            // Un clic con modificador, o con un botón que no sea el principal,
            // significa "ábrelo aparte". Eso lo resuelve el navegador mejor que
            // nosotros: solo interceptamos el clic simple.
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
            e.preventDefault();
            onNavigate(r);
          }}
        >
          {LABEL[r]}
          {r === '/build' && stage.offRatio && <span className="nav-dot" aria-hidden="true" />}
        </a>
      ))}
    </nav>
  );
}
