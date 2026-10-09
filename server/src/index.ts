import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  claimTile,
  createRoomState,
  endTurn,
  generateRoomCode,
  onMemberRemoved,
  rollOrder,
  rollTurn,
  roomToSession,
  startGame,
  transferHostIfNeeded,
  type Room,
  type RoomMember,
} from './roomManager.js';
import {
  createFoldRoomState,
  filteredFoldState,
  foldRoomToSession,
  onFoldMemberRemoved,
  startFoldGame,
  submitFoldSection,
  type FoldRoom,
} from './foldRoomManager.js';
import { SocketRateLimiter } from './rateLimit.js';
import {
  parseClaimPayload,
  parseCreateRoom,
  parseFoldCreateRoom,
  parseFoldSubmitSection,
  parseJoinRoom,
  parseRejoin,
} from './validation.js';

const PORT = Number(process.env.PORT) || 3001;
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS) || 60_000;

/** server/dist → monorepo client/dist (works from package root or Render cwd). */
const CLIENT_DIST = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../client/dist',
);

/**
 * Virgülle ayrılmış origin listesi.
 * Boşsa: localhost (dev) + Render’ın RENDER_EXTERNAL_URL (same-origin tek servis).
 * Üretimde CORS_ORIGIN=* önermiyoruz; özel alan adı için CORS_ORIGIN ayarlayın.
 */
function corsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGIN?.trim();
  if (raw === '*') return true;
  if (raw) return raw.split(',').map((s) => s.trim()).filter(Boolean);

  const origins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
  const renderUrl = process.env.RENDER_EXTERNAL_URL?.trim().replace(/\/$/, '');
  if (renderUrl) origins.push(renderUrl);
  return origins;
}

const ALLOWED_ORIGINS = corsOrigins();

const app = express();
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
  }),
);
app.get('/health', (_req, res) => res.json({ ok: true }));

function mountClientStatic() {
  if (process.env.SERVE_CLIENT === '0') return;
  if (!fs.existsSync(path.join(CLIENT_DIST, 'index.html'))) {
    console.warn(`Client dist not found at ${CLIENT_DIST} — API/Socket only`);
    return;
  }

  app.use(express.static(CLIENT_DIST, { index: false, fallthrough: true }));
  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    if (req.path.startsWith('/socket.io')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
  console.log(`Serving client from ${CLIENT_DIST}`);
}

mountClientStatic();

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: ALLOWED_ORIGINS },
  /** Section PNG data URLs need headroom beyond default 1MB. */
  maxHttpBufferSize: 2e6,
});
const rooms = new Map<string, Room>();
const foldRooms = new Map<string, FoldRoom>();
const socketToRoom = new Map<string, { code: string; memberId: string }>();
const socketToFoldRoom = new Map<string, { code: string; memberId: string }>();
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const foldDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();
const rateLimiter = new SocketRateLimiter(40, 10_000);
/** Stricter budget for large fold:submitSection payloads. */
const foldSubmitLimiter = new SocketRateLimiter(8, 60_000);

function foldIoRoom(code: string) {
  return `fold:${code}`;
}

function allocUniqueCode(): string {
  let code = generateRoomCode();
  while (rooms.has(code) || foldRooms.has(code)) code = generateRoomCode();
  return code;
}

function findRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase());
}

function findFoldRoom(code: string): FoldRoom | undefined {
  return foldRooms.get(code.toUpperCase());
}

function memberKey(code: string, memberId: string) {
  return `${code}:${memberId}`;
}

function broadcastRoom(room: Room) {
  for (const member of room.members) {
    if (!member.connected) continue;
    io.to(member.socketId).emit('room:update', roomToSession(room, member.id));
  }
}

function broadcastGame(room: Room) {
  if (!room.game) return;
  io.to(room.code).emit('game:state', room.game);
}

function broadcastFoldRoom(room: FoldRoom) {
  for (const member of room.members) {
    if (!member.connected) continue;
    io.to(member.socketId).emit('fold:update', foldRoomToSession(room, member.id));
  }
}

