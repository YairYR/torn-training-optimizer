import { useEffect, useState } from 'react';
import { PlayerState } from '../engine/types';
import { HistoryPoint } from '../engine/history';
import { toHistory } from '../cloud/tracking';
import { fetchHistory, getToken, startTracking, stopTracking, TrackedMember } from '../cloud/client';
import { track } from '../analytics';

interface Props {
  player: PlayerState;
  apiKey: string;
  onHistory: (points: HistoryPoint[]) => void;
}

const fmtDay = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

/** Alta/baja del seguimiento diario en el servidor; entrega los puntos al gráfico. */
export function CloudSync({ player, apiKey, onHistory }: Props) {
  const [member, setMember] = useState<TrackedMember | null>(null);
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const canStart = Boolean(apiKey && player.playerId);

  const load = async () => {
    const h = await fetchHistory();
    setMember(h?.member ?? null);
    setShare(h?.member.share_faction ?? false);
    onHistory(h ? toHistory(h.points) : []);
  };

  useEffect(() => {
    if (getToken()) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      await load();
      setMsg(done);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const start = (nextShare: boolean) =>
    run(async () => {
      await startTracking(apiKey, nextShare);
      track('tracking_started', { share: nextShare ? 1 : 0 });
    }, 'Saved.');

  const stop = () => {
    if (!confirm('Stop daily tracking and delete your stored key and history?')) return;
    void run(async () => {
      await stopTracking();
      track('tracking_stopped');
    }, 'Tracking stopped. Your key and history were deleted.');
  };

  return (
    <section className="panel">
      <h2>Daily history</h2>
      {member ? (
        <>
          <p>
            Tracking <strong>{member.name}</strong> since {fmtDay(member.created_at)} · last update{' '}
            {fmtDay(member.last_ok)}. A snapshot is saved every day, even when you do not visit.
          </p>
          {member.last_error && <p className="footnote">Last update failed: {member.last_error}</p>}
          <label className="cloud-share">
            <input
              type="checkbox"
              checked={share}
              disabled={busy || !canStart}
              onChange={(e) => void start(e.target.checked)}
            />{' '}
            Share my stats with my faction&apos;s leader and co-leader (and count anonymously in faction ranks)
          </label>
          <button type="button" className="btn-quiet" onClick={stop} disabled={busy}>
            Stop tracking &amp; delete my data
          </button>
        </>
      ) : (
        <>
          <p>
            Turn on daily tracking and your battle stats are saved once a day — even on days you do
            not visit — so the chart below fills itself. Free. Your key is stored encrypted and used
            only to read your own stats; stopping deletes the key and the whole history.
          </p>
          <label className="cloud-share">
            <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Share my stats
            with my faction&apos;s leader and co-leader (and count anonymously in faction ranks)
          </label>
          <button type="button" onClick={() => void start(share)} disabled={busy || !canStart}>
            {busy ? 'Saving…' : 'Start daily tracking'}
          </button>
          {!canStart && <p className="footnote">Load your API key above first.</p>}
        </>
      )}
      {msg && <p className="footnote" role="status">{msg}</p>}
      <p className="footnote">
        Details in the <a href="/privacy">privacy policy</a>.
      </p>
    </section>
  );
}
