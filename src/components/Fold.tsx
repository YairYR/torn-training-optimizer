import { ReactNode, useState } from 'react';

interface Props {
  label: string;
  hint?: string;
  /** Open on first paint. Use for the one or two panels most people want. */
  open?: boolean;
  children: ReactNode;
}

/**
 * Collapses a secondary panel behind a header.
 *
 * The tool grew to a dozen stacked panels, which buries the answer most people
 * came for. Native <details> does the layout and gives keyboard and
 * screen-reader behaviour for free.
 *
 * Children are mounted on first open rather than up front. That is not an
 * optimisation detail — it is load-bearing:
 *   1. Recharts measures its container when it mounts. Inside a closed
 *      <details> that measurement is zero, and the chart can come back blank
 *      or one pixel wide.
 *   2. It keeps a dozen panels' worth of nodes out of the initial DOM, and
 *      lets the chart panels be code-split (see App.tsx) so recharts is not in
 *      the first payload.
 * Once opened, the subtree stays mounted, so its state survives collapsing.
 *
 * Trade-off: collapsed panels are no longer in the DOM for crawlers. That is
 * fine here — search traffic is carried by the prerendered shell in
 * index.html and the generated pages under /gyms/, not by these panels, which
 * only ever render once a player is loaded.
 */
export function Fold({ label, hint, open, children }: Props) {
  const [mounted, setMounted] = useState(!!open);
  return (
    <details
      className="fold"
      open={open}
      onToggle={(e) => e.currentTarget.open && setMounted(true)}
    >
      <summary>
        <span className="fold-label">{label}</span>
        {hint && <span className="fold-hint">{hint}</span>}
      </summary>
      {mounted && children}
    </details>
  );
}
