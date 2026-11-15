import { useState } from 'react';
import { PlayerState } from '../engine/types';
import { usePro } from '../pro/usePro';
import { PROFILE_URL, RECIPIENT_ID, XANAX_PER_FACTION_MONTH } from '../pro/entitlement';
import { track } from '../analytics';

const HIDE = 'tto.proBanner';
const WEEK = 7 * 86_400_000;

const hiddenUntil = () => {
  try {
    return Number(localStorage.getItem(HIDE) ?? 0);
  } catch {
    return 0;
  }
};

/**
 * CTA de Pro en todas las pestañas. Líderes y co-líderes (cargo que trae
 * `profile`) ven la oferta de facción mientras su facción no tenga el pase;
 * el resto, la personal mientras no tenga Pro. Se puede ocultar una semana.
 */
export function ProBanner({ player }: { player: PlayerState }) {
  const { status } = usePro(player.playerId, player.factionId);
  const [hidden, setHidden] = useState(() => hiddenUntil() > Date.now());
  const leader = /leader/i.test(player.factionPosition ?? '');
  const variant = leader && !status?.factionPass ? 'faction' : !status?.pro ? 'personal' : null;
  if (hidden || !variant) return null;

  const hide = () => {
    try {
      localStorage.setItem(HIDE, String(Date.now() + WEEK));
    } catch {
      /* sin storage: se oculta solo en esta vista */
    }
    setHidden(true);
    track('pro_banner_hide', { variant });
  };
  const click = () => track('pro_cta_click', { variant, where: 'banner' });

  return (
    <aside className={`pro-banner pro-banner-${variant}`} aria-label="Torn Training Pro">
      {variant === 'faction' ? (
        <p>
          <strong>Lead {player.factionName ?? 'your faction'}?</strong> Send {XANAX_PER_FACTION_MONTH} Xanax in
          one gift and <strong>every member gets Pro for 30 days</strong> — plus a dashboard of everyone&apos;s
          stats, split and 30-day growth for you and your co-leader.
        </p>
      ) : (
        <p>
          <strong>Go Pro for 1 Xanax.</strong> Happy jump ROI at live market prices, with Pro alerts in
          the browser extension coming soon. 30 days, stackable — everything else stays free.
        </p>
      )}
      <div className="pro-banner-actions">
        <a className="pro-banner-cta" href={PROFILE_URL} target="_blank" rel="noopener" onClick={click}>
          Send to [{RECIPIENT_ID}]
        </a>
        <a href="/pro" onClick={click}>
          How it works
        </a>
        <button type="button" className="pro-banner-x" onClick={hide} aria-label="Hide for a week">
          ×
        </button>
      </div>
    </aside>
  );
}
