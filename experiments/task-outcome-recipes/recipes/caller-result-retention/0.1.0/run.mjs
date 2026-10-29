import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repoRoot, runNode } from '../../../lib/cli.mjs';
import { directCopy } from './direct.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = (name) => path.join(here, 'fixtures', name);

function retain(result, out) {
  const root = repoRoot();
  const script = path.join(root, 'skills/samedaydesk-task-result/scripts/task-result.mjs');
  return runNode(script, ['retain', '--result', result, '--out', out], { cwd: root });
}

export function runRetentionCases() {
  const dir = mkdtempSync(path.join(tmpdir(), 'h64006-retain-'));
  try {
    const firstOut = path.join(dir, 'first.json');
    const firstCopy = path.join(dir, 'first-direct.json');
    const first = retain(fixture('first-use.json'), firstOut);
    const directFirst = directCopy(fixture('first-use.json'), firstCopy);
    const repeatOut = path.join(dir, 'second.json');
    const repeat = retain(fixture('repeat.json'), repeatOut);
    const firstBytes = readFileSync(firstOut);
    const refusalOut = path.join(dir, 'refusal.json');
    const toolError = retain(fixture('tool-error.json'), refusalOut);
    const root = repoRoot();
    const script = path.join(root, 'skills/samedaydesk-task-result/scripts/task-result.mjs');
    const pay = runNode(script, ['retain', '--pay', '--result', fixture('first-use.json'), '--out', path.join(dir, 'pay.json')], { cwd: root });
    const overwrite = retain(fixture('repeat.json'), firstOut);
    const missing = retain(path.join(dir, 'absent.json'), path.join(dir, 'missing-out.json'));
    const recover = runNode(script, [
      'recover',
      '--caller', path.join(dir, 'no-caller'),
      '--action', 'resume',
      '--checkpoint', path.join(dir, 'checkpoint.json'),
      '--grant', path.join(dir, 'grant.json'),
    ], { cwd: root });
    return {
      first,
      directFirst,
      repeat,
      firstBytes,
      firstStill: readFileSync(firstOut),
      repeatBytes: readFileSync(repeatOut),
      toolError,
      toolErrorBytes: readFileSync(refusalOut),
      pay,
      overwrite,
      missing,
      recover,
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
