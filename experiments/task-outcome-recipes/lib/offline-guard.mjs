// Refuse every fetch that is not the local MCP fixture. Import this before use.
const original = globalThis.fetch;
globalThis.fetch = async function guardedFetch(input, init) {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url;
  let hostname = '';
  try {
    hostname = new URL(href).hostname;
  } catch {
    throw Object.assign(new Error('network_refused'), { code: 'network_refused' });
  }
  if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== '[::1]') {
    throw Object.assign(new Error(`network_refused ${hostname}`), { code: 'network_refused' });
  }
  return original(input, init);
};
