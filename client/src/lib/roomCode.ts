export const ROOM_CODE_MAX_LEN = 8;

/** Normalize for join/submit. Do not uppercase on every keystroke: that fights mobile IME and drops chars. */
export function normalizeRoomCode(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_MAX_LEN);
}

/** Keep typing raw (IME-safe). Strip only clearly invalid chars without changing case. */
export function filterRoomCodeInput(raw: string, isComposing: boolean): string {
  if (isComposing) return raw;
  return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, ROOM_CODE_MAX_LEN);
}
