/**
 * Isolated synthetic protocol fixture for the Antigravity adapter.
 * This is not the official MCP SDK and not the Antigravity host.
 */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

export const DISCOVERY_METHODS = Object.freeze([
  'initialize',
  'notifications/initialized',
  'tools/list',
]);

/**
 * Directory this fixture uses when it stages a plugin.
 * This is not the path agy 1.4.8 wrote. That observed path is
 * OBSERVED_AGY_148_PLUGIN_STAGE_REL.
 */
export const SYNTHETIC_PLUGIN_STAGE_REL = '.gemini/antigravity-cli/plugins';

/** Staged plugin root recorded for agy 1.4.8. The fixture never writes this path. */
export const OBSERVED_AGY_148_PLUGIN_STAGE_REL = '.gemini/config/plugins';

export const HOST_NAME_MAX = 64;
export const HOST_NAME_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function agyHostPrefix(pluginName, serverName) {
  if (typeof pluginName !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(pluginName)) {
    throw new ConfigError('plugin name is not a host name component');
  }
  if (typeof serverName !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(serverName)) {
    throw new ConfigError('server name is not a host name component');
  }
  return `mcp_${pluginName}_${serverName}_`;
}

export function agyHostToolName(pluginName, serverName, toolId) {
  if (typeof toolId !== 'string' || toolId.length === 0) {
    throw new ConfigError('tool id missing');
  }
  return `${agyHostPrefix(pluginName, serverName)}${toolId}`;
}

export function agyHostNameFits(pluginName, serverName, toolId) {
  return HOST_NAME_PATTERN.test(agyHostToolName(pluginName, serverName, toolId));
}

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

export class TransportRefusal extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'TransportRefusal';
    this.details = details;
  }
}

export class ProtocolError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'ProtocolError';
    this.details = details;
  }
}

const SERVER_FIELDS = new Set(['serverUrl']);

export function loadAdapterConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new ConfigError('config must be an object');
  }
  const extraRoot = Object.keys(config).filter((key) => key !== 'mcpServers');
  if (extraRoot.length > 0) throw new ConfigError(`unsupported config field ${extraRoot.join(',')}`);
  const servers = config.mcpServers;
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
    throw new ConfigError('missing mcpServers');
  }
  const entries = Object.entries(servers);
  if (entries.length !== 1) throw new ConfigError('expected exactly one server');
  const [name, server] = entries[0];
  if (!name || typeof name !== 'string') throw new ConfigError('server name missing');
  if (!server || typeof server !== 'object' || Array.isArray(server)) {
    throw new ConfigError('server entry must be an object');
  }
  if (server.httpUrl) throw new ConfigError('unsupported httpUrl');
  if (server.type === 'sse' || server.transport === 'sse') throw new ConfigError('unsupported sse');
  if (server.command || server.args || server.env || server.cwd) {
    throw new ConfigError('unsupported stdio server');
  }
  if (server.oauth || server.authProviderType || server.headers) {
    throw new ConfigError('unsupported credential or header field');
  }
  if (server.url && !server.serverUrl) throw new ConfigError('unsupported legacy url key');
  const extra = Object.keys(server).filter((key) => !SERVER_FIELDS.has(key));
  if (extra.length > 0) throw new ConfigError(`unsupported server field ${extra.join(',')}`);
  if (typeof server.serverUrl !== 'string' || server.serverUrl !== 'https://agents.samedaydesk.com/mcp') {
    throw new ConfigError('serverUrl must be the existing SameDayDesk MCP endpoint');
  }
  return { name, serverUrl: server.serverUrl };
}

function refusePaid(method) {
  if (method === 'tools/call') {
    throw new ProtocolError('paid tool request refused before send');
  }
}

