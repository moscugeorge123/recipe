// The app has no Node typings; this test only needs to read source files.
declare const require: (id: string) => {
  readFileSync: (path: string, enc: 'utf8') => string;
  join: (...parts: string[]) => string;
};
declare const __dirname: string;

/** Design-mock captions must not reach the UI (Q11). */
const FILES = ['recipe-detail.tsx', 'editor.tsx', 'recipe-notes.tsx'];

describe('placeholder captions', () => {
  test.each(FILES)('%s has no mock "photo · " / "link · " captions', (file) => {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const src = readFileSync(join(__dirname, '..', file), 'utf8');
    expect(src).not.toMatch(/['"`]photo · /);
    expect(src).not.toMatch(/['"`]link · /);
    expect(src).not.toMatch(/\bcaption=/);
  });
});
