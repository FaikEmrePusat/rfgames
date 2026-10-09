import type { MapSize } from './types.js';

const GRID_BY_SIZE: Record<MapSize, { cols: number; rows: number }[]> = {
  small: [
    { cols: 36, rows: 28 },
    { cols: 44, rows: 32 },
    { cols: 52, rows: 36 },
    { cols: 58, rows: 40 },
    { cols: 64, rows: 44 },
  ],
  medium: [
    { cols: 48, rows: 36 },
    { cols: 56, rows: 42 },
    { cols: 64, rows: 46 },
    { cols: 72, rows: 50 },
    { cols: 80, rows: 54 },
  ],
  large: [
    { cols: 60, rows: 44 },
    { cols: 70, rows: 50 },
    { cols: 80, rows: 56 },
    { cols: 90, rows: 60 },
    { cols: 100, rows: 66 },
  ],
};

/** Ortalama ada boyutu (küçük ölçek, ilk versiyondaki gibi) */
const AVG_ISLAND_SIZE = 28;

/** Hedef kara oranı — boş alanı doldurmak için daha fazla ada */
const TARGET_LAND_COVERAGE = 0.36;

export function clampPlayerCount(count: number): number {
  return Math.min(6, Math.max(2, count));
}

export function getGridDimensions(mapSize: MapSize, playerCount: number): { cols: number; rows: number } {
  const idx = clampPlayerCount(playerCount) - 2;
  return GRID_BY_SIZE[mapSize][idx];
}

/**
 * Ada sayısı: küçük adalarla ~%36 kara dolduracak kadar.
 * N ≈ (cols × rows × 0.36) / 28  (+ oyuncu başına hafif artış)
 */
export function getIslandCount(mapSize: MapSize, playerCount: number): number {
  const { cols, rows } = getGridDimensions(mapSize, playerCount);
  const players = clampPlayerCount(playerCount);
  const fromArea = Math.round((cols * rows * TARGET_LAND_COVERAGE) / AVG_ISLAND_SIZE);
  return Math.max(5, fromArea + (players - 2));
}

export function getBridgeCountForDistance(minDist: number): number {
  if (minDist <= 6) return 2;
  if (minDist <= 11) return 2;
  return 1;
}

/**
 * Yerel köprü menzili — uzak diyagonal köprüleri keser.
 * d_max = clamp(8, 0.16·min(cols,rows), 14)
 */
export function getBridgeMaxDistance(cols: number, rows: number): number {
  return Math.max(8, Math.min(14, Math.floor(Math.min(cols, rows) * 0.16)));
}

/** Her adanın en fazla bu kadar en yakın komşuya köprü kurması */
export const BRIDGE_NEAREST_NEIGHBORS = 3;

/**
 * Küçük ada ölçeği (ilk versiyon: ~18–38 kare).
 * Boş alan ada sayısının artmasıyla doldurulur, ada büyütülerek değil.
 */
export function computeIslandParams(cols: number, rows: number, islandCount: number): {
  minSize: number;
  maxSize: number;
  minSeedDistance: number;
  growthChance: number;
} {
  const totalCells = cols * rows;
  const minSize = 16;
  const maxSize = 40;
  // Çok ada sığsın diye mesafe sıkı ama yapışmayacak kadar
  const minSeedDistance = Math.max(
    5,
    Math.min(8, Math.floor(Math.sqrt(totalCells / islandCount) * 0.4)),
  );
  const growthChance = 0.6 + Math.random() * 0.08;

  return { minSize, maxSize, minSeedDistance, growthChance };
}

export const BRIDGE_MAX_PAIR_DISTANCE = 18;
