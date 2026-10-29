import { copyFileSync, readFileSync } from 'node:fs';

// Byte copy is the direct way to keep a result the caller already holds.
// It does not classify a tool error and it does not refuse a second copy.

export function directCopy(from, to) {
  const before = readFileSync(from);
  copyFileSync(from, to);
  const after = readFileSync(to);
  return {
    baseline: 'file-copy',
    bytes: after.length,
    match: before.equals(after),
    classifiesToolError: false,
    refusesOverwrite: false,
    paymentCreated: false,
  };
}
