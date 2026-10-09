import type { Bridge, Cell, GridPos, Island, MapSize } from './types.js';
import {
  BRIDGE_NEAREST_NEIGHBORS,
  computeIslandParams,
  getBridgeCountForDistance,
  getBridgeMaxDistance,
  getGridDimensions,
  getIslandCount,
} from './mapConfig.js';

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const CARDINAL = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

function valueNoise2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453;
  return n - Math.floor(n);
}

function islandCentroid(cells: GridPos[]): GridPos {
  let r = 0;
  let c = 0;
  for (const cell of cells) {
    r += cell.r;
    c += cell.c;
  }
  return { r: r / cells.length, c: c / cells.length };
}

function isShoreCell(grid: (Cell | null)[][], pos: GridPos, rows: number, cols: number): boolean {
  for (const d of CARDINAL) {
    const nr = pos.r + d.r;
    const nc = pos.c + d.c;
    if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) return true;
    if (!grid[nr]![nc]) return true;
  }
  return false;
}

function growOrganicIsland(
  grid: (Cell | null)[][],
  seed: GridPos,
  islandId: number,
  targetSize: number,
  rows: number,
  cols: number,
  innerMargin: number,
  noiseSeed: number,
): GridPos[] {
  const islandCells: GridPos[] = [];
  const queue: GridPos[] = [{ r: seed.r, c: seed.c }];
  const inIsland = new Set<string>([`${seed.r},${seed.c}`]);

  const stretch = 0.55 + Math.random() * 0.9;
  const angle = Math.random() * Math.PI;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);
  const radiusHint = Math.sqrt(targetSize / Math.PI) * (1.15 + Math.random() * 0.35);

  const placeCell = (r: number, c: number) => {
    grid[r]![c] = { isLand: true, islandId, owner: null, r, c };
    islandCells.push({ r, c });
  };

  placeCell(seed.r, seed.c);

  const ellipseScore = (r: number, c: number): number => {
    const dr = r - seed.r;
    const dc = c - seed.c;
    const lr = dr * cosA + dc * sinA;
    const lc = -dr * sinA + dc * cosA;
    const ell = Math.hypot(lr / stretch, lc * stretch) / radiusHint;
    const noise = valueNoise2D(r * 0.35, c * 0.35, noiseSeed) * 0.45;
    return ell - noise;
  };

  while (queue.length > 0 && islandCells.length < targetSize) {
    const qi = randInt(0, queue.length - 1);
    const current = queue.splice(qi, 1)[0]!;

    for (const d of shuffle(CARDINAL)) {
      const nr = current.r + d.r;
      const nc = current.c + d.c;
      const key = `${nr},${nc}`;

      if (nr < innerMargin || nr >= rows - innerMargin) continue;
      if (nc < innerMargin || nc >= cols - innerMargin) continue;
      if (inIsland.has(key) || grid[nr]![nc]) continue;

      let neighborOther = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const check = grid[nr + dr]?.[nc + dc];
          if (check && check.islandId !== islandId) neighborOther = true;
        }
      }
      if (neighborOther) continue;

      const score = ellipseScore(nr, nc);
      const acceptChance = score < 0.7 ? 0.88 : score < 1.05 ? 0.45 : score < 1.35 ? 0.18 : 0.04;
      if (Math.random() > acceptChance) continue;

      placeCell(nr, nc);
      inIsland.add(key);
      queue.push({ r: nr, c: nc });
      if (islandCells.length >= targetSize) break;
    }
  }

  return islandCells;
}

