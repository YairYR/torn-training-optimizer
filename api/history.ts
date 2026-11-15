// GET /api/history (Bearer token) → { member, points } — el historial diario del propio jugador.

import { json, sb, sessionOf } from './_lib.js';

async function handle(req: Request) {
  const id = await sessionOf(req);
  if (!id) return json({ error: 'session' }, 401);

  const [member] = (await (
    await sb(`members?player_id=eq.${id}&select=name,share_faction,created_at,last_ok,last_error`)
  ).json()) as unknown[];
  if (!member) return json({ error: 'not tracked' }, 404);

  const points = await (
    await sb(`snapshots?player_id=eq.${id}&select=player_id,day,strength,defense,speed,dexterity&order=day`)
  ).json();
  return json({ member, points });
}

export default { fetch: handle };
