import { DETAIL_TABS } from '../detail-layout';

describe('detail tabs', () => {
  test('the second tab is called Steps, never Method', () => {
    expect(DETAIL_TABS).toEqual(['Ingredients', 'Steps']);
  });
});
