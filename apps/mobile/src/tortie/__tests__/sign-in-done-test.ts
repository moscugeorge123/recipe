import { doneCtaLabel } from '@/tortie/screens/sign-in';

describe('sign-in success screen', () => {
  test('a new account is not told to go "back"', () => {
    expect(doneCtaLabel(false)).toBe('Start cooking');
  });

  test('a returning user goes back to the kitchen', () => {
    expect(doneCtaLabel(true)).toBe('Back to the kitchen');
  });
});
