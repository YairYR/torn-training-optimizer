// Supporter Pro: 1 Xanax enviado al personaje del autor = 30 días de Pro.
//
// Compartido entre la función de Vercel (api/pro.ts), que lee los eventos de
// Torn y guarda las donaciones, y la app, que solo consulta el vencimiento.
// Lógica pura y sin red: es la parte que tiene tests.

export const RECIPIENT_ID = 2885363;
export const DAYS_PER_XANAX = 30;
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
