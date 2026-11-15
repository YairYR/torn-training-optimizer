import { useCallback, useEffect, useState } from 'react';
import { track } from '../analytics';

export interface ProStatus {
  pro: boolean;
  expires: string | null;
}

/**
 * Estado Pro de un jugador. Sin ID (entrada manual) no hay forma de verificar,
 * y devuelve null. El resultado se cachea una hora en localStorage para no
 * llamar a la función en cada visita; `recheck` lo salta tras donar.
 */
export function usePro(playerId: number | null | undefined, factionId?: number | null) {
  const [status, setStatus] = useState<ProStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const cacheKey = `tto-pro-${playerId}-${factionId ?? 0}`;

  const check = useCallback(
    async (force: boolean) => {
      if (!playerId) return setStatus(null);
      try {
        const hit = JSON.parse(localStorage.getItem(cacheKey) ?? 'null') as (ProStatus & { at: number }) | null;
        if (!force && hit && Date.now() - hit.at < 3_600_000) return setStatus(hit);
      } catch {
        /* storage bloqueado: se consulta igual */
      }
      setChecking(true);
      try {
        const res = await fetch(`/api/pro?id=${playerId}${factionId ? `&faction=${factionId}` : ''}`);
        if (!res.ok) return;
        const s = (await res.json()) as ProStatus;
        setStatus(s);
        if (force && s.pro) track('pro_unlocked');
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ ...s, at: Date.now() }));
        } catch {
          /* idem */
        }
      } finally {
        setChecking(false);
      }
    },
    [playerId, factionId, cacheKey],
  );

  useEffect(() => {
    void check(false);
  }, [check]);

  return { status, checking, recheck: () => check(true) };
}
