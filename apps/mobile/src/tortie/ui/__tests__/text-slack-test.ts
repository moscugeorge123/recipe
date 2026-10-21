import { F } from '@/tortie/theme';
import { serifSlack } from '@/tortie/ui/text-slack';

describe('serifSlack', () => {
  it('adds symmetric slack to Newsreader text', () => {
    const r = serifSlack({ fontFamily: F.serif500, fontSize: 26 });
    expect(r).toEqual({ paddingLeft: 3, paddingRight: 3 });
  });
  it('grows with negative tracking', () => {
    const r = serifSlack([
      { fontFamily: F.serif500, fontSize: 34, letterSpacing: -0.68 },
    ]);
    expect(r!.paddingLeft).toBeGreaterThan(3);
  });
  it('ignores sans, explicit padding and missing styles', () => {
    expect(serifSlack({ fontFamily: F.sans500, fontSize: 20 })).toBeNull();
    expect(
      serifSlack({ fontFamily: F.serif500, fontSize: 20, paddingLeft: 4 }),
    ).toBeNull();
    expect(serifSlack(undefined)).toBeNull();
  });
});