export function generateMap(cols: number, rows: number, islandCount: number): {
  grid: (Cell | null)[][];
  islands: Island[];
  totalLand: number;
} {
  const grid: (Cell | null)[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => null),
  );
  const islands: Island[] = [];
  const seeds: GridPos[] = [];

  const { minSize, maxSize, minSeedDistance } = computeIslandParams(cols, rows, islandCount);

  const margin = Math.max(3, Math.floor(Math.min(cols, rows) * 0.05));
  const seedTarget = Math.max(islandCount * 3, islandCount + 20);

  let attempts = 0;
  while (seeds.length < seedTarget && attempts < 4000) {
    attempts++;
    let r: number;
    let c: number;

    if (seeds.length > 0 && Math.random() < 0.35) {
      const anchor = seeds[randInt(0, seeds.length - 1)]!;
      const ring = minSeedDistance * (1.1 + Math.random() * 1.4);
      const theta = Math.random() * Math.PI * 2;
      r = Math.round(anchor.r + Math.sin(theta) * ring);
      c = Math.round(anchor.c + Math.cos(theta) * ring);
      if (r < margin || r >= rows - margin || c < margin || c >= cols - margin) continue;
    } else {
      r = randInt(margin, rows - margin - 1);
      c = randInt(margin, cols - margin - 1);
    }

    const tooClose = seeds.some((s) => Math.hypot(s.r - r, s.c - c) < minSeedDistance);
    if (!tooClose) seeds.push({ r, c });
  }

  let totalLand = 0;
  const innerMargin = Math.max(2, margin - 1);
  const minAcceptable = 10;

  let seedIdx = 0;
  let islandId = 0;
  while (islands.length < islandCount && seedIdx < seeds.length) {
    const seed = seeds[seedIdx++]!;
    if (grid[seed.r]![seed.c]) continue;

    islandId++;
    const roll = Math.random();
    const targetSize =
      roll < 0.22
        ? randInt(minSize, Math.floor((minSize + maxSize) / 2))
        : roll < 0.78
          ? randInt(minSize + 2, maxSize)
          : randInt(Math.floor(maxSize * 0.85), maxSize + 8);

    const islandCells = growOrganicIsland(
      grid,
      seed,
      islandId,
      targetSize,
      rows,
      cols,
      innerMargin,
      islandId * 97 + seed.r * 13 + seed.c,
    );

    if (islandCells.length < minAcceptable) {
      for (const cell of islandCells) {
        grid[cell.r]![cell.c] = null;
      }
      islandId--;
      continue;
    }

    islands.push({ id: islandId, name: `Ada ${islandId}`, cells: islandCells });
    totalLand += islandCells.length;
  }

  islands.forEach((island, idx) => {
    const newId = idx + 1;
    if (island.id === newId) return;
    for (const cell of island.cells) {
      const g = grid[cell.r]![cell.c];
      if (g) g.islandId = newId;
    }
    island.id = newId;
    island.name = `Ada ${newId}`;
  });

  return { grid, islands, totalLand };
}

interface CellPair {
  cellA: GridPos;
  cellB: GridPos;
  dist: number;
  score: number;
}

function bridgeKey(a: GridPos, b: GridPos): string {
  return `${a.r},${a.c}->${b.r},${b.c}`;
}

function unit(dr: number, dc: number): { r: number; c: number } | null {
  const len = Math.hypot(dr, dc);
  if (len < 1e-6) return null;
  return { r: dr / len, c: dc / len };
}

function minIslandDistance(a: Island, b: Island): number {
  let minDist = Infinity;
  for (const cellA of a.cells) {
    for (const cellB of b.cells) {
      minDist = Math.min(minDist, Math.hypot(cellA.r - cellB.r, cellA.c - cellB.c));
    }
  }
  return minDist;
}

/** Köprü çizgisi başka karadan geçmesin (uç noktalar hariç) */
function waterPathClear(
  grid: (Cell | null)[][],
  from: GridPos,
  to: GridPos,
  islandA: number,
  islandB: number,
): boolean {
  let r0 = from.r;
  let c0 = from.c;
  const r1 = to.r;
  const c1 = to.c;
  const dr = Math.abs(r1 - r0);
  const dc = Math.abs(c1 - c0);
  const sr = r0 < r1 ? 1 : -1;
  const sc = c0 < c1 ? 1 : -1;
  let err = dr - dc;

  while (!(r0 === r1 && c0 === c1)) {
    const e2 = 2 * err;
    if (e2 > -dc) {
      err -= dc;
      r0 += sr;
    }
    if (e2 < dr) {
      err += dr;
      c0 += sc;
    }
    if (r0 === r1 && c0 === c1) break;

    const cell = grid[r0]?.[c0];
    if (cell?.isLand && cell.islandId !== islandA && cell.islandId !== islandB) {
      return false;
    }
  }

  return true;
}

/**
 * Karşılıklı kıyılardan, deniz üzerinden kısa köprü.
 * Aynı kare birden fazla köprüye uç olabilir (farklı hedeflere).
 */
