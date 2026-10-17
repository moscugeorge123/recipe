/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

import {
  PREFS_VERSION,
  migratePrefs,
  useTortiePrefs,
} from '@/tortie/prefs-store';

describe('prefs migration', () => {
  test('drops the removed diet and voice settings, keeps the rest', () => {
    const out = migratePrefs(
      { units: 'imperial', diet: { veg: true }, voice: true, snappy: true },
      0,
    ) as unknown as Record<string, unknown>;
    expect(out).toEqual({ units: 'imperial', snappy: true });
    expect('diet' in out).toBe(false);
  });

  test('a fresh store has no diet and a bumped version', () => {
    expect('diet' in useTortiePrefs.getState()).toBe(false);
    expect(PREFS_VERSION).toBeGreaterThanOrEqual(1);
  });
});

/** Keys whose consumer is tracked by another task. */
const PENDING_CONSUMER = new Set(['defaultServings']); // Q33

type Entry = { name: string; isDirectory(): boolean };

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }) as Entry[]) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__') sourceFiles(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

describe('prefs keys', () => {
  test('every setting is read somewhere outside Profile', () => {
    const src = path.resolve(process.cwd(), 'src');
    const files = sourceFiles(src).filter(
      (f) => !/(profile\.tsx|prefs-store\.ts)$/.test(f),
    );
    const text = files
      .map((f) => fs.readFileSync(f, 'utf8') as string)
      .join('\n');
    const keys = Object.keys(useTortiePrefs.getState()).filter(
      (k) => k !== 'set',
    );
    const dead = keys.filter(
      (k) => !PENDING_CONSUMER.has(k) && !new RegExp(`\\b${k}\\b`).test(text),
    );
    expect(dead).toEqual([]);
  });
});
