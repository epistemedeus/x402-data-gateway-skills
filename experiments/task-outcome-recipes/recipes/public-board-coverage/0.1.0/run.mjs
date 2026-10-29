import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, runNode } from '../../../lib/cli.mjs';
import { directBoardRead } from './direct.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(here, 'fixtures', name);

function titlesOf(body) {
  return (body?.rows ?? []).map((row) => row.title);
}

function observe(board, seedName, extra = []) {
  const seed = fixture(seedName);
  const root = repoRoot();
  const script = path.join(root, 'skills/public-careers-board/scripts/cli.mjs');
  const ran = runNode(script, ['run', '--board', board, '--seed', seed, '--timeout-ms', '4000', ...extra], { cwd: root });
  const held = JSON.parse(readFileSync(seed, 'utf8'));
  return { ran, direct: directBoardRead(held), titles: titlesOf(ran.body) };
}

export function runBoardCases() {
  const first = observe('acxiom', 'first-use.json');
  const same = observe('acxiom', 'repeat-no-change.json');
  const changed = observe('acxiom', 'repeat-changed.json');
  const partial = observe('acxiom', 'partial.json');
  const root = repoRoot();
  const script = path.join(root, 'skills/public-careers-board/scripts/cli.mjs');
  const pay = runNode(script, ['run', '--pay'], { cwd: root });
  const unknown = runNode(script, ['run', '--board', 'notion', '--timeout-ms', '4000'], { cwd: root });
  const wrong = runNode(script, ['run', '--board', 'liveramp', '--source', 'workday', '--timeout-ms', '4000'], { cwd: root });
  const failed = observe('liveramp', 'recovery-failure.json');
  const recovered = observe('liveramp', 'recovery-complete.json');
  return { first, same, changed, partial, pay, unknown, wrong, failed, recovered };
}
