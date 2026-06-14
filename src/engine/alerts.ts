// Anti-waste alert rules (spec §10). Pure and stateless: it reports which
// conditions are currently true for a snapshot. Transition detection / dedupe
// (notify once when a condition turns on) is the caller's job (the extension).
// Reusable by an MV3 extension or a Discord bot.

export type AlertId =
  | 'energyOverflow'
  | 'happyJumped'
  | 'drugReady'
  | 'educationDone'
  | 'lowHappyHighEnergy';

export interface AlertSnapshot {
  energy: { current: number; maximum: number };
  happy: { current: number; maximum: number };
  drugCooldown: number; // seconds remaining
  educationTimeLeft: number | null; // seconds; 0/null = not studying
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
  },
};

export function evaluateAlerts(s: AlertSnapshot, cfg: AlertConfig): Alert[] {
  const out: Alert[] = [];
  const on = (id: AlertId) => cfg.enabled[id] !== false;

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
      message: `${s.happy.current} happy — train now before it decays.`,
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

  return out;
}
