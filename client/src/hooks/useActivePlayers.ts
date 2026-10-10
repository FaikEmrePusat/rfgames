import { useEffect, useState } from 'react';

/** Same origin resolution as online hooks — keep CORS/deploy paths aligned. */
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

const POLL_MS = 25_000;

/**
 * Polls GET /health for `activePlayers` (connected Socket.io clients).
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

    void fetchCount();
    const id = window.setInterval(fetchCount, POLL_MS);
    window.addEventListener('focus', fetchCount);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('focus', fetchCount);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return count;
}
