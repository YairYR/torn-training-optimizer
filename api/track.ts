// POST   /api/track  { key, share }  → alta o actualización del seguimiento diario; { token, playerId }
// DELETE /api/track  (Bearer token)  → baja: borra al miembro, su key y todo su historial
//
// La key solo se acepta para leer los stats propios. Se guarda cifrada
// (AES-GCM, APP_SECRET) y la usa únicamente el cron diario.

import { seal, signSession } from '../src/cloud/crypto.js';
import { appSecret, json, readMe, saveSnapshot, sb, sessionOf } from './_lib.js';

async function handle(req: Request) {
  if (req.method === 'DELETE') {
    const id = await sessionOf(req);
    if (!id) return json({ error: 'session' }, 401);
    await sb(`members?player_id=eq.${id}`, { method: 'DELETE' }); // snapshots: on delete cascade
    return json({ deleted: true });
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const { key, share } = (await req.json().catch(() => ({}))) as { key?: string; share?: boolean };
  if (!key || !/^[A-Za-z0-9]{16}$/.test(key)) return json({ error: 'A 16-character Torn API key is required.' }, 400);

  const me = await readMe(key);
  if (me.error) return json({ error: `Torn API error ${me.error.code}: ${me.error.error}` }, 400);

  const up = await sb('members?on_conflict=player_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      player_id: me.player_id,
      name: me.name,
      faction_id: me.faction?.faction_id || null,
      key_enc: await seal(appSecret(), key),
      share_faction: share === true,
      last_ok: new Date().toISOString(),
      last_error: null,
    }),
  });
  if (!up.ok) return json({ error: 'storage' }, 502);
  await saveSnapshot(me);

  return json({ token: await signSession(appSecret(), me.player_id), playerId: me.player_id });
}

export default { fetch: handle };
