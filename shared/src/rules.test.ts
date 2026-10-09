import { describe, expect, it } from 'vitest';
import type { Cell, GameState, Player } from './types.js';
import {
  autoFillIsolatedTerritories,
  checkVictory,
  claimCell,
  getValidMoves,
} from './rules.js';
import { createMapForConfig } from './mapGenerator.js';
import { createInitialGame } from './gameFactory.js';
import {
  performClaim,
  performEndTurn,
  performOrderRoll,
  performTurnRoll,
} from './turnOrchestrator.js';

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
  }));
}

/** 3x3 tek ada: merkez + komşular kara; sahiplik parametre ile. */
function tinyState(owners: (number | null)[][]): GameState {
  const rows = owners.length;
  const cols = owners[0].length;
  const grid: (Cell | null)[][] = [];
  let unclaimed = 0;
  let total = 0;

  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const owner = owners[r][c];
      if (owner === undefined) {
        grid[r][c] = null;
        continue;
      }
      grid[r][c] = land(r, c, owner);
      total++;
      if (owner === null) unclaimed++;
    }
  }

  const players = makePlayers(2);
  for (const row of owners) {
    for (const o of row) {
      if (o !== null && o !== undefined) players[o].score += 1;
    }
  }

  return {
    gridCols: cols,
    gridRows: rows,
    cellSize: 36,
    grid,
    islands: [{ id: 0, name: 'Ada', cells: [] }],
    bridges: [],
    players,
    currentPlayerIdx: 0,
    phase: 'claim',
    remainingSteps: 3,
    lastDiceRoll: 3,
    totalLandTiles: total,
    unclaimedLandTiles: unclaimed,
    orderRollsPending: false,
    winnerIds: null,
    log: [],
  };
}

describe('claimCell', () => {
  it('allows claiming adjacent empty land', () => {
    const state = tinyState([
      [0, null],
      [null, null],
    ]);
    expect(claimCell(state, 0, 1, 0)).toBe(true);
    expect(state.grid[0][1]!.owner).toBe(0);
    expect(state.players[0].score).toBe(2);
    expect(state.remainingSteps).toBe(2);
    expect(state.unclaimedLandTiles).toBe(2);
  });

  it('rejects non-adjacent and owned cells', () => {
    const state = tinyState([
      [0, null, null],
      [null, null, null],
    ]);
    expect(claimCell(state, 0, 2, 0)).toBe(false);
    state.grid[0][1]!.owner = 1;
    state.players[1].score = 1;
    expect(claimCell(state, 0, 1, 0)).toBe(false);
  });

  it('allows first claim anywhere when player has no cells', () => {
    const state = tinyState([
      [null, null],
      [null, null],
    ]);
    const moves = getValidMoves(state.grid, state.bridges, state.gridRows, state.gridCols, 0);
    expect(moves.length).toBe(4);
    expect(claimCell(state, 1, 1, 0)).toBe(true);
  });
});

describe('autoFillIsolatedTerritories', () => {
  it('fills cells only reachable by one player', () => {
    // P0 owns left; P1 owns right; middle empty but only adjacent to P0
    const state = tinyState([
      [0, null, 1],
    ]);
    // middle is adjacent to both — should not auto-fill
    expect(autoFillIsolatedTerritories(state)).toBe(0);

    const isolated = tinyState([
      [0, null],
      [null, null],
    ]);
    // Give P1 a distant cell with a gap of water so they cannot reach empties
    isolated.grid.push([null, null]);
    isolated.gridRows = 3;
    isolated.grid[2] = [land(2, 0, 1), null];
    isolated.players[1].score = 1;
    isolated.totalLandTiles += 1;
    // empties at (0,1) and (1,0),(1,1) — P1 at (2,0) can reach via (1,0)
    // Make P1 landlocked away: remove adjacency by putting water
    isolated.grid[1][0] = null;
    isolated.grid[2][0] = land(2, 0, 1);
    isolated.unclaimedLandTiles = 2; // (0,1) and (1,1)
    isolated.totalLandTiles = 4;

    const filled = autoFillIsolatedTerritories(isolated);
    expect(filled).toBeGreaterThan(0);
    expect(isolated.grid[0][1]!.owner).toBe(0);
  });
});

