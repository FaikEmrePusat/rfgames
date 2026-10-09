import { describe, expect, it } from 'vitest';
import type { Cell, GameState, Player } from './types.js';
import { chooseBotClaim, scoreClaimMove } from './bot.js';
import { getValidMoves } from './rules.js';

function land(r: number, c: number, owner: number | null = null, islandId = 0): Cell {
  return { isLand: true, islandId, owner, r, c };
}

function makePlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `P${i}`,
    color: '#000',
    score: 0,
    orderRoll: null,
    isBot: i > 0,
    botDifficulty: 'medium' as const,
  }));
}

function tinyState(owners: (number | null)[][]): GameState {
  const rows = owners.length;
  const cols = owners[0]!.length;
  const grid: (Cell | null)[][] = [];
  let unclaimed = 0;
  let total = 0;

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const owner = owners[r]![c]!;
      const cell = land(r, c, owner);
      grid[r]![c] = cell;
      total += 1;
      if (owner === null) unclaimed += 1;
    }
  }

  return {
    gridCols: cols,
    gridRows: rows,
    cellSize: 36,
    grid,
    islands: [{ id: 0, name: 'Ada', cells: [] }],
    bridges: [],
    players: makePlayers(2),
    currentPlayerIdx: 0,
    phase: 'claim',
    remainingSteps: 1,
    lastDiceRoll: 1,
    totalLandTiles: total,
    unclaimedLandTiles: unclaimed,
    orderRollsPending: false,
    winnerIds: null,
    log: [],
  };
}

describe('chooseBotClaim', () => {
  it('easy returns a valid move', () => {
    const state = tinyState([
      [0, null, null],
      [null, null, null],
      [null, null, null],
    ]);
    const move = chooseBotClaim(state, 0, 'easy');
    expect(move).not.toBeNull();
    const valid = getValidMoves(state.grid, state.bridges, state.gridRows, state.gridCols, 0);
    expect(valid.some((m) => m.r === move!.r && m.c === move!.c)).toBe(true);
  });

  it('hard prefers contested / high-score cells over weak ones', () => {
    // P0 at (1,0); empty (1,1) adjacent to enemy at (1,2) should beat far corner
    const state = tinyState([
      [null, null, null],
      [0, null, 1],
      [null, null, null],
    ]);
    const bridge = { r: 1, c: 1, isBridgeTarget: false };
    const weak = { r: 0, c: 0, isBridgeTarget: false };
    expect(scoreClaimMove(state, 0, bridge)).toBeGreaterThan(scoreClaimMove(state, 0, weak));

    const move = chooseBotClaim(state, 0, 'hard');
    expect(move).toEqual(expect.objectContaining({ r: 1, c: 1 }));
  });

  it('returns null when no moves', () => {
    const state = tinyState([
      [0, 1],
      [1, 0],
    ]);
    expect(chooseBotClaim(state, 0, 'hard')).toBeNull();
  });
});
