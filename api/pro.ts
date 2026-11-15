// GET /api/pro?id=<torn player id>[&faction=<faction id>]  →  { pro, expires }
//
// Lee los eventos de la cuenta del autor con una key Limited (TORN_KEY), acredita
// cada "You were sent Nx Xanax" en Supabase y devuelve el vencimiento del Pro de
// ese jugador. La key del usuario nunca llega aquí: la app manda solo su ID.
//
// Variables de entorno (Vercel → Settings → Environment Variables):
//   TORN_KEY             key Limited de la cuenta que recibe los Xanax
//   SUPABASE_URL         https://<ref>.supabase.co
//   SUPABASE_SECRET_KEY  secret key del proyecto (no la publishable)

import { parseDonation, proExpiry, Credit, Donation, XANAX_PER_FACTION_MONTH } from '../src/pro/entitlement.js'; // ESM en Node exige la extensión

// Sin @types/node por una sola línea: el runtime de Vercel ya trae process.
declare const process: { env: Record<string, string | undefined> };
const env = (k: string) => process.env[k] ?? '';

function sb(path: string, init: RequestInit = {}) {
  const key = env('SUPABASE_SECRET_KEY');
  return fetch(`${env('SUPABASE_URL')}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  });
}

interface TornEvents {
  events?: Record<string, { timestamp: number; event: string }>;
  error?: { code: number; error: string };
}

/** Facción actual de un jugador (perfil público). null si no tiene o si falla. */
async function factionOf(playerId: number): Promise<number | null> {
  try {
    const r = (await (
      await fetch(`https://api.torn.com/user/${playerId}?selections=profile&key=${env('TORN_KEY')}&comment=TrainingOptimizer`)
    ).json()) as { faction?: { faction_id?: number } };
    return r.faction?.faction_id || null;
  } catch {
    return null;
  }
}

/**
 * Trae los eventos nuevos como mucho una vez por minuto, sea cual sea el tráfico:
 * la key del autor tiene 100 llamadas/min y la comparte con su propio juego.
 */
async function sync() {
  const [state] = (await (await sb('sync_state?id=eq.1&select=last_ts,synced_at')).json()) as {
    last_ts: number;
    synced_at: string;
  }[];
  if (!state || Date.now() - Date.parse(state.synced_at) < 60_000) return;
  await sb('sync_state?id=eq.1', { method: 'PATCH', body: JSON.stringify({ synced_at: new Date().toISOString() }) });

  const rows: Donation[] = [];
  let newest = state.last_ts;
  let to = '';
  // ponytail: la API devuelve como mucho 100 eventos por llamada, los más
  // recientes del rango; se pagina hacia atrás con `to`. 5 páginas = 500
  // eventos por minuto de margen, de sobra para una cuenta normal.
  for (let page = 0; page < 5; page++) {
    const res = (await (
      await fetch(
        `https://api.torn.com/user/?selections=events&from=${state.last_ts + 1}${to}&key=${env('TORN_KEY')}&comment=TrainingOptimizer`,
      )
    ).json()) as TornEvents;
    if (res.error) throw new Error(`Torn API ${res.error.code}: ${res.error.error}`);
    const events = Object.entries(res.events ?? {});
    for (const [id, e] of events) {
      newest = Math.max(newest, e.timestamp);
      const d = parseDonation(id, e);
      if (d) rows.push(d);
      else if (/xanax/i.test(e.event) && /sent/i.test(e.event)) console.warn('pro: unparsed Xanax event', id, e.event);
    }
    if (events.length < 100) break;
    to = `&to=${Math.min(...events.map(([, e]) => e.timestamp))}`;
  }

  if (rows.length) {
    const credits = await Promise.all(
      rows.map(async (d) => ({
        event_id: d.eventId,
        player_id: d.playerId,
        qty: d.qty,
        ts: d.ts,
        // La facción se fija al momento del envío: si el remitente cambia
        // después, el pase se queda con la facción que pagó.
        faction_id: d.qty >= XANAX_PER_FACTION_MONTH ? await factionOf(d.playerId) : null,
      })),
    );
    await sb('donations?on_conflict=event_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify(credits),
    });
  }
  if (newest > state.last_ts) {
    await sb('sync_state?id=eq.1', { method: 'PATCH', body: JSON.stringify({ last_ts: newest }) });
  }
}

async function handle(request: Request) {
  const q = new URL(request.url).searchParams;
  const id = Number(q.get('id'));
  const faction = Number(q.get('faction')) || null;
  if (!Number.isInteger(id) || id <= 0 || (faction != null && !Number.isInteger(faction))) {
    return Response.json({ error: 'id' }, { status: 400 });
  }

  // Un fallo de Torn o de la sincronización no debe negar el Pro ya pagado:
  // se registra y se responde con lo que ya está guardado.
  await sync().catch((e) => console.error('pro: sync failed', e));

  const who = faction ? `or=(player_id.eq.${id},faction_id.eq.${faction})` : `player_id=eq.${id}`;
  const res = await sb(`donations?${who}&select=player_id,faction_id,qty,ts`);
  if (!res.ok) return Response.json({ error: 'storage' }, { status: 502 });
  const expires = proExpiry((await res.json()) as Credit[], id, faction);

  return Response.json(
    { pro: expires * 1000 > Date.now(), expires: expires ? new Date(expires * 1000).toISOString() : null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

// Firma Web documentada por Vercel para funciones en /api fuera de Next.js.
export default { fetch: handle };
