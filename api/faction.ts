// GET /api/faction (Bearer token) → dashboard de la facción del jugador.
//
// 403 si no es líder ni co-líder (verificado con la API de Torn y su propia key),
// 402 si la facción no tiene el pase activo. Solo aparecen los miembros actuales
// de la facción que eligieron compartir sus stats con la dirigencia.

import { unseal } from '../src/cloud/crypto.js';
import { proExpiry, Credit } from '../src/pro/entitlement.js';
import { summarize, utcDay, SnapshotRow } from '../src/cloud/tracking.js';
import { appSecret, json, sb, sessionOf, torn } from './_lib.js';

interface FactionBasic {
  ID: number;
  name: string;
  leader: number;
  'co-leader': number;
  members: Record<string, { name: string }>;
}

async function handle(req: Request) {
  const id = await sessionOf(req);
  if (!id) return json({ error: 'session' }, 401);

  const [me] = (await (await sb(`members?player_id=eq.${id}&select=key_enc`)).json()) as { key_enc: string | null }[];
  if (!me?.key_enc) return json({ error: 'not tracked' }, 404);

  const f = await torn<FactionBasic>('/faction/?selections=basic', await unseal(appSecret(), me.key_enc));
  if (f.error || !f.ID) return json({ error: 'no faction' }, 403);
  if (f.leader !== id && f['co-leader'] !== id) return json({ error: 'leader only', faction: f.name }, 403);

  const credits = (await (await sb(`donations?faction_id=eq.${f.ID}&select=player_id,faction_id,qty,ts`)).json()) as Credit[];
  const expires = proExpiry(credits, 0, f.ID);
  if (expires * 1000 <= Date.now()) return json({ error: 'faction pass', faction: f.name, factionId: f.ID }, 402);

  // La lista de miembros de Torn manda: un ex miembro con opt-in no aparece.
  const ids = Object.keys(f.members);
  const shared = (await (
    await sb(`members?player_id=in.(${ids.join(',')})&share_faction=eq.true&select=player_id`)
  ).json()) as { player_id: number }[];
  const since = utcDay(new Date(Date.now() - 30 * 86_400_000));
  const rows: SnapshotRow[] = shared.length
    ? await (
        await sb(
          `snapshots?player_id=in.(${shared.map((m) => m.player_id).join(',')})&day=gte.${since}&select=player_id,day,strength,defense,speed,dexterity`,
        )
      ).json()
    : [];
  const names = Object.fromEntries(Object.entries(f.members).map(([pid, m]) => [Number(pid), m.name]));

  return json({
    faction: { id: f.ID, name: f.name },
    expires: new Date(expires * 1000).toISOString(),
    memberCount: ids.length,
    members: summarize(rows, names),
  });
}

export default { fetch: handle };
