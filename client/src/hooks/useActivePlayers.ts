import { useEffect, useState } from 'react';
import { SERVER_URL } from '../lib/serverUrl';
import { getSharedSocket } from '../lib/sharedSocket';

const POLL_MS = 25_000;

/**
 * Polls GET /health for `activePlayers` (connected Socket.io clients).
 * Also refreshes when the shared presence socket connects/disconnects.
 * Fails silently when offline — returns null so the UI can hide.
 */
export function useActivePlayers(): number | null {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/health`, {
          method: 'GET',
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data: unknown = await res.json();
        if (
          cancelled ||
          !data ||
          typeof data !== 'object' ||
          !('activePlayers' in data) ||
          typeof (data as { activePlayers: unknown }).activePlayers !== 'number'
        ) {
          return;
        }
        setCount((data as { activePlayers: number }).activePlayers);
      } catch {
        /* offline / CORS — keep last known or stay hidden */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchCount();
    };

    const socket = getSharedSocket();
    const onSocketChange = () => void fetchCount();

    void fetchCount();
    const id = window.setInterval(fetchCount, POLL_MS);
    window.addEventListener('focus', fetchCount);
    document.addEventListener('visibilitychange', onVisible);
    socket.on('connect', onSocketChange);
    socket.on('disconnect', onSocketChange);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('focus', fetchCount);
      document.removeEventListener('visibilitychange', onVisible);
      socket.off('connect', onSocketChange);
      socket.off('disconnect', onSocketChange);
    };
  }, []);

  return count;
}