/** Per-member filtered state — never blast full paper to waiting seats. */
function broadcastFoldGame(room: FoldRoom) {
  if (!room.game) return;
  for (const member of room.members) {
    if (!member.connected) continue;
    const view = filteredFoldState(room, member.id);
    if (view) io.to(member.socketId).emit('fold:state', view);
  }
}

function leaveKapmacaIfAny(socketId: string) {
  const ref = socketToRoom.get(socketId);
  if (!ref) return;
  const room = findRoom(ref.code);
  if (room) removeMemberPermanently(room, ref.memberId);
  const sock = io.sockets.sockets.get(socketId);
  sock?.leave(ref.code);
  socketToRoom.delete(socketId);
}

function leaveFoldIfAny(socketId: string) {
  const ref = socketToFoldRoom.get(socketId);
  if (!ref) return;
  const room = findFoldRoom(ref.code);
  if (room) removeFoldMemberPermanently(room, ref.memberId);
  const sock = io.sockets.sockets.get(socketId);
  sock?.leave(foldIoRoom(ref.code));
  socketToFoldRoom.delete(socketId);
}

function removeMemberPermanently(room: Room, memberId: string) {
  const key = memberKey(room.code, memberId);
  const timer = disconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(key);
  }

  onMemberRemoved(room, memberId);
  room.members = room.members.filter((m) => m.id !== memberId);

  if (room.members.length === 0) {
    rooms.delete(room.code);
    return;
  }

  transferHostIfNeeded(room);
  broadcastRoom(room);
  if (room.game) broadcastGame(room);
}

function scheduleDisconnectCleanup(room: Room, member: RoomMember) {
  const key = memberKey(room.code, member.id);
  const existing = disconnectTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    disconnectTimers.delete(key);
    const current = findRoom(room.code);
    if (!current) return;
    const m = current.members.find((x) => x.id === member.id);
    if (!m || m.connected) return;
    removeMemberPermanently(current, member.id);
  }, DISCONNECT_GRACE_MS);

  disconnectTimers.set(key, timer);
}

function removeFoldMemberPermanently(room: FoldRoom, memberId: string) {
  const key = memberKey(room.code, memberId);
  const timer = foldDisconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    foldDisconnectTimers.delete(key);
  }

  onFoldMemberRemoved(room, memberId);
  room.members = room.members.filter((m) => m.id !== memberId);

  if (room.members.length === 0) {
    foldRooms.delete(room.code);
    return;
  }

  transferHostIfNeeded(room);
  broadcastFoldRoom(room);
  if (room.game) broadcastFoldGame(room);
}

function scheduleFoldDisconnectCleanup(room: FoldRoom, member: RoomMember) {
  const key = memberKey(room.code, member.id);
  const existing = foldDisconnectTimers.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    foldDisconnectTimers.delete(key);
    const current = findFoldRoom(room.code);
    if (!current) return;
    const m = current.members.find((x) => x.id === member.id);
    if (!m || m.connected) return;
    removeFoldMemberPermanently(current, member.id);
  }, DISCONNECT_GRACE_MS);

  foldDisconnectTimers.set(key, timer);
}

function attachMember(socketId: string, room: Room, member: RoomMember) {
  member.socketId = socketId;
  member.connected = true;
  member.disconnectedAt = null;
  const key = memberKey(room.code, member.id);
  const timer = disconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    disconnectTimers.delete(key);
  }
  socketToRoom.set(socketId, { code: room.code, memberId: member.id });
}

function attachFoldMember(socketId: string, room: FoldRoom, member: RoomMember) {
  member.socketId = socketId;
  member.connected = true;
  member.disconnectedAt = null;
  const key = memberKey(room.code, member.id);
  const timer = foldDisconnectTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    foldDisconnectTimers.delete(key);
  }
  socketToFoldRoom.set(socketId, { code: room.code, memberId: member.id });
}

