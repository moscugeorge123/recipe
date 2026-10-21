import { resolveApiUrl } from '@/constants/env';

const EMU = 'http://10.0.2.2:3000/api/v1';

describe('resolveApiUrl', () => {
  test('swaps an emulator or loopback host for the Metro host in development', () => {
    expect(resolveApiUrl(EMU, '192.168.1.20:8081', true)).toBe(
      'http://192.168.1.20:3000/api/v1',
    );
    expect(
      resolveApiUrl('http://localhost:3000/api/v1', '192.168.1.20:8081', true),
    ).toBe('http://192.168.1.20:3000/api/v1');
  });

  test('keeps the URL when Metro is also on localhost', () => {
    expect(resolveApiUrl(EMU, 'localhost:8081', true)).toBe(EMU);
  });

  test('keeps an explicit host and anything outside development', () => {
    const lan = 'http://192.168.5.5:3000/api/v1';
    expect(resolveApiUrl(lan, '192.168.1.20:8081', true)).toBe(lan);
    expect(resolveApiUrl(EMU, '192.168.1.20:8081', false)).toBe(EMU);
    expect(resolveApiUrl(EMU, undefined, true)).toBe(EMU);
  });
});
