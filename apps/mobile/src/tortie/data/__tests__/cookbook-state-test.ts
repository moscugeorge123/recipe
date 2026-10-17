import { cookbookSubtitle, showingSummary } from '@/tortie/data/cookbook-state';

describe('cookbookSubtitle', () => {
  it('singular and plural', () => {
    expect(cookbookSubtitle(0, 0)).toBe('0 recipes · 0 favourites');
    expect(cookbookSubtitle(1, 1)).toBe('1 recipe · 1 favourite');
    expect(cookbookSubtitle(3, 2)).toBe('3 recipes · 2 favourites');
  });
});

describe('showingSummary', () => {
  it('says how many are shown when filters hide recipes', () => {
    expect(showingSummary(1, 4, true)).toBe('Showing 1 of 4');
  });
  it('is hidden with no filters or nothing hidden', () => {
    expect(showingSummary(1, 4, false)).toBeNull();
    expect(showingSummary(4, 4, true)).toBeNull();
  });
});
