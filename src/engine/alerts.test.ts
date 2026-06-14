import { describe, it, expect } from 'vitest';
import { evaluateAlerts, AlertSnapshot, DEFAULT_ALERT_CONFIG } from './alerts';

const snap: AlertSnapshot = {
  energy: { current: 50, maximum: 150 },
  happy: { current: 5025, maximum: 5025 },
  drugCooldown: 3600,
  educationTimeLeft: 1000,
};

const cfg = DEFAULT_ALERT_CONFIG;

describe('evaluateAlerts', () => {
  it('is quiet for a neutral snapshot', () => {
    expect(evaluateAlerts(snap, cfg)).toHaveLength(0);
  });

  it('fires energy overflow near max', () => {
    const ids = evaluateAlerts({ ...snap, energy: { current: 145, maximum: 150 } }, cfg).map((a) => a.id);
    expect(ids).toContain('energyOverflow');
  });

  it('fires happy jumped when happy exceeds max', () => {
    const ids = evaluateAlerts({ ...snap, happy: { current: 99_999, maximum: 5025 } }, cfg).map((a) => a.id);
    expect(ids).toContain('happyJumped');
  });

  it('fires drug ready when cooldown is 0 and energy not full', () => {
    const ids = evaluateAlerts({ ...snap, drugCooldown: 0 }, cfg).map((a) => a.id);
    expect(ids).toContain('drugReady');
  });

  it('does not fire drug ready when energy is full', () => {
    const ids = evaluateAlerts(
      { ...snap, drugCooldown: 0, energy: { current: 150, maximum: 150 } },
      cfg,
    ).map((a) => a.id);
    expect(ids).not.toContain('drugReady');
  });

  it('respects disabled rules', () => {
    const disabled = { ...cfg, enabled: { ...cfg.enabled, energyOverflow: false } };
    const ids = evaluateAlerts({ ...snap, energy: { current: 150, maximum: 150 } }, disabled).map((a) => a.id);
    expect(ids).not.toContain('energyOverflow');
  });

  it('fires low-happy/high-energy only when enabled', () => {
    const s: AlertSnapshot = { ...snap, happy: { current: 1000, maximum: 5025 }, energy: { current: 500, maximum: 150 } };
    expect(evaluateAlerts(s, cfg).map((a) => a.id)).not.toContain('lowHappyHighEnergy');
    const enabled = { ...cfg, enabled: { ...cfg.enabled, lowHappyHighEnergy: true } };
    expect(evaluateAlerts(s, enabled).map((a) => a.id)).toContain('lowHappyHighEnergy');
  });
});
