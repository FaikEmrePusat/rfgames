import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { FoldGameState } from '@rfgames/shared';
import { isCurrentFoldArtist, setSectionLayer } from '@rfgames/shared';
import { buildPeekSafeLayer } from '../components/foldDraw/peekSafeLayer';

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ??
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

const SESSION_KEY = 'rfgames.foldOnlineSession';

export interface FoldOnlineSession {
  roomCode: string;
  memberId: string;
  isHost: boolean;
  waiting: boolean;
  members: { name: string; id: string; connected?: boolean }[];
  maxPlayers: 2 | 3 | 4;
  gameId: 'fold';
}

export interface FoldOnlineCreateOpts {
  playerName: string;
  maxPlayers: 2 | 3 | 4;
}

function loadSavedSession(): { code: string; memberId: string } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { roomCode?: string; memberId?: string };
    if (parsed.roomCode && parsed.memberId) {
      return { code: parsed.roomCode, memberId: parsed.memberId };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function saveSession(session: FoldOnlineSession | null) {
  if (!session) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ roomCode: session.roomCode, memberId: session.memberId }),
  );
}

export function useOnlineFoldDraw() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [session, setSession] = useState<FoldOnlineSession | null>(null);
  const [serverGame, setServerGame] = useState<FoldGameState | null>(null);
  /** Local ink only applies when section matches server currentSection. */
  const [localDraft, setLocalDraft] = useState<{
    section: number;
    layer: string | null;
  } | null>(null);
  const historyRef = useRef<string[]>([]);
  const [undoTick, setUndoTick] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  const clearLocalInk = useCallback(() => {
    historyRef.current = [];
    setLocalDraft(null);
    setUndoTick((n) => n + 1);
  }, []);

  const bindSocketHandlers = useCallback((s: Socket) => {
    s.on('fold:update', (payload: FoldOnlineSession) => {
      setSession(payload);
      saveSession(payload);
    });

    s.on('fold:state', (state: FoldGameState) => {
      setServerGame(state);
      setLocalDraft((prev) => {
        if (prev && prev.section === state.currentSection && state.phase === 'drawing') {
          return prev;
        }
        historyRef.current = [];
        return null;
      });
      setUndoTick((n) => n + 1);
      setSubmitting(false);
    });

    s.on('error', (msg: string) => {
      setError(msg);
      setSubmitting(false);
    });
  }, []);

  const ensureSocket = useCallback((): Socket => {
    if (socketRef.current) return socketRef.current;

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
        'fold:rejoin',
        saved,
        (res: { ok: boolean; session?: FoldOnlineSession; error?: string }) => {
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
    if (loadSavedSession()) ensureSocket();
    return () => {
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [ensureSocket]);

  const createRoom = useCallback(
    (opts: FoldOnlineCreateOpts) => {
      saveSession(null);
      clearLocalInk();
      setServerGame(null);
      const s = ensureSocket();
      setError(null);
      s.emit(
        'fold:create',
        opts,
        (res: { ok: boolean; session?: FoldOnlineSession; error?: string }) => {
          if (!res.ok) setError(res.error ?? 'Oda oluşturulamadı');
          else if (res.session) {
            setSession(res.session);
            saveSession(res.session);
          }
        },
      );
    },
    [clearLocalInk, ensureSocket],
  );

  const joinRoom = useCallback(
    (code: string, name: string) => {
      saveSession(null);
      clearLocalInk();
      setServerGame(null);
      const s = ensureSocket();
      setError(null);
      s.emit(
        'fold:join',
        { code, name },
        (res: { ok: boolean; session?: FoldOnlineSession; error?: string }) => {
          if (!res.ok) setError(res.error ?? 'Odaya katılınamadı');
          else if (res.session) {
            setSession(res.session);
            saveSession(res.session);
          }
        },
      );
    },
    [clearLocalInk, ensureSocket],
  );

  const startOnlineGame = useCallback(() => {
    socketRef.current?.emit('fold:start');
  }, []);

  const rematch = useCallback(() => {
    clearLocalInk();
    setError(null);
    socketRef.current?.emit('fold:rematch');
  }, [clearLocalInk]);

  const isMyTurn =
    !!session &&
    !!serverGame &&
    isCurrentFoldArtist(serverGame, session.memberId);

  const game = useMemo(() => {
    if (!serverGame) return null;
    if (!isMyTurn || serverGame.phase !== 'drawing') return serverGame;
    if (!localDraft || localDraft.section !== serverGame.currentSection) return serverGame;
    return setSectionLayer(serverGame, serverGame.currentSection, localDraft.layer);
  }, [serverGame, isMyTurn, localDraft]);

  const commitLayer = useCallback(
    (dataUrl: string) => {
      if (!serverGame || serverGame.phase !== 'drawing') return;
      const sec = serverGame.currentSection;
      setLocalDraft((prev) => {
        if (!prev || prev.section !== sec) {
          historyRef.current = [];
        }
        const prevLayer = prev?.section === sec ? prev.layer : null;
        historyRef.current = [...historyRef.current, prevLayer ?? ''];
        return { section: sec, layer: dataUrl };
      });
      setUndoTick((n) => n + 1);
    },
    [serverGame],
  );

  const undo = useCallback(() => {
    if (!serverGame || serverGame.phase !== 'drawing') return;
    const stack = historyRef.current;
    if (stack.length === 0) return;
    const prev = stack[stack.length - 1]!;
    historyRef.current = stack.slice(0, -1);
    setLocalDraft({
      section: serverGame.currentSection,
      layer: prev === '' ? null : prev,
    });
    setUndoTick((n) => n + 1);
  }, [serverGame]);

  const foldAndPass = useCallback(async () => {
    const layer =
      localDraft && serverGame && localDraft.section === serverGame.currentSection
        ? localDraft.layer
        : null;
    if (!layer || !socketRef.current || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const peekSafeDataUrl = await buildPeekSafeLayer(layer, serverGame?.peekRatio ?? 0.1);
      socketRef.current.emit('fold:submitSection', {
        layerDataUrl: layer,
        peekSafeDataUrl,
      });
    } catch {
      setError('Kat hazırlanamadı');
      setSubmitting(false);
    }
  }, [localDraft, serverGame, submitting]);

  const leave = useCallback(() => {
    socketRef.current?.emit('fold:leave');
    saveSession(null);
    setSession(null);
    setServerGame(null);
    clearLocalInk();
    setError(null);
  }, [clearLocalInk]);

  const canUndo =
    isMyTurn &&
    !!serverGame &&
    serverGame.phase === 'drawing' &&
    historyRef.current.length > 0 &&
    undoTick >= 0;

  return {
    session,
    game,
    error,
    connected: !!socket?.connected,
    isMyTurn,
    submitting,
    createRoom,
    joinRoom,
    startOnlineGame,
    rematch,
    commitLayer,
    undo,
    foldAndPass,
    leave,
    canUndo: !!canUndo,
  };
}