function findBridgePairs(
  grid: (Cell | null)[][],
  islA: Island,
  islB: Island,
  count: number,
  maxBridgeDist: number,
  rows: number,
  cols: number,
  pairMinDist: number,
): CellPair[] {
  const centerA = islandCentroid(islA.cells);
  const centerB = islandCentroid(islB.cells);
  const towardB = unit(centerB.r - centerA.r, centerB.c - centerA.c);
  if (!towardB) return [];

  const towardA = { r: -towardB.r, c: -towardB.c };
  const closePair = pairMinDist <= 7;
  const facingDot = closePair ? -0.15 : 0.05;
  const minAlign = closePair ? 0.25 : 0.5;

  const shoreA = islA.cells.filter((p) => isShoreCell(grid, p, rows, cols));
  const shoreB = islB.cells.filter((p) => isShoreCell(grid, p, rows, cols));

  const facingA = shoreA.filter((p) => {
    const u = unit(p.r - centerA.r, p.c - centerA.c);
    return u ? u.r * towardB.r + u.c * towardB.c > facingDot : false;
  });
  const facingB = shoreB.filter((p) => {
    const u = unit(p.r - centerB.r, p.c - centerB.c);
    return u ? u.r * towardA.r + u.c * towardA.c > facingDot : false;
  });

  const candidatesA = facingA.length > 0 ? facingA : shoreA;
  const candidatesB = facingB.length > 0 ? facingB : shoreB;
  const pairs: CellPair[] = [];

  for (const cellA of candidatesA) {
    for (const cellB of candidatesB) {
      const dist = Math.hypot(cellA.r - cellB.r, cellA.c - cellB.c);
      if (dist < 1.2 || dist > maxBridgeDist) continue;

      const bridgeDir = unit(cellB.r - cellA.r, cellB.c - cellA.c);
      if (!bridgeDir) continue;

      const alignment = bridgeDir.r * towardB.r + bridgeDir.c * towardB.c;
      if (alignment < minAlign) continue;

      if (!waterPathClear(grid, cellA, cellB, islA.id, islB.id)) continue;

      const score = dist * 1.4 + (1 - alignment) * 3;
      pairs.push({ cellA, cellB, dist, score });
    }
  }

  pairs.sort((a, b) => a.score - b.score);

  const selected: CellPair[] = [];
  const usedExact = new Set<string>();

  for (const pair of pairs) {
    if (selected.length >= count) break;
    // Aynı A↔B çiftini tekrar ekleme; uç kareler serbestçe paylaşılabilir
    const key = bridgeKey(pair.cellA, pair.cellB);
    if (usedExact.has(key)) continue;
    usedExact.add(key);
    selected.push(pair);
  }

  return selected;
}

/**
 * Köprü grafiği:
 * 1) Her ada için en yakın K komşu
 * 2) Aday çiftleri mesafeye göre (yakın önce) işle
 * 3) Uzak diyagonaller yerine yerel, deniz-üstü bağlantılar
 * 4) Bir kıyı karesi birden fazla köprüye uç olabilir
 */
export function generateBridges(
  islands: Island[],
  cols: number,
  rows: number,
  grid: (Cell | null)[][],
): Bridge[] {
  const bridges: Bridge[] = [];
  const maxBridgeDist = getBridgeMaxDistance(cols, rows);

  type PairCand = { i: number; j: number; dist: number };
  const allPairs: PairCand[] = [];

  for (let i = 0; i < islands.length; i++) {
    for (let j = i + 1; j < islands.length; j++) {
      const dist = minIslandDistance(islands[i]!, islands[j]!);
      if (dist <= maxBridgeDist) {
        allPairs.push({ i, j, dist });
      }
    }
  }

  const nearest = new Map<number, Set<number>>();
  for (let i = 0; i < islands.length; i++) {
    const ranked = allPairs
      .filter((p) => p.i === i || p.j === i)
      .sort((a, b) => a.dist - b.dist)
      .slice(0, BRIDGE_NEAREST_NEIGHBORS)
      .map((p) => (p.i === i ? p.j : p.i));
    nearest.set(i, new Set(ranked));
  }

  const localPairs = allPairs
    .filter((p) => nearest.get(p.i)?.has(p.j) || nearest.get(p.j)?.has(p.i))
    .sort((a, b) => a.dist - b.dist);

  for (const { i, j, dist } of localPairs) {
    const islA = islands[i]!;
    const islB = islands[j]!;
    const bridgeCount = getBridgeCountForDistance(dist);
    const pairs = findBridgePairs(
      grid,
      islA,
      islB,
      bridgeCount,
      maxBridgeDist,
      rows,
      cols,
      dist,
    );

    for (const pair of pairs) {
      bridges.push({
        fromIsland: islA.id,
        toIsland: islB.id,
        cellA: pair.cellA,
        cellB: pair.cellB,
        dist: pair.dist,
      });
    }
  }

  return bridges;
}

export function createMapForConfig(mapSize: MapSize, playerCount: number) {
  const { cols, rows } = getGridDimensions(mapSize, playerCount);
  const islandCount = getIslandCount(mapSize, playerCount);
  const { grid, islands, totalLand } = generateMap(cols, rows, islandCount);
  const bridges = generateBridges(islands, cols, rows, grid);
  return { grid, islands, bridges, totalLand, cols, rows };
}
