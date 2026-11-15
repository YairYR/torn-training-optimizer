import { SnapshotRow, MemberSummary } from './tracking';

// Cliente del seguimiento diario. El token de sesión (no la key) vive en localStorage.

const TOKEN = 'tto.cloud';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN);
  } catch {
    return null;
  }
};
const setToken = (t: string | null) => {
  try {
    if (t) localStorage.setItem(TOKEN, t);
    else localStorage.removeItem(TOKEN);
  } catch {
    /* storage bloqueado: la sesión dura lo que la pestaña */
  }
};
const auth = () => ({ Authorization: `Bearer ${getToken()}` });

export interface TrackedMember {
  name: string;
  share_faction: boolean;
  created_at: string;
  last_ok: string | null;
  last_error: string | null;
}

/** Alta o cambio de preferencias. Lanza con el mensaje del servidor si falla. */
export async function startTracking(key: string, share: boolean): Promise<void> {
  const res = await fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, share }),
  });
  const body = (await res.json()) as { token?: string; error?: string };
  if (!res.ok || !body.token) throw new Error(body.error ?? 'Could not start tracking.');
  setToken(body.token);
}

export async function stopTracking(): Promise<void> {
  await fetch('/api/track', { method: 'DELETE', headers: auth() });
  setToken(null);
}

/** null si no hay seguimiento (o la sesión ya no vale, y entonces se descarta). */
export async function fetchHistory(): Promise<{ member: TrackedMember; points: SnapshotRow[] } | null> {
  if (!getToken()) return null;
  const res = await fetch('/api/history', { headers: auth() });
  if (res.status === 401 || res.status === 404) setToken(null);
  return res.ok ? res.json() : null;
}

export type FactionResult =
  | { status: 200; faction: { id: number; name: string }; expires: string; memberCount: number; members: MemberSummary[] }
  | { status: 402; faction: string; factionId: number }
  | { status: number };

export async function fetchFaction(): Promise<FactionResult | null> {
  if (!getToken()) return null;
  const res = await fetch('/api/faction', { headers: auth() });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

export type RankResult =
  | ({ status: 200 } & import('./tracking').FactionRank)
  | { status: 200 | 402; sharers: number; needed: number }
  | { status: number };

export async function fetchRank(): Promise<RankResult | null> {
  if (!getToken()) return null;
  const res = await fetch('/api/rank', { headers: auth() });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}
