import { RF0, useCookbook } from '@/tortie/data/cookbook';

describe('useCookbook.resetBrowse', () => {
  it('clears the search and the quick chip but keeps sort and refine', () => {
    useCookbook.setState({
      q: 'avocado',
      filter: 'veg',
      rf: { ...RF0, sort: 'az' },
    });
    useCookbook.getState().resetBrowse();
    const s = useCookbook.getState();
    expect(s.q).toBe('');
    expect(s.filter).toBe('all');
    expect(s.rf.sort).toBe('az');
  });
});
