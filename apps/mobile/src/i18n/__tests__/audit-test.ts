import { spawnSync } from 'node:child_process';
import path from 'node:path';

describe('i18n audit', () => {
  it('has no new un-keyed strings in tortie/screens or tortie/ui', () => {
    const result = spawnSync(
      process.execPath,
      [path.join(__dirname, '../../../scripts/i18n-audit.mjs'), '--check'],
      { encoding: 'utf8' },
    );
    expect(result.stdout).not.toMatch(/un-keyed string/);
    expect(result.status).toBe(0);
  });
});