describe('checkVictory', () => {
  it('returns null while unclaimed land and moves remain', () => {
    const state = tinyState([
      [0, null],
      [null, 1],
    ]);
    expect(checkVictory(state)).toBeNull();
  });

  it('declares winner(s) when board is full', () => {
    const state = tinyState([
      [0, 0],
      [1, 0],
    ]);
    state.unclaimedLandTiles = 0;
    const winners = checkVictory(state);
    expect(winners).toEqual([0]);
  });

  it('supports ties', () => {
    const state = tinyState([
      [0, 1],
      [1, 0],
    ]);
    state.unclaimedLandTiles = 0;
    const winners = checkVictory(state);
    expect(winners?.sort()).toEqual([0, 1]);
  });
});

describe('mapGenerator smoke', () => {
  it('creates a playable map for each size', () => {
    for (const size of ['small', 'medium', 'large'] as const) {
      const map = createMapForConfig(size, 2);
      expect(map.cols).toBeGreaterThan(0);
      expect(map.rows).toBeGreaterThan(0);
      expect(map.totalLand).toBeGreaterThan(0);
      expect(map.islands.length).toBeGreaterThan(0);
      expect(map.bridges.length).toBeGreaterThanOrEqual(0);

      let landCount = 0;
      for (const row of map.grid) {
        for (const cell of row) {
          if (cell?.isLand) landCount++;
        }
      }
      expect(landCount).toBe(map.totalLand);
    }
  });

  it('createInitialGame starts in roll_order', () => {
    const game = createInitialGame({
      mapSize: 'small',
      playerCount: 2,
      playerNames: ['A', 'B'],
    });
    expect(game.phase).toBe('roll_order');
    expect(game.players).toHaveLength(2);
    expect(game.unclaimedLandTiles).toBe(game.totalLandTiles);
  });
});

describe('turnOrchestrator', () => {
  it('order roll advances and resolves turn order', () => {
    const game = createInitialGame({
      mapSize: 'small',
      playerCount: 2,
      playerNames: ['A', 'B'],
    });

    const r0 = performOrderRoll(game, 0);
    expect(r0.ok).toBe(true);
    expect(r0.orderRollIndex).toBe(1);

    // Force distinct rolls if tie would reroll — keep looping until main game
    let idx = r0.orderRollIndex;
    let guard = 0;
    while (game.phase === 'roll_order' && guard++ < 20) {
      const r = performOrderRoll(game, idx);
      expect(r.ok).toBe(true);
      idx = r.orderRollIndex;
    }
    expect(game.phase).toBe('roll');
  });

  it('claim via orchestrator updates phase', () => {
    const state = tinyState([
      [0, null],
      [null, null],
    ]);
    state.phase = 'claim';
    state.remainingSteps = 1;
    const result = performClaim(state, 0, 0, 1);
    expect(result.ok).toBe(true);
    expect(['turn_complete', 'game_over']).toContain(state.phase);
  });

  it('turn roll and end turn enforce acting player', () => {
    const state = tinyState([[0, null]]);
    state.phase = 'roll';
    state.currentPlayerIdx = 0;
    expect(performTurnRoll(state, 1).ok).toBe(false);
    expect(performTurnRoll(state, 0).ok).toBe(true);

    state.phase = 'turn_complete';
    state.currentPlayerIdx = 0;
    expect(performEndTurn(state, 1).ok).toBe(false);
    expect(performEndTurn(state, 0).ok).toBe(true);
    expect(state.currentPlayerIdx).toBe(1);
  });
});
