import { AlertSnapshot } from '../../src/engine/alerts';

const BASE = 'https://api.torn.com';

export interface Snapshot extends AlertSnapshot {
  playerId: number;
  factionId: number | null;
}

// Field names per v1 user selections; isolated here so they are easy to fix if
// the API differs (cooldowns.drug/booster, education_timeleft). `profile` is
// public and only adds who you are, for the Pro check.
export async function fetchSnapshot(key: string): Promise<Snapshot> {
  const url = `${BASE}/user/?selections=bars,cooldowns,education,profile&key=${encodeURIComponent(
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
    boosterCooldown: d.cooldowns?.booster ?? undefined,
    educationTimeLeft: d.education_timeleft ?? null,
    now: Date.now(),
    playerId: d.player_id,
    factionId: d.faction?.faction_id || null,
  };
}

export interface ProStatus {
  pro: boolean;
  expires: string | null;
  at: number;
}

/** Pro status from torntraining.com, at most once an hour. Errors keep the last known value. */
export async function proStatus(playerId: number, factionId: number | null): Promise<ProStatus | null> {
  const { pro } = (await chrome.storage.local.get('pro')) as { pro?: ProStatus & { id: number } };
  if (pro && pro.id === playerId && Date.now() - pro.at < 3_600_000) return pro;
  try {
    const res = await fetch(
      `https://torntraining.com/api/pro?id=${playerId}${factionId ? `&faction=${factionId}` : ''}`,
    );
    const s = (await res.json()) as { pro: boolean; expires: string | null };
    const next = { ...s, at: Date.now(), id: playerId };
    await chrome.storage.local.set({ pro: next });
    return next;
  } catch {
    return pro ?? null;
  }
}
