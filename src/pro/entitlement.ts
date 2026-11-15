// Supporter Pro: 1 Xanax enviado al personaje del autor = 30 días de Pro.
//
// Compartido entre la función de Vercel (api/pro.ts), que lee los eventos de
// Torn y guarda las donaciones, y la app, que solo consulta el vencimiento.
// Lógica pura y sin red: es la parte que tiene tests.

export const RECIPIENT_ID = 2885363;
export const DAYS_PER_XANAX = 30;
/** Un solo envío de 30+ Xanax compra 30 días para toda la facción del remitente. */
export const XANAX_PER_FACTION_MONTH = 30;
export const PROFILE_URL = `https://www.torn.com/profiles.php?XID=${RECIPIENT_ID}`;

export interface Donation {
  eventId: string;
  playerId: number;
  qty: number;
  /** Segundos epoch, como los devuelve la API de Torn. */
  ts: number;
}

// ponytail: regex sobre el HTML del evento ("You were sent 2x Xanax from
// <a href=...XID=123>"). Si Torn cambia el texto deja de acreditar en silencio;
// api/pro.ts registra cualquier evento con "Xanax" que no case, para verlo en
// los logs de Vercel.
// Texto real (nov 2026): un Xanax llega como "some Xanax", varios como "2x Xanax".
const SENT = /You were sent (?:(\d+)\s*x\s*|an? |some )?Xanax\b[\s\S]*?XID=(\d+)/i;

export function parseDonation(eventId: string, e: { timestamp: number; event: string }): Donation | null {
  const m = SENT.exec(e.event);
  if (!m) return null;
  return { eventId, playerId: Number(m[2]), qty: m[1] ? Number(m[1]) : 1, ts: e.timestamp };
}

/**
 * Vencimiento en segundos epoch, o 0 si nunca donó. Las donaciones se encadenan:
 * pagar antes de vencer extiende desde el vencimiento vigente, no desde hoy, así
 * que adelantarse nunca pierde días.
 */
export function expiryOf(donations: Pick<Donation, 'qty' | 'ts'>[]): number {
  const DAY = 86_400;
  return [...donations]
    .sort((a, b) => a.ts - b.ts)
    .reduce((exp, d) => Math.max(exp, d.ts) + d.qty * DAYS_PER_XANAX * DAY, 0);
}

/** Una fila de `donations`: faction_id solo viene en envíos de 30+ Xanax. */
export interface Credit {
  player_id: number;
  faction_id: number | null;
  qty: number;
  ts: number;
}

/**
 * Vencimiento para un jugador: el más tardío entre sus envíos propios y los pases
 * de facción que compró cualquiera de su facción. En un envío de facción, cada
 * bloque de 30 va a la facción y el resto (qty % 30) al remitente.
 */
export function proExpiry(rows: Credit[], playerId: number, factionId: number | null): number {
  const N = XANAX_PER_FACTION_MONTH;
  const own = rows
    .filter((r) => r.player_id === playerId)
    .map((r) => ({ ts: r.ts, qty: r.faction_id ? r.qty % N : r.qty }));
  const faction = factionId
    ? rows.filter((r) => r.faction_id === factionId).map((r) => ({ ts: r.ts, qty: Math.floor(r.qty / N) }))
    : [];
  const live = (xs: { ts: number; qty: number }[]) => xs.filter((x) => x.qty > 0);
  return Math.max(expiryOf(live(own)), expiryOf(live(faction)));
}
