import { isValidFoldLayerDataUrl, type MapSize } from '@rfgames/shared';

const MAP_SIZES = new Set<MapSize>(['small', 'medium', 'large']);
const NAME_MAX = 24;
const ROOM_CODE_RE = /^[A-Z0-9]{4,8}$/;

export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().slice(0, NAME_MAX);
  return name.length > 0 ? name : null;
}

export function parseMapSize(raw: unknown): MapSize | null {
  return typeof raw === 'string' && MAP_SIZES.has(raw as MapSize) ? (raw as MapSize) : null;
}

export function parseMaxPlayers(raw: unknown): number | 'unlimited' | null {
  if (raw === 'unlimited') return 'unlimited';
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 2 && raw <= 6) return raw;
  return null;
}

export function parseRoomCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  return ROOM_CODE_RE.test(code) ? code : null;
}

export function parseClaimPayload(raw: unknown): { r: number; c: number } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { r, c } = raw as { r?: unknown; c?: unknown };
  if (typeof r !== 'number' || typeof c !== 'number') return null;
  if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
  if (r < 0 || c < 0 || r > 200 || c > 200) return null;
  return { r, c };
}

export function parseCreateRoom(raw: unknown): {
  playerName: string;
  mapSize: MapSize;
  maxPlayers: number | 'unlimited';
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const playerName = sanitizeName(o.playerName);
  const mapSize = parseMapSize(o.mapSize);
  const maxPlayers = parseMaxPlayers(o.maxPlayers);
  if (!playerName || !mapSize || maxPlayers === null) return null;
  return { playerName, mapSize, maxPlayers };
}

export function parseJoinRoom(raw: unknown): { code: string; name: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const code = parseRoomCode(o.code);
  const name = sanitizeName(o.name);
  if (!code || !name) return null;
  return { code, name };
}

export function parseRejoin(raw: unknown): { code: string; memberId: string } | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const code = parseRoomCode(o.code);
  const memberId = typeof o.memberId === 'string' && o.memberId.length >= 8 ? o.memberId : null;
  if (!code || !memberId) return null;
  return { code, memberId };
}

export function parseFoldMaxPlayers(raw: unknown): 2 | 3 | 4 | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null;
  if (raw === 2 || raw === 3 || raw === 4) return raw;
  return null;
}

export function parseFoldCreateRoom(raw: unknown): {
  playerName: string;
  maxPlayers: 2 | 3 | 4;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const playerName = sanitizeName(o.playerName);
  const maxPlayers = parseFoldMaxPlayers(o.maxPlayers);
  if (!playerName || maxPlayers === null) return null;
  return { playerName, maxPlayers };
}

/** Section + peek-safe PNG/JPEG data URLs (size-checked via shared helper). */
export function parseFoldSubmitSection(raw: unknown): {
  layerDataUrl: string;
  peekSafeDataUrl: string;
} | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!isValidFoldLayerDataUrl(o.layerDataUrl) || !isValidFoldLayerDataUrl(o.peekSafeDataUrl)) {
    return null;
  }
  return {
    layerDataUrl: o.layerDataUrl,
    peekSafeDataUrl: o.peekSafeDataUrl,
  };
}
