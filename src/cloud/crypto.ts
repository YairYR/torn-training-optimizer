// Cifrado de keys de Torn y sesión sin cuentas, con WebCrypto (Node y navegador).
// Un solo secreto de entorno (APP_SECRET); de él se derivan, por etiqueta, la
// clave AES-GCM de las keys y la clave HMAC de las sesiones.

const te = new TextEncoder();
const b64 = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

async function derive(secret: string, usage: 'enc' | 'mac') {
  const raw = await crypto.subtle.digest('SHA-256', te.encode(`tto-${usage}:${secret}`));
  return usage === 'enc'
    ? crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
    : crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** Cifra texto: "iv.ciphertext" en base64url. */
export async function seal(secret: string, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await derive(secret, 'enc'), te.encode(text));
  return `${b64(iv)}.${b64(ct)}`;
}

export async function unseal(secret: string, sealed: string): Promise<string> {
  const [iv, ct] = sealed.split('.').map(unb64);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, await derive(secret, 'enc'), ct);
  return new TextDecoder().decode(pt);
}

/** Token de sesión "playerId.firma". No caduca: se revoca borrando al miembro. */
export async function signSession(secret: string, playerId: number): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await derive(secret, 'mac'), te.encode(String(playerId)));
  return `${playerId}.${b64(sig)}`;
}

/** Player id del token, o null si la firma no es válida. Comparación en tiempo constante. */
export async function verifySession(secret: string, token: string | null): Promise<number | null> {
  const [id, sig] = (token ?? '').split('.');
  if (!/^\d+$/.test(id ?? '') || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await derive(secret, 'mac'), unb64(sig), te.encode(id));
    return ok ? Number(id) : null;
  } catch {
    return null;
  }
}
