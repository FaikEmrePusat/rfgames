import { describe, expect, it } from 'vitest';
import {
  assignSectionOwners,
  completeSection,
  createFoldGame,
  peekBounds,
  sectionHasInk,
  sectionYRange,
  setSectionLayer,
} from './logic.js';
import {
  createFoldGameOnline,
  filterFoldStateForMember,
  isCurrentFoldArtist,
  isValidFoldLayerDataUrl,
} from './online.js';

describe('foldDraw assignment', () => {
  it('assigns 4 sections round-robin for 2 players', () => {
    expect(assignSectionOwners(2)).toEqual([0, 1, 0, 1]);
  });

  it('assigns one section each for 4 players', () => {
    expect(assignSectionOwners(4)).toEqual([0, 1, 2, 3]);
  });
});

describe('foldDraw flow', () => {
  it('advances sections then reveals', () => {
    let g = createFoldGame({ playerNames: ['A', 'B'] });
    expect(g.currentSection).toBe(0);
    g = completeSection(g);
    expect(g.currentSection).toBe(1);
    g = completeSection(g);
    g = completeSection(g);
    g = completeSection(g);
    expect(g.phase).toBe('reveal');
  });

  it('peek sits at bottom of previous section', () => {
    const peek = peekBounds(1, 0.1);
    expect(peek).not.toBeNull();
    const prev = sectionYRange(0);
    expect(peek!.y1).toBeCloseTo(prev.y1);
    expect(peek!.y0).toBeGreaterThan(prev.y0);
  });

  it('tracks section ink layers', () => {
    let g = createFoldGame({ playerNames: ['A', 'B'] });
    expect(sectionHasInk(g)).toBe(false);
    g = setSectionLayer(g, 0, 'data:image/png;base64,xx');
    expect(sectionHasInk(g, 0)).toBe(true);
  });
});

describe('foldDraw online privacy', () => {
  const tinyPng = `data:image/png;base64,${'A'.repeat(40)}`;
  const peekSafe = `data:image/png;base64,${'B'.repeat(40)}`;

  it('creates seats with memberIds', () => {
    const g = createFoldGameOnline([
      { memberId: 'm1-aaaa', name: 'Ali' },
      { memberId: 'm2-bbbb', name: 'Ayşe' },
    ]);
    expect(g.players[0]?.memberId).toBe('m1-aaaa');
    expect(isCurrentFoldArtist(g, 'm1-aaaa')).toBe(true);
    expect(isCurrentFoldArtist(g, 'm2-bbbb')).toBe(false);
  });

  it('hides layers from waiting players and peek-only for artist', () => {
    let g = createFoldGameOnline([
      { memberId: 'm1-aaaa', name: 'Ali' },
      { memberId: 'm2-bbbb', name: 'Ayşe' },
    ]);
    g = setSectionLayer(g, 0, tinyPng);
    g = completeSection(g);
    const peekSafeLayers = [peekSafe, null, null, null];

    const waiter = filterFoldStateForMember(g, 'm1-aaaa', peekSafeLayers);
    expect(waiter.sectionLayers.every((l) => l === null)).toBe(true);

    const artist = filterFoldStateForMember(g, 'm2-bbbb', peekSafeLayers);
    expect(artist.sectionLayers[0]).toBe(peekSafe);
    expect(artist.sectionLayers[1]).toBeNull();
  });

  it('reveals full layers to everyone', () => {
    let g = createFoldGameOnline([
      { memberId: 'm1-aaaa', name: 'Ali' },
      { memberId: 'm2-bbbb', name: 'Ayşe' },
    ]);
    g = {
      ...g,
      phase: 'reveal',
      sectionLayers: [tinyPng, tinyPng, tinyPng, tinyPng],
    };
    const view = filterFoldStateForMember(g, 'm2-bbbb', [null, null, null, null]);
    expect(view.sectionLayers.filter(Boolean)).toHaveLength(4);
  });

  it('validates layer data URLs', () => {
    expect(isValidFoldLayerDataUrl(tinyPng)).toBe(true);
    expect(isValidFoldLayerDataUrl('http://evil')).toBe(false);
    expect(isValidFoldLayerDataUrl('data:image/png;base64,short')).toBe(false);
  });
});
