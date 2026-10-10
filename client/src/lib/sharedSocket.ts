import { io, Socket } from 'socket.io-client';
import { SERVER_URL } from './serverUrl';

/**
 * One Socket.io connection for the whole app: presence (hub / local / online)
 * plus Kapmaca & Katla-Çiz online rooms. Counted by server `/health` activePlayers.
 */
let shared: Socket | null = null;

export function getSharedSocket(): Socket {
  if (!shared) {
    shared = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
  } else if (!shared.connected) {
    shared.connect();
  }
  return shared;
}

/** App-level teardown only — online hooks must not call this. */
export function disposeSharedSocket(): void {
  if (!shared) return;
  shared.disconnect();
  shared = null;
}