function parseRpcBody(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const messages = [];
  for (const line of trimmed.split(/\r?\n/)) {
    if (line.startsWith('data:')) {
      const data = line.slice(5).trim();
      if (data && data !== '[DONE]') messages.push(JSON.parse(data));
    }
  }
  if (messages.length === 0) throw new ProtocolError('unreadable protocol body');
  return messages[messages.length - 1];
}

export async function discover(url, { fetchImpl = globalThis.fetch } = {}) {
  const sent = [];
  let session = null;

  async function post(method, params, id) {
    refusePaid(method);
    if (!DISCOVERY_METHODS.includes(method)) {
      throw new ProtocolError(`method not in discovery set: ${method}`, { sent: [...sent] });
    }
    sent.push(method);
    const body = { jsonrpc: '2.0', method };
    if (params !== undefined) body.params = params;
    if (id !== undefined) body.id = id;
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    };
    if (session) headers['mcp-session-id'] = session;
    let response;
    try {
      response = await fetchImpl(url, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch (error) {
      throw new TransportRefusal(error instanceof Error ? error.message : String(error), { sent: [...sent] });
    }
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      throw new TransportRefusal(`HTTP ${response.status}`, { sent: [...sent] });
    }
    const headerSession = response.headers.get('mcp-session-id');
    if (headerSession) session = headerSession;
    const text = await response.text();
    if (method === 'notifications/initialized') {
      if (response.status >= 400) {
        throw new ProtocolError('initialized notification rejected', { status: response.status, sent: [...sent] });
      }
      return null;
    }
    if (response.status >= 400) {
      throw new TransportRefusal(`HTTP ${response.status}`, { sent: [...sent] });
    }
    let payload;
    try {
      payload = parseRpcBody(text);
    } catch (error) {
      throw new ProtocolError(error instanceof Error ? error.message : 'unreadable protocol body', { sent: [...sent] });
    }
    if (!payload || payload.jsonrpc !== '2.0') throw new ProtocolError('missing jsonrpc envelope', { sent: [...sent] });
    if (payload.error) {
      const message = payload.error.message || 'rpc error';
      throw new ProtocolError(message, { code: payload.error.code, sent: [...sent] });
    }
    return payload.result;
  }

  const initialized = await post('initialize', {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'samedaydesk-antigravity-fixture', version: '0.1.0' },
  }, 1);
  if (!initialized || typeof initialized.protocolVersion !== 'string' || initialized.protocolVersion.length === 0) {
    throw new ProtocolError('initialize missing protocolVersion', { sent: [...sent] });
  }
  await post('notifications/initialized');
  const listed = await post('tools/list', {}, 2);
  if (!listed || !Array.isArray(listed.tools)) {
    throw new ProtocolError('tools/list missing tools array', { sent: [...sent] });
  }
  for (const tool of listed.tools) {
    if (!tool || typeof tool.name !== 'string' || tool.name.length === 0) {
      throw new ProtocolError('tool missing name', { sent: [...sent] });
    }
    if (!tool.inputSchema || typeof tool.inputSchema !== 'object' || Array.isArray(tool.inputSchema)) {
      throw new ProtocolError(`tool missing inputSchema: ${tool.name}`, { sent: [...sent] });
    }
  }
  return {
    sent,
    protocolVersion: initialized.protocolVersion,
    serverInfo: initialized.serverInfo ?? null,
    tools: listed.tools,
    session,
  };
}

export async function probeUnsupported(url, method, { fetchImpl = globalThis.fetch } = {}) {
  refusePaid(method);
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 9, method, params: {} }),
  });
  const payload = parseRpcBody(await response.text());
  if (!payload?.error) throw new ProtocolError('unsupported method did not return an error');
  return payload.error;
}

function positiveResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

