// GET /api/cron — Vercel Cron, una vez al día (vercel.json). Guarda el snapshot
// de cada miembro con su propia key. Una key muerta se borra de inmediato, como
// pide la guía de la API de Torn; un error transitorio solo se anota.

import { unseal } from '../src/cloud/crypto.js';
import { isDeadKeyError } from '../src/cloud/tracking.js';
import { env, json, readMe, saveSnapshot, sb } from './_lib.js';

async function track(m: { player_id: number; key_enc: string }) {
  const patch = (body: object) =>
    sb(`members?player_id=eq.${m.player_id}`, { method: 'PATCH', body: JSON.stringify(body) });
  try {
    const me = await readMe(await unseal(env('APP_SECRET'), m.key_enc));
    if (me.error) {
      await patch({ last_error: me.error.error, ...(isDeadKeyError(me.error.code) ? { key_enc: null } : {}) });
      return false;
    }
    await saveSnapshot(me);
    await patch({ name: me.name, faction_id: me.faction?.faction_id || null, last_ok: new Date().toISOString(), last_error: null });
    return true;
  } catch (e) {
    await patch({ last_error: String(e) }).catch(() => {});
    return false;
  }
}

async function handle(req: Request) {
  if (req.headers.get('authorization') !== `Bearer ${env('CRON_SECRET')}`) return json({ error: 'auth' }, 401);

  const members = (await (await sb('members?key_enc=not.is.null&select=player_id,key_enc')).json()) as {
    player_id: number;
    key_enc: string;
  }[];
  let ok = 0;
  // ponytail: tandas de 10 en paralelo dentro de una sola invocación (~1.000
  // miembros por minuto). Si crece más, partir por rangos de player_id.
  for (let i = 0; i < members.length; i += 10) {
    const done = await Promise.all(members.slice(i, i + 10).map(track));
    ok += done.filter(Boolean).length;
  }
  return json({ members: members.length, ok });
}

export default { fetch: handle };
