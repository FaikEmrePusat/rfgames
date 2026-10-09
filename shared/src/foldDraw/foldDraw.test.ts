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