export function startFixture(mode) {
  const requests = [];
  const server = createServer((req, res) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let message = null;
      try {
        message = raw ? JSON.parse(raw) : null;
      } catch {
        message = { parseError: true, raw };
      }
      requests.push(message);
      if (mode === 'transport-refusal') {
        res.writeHead(503, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'refused' }));
        return;
      }
      if (!message || message.parseError) {
        res.writeHead(400, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }));
        return;
      }
      if (message.method === 'tools/call') {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('paid tool request reached the fixture');
        return;
      }
      if (message.method === 'notifications/initialized') {
        res.writeHead(202);
        res.end();
        return;
      }
      if (message.method === 'initialize') {
        res.writeHead(200, {
          'content-type': 'application/json',
          'mcp-session-id': 'fixture-session',
        });
        res.end(JSON.stringify(positiveResult(message.id, {
          protocolVersion: '2025-11-25',
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'samedaydesk-fixture', version: '0' },
        })));
        return;
      }
      if (message.method === 'tools/list') {
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        const payload = positiveResult(message.id, {
          tools: [
            {
              name: 'extract',
              description: 'Paid page extract. The fixture must not be asked to call it.',
              inputSchema: {
                type: 'object',
                properties: { url: { type: 'string' } },
                required: ['url'],
              },
            },
          ],
        });
        res.end(`event: message\ndata: ${JSON.stringify(payload)}\n\n`);
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: { code: -32601, message: `method not found: ${message.method}` },
      }));
    });
  });

  return new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolveListen({
        url: `http://127.0.0.1:${address.port}/mcp`,
        requests,
        close() {
          return new Promise((resolveClose, rejectClose) => {
            server.close((error) => (error ? rejectClose(error) : resolveClose()));
          });
        },
      });
    });
  });
}

function contained(root, target) {
  const base = resolve(root);
  const full = resolve(target);
  return full === base || full.startsWith(base + sep);
}

function walkFiles(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walkFiles(full));
    else if (stat.isFile()) files.push(full);
  }
  return files.sort();
}

export function treeDigest(dir) {
  const hash = createHash('sha256');
  if (!existsSync(dir)) return null;
  for (const file of walkFiles(dir)) {
    hash.update(relative(dir, file).split(sep).join('/'));
    hash.update('\0');
    hash.update(readFileSync(file));
    hash.update('\0');
  }
  return hash.digest('hex');
}

export function stagePlugin(home, name, sourceDir) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new ConfigError('plugin name rejected');
  const pluginsRoot = join(home, ...SYNTHETIC_PLUGIN_STAGE_REL.split('/'));
  const dest = join(pluginsRoot, name);
  if (!contained(pluginsRoot, dest)) throw new ConfigError('plugin path escaped the config root');
  if (existsSync(join(sourceDir, 'hooks.json'))) throw new ConfigError('hooks are not part of this adapter');
  mkdirSync(pluginsRoot, { recursive: true });
  cpSync(sourceDir, dest, { recursive: true, dereference: true });
  const statePath = join(home, '.gemini', 'antigravity-cli', 'plugin-state.json');
  const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : { plugins: {} };
  state.plugins ??= {};
  state.plugins[name] = { enabled: true, source: 'local-directory' };
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return dest;
}

export function uninstallPlugin(home, name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new ConfigError('plugin name rejected');
  const pluginsRoot = join(home, ...SYNTHETIC_PLUGIN_STAGE_REL.split('/'));
  const dest = join(pluginsRoot, name);
  if (!contained(pluginsRoot, dest)) throw new ConfigError('plugin path escaped the config root');
  rmSync(dest, { recursive: true, force: true });
  const statePath = join(home, '.gemini', 'antigravity-cli', 'plugin-state.json');
  if (!existsSync(statePath)) return;
  const state = JSON.parse(readFileSync(statePath, 'utf8'));
  if (state.plugins) delete state.plugins[name];
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

export function readPluginState(home) {
  const statePath = join(home, '.gemini', 'antigravity-cli', 'plugin-state.json');
  if (!existsSync(statePath)) return { plugins: {} };
  return JSON.parse(readFileSync(statePath, 'utf8'));
}
