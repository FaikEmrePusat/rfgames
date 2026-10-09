import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState, MapSize } from '@rfgames/shared';
import { playerIdForMember } from '@rfgames/shared';
import type { OnlineLobbyOptions } from '../components/LobbyScreen';

/** Dev: localhost API. Prod (unset VITE_SERVER_URL): same origin for single-service deploy. */
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');
const SESSION_KEY = 'rfgames.onlineSession';

export interface OnlineSession {
  roomCode: string;
  memberId: string;
  isHost: boolean;
  waiting: boolean;
  members: { name: string; id: string; connected?: boolean }[];
  maxPlayers: number | 'unlimited';
  mapSize: MapSize;
}

function loadSavedSession(): { roomCode: string; memberId: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { roomCode?: string; memberId?: string };
    if (parsed.roomCode && parsed.memberId) return { roomCode: parsed.roomCode, memberId: parsed.memberId };
  } catch {
    /* ignore */
  }
  return null;
}

function saveSession(session: OnlineSession | null) {
  if (!session) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ roomCode: session.roomCode, memberId: session.memberId }),
  );
}

export function useOnlineGame() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [session, setSession] = useState<OnlineSession | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [orderRollIdx, setOrderRollIdx] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2800);
  }, []);

  const bindSocketHandlers = useCallback(
    (s: Socket) => {
      s.on('room:update', (payload: OnlineSession) => {
        setSession(payload);
        saveSession(payload);
      });

      s.on('game:state', (state: GameState) => {
        setGame(state);
        if (state.phase !== 'roll_order') setOrderRollIdx(0);
      });

      s.on('game:toast', (msg: string) => {
        showToast(msg);
      });

      s.on('error', (msg: string) => {
        setError(msg);
      });
    },
    [showToast],
  );

  const ensureSocket = useCallback((): Socket => {
    if (socketRef.current?.connected || socketRef.current) {
      return socketRef.current;
    }

    const s = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    socketRef.current = s;
    setSocket(s);
    bindSocketHandlers(s);

    s.on('connect', () => {
      const saved = loadSavedSession();
      if (!saved) return;
      s.emit(
        'room:rejoin',
        saved,
        (res: { ok: boolean; session?: OnlineSession; error?: string }) => {
          if (res.ok && res.session) {
            setSession(res.session);
            saveSession(res.session);
          } else {
            saveSession(null);
          }
        },
      );
    });

    return s;
  }, [bindSocketHandlers]);

  useEffect(() => {
    // Yalnızca kayıtlı online oturum varsa bağlan (yerel oyunda soket yok).
    if (loadSavedSession()) ensureSocket();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [ensureSocket]);

  const createRoom = useCallback(
    (opts: OnlineLobbyOptions) => {
      saveSession(null);
      const s = ensureSocket();
      setError(null);
      s.emit('room:create', opts, (res: { ok: boolean; session?: OnlineSession; error?: string }) => {
        if (!res.ok) setError(res.error ?? 'Oda oluşturulamadı');
        else if (res.session) {
          setSession(res.session);
          saveSession(res.session);
        }
      });
    },
    [ensureSocket],
  );

  const joinRoom = useCallback(
    (code: string, name: string) => {
      saveSession(null);
      const s = ensureSocket();
      setError(null);
      s.emit('room:join', { code, name }, (res: { ok: boolean; session?: OnlineSession; error?: string }) => {
        if (!res.ok) setError(res.error ?? 'Odaya katılınamadı');
        else if (res.session) {
          setSession(res.session);
          saveSession(res.session);
        }
      });
    },
    [ensureSocket],
  );

  const startOnlineGame = useCallback(() => {
    socketRef.current?.emit('game:start');
  }, []);

  const rollOrderDice = useCallback(() => {
    socketRef.current?.emit('game:rollOrder');
  }, []);

  const rollTurnDice = useCallback(() => {
    socketRef.current?.emit('game:roll');
  }, []);

  const claimTile = useCallback((r: number, c: number) => {
    socketRef.current?.emit('game:claim', { r, c });
  }, []);

  const endTurn = useCallback(() => {
    socketRef.current?.emit('game:endTurn');
  }, []);

  const leave = useCallback(() => {
    socketRef.current?.emit('room:leave');
    saveSession(null);
    setSession(null);
    setGame(null);
  }, []);

  const canInteract = (() => {
    if (!session || !game) return false;
    if (game.phase === 'roll_order') {
      const nextSeat = game.players.findIndex((p) => p.orderRoll === null);
      if (nextSeat < 0) return false;
      return game.players[nextSeat]?.memberId === session.memberId;
    }
    const pid = playerIdForMember(game, session.memberId);
    return pid !== null && game.currentPlayerIdx === pid;
  })();

  return {
    session,
    game,
    orderRollIdx,
    toast,
    error,
    connected: !!socket?.connected,
    createRoom,
    joinRoom,
    startOnlineGame,
    rollOrderDice,
    rollTurnDice,
    claimTile,
    endTurn,
    leave,
    canInteract: !!canInteract,
    setOrderRollIdx,
  };
}
