import { readFile, rename, writeFile } from 'node:fs/promises';

export const STATE_SCHEMA = 'board-notice.state.v1';

export function emptyState() {
  return { schema: STATE_SCHEMA, journeys: {} };
}

export async function readState(file) {
  let text;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT') return { state: emptyState(), existed: false, bytes: null };
    throw error;
  }
  let state;
  try {
    state = JSON.parse(text);
  } catch {
    throw Object.assign(new Error('state_rejected'), { code: 'state_rejected' });
  }
  if (!state || state.schema !== STATE_SCHEMA || !state.journeys || typeof state.journeys !== 'object' || Array.isArray(state.journeys)) {
    throw Object.assign(new Error('state_rejected'), { code: 'state_rejected' });
  }
  return { state, existed: true, bytes: Buffer.from(text) };
}

export async function writeState(file, state) {
  const body = `${JSON.stringify(state)}\n`;
  const next = `${file}.next`;
  await writeFile(next, body, { mode: 0o600 });
  await rename(next, file);
  return Buffer.from(body);
}
