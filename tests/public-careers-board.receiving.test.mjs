import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdtemp, rm, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = fileURLToPath(new URL('../skills/public-careers-board/', import.meta.url));
for (const target of ['seed', 'references/pins.json', 'recipe/boards.mjs']) {
  test(`installed client exits without a writer for FIFO ${target}`, async () => {
    const dir = await mkdtemp(join(tmpdir(), 'root-careers-fifo-'));
    try {
      const dest = join(dir, 'public-careers-board');
      await cp(source, dest, { recursive: true });
      const fifo = target === 'seed' ? join(dir, 'seed') : join(dest, target);
      if (target !== 'seed') await unlink(fifo);
      execFileSync('mkfifo', [fifo], { timeout: 1000 });
      const args = [join(dest, 'scripts/cli.mjs'), 'run', '--board', 'liveramp', '--timeout-ms', '100'];
      if (target === 'seed') args.push('--seed', fifo);
      const result = spawnSync(process.execPath, args, {
        cwd: dest, timeout: 1000, encoding: 'utf8',
        env: { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' },
      });
      assert.equal(result.error, undefined, result.error?.message);
      assert.equal(result.signal, null, result.signal || result.stderr);
      assert.equal(result.status, 2, result.stdout);
      const body = JSON.parse(result.stdout);
      assert.equal(body.reason, target === 'seed' ? 'seed_rejected' : 'tampered_source');
      assert.equal(body.rows, null);
      assert.equal(body.paymentSent, false);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
}
