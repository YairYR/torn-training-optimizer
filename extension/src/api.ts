import { AlertSnapshot } from '../../src/engine/alerts';

const BASE = 'https://api.torn.com';

// Field names per v1 user selections; isolated here so they are easy to fix if
// the API differs (cooldowns.drug, education_timeleft). [VALIDAR against live]
export async function fetchSnapshot(key: string): Promise<AlertSnapshot> {
  const url = `${BASE}/user/?selections=bars,cooldowns,education&key=${encodeURIComponent(
    key,
  )}&comment=TrainingAlerts`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(`${d.error.code}: ${d.error.error}`);
  return {
    energy: { current: d.energy.current, maximum: d.energy.maximum },
    happy: { current: d.happy.current, maximum: d.happy.maximum },
    drugCooldown: d.cooldowns?.drug ?? 0,
    educationTimeLeft: d.education_timeleft ?? null,
  };
}
