import { useEffect } from 'react';
import { disposeSharedSocket, getSharedSocket } from '../lib/sharedSocket';

/**
 * Keeps a single shared Socket.io connection open for the App lifetime so
 * hub visitors and local-game players count toward `aktif · N`.
 */
export function useAppPresence(): void {
  useEffect(() => {
    getSharedSocket();
    return () => disposeSharedSocket();
  }, []);
}
