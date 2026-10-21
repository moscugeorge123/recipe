/// <reference types="node" />
import fs from 'fs';
import path from 'path';

import iconNames from '../../../../assets/fonts/icon-names.json';

const SRC = path.resolve(__dirname, '../../..');
const known = new Set<string>(iconNames);

function files(dir: string, out: string[] = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const LITERAL = /['"`]([a-z][a-z0-9_]*)['"`]/g;

/** Literal icon names in `<Icon|Glyph name=…>`, `icon: '…'`, `icon=…`, `icons={[…]}`, `*_ICONS = […]`. */
function iconLiterals(text: string) {
  const found: string[] = [];
  const grab = (chunk: string) => {
    for (const m of chunk.matchAll(LITERAL)) found.push(m[1]!);
  };
  for (const m of text.matchAll(
    /<(?:Icon|Glyph)\b[^>]*?\bname=("[^"]*"|\{[^}]*\})/gs,
  ))
    grab(m[1]!);
  for (const m of text.matchAll(
    /\bicon(?:Name)?=(?:("[^"]*")|\{([^}]*)\})|\bicon:\s*('[^']*'|"[^"]*")/g,
  ))
    grab(m[1] ?? m[2] ?? m[3] ?? '');
  for (const m of text.matchAll(/\bicons=\{\[([^\]]*)\]/g)) grab(m[1]!);
  for (const m of text.matchAll(/\b[A-Z_]*ICONS\b[^=]*=\s*\[([^\]]*)\]/g))
    grab(m[1]!);
  return found;
}

describe('icon names', () => {
  it('every literal icon name exists in the bundled font subsets', () => {
    const missing: string[] = [];
    for (const f of files(SRC)) {
      for (const name of iconLiterals(fs.readFileSync(f, 'utf8'))) {
        if (!known.has(name)) missing.push(`${path.relative(SRC, f)}: ${name}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('detects an unknown name', () => {
    expect(iconLiterals('<Glyph name="not_a_real_icon" size={4} />')).toEqual([
      'not_a_real_icon',
    ]);
    expect(known.has('not_a_real_icon')).toBe(false);
  });

  it('includes the previously missing names', () => {
    for (const n of ['tour', 'download', 'cloud_download', 'restaurant'])
      expect(known.has(n)).toBe(true);
  });
});
