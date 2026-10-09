import type { BotDifficulty, GameState, GridPos } from './types.js';
import { getPlayerCells, getValidMoves, type ValidMove } from './rules.js';

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function neighborsOf(r: number, c: number): GridPos[] {
  return [
    { r: r - 1, c },
    { r: r + 1, c },
    { r, c: c - 1 },
    { r, c: c + 1 },
  ];
}

function islandEmptyCount(state: GameState, islandId: number): number {
  let n = 0;
  for (const row of state.grid) {
    for (const cell of row) {
      if (cell?.isLand && cell.islandId === islandId && cell.owner === null) n += 1;
    }
  }
  return n;
}

/** Hamle skoru — yüksek = daha iyi (zor bot için). */
export function scoreClaimMove(state: GameState, playerId: number, move: ValidMove): number {
  const cell = state.grid[move.r]?.[move.c];
  if (!cell) return -Infinity;

  let score = 0;

  if (move.isBridgeTarget) score += 55;

  const ownCells = getPlayerCells(state.grid, playerId);
  const isFirst = ownCells.length === 0;

  if (isFirst) {
    score += islandEmptyCount(state, cell.islandId) * 1.5;
    const cy = (state.gridRows - 1) / 2;
    const cx = (state.gridCols - 1) / 2;
    const dist = Math.abs(move.r - cy) + Math.abs(move.c - cx);
    score += Math.max(0, 12 - dist);
  }

  let enemyAdj = 0;
  let emptyAdj = 0;
  let ownAdj = 0;

  for (const n of neighborsOf(move.r, move.c)) {
    if (n.r < 0 || n.r >= state.gridRows || n.c < 0 || n.c >= state.gridCols) continue;
    const nc = state.grid[n.r]?.[n.c];
    if (!nc?.isLand) continue;
    if (nc.owner === null) emptyAdj += 1;
    else if (nc.owner === playerId) ownAdj += 1;
    else enemyAdj += 1;
  }

  score += enemyAdj * 10;
  score += emptyAdj * 2.5;
  score += ownAdj * 1.5;

  // Aynı adada rakip varsa sıkıştır
  for (const row of state.grid) {
    for (const other of row) {
      if (
        other?.isLand &&
        other.islandId === cell.islandId &&
        other.owner !== null &&
        other.owner !== playerId
      ) {
        score += 4;
      }
    }
  }

  return score;
}

/**
 * Bot hamle seçimi.
 * - easy: rastgele
 * - medium: skorlu havuzdan yumuşak seçim
 * - hard: en yüksek skor (hafif gürültü)
 */
export function chooseBotClaim(
  state: GameState,
  playerId: number,
  difficulty: BotDifficulty = 'medium',
): ValidMove | null {
  const moves = getValidMoves(
    state.grid,
    state.bridges,
    state.gridRows,
    state.gridCols,
    playerId,
  );
  if (moves.length === 0) return null;

  if (difficulty === 'easy') {
    return pickRandom(moves);
  }

  const scored = moves
    .map((m) => ({
      move: m,
      score: scoreClaimMove(state, playerId, m) + Math.random() * (difficulty === 'hard' ? 1.5 : 6),
    }))
    .sort((a, b) => b.score - a.score);

  if (difficulty === 'hard') {
    return scored[0]!.move;
  }

  // medium: en iyi %40 içinden seç (en az 2 aday)
  const topCount = Math.max(2, Math.ceil(scored.length * 0.4));
  const pool = scored.slice(0, Math.min(topCount, scored.length));
  return pickRandom(pool).move;
}
