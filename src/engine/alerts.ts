// Anti-waste alert rules (spec §10). Pure and stateless: it reports which
// conditions are currently true for a snapshot. Transition detection / dedupe
// (notify once when a condition turns on) is the caller's job (the extension).
// Reusable by an MV3 extension or a Discord bot.

export type AlertId =
  | 'energyOverflow'
  | 'happyJumped'
  | 'drugReady'
  | 'educationDone'
  | 'lowHappyHighEnergy'
  // Pro (Supporter): solo se evalúan con pro = true.
  | 'boosterReady'
  | 'jumpReady'
  | 'happyResetSoon';

export const PRO_ALERTS: AlertId[] = ['boosterReady', 'jumpReady', 'happyResetSoon'];

export interface AlertSnapshot {
  energy: { current: number; maximum: number };
  happy: { current: number; maximum: number };
  drugCooldown: number; // seconds remaining
  educationTimeLeft: number | null; // seconds; 0/null = not studying
  /** Seconds left on the booster cooldown (eDVDs, Ecstasy). Pro alerts only. */
  boosterCooldown?: number;
  /** Epoch ms of the snapshot, for the quarter-hour happy reset. Pro alerts only. */
  now?: number;
}

export interface AlertConfig {
  energyOverflowMargin: number; // alert when current >= max - margin
  lowHappyThreshold: number;
  highEnergyForLowHappy: number;
  enabled: Record<AlertId, boolean>;
}

export interface Alert {
  id: AlertId;
  title: string;
  message: string;
}

export const DEFAULT_ALERT_CONFIG: AlertConfig = {
  energyOverflowMargin: 10,
  lowHappyThreshold: 4000,
  highEnergyForLowHappy: 100,
  enabled: {
    energyOverflow: true,
    happyJumped: true,
    drugReady: true,
    educationDone: false,
    lowHappyHighEnergy: false,
    boosterReady: true,
    jumpReady: true,
    happyResetSoon: true,
  },
};

/** Minutes until the next xx:00/15/30/45, when boosted happy resets to max. */
export const minutesToHappyReset = (nowMs: number) => 15 - (Math.floor(nowMs / 60_000) % 15);

export function evaluateAlerts(s: AlertSnapshot, cfg: AlertConfig, pro = false): Alert[] {
  const out: Alert[] = [];
  const on = (id: AlertId) => cfg.enabled[id] !== false && (pro || !PRO_ALERTS.includes(id));

  if (on('energyOverflow') && s.energy.current >= s.energy.maximum - cfg.energyOverflowMargin) {
    out.push({
      id: 'energyOverflow',
      title: 'Energy almost full',
      message: `${s.energy.current}/${s.energy.maximum} — train before natural regen is wasted.`,
    });
  }

  if (on('happyJumped') && s.happy.current > s.happy.maximum) {
    out.push({
      id: 'happyJumped',
      title: 'Happy is jumped',
      message: `${s.happy.current} happy — train now, it resets to max at the next quarter hour.`,
    });
  }

  if (on('drugReady') && s.drugCooldown <= 0 && s.energy.current < s.energy.maximum) {
    out.push({
      id: 'drugReady',
      title: 'Drug cooldown clear',
      message: 'You can take Xanax to stack energy.',
    });
  }

  if (on('educationDone') && (s.educationTimeLeft == null || s.educationTimeLeft <= 0)) {
    out.push({
      id: 'educationDone',
      title: 'Education idle',
      message: 'No course running — start one (gym-gain courses raise M).',
    });
  }

  if (
    on('lowHappyHighEnergy') &&
    s.happy.current < cfg.lowHappyThreshold &&
    s.happy.current <= s.happy.maximum &&
    s.energy.current >= cfg.highEnergyForLowHappy
  ) {
    out.push({
      id: 'lowHappyHighEnergy',
      title: 'Low happy',
      message: `Happy ${s.happy.current} with ${s.energy.current} energy — boost happy before training.`,
    });
  }

  if (on('boosterReady') && s.boosterCooldown != null && s.boosterCooldown <= 0) {
    out.push({
      id: 'boosterReady',
      title: 'Booster cooldown clear',
      message: 'eDVDs and Ecstasy are usable again.',
    });
  }

  if (
    on('jumpReady') &&
    s.energy.current >= 1000 &&
    s.drugCooldown <= 0 &&
    s.boosterCooldown != null &&
    s.boosterCooldown <= 0
  ) {
    out.push({
      id: 'jumpReady',
      title: 'Ready to happy jump',
      message: `${s.energy.current} energy stacked, drug and booster cooldowns clear. Start just after the next quarter hour.`,
    });
  }

  if (on('happyResetSoon') && s.now != null && s.happy.current > s.happy.maximum) {
    const left = minutesToHappyReset(s.now);
    if (left <= 3) {
      out.push({
        id: 'happyResetSoon',
        title: `Happy resets in ${left} min`,
        message: `Train the rest of your energy now — happy drops back to ${s.happy.maximum}.`,
      });
    }
  }

  return out;
}