io.on('connection', (socket) => {
  socket.use(([event], next) => {
    if (event === 'disconnect') return next();
    if (!rateLimiter.allow(socket.id)) {
      socket.emit('error', 'Çok fazla istek — biraz bekleyin');
      return;
    }
    next();
  });

  socket.on(
    'room:create',
    (
      raw: unknown,
      ack: (res: { ok: boolean; session?: ReturnType<typeof roomToSession>; error?: string }) => void,
    ) => {
      const opts = parseCreateRoom(raw);
      if (!opts) {
        ack({ ok: false, error: 'Geçersiz oda ayarları' });
        return;
      }

      leaveFoldIfAny(socket.id);
      const code = allocUniqueCode();

      const memberId = randomUUID();
      const member: RoomMember = {
        id: memberId,
        name: opts.playerName,
        socketId: socket.id,
        connected: true,
        disconnectedAt: null,
      };
      const room = createRoomState(code, member, opts.mapSize, opts.maxPlayers);
      rooms.set(code, room);
      socket.join(code);
      socketToRoom.set(socket.id, { code, memberId });

      ack({ ok: true, session: roomToSession(room, memberId) });
      broadcastRoom(room);
    },
  );

  socket.on(
    'room:join',
    (
      raw: unknown,
      ack: (res: { ok: boolean; session?: ReturnType<typeof roomToSession>; error?: string }) => void,
    ) => {
      const payload = parseJoinRoom(raw);
      if (!payload) {
        ack({ ok: false, error: 'Geçersiz katılım bilgisi' });
        return;
      }

      const room = findRoom(payload.code);
      if (!room) {
        ack({ ok: false, error: 'Oda bulunamadı' });
        return;
      }
      if (room.game) {
        ack({ ok: false, error: 'Oyun zaten başlamış' });
        return;
      }

      const max = room.maxPlayers;
      if (max !== 'unlimited' && room.members.length >= max) {
        ack({ ok: false, error: 'Oda dolu' });
        return;
      }

      leaveFoldIfAny(socket.id);
      const memberId = randomUUID();
      const member: RoomMember = {
        id: memberId,
        name: payload.name,
        socketId: socket.id,
        connected: true,
        disconnectedAt: null,
      };
      room.members.push(member);
      socket.join(room.code);
      socketToRoom.set(socket.id, { code: room.code, memberId });

      ack({ ok: true, session: roomToSession(room, memberId) });
      broadcastRoom(room);
    },
  );

  socket.on(
    'room:rejoin',
    (
      raw: unknown,
      ack: (res: { ok: boolean; session?: ReturnType<typeof roomToSession>; error?: string }) => void,
    ) => {
      const payload = parseRejoin(raw);
      if (!payload) {
        ack({ ok: false, error: 'Geçersiz yeniden bağlanma' });
        return;
      }

      const room = findRoom(payload.code);
      if (!room) {
        ack({ ok: false, error: 'Oda bulunamadı' });
        return;
      }

      const member = room.members.find((m) => m.id === payload.memberId);
      if (!member) {
        ack({ ok: false, error: 'Oturum bulunamadı' });
        return;
      }

      leaveFoldIfAny(socket.id);

      if (member.connected && member.socketId !== socket.id) {
        const old = io.sockets.sockets.get(member.socketId);
        old?.leave(room.code);
        socketToRoom.delete(member.socketId);
      }

      attachMember(socket.id, room, member);
      socket.join(room.code);
      transferHostIfNeeded(room);

      ack({ ok: true, session: roomToSession(room, member.id) });
      broadcastRoom(room);
      if (room.game) socket.emit('game:state', room.game);
    },
  );

  socket.on('game:start', () => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return;
    const room = findRoom(ref.code);
    if (!room || room.hostId !== ref.memberId) return;
    if (room.members.filter((m) => m.connected).length < 2) return;

    startGame(room);
    broadcastGame(room);
    broadcastRoom(room);
  });

  socket.on('game:rollOrder', () => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return;
    const room = findRoom(ref.code);
    if (!room?.game) return;

    const result = rollOrder(room, ref.memberId);
    if (!result.ok) {
      socket.emit('error', result.error);
      return;
    }
    if (result.toast) io.to(room.code).emit('game:toast', result.toast);
    broadcastGame(room);
  });

  socket.on('game:roll', () => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return;
    const room = findRoom(ref.code);
    if (!room?.game) return;

    const result = rollTurn(room, ref.memberId);
    if (!result.ok) socket.emit('error', result.error);
    else broadcastGame(room);
  });

  socket.on('game:claim', (raw: unknown) => {
    const payload = parseClaimPayload(raw);
    if (!payload) {
      socket.emit('error', 'Geçersiz hamle');
      return;
    }

    const ref = socketToRoom.get(socket.id);
    if (!ref) return;
    const room = findRoom(ref.code);
    if (!room?.game) return;

    const result = claimTile(room, ref.memberId, payload.r, payload.c);
    if (!result.ok) {
      if (result.toast) socket.emit('game:toast', result.toast);
      else if (result.error) socket.emit('error', result.error);
      return;
    }
    if (result.toast) io.to(room.code).emit('game:toast', result.toast);
    broadcastGame(room);
  });

  socket.on('game:endTurn', () => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return;
    const room = findRoom(ref.code);
    if (!room?.game) return;

    const result = endTurn(room, ref.memberId);
    if (!result.ok) socket.emit('error', result.error);
    else broadcastGame(room);
  });

  socket.on('room:leave', () => {
    const ref = socketToRoom.get(socket.id);
    if (!ref) return;
    const room = findRoom(ref.code);
    if (room) removeMemberPermanently(room, ref.memberId);
    socket.leave(ref.code);
    socketToRoom.delete(socket.id);
    rateLimiter.clear(socket.id);
  });

  // —— Katla-Çiz (fold) — game-scoped events; separate from Kapmaca room:* ——

  socket.on(
    'fold:create',
    (
      raw: unknown,
      ack: (res: {
        ok: boolean;
        session?: ReturnType<typeof foldRoomToSession>;
        error?: string;
      }) => void,
    ) => {
      const opts = parseFoldCreateRoom(raw);
      if (!opts) {
        ack({ ok: false, error: 'Geçersiz oda ayarları' });
        return;
      }

      leaveKapmacaIfAny(socket.id);
      leaveFoldIfAny(socket.id);

      const code = allocUniqueCode();
      const memberId = randomUUID();
      const member: RoomMember = {
        id: memberId,
        name: opts.playerName,
        socketId: socket.id,
        connected: true,
        disconnectedAt: null,
      };
      const room = createFoldRoomState(code, member, opts.maxPlayers);
      foldRooms.set(code, room);
      socket.join(foldIoRoom(code));
      socketToFoldRoom.set(socket.id, { code, memberId });

      ack({ ok: true, session: foldRoomToSession(room, memberId) });
      broadcastFoldRoom(room);
    },
  );

  socket.on(
    'fold:join',
    (
      raw: unknown,
      ack: (res: {
        ok: boolean;
        session?: ReturnType<typeof foldRoomToSession>;
        error?: string;
      }) => void,
    ) => {
      const payload = parseJoinRoom(raw);
      if (!payload) {
        ack({ ok: false, error: 'Geçersiz katılım bilgisi' });
        return;
      }

      const room = findFoldRoom(payload.code);
      if (!room) {
        ack({ ok: false, error: 'Oda bulunamadı' });
        return;
      }
      if (room.game) {
        ack({ ok: false, error: 'Oyun zaten başlamış' });
        return;
      }
      if (room.members.length >= room.maxPlayers) {
        ack({ ok: false, error: 'Oda dolu' });
        return;
      }

      leaveKapmacaIfAny(socket.id);
      leaveFoldIfAny(socket.id);

      const memberId = randomUUID();
      const member: RoomMember = {
        id: memberId,
        name: payload.name,
        socketId: socket.id,
        connected: true,
        disconnectedAt: null,
      };
      room.members.push(member);
      socket.join(foldIoRoom(room.code));
      socketToFoldRoom.set(socket.id, { code: room.code, memberId });

      ack({ ok: true, session: foldRoomToSession(room, memberId) });
      broadcastFoldRoom(room);
    },
  );

  socket.on(
    'fold:rejoin',
    (
      raw: unknown,
      ack: (res: {
        ok: boolean;
        session?: ReturnType<typeof foldRoomToSession>;
        error?: string;
      }) => void,
    ) => {
      const payload = parseRejoin(raw);
      if (!payload) {
        ack({ ok: false, error: 'Geçersiz yeniden bağlanma' });
        return;
      }

      const room = findFoldRoom(payload.code);
      if (!room) {
        ack({ ok: false, error: 'Oda bulunamadı' });
        return;
      }

      const member = room.members.find((m) => m.id === payload.memberId);
      if (!member) {
        ack({ ok: false, error: 'Oturum bulunamadı' });
        return;
      }

      leaveKapmacaIfAny(socket.id);

      if (member.connected && member.socketId !== socket.id) {
        const old = io.sockets.sockets.get(member.socketId);
        old?.leave(foldIoRoom(room.code));
        socketToFoldRoom.delete(member.socketId);
      }

      attachFoldMember(socket.id, room, member);
      socket.join(foldIoRoom(room.code));
      transferHostIfNeeded(room);

      ack({ ok: true, session: foldRoomToSession(room, member.id) });
      broadcastFoldRoom(room);
      const view = filteredFoldState(room, member.id);
      if (view) socket.emit('fold:state', view);
    },
  );

  socket.on('fold:start', () => {
    const ref = socketToFoldRoom.get(socket.id);
    if (!ref) return;
    const room = findFoldRoom(ref.code);
    if (!room || room.hostId !== ref.memberId) return;
    if (room.members.filter((m) => m.connected).length < 2) return;
    if (room.game) return;

    startFoldGame(room);
    broadcastFoldGame(room);
    broadcastFoldRoom(room);
  });

  socket.on('fold:submitSection', (raw: unknown) => {
    if (!foldSubmitLimiter.allow(socket.id)) {
      socket.emit('error', 'Çok fazla kat gönderimi — biraz bekleyin');
      return;
    }

    const payload = parseFoldSubmitSection(raw);
    if (!payload) {
      socket.emit('error', 'Geçersiz çizim verisi');
      return;
    }

    const ref = socketToFoldRoom.get(socket.id);
    if (!ref) return;
    const room = findFoldRoom(ref.code);
    if (!room?.game) return;

    const result = submitFoldSection(
      room,
      ref.memberId,
      payload.layerDataUrl,
      payload.peekSafeDataUrl,
    );
    if (!result.ok) {
      socket.emit('error', result.error ?? 'Kat gönderilemedi');
      return;
    }

    broadcastFoldGame(room);
    broadcastFoldRoom(room);
  });

  socket.on('fold:leave', () => {
    const ref = socketToFoldRoom.get(socket.id);
    if (!ref) return;
    const room = findFoldRoom(ref.code);
    if (room) removeFoldMemberPermanently(room, ref.memberId);
    socket.leave(foldIoRoom(ref.code));
    socketToFoldRoom.delete(socket.id);
    foldSubmitLimiter.clear(socket.id);
  });

  socket.on('disconnect', () => {
    rateLimiter.clear(socket.id);
    foldSubmitLimiter.clear(socket.id);

    const kapRef = socketToRoom.get(socket.id);
    if (kapRef) {
      socketToRoom.delete(socket.id);
      const room = findRoom(kapRef.code);
      if (room) {
        const member = room.members.find((m) => m.id === kapRef.memberId);
        if (member && member.socketId === socket.id) {
          member.connected = false;
          member.disconnectedAt = Date.now();
          transferHostIfNeeded(room);
          broadcastRoom(room);
          scheduleDisconnectCleanup(room, member);
        }
      }
    }

    const foldRef = socketToFoldRoom.get(socket.id);
    if (foldRef) {
      socketToFoldRoom.delete(socket.id);
      const room = findFoldRoom(foldRef.code);
      if (room) {
        const member = room.members.find((m) => m.id === foldRef.memberId);
        if (member && member.socketId === socket.id) {
          member.connected = false;
          member.disconnectedAt = Date.now();
          transferHostIfNeeded(room);
          broadcastFoldRoom(room);
          scheduleFoldDisconnectCleanup(room, member);
        }
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`RF Games server listening on http://localhost:${PORT}`);
});
