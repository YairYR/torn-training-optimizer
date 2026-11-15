// Utilidades compartidas por las funciones de /api. El prefijo "_" hace que
// Vercel no lo publique como ruta.

import { verifySession } from '../src/cloud/crypto.js';
import { utcDay } from '../src/cloud/tracking.js';

// Sin @types/node por una sola línea: el runtime de Vercel ya trae process.
declare const process: { env: Record<string, string | undefined> };
export const env = (k: string) => process.env[k] ?? '';

/**
 * Secreto de cifrado y sesiones. Falla cerrado: el repo es público, así que un
 * secreto vacío o corto permitiría a cualquiera falsificar sesiones y descifrar
 * keys guardadas.
 */
export function appSecret(): string {
  const s = env('APP_SECRET');
  if (s.length < 32) throw new Error('APP_SECRET is missing or shorter than 32 characters');
  return s;
}

export function sb(path: string, init: RequestInit = {}) {
  const key = env('SUPABASE_SECRET_KEY');
  return fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  });
}

export type TornError = { error?: { code: number; error: string } };

export async function torn<T>(path: string, key: string): Promise<T & TornError> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`https://api.torn.com${path}${sep}key=${encodeURIComponent(key)}&comment=TrainingOptimizer`);
  return (await res.json()) as T & TornError;
}

/** Player id de la sesión del request (Authorization: Bearer <token>), o null. */
export const sessionOf = (req: Request) =>
  verifySession(appSecret(), req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null);

export interface Me {
  player_id: number;
  name: string;
  faction?: { faction_id?: number };
  strength: number;
  defense: number;
  speed: number;
  dexterity: number;
}

/** Lo que el seguimiento diario lee de cada jugador, con su propia key. */
export const readMe = (key: string) => torn<Me>('/user/?selections=battlestats,profile', key);

export function saveSnapshot(me: Me) {
  return sb('snapshots?on_conflict=player_id,day', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      player_id: me.player_id,
      day: utcDay(),
      strength: Math.round(me.strength),
      defense: Math.round(me.defense),
      speed: Math.round(me.speed),
      dexterity: Math.round(me.dexterity),
    }),
  });
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
