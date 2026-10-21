import appJson from '../../../app.json';

describe('app.json', () => {
  test('the app is locked to the light palette until dark mode exists', () => {
    expect(appJson.expo.userInterfaceStyle).toBe('light');
  });
});
