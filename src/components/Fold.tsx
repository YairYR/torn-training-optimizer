import { ReactNode } from 'react';

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
 * came for. Native <details> does the whole job: no state, no effect, no
 * animation to get wrong, and it stays keyboard- and screen-reader-accessible
 * for free. Collapsed content is still in the DOM, so it remains crawlable and
 * findable with in-page search.
 *
 * The wrapped panel keeps its own styling; CSS hides its <h2> so the label
 * isn't printed twice.
 */
export function Fold({ label, hint, open, children }: Props) {
  return (
    <details className="fold" open={open}>
      <summary>
        <span className="fold-label">{label}</span>
        {hint && <span className="fold-hint">{hint}</span>}
      </summary>
      {children}
    </details>
  );
}
