import { Gym, PlayerState } from '../engine/types';
import { normalizeGyms, normalizePlayer, RawGym, RawUser } from './normalize';

const BASE = 'https://api.torn.com';
const COMMENT = 'TrainingOptimizer';

interface ApiError {
  error?: { code: number; error: string };
}

async function call<T>(path: string, key: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${BASE}${path}${sep}key=${encodeURIComponent(key)}&comment=${COMMENT}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error('Network error reaching the Torn API. Check your connection.');
  }
  if (!res.ok) throw new Error(`Torn API returned HTTP ${res.status}.`);
  const data = (await res.json()) as T & ApiError;
  if (data.error) throw new Error(`Torn API error ${data.error.code}: ${data.error.error}`);
  return data;
}

/** Requires a key with battlestats access (Limited or Full). */
export async function fetchPlayer(key: string): Promise<PlayerState> {
  const data = await call<RawUser>('/user/?selections=battlestats,bars,personalstats,perks,gym', key);
  return normalizePlayer(data);
}

/** Public selection — any key works. */
export async function fetchGyms(key: string): Promise<Gym[]> {
  const data = await call<{ gyms: Record<string, RawGym> }>('/torn/?selections=gyms', key);
  return normalizeGyms(data.gyms);
}
