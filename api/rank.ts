// GET /api/rank (Bearer token) → posición del jugador en su facción, entre los
// miembros que comparten. Solo agregados (puesto y mediana), nunca números de
// otro jugador, y solo con 5+ miembros compartiendo. Pro.
//
// 403 si el jugador no comparte (reciprocidad), 402 si no tiene Pro.

import { proExpiry, Credit } from '../src/pro/entitlement.js';
import { factionRank, summarize, utcDay, SnapshotRow, MIN_SHARERS } from '../src/cloud/tracking.js';
import { json, sb, sessionOf } from './_lib.js';

async function handle(req: Request) {
  const id = await sessionOf(req);
  if (!id) return json({ error: 'session' }, 401);

  const [me] = (await (await sb(`members?player_id=eq.${id}&select=faction_id,share_faction`)).json()) as {
    faction_id: number | null;
    share_faction: boolean;
  }[];
  if (!me) return json({ error: 'not tracked' }, 404);
  if (!me.faction_id) return json({ error: 'no faction' }, 404);
  if (!me.share_faction) return json({ error: 'share' }, 403);

  const sharers = (await (
    await sb(`members?faction_id=eq.${me.faction_id}&share_faction=eq.true&select=player_id`)
  ).json()) as { player_id: number }[];

  const who = `or=(player_id.eq.${id},faction_id.eq.${me.faction_id})`;
  const credits = (await (await sb(`donations?${who}&select=player_id,faction_id,qty,ts`)).json()) as Credit[];
  if (proExpiry(credits, id, me.faction_id) * 1000 <= Date.now()) {
    return json({ error: 'pro', sharers: sharers.length, needed: MIN_SHARERS }, 402);
  }

  const since = utcDay(new Date(Date.now() - 30 * 86_400_000));
  const rows: SnapshotRow[] = await (
    await sb(
      `snapshots?player_id=in.(${sharers.map((m) => m.player_id).join(',')})&day=gte.${since}&select=player_id,day,strength,defense,speed,dexterity`,
    )
  ).json();
  const rank = factionRank(summarize(rows, {}), id);
  return json(rank ?? { sharers: sharers.length, needed: MIN_SHARERS });
}

export default { fetch: handle };
