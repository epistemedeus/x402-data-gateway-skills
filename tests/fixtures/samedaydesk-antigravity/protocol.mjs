/**
 * Isolated synthetic protocol fixture for the Antigravity adapter.
 * This is not the official MCP SDK and not the Antigravity host.
 *
 * Audiences stay separate:
 * - Implementation/QA uses this file on loopback only. It does not call production.
 * - Operator discovery-QA uses discover() and refuses tools/call.
 * - The customer path uses customerFreeRead() for one ordinary trial_read.
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

/** Unpaid inventory only. This mode never becomes a customer call. */
export const OPERATOR_DISCOVERY_QA = 'operator-discovery-qa';

/**
 * Customer path. One ordinary free trial_read is allowed.
 * Discovery mode does not use this constant as a call.
 */
export const CUSTOMER_TASK_READY = 'customer-task-ready';

const TRIAL_CONSUMPTION = /\/trial\/(?:read|extract)(?:$|[/?#])/;

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

/**
 * Read the one history entry named by currentQualification.id.
 * Earlier entries stay in the record. A false on another entry stays false.
 * This does not contact a host and does not add a model turn.
 */
export function currentHostQualification(observed) {
  if (!observed || typeof observed !== 'object' || Array.isArray(observed)) {
    throw new ProtocolError('qualification record missing');
  }
  const pointer = observed.currentQualification;
  if (!pointer || typeof pointer !== 'object' || Array.isArray(pointer)) {
    throw new ProtocolError('current qualification id missing');
  }
  if (typeof pointer.id !== 'string' || pointer.id.length === 0) {
    throw new ProtocolError('current qualification id missing');
  }
  const history = observed.qualificationHistory;
  if (!Array.isArray(history)) throw new ProtocolError('qualification history missing');
  const matches = history.filter((entry) => entry && entry.id === pointer.id);
  if (matches.length !== 1) throw new ProtocolError('current qualification id is not one history entry');
  const entry = matches[0];
  const install = entry.install && typeof entry.install === 'object' ? entry.install : null;
  const inventory = entry.inventory && typeof entry.inventory === 'object' ? entry.inventory : null;
  return {
    id: entry.id,
    source: 'qualificationHistory',
    hostComplete: entry.hostComplete === true,
    hostLoadedAfterRename: entry.hostLoadedAfterRename === true,
    hostLoadedExchangeReceived: entry.hostLoadedExchangeReceived === true,
    agyVersion: typeof entry.agyVersion === 'string' ? entry.agyVersion : null,
    stagedDirectory: install && typeof install.stagedDirectory === 'string' ? install.stagedDirectory : null,
    serverHeading: inventory && typeof inventory.serverHeading === 'string' ? inventory.serverHeading : null,
    loaded: inventory && Number.isInteger(inventory.loaded) ? inventory.loaded : null,
    dropped: inventory && Number.isInteger(inventory.dropped) ? inventory.dropped : null,
    earlierEntriesRemain: history.filter((row) => row && row.id !== pointer.id).map((row) => row.id),
  };
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

/** Discovery mode only. An ordinary customer tools/call does not use this. */
function refuseDiscoveryCall(method) {
  if (method === 'tools/call') {
    throw new ProtocolError('discovery mode refuses tools/call before send');
  }
}

function refuseTrialTarget(target) {
  if (typeof target === 'string' && TRIAL_CONSUMPTION.test(target)) {
    throw new ProtocolError('trial consumption refused before send');
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Names a free, paid, or refusal class from one tools/list entry.
 * Accept entries and prices are dropped here. The result is not a request.
 */
export function classifyListedTool(tool) {
  const refused = (reason, name) => ({
    name,
    class: 'refusal',
    reason,
    toolsCallSent: false,
    trialPostSent: false,
    purchaseSent: false,
    priceCopied: false,
    acceptsCopied: false,
    taskSupportAuthorizesCall: false,
  });
  if (!isRecord(tool) || typeof tool.name !== 'string' || tool.name.length === 0) {
    return refused('missing-name', null);
  }
  if (!isRecord(tool.inputSchema)) {
    return refused('missing-input-schema', tool.name);
  }
  const meta = isRecord(tool._meta) ? tool._meta : null;
  const x402 = meta && isRecord(meta.x402) ? meta.x402 : null;
  const samedaydesk = meta && isRecord(meta.samedaydesk) ? meta.samedaydesk : null;
  const x402Paid = Boolean(x402 && x402.paymentRequired === true);
  const x402Other = Boolean(x402) && x402.paymentRequired !== true;
  const freePair = Boolean(
    samedaydesk
    && samedaydesk.paymentRequired === false
    && samedaydesk.charged === false,
  );
  const hasFreeKeys = Boolean(
    samedaydesk
    && (Object.prototype.hasOwnProperty.call(samedaydesk, 'paymentRequired')
      || Object.prototype.hasOwnProperty.call(samedaydesk, 'charged')),
  );
  let klass = 'refusal';
  let reason = 'unknown-payment-mark';
  if (x402Other || (hasFreeKeys && !freePair)) {
    klass = 'refusal';
    reason = 'unknown-payment-mark';
  } else if (x402Paid && freePair) {
    klass = 'refusal';
    reason = 'contradictory-marks';
  } else if (x402Paid) {
    klass = 'paid';
    reason = 'x402-payment-required';
  } else if (freePair && !x402) {
    klass = 'free';
    reason = 'samedaydesk-uncharged';
  }
  const taskSupport = isRecord(tool.execution) && typeof tool.execution.taskSupport === 'string'
    ? tool.execution.taskSupport
    : null;
  return {
    name: tool.name,
    class: klass,
    reason,
    toolsCallSent: false,
    trialPostSent: false,
    purchaseSent: false,
    priceCopied: false,
    acceptsCopied: false,
    taskSupport,
    taskSupportAuthorizesCall: false,
  };
}

export function readToolBoundary(tool, mode) {
  if (mode !== OPERATOR_DISCOVERY_QA && mode !== CUSTOMER_TASK_READY) {
    throw new ProtocolError('unknown reader mode');
  }
  const classified = classifyListedTool(tool);
  let documentedNextAction = 'stop';
  if (mode === OPERATOR_DISCOVERY_QA) {
    documentedNextAction = 'stop-after-unpaid-list';
  } else if (classified.class === 'free' && classified.name === 'trial_read') {
    documentedNextAction = 'one-ordinary-free-trial-read';
  } else if (classified.class === 'paid') {
    documentedNextAction = 'caller-authority';
  } else if (classified.class === 'free') {
    documentedNextAction = 'free-mark-is-not-a-call';
  }
  return { mode, documentedNextAction, ...classified };
}

export function readInventory(tools, mode) {
  if (!Array.isArray(tools)) throw new ProtocolError('tools/list missing tools array');
  const rows = tools.map((tool) => readToolBoundary(tool, mode));
  return {
    mode,
    toolsCallSent: false,
    trialPostSent: false,
    purchaseSent: false,
    rows,
    free: rows.filter((row) => row.class === 'free').map((row) => row.name),
    paid: rows.filter((row) => row.class === 'paid').map((row) => row.name),
    refusal: rows.filter((row) => row.class === 'refusal').map((row) => row.name),
  };
}

function assertSyntheticMcp(url) {
  refuseTrialTarget(url);
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new ProtocolError('customer fixture accepts only a synthetic local MCP');
  }
  if (parsed.protocol !== 'http:' || (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost')) {
    throw new ProtocolError('customer fixture accepts only a synthetic local MCP');
  }
}

function assertPublicPageUrl(value) {
  if (typeof value !== 'string' || value.length === 0) throw new ProtocolError('public url required');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ProtocolError('public url required');
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hostname.length === 0) {
    throw new ProtocolError('public url must be https without credentials');
  }
}

function trialReadArguments(schema, publicUrl, markdownLimitChars) {
  if (!isRecord(schema) || !isRecord(schema.properties)) throw new ProtocolError('missing-input-schema');
  const urlSchema = schema.properties.url;
  if (!isRecord(urlSchema) || urlSchema.type !== 'string') throw new ProtocolError('live schema has no url string');
  if (!Array.isArray(schema.required) || !schema.required.includes('url')) {
    throw new ProtocolError('live schema does not require url');
  }
  const min = Number.isInteger(urlSchema.minLength) ? urlSchema.minLength : 1;
  const max = Number.isInteger(urlSchema.maxLength) ? urlSchema.maxLength : null;
  if (publicUrl.length < min || (max !== null && publicUrl.length > max)) {
    throw new ProtocolError('public url outside live schema');
  }
  const args = { url: publicUrl };
  if (markdownLimitChars !== undefined) {
    const limitSchema = schema.properties.markdownLimitChars;
    if (!isRecord(limitSchema)) throw new ProtocolError('live schema has no markdownLimitChars');
    if (!Number.isInteger(markdownLimitChars)) throw new ProtocolError('markdownLimitChars outside live schema');
    if (Number.isInteger(limitSchema.minimum) && markdownLimitChars < limitSchema.minimum) {
      throw new ProtocolError('markdownLimitChars outside live schema');
    }
    if (Number.isInteger(limitSchema.maximum) && markdownLimitChars > limitSchema.maximum) {
      throw new ProtocolError('markdownLimitChars outside live schema');
    }
    args.markdownLimitChars = markdownLimitChars;
  }
  return args;
}

const ACCESS_OUTCOMES = new Set(['exhausted', 'expired', 'refused']);

function namedAccess(body, isError) {
  const errorText = typeof body.error === 'string' ? body.error.trim().toLowerCase() : '';
  const availability = typeof body.availability === 'string' ? body.availability.trim().toLowerCase() : '';
  if (ACCESS_OUTCOMES.has(availability)) return availability;
  if (ACCESS_OUTCOMES.has(errorText)) return errorText;
  if (isError) return 'refused';
  return null;
}

function judgeTrialRead(exchange) {
  if (!exchange || exchange.lost) return { outcome: 'unknown', reason: 'lost-response', structured: null };
  if (exchange.paidChallenge || exchange.httpStatus === 402) {
    return { outcome: 'caller-authority', reason: 'payment-challenge', structured: null };
  }
  const payload = exchange.payload;
  if (!payload || payload.jsonrpc !== '2.0' || payload.error || !isRecord(payload.result)) {
    return { outcome: 'unknown', reason: 'lost-response', structured: null };
  }
  const result = payload.result;
  const body = isRecord(result.structuredContent) ? result.structuredContent : null;
  if (!body) {
    return {
      outcome: result.isError === true ? 'refused' : 'unknown',
      reason: result.isError === true ? 'tool-error' : 'missing-structured-content',
      structured: null,
    };
  }
  const access = namedAccess(body, result.isError === true);
  if (access) return { outcome: access, reason: access, structured: body };
  if (body.charged !== false) return { outcome: 'unknown', reason: 'charged-not-false', structured: body };
  if (body.ok === true && body.sourceOk === true && typeof body.markdown === 'string' && body.markdown.length > 0) {
    return { outcome: 'useful', reason: 'structured-read', structured: body };
  }
  if (body.sourceOk === false) return { outcome: 'refused', reason: 'source-not-ok', structured: body };
  return { outcome: 'unknown', reason: 'unclassified-result', structured: body };
}

function customerResult(found, publicUrl, extra) {
  const sent = [...found.sent];
  if (extra.sentExtra) sent.push(extra.sentExtra);
  return {
    mode: CUSTOMER_TASK_READY,
    outcome: extra.outcome,
    reason: extra.reason ?? null,
    publicUrl,
    sent,
    toolsCallSent: extra.toolsCallSent === true,
    consumingRequests: extra.consumingRequests ?? 0,
    trialPostSent: false,
    purchaseSent: false,
    paidRequestSent: false,
    taskAugmented: false,
    retried: false,
    structured: extra.structured ?? null,
  };
}

async function postOneTrialRead(url, session, args, fetchImpl) {
  const params = { name: 'trial_read', arguments: args };
  const headers = {
    'content-type': 'application/json',
    accept: 'application/json, text/event-stream',
  };
  if (session) headers['mcp-session-id'] = session;
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      redirect: 'error',
      headers,
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/call', params }),
    });
  } catch (error) {
    return { lost: true, message: error instanceof Error ? error.message : String(error) };
  }
  let text = '';
  try {
    text = await response.text();
  } catch (error) {
    return {
      lost: true,
      httpStatus: response.status,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  if (response.status === 402) return { httpStatus: 402, paidChallenge: true };
  if (!text.trim()) return { lost: true, httpStatus: response.status, empty: true };
  try {
    return { httpStatus: response.status, payload: parseRpcBody(text) };
  } catch {
    return { lost: true, httpStatus: response.status, unreadable: true };
  }
}

/**
 * One ordinary free trial_read for a supplied public URL.
 * Discovery methods are not consuming. The tools/call is the one consuming request.
 * No task field, no second call, no paid tool, no production host.
 */
export async function customerFreeRead(mcpUrl, publicUrl, options = {}) {
  if (options.task != null) throw new ProtocolError('task augmentation refused before send');
  assertSyntheticMcp(mcpUrl);
  assertPublicPageUrl(publicUrl);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const found = await discover(mcpUrl, { fetchImpl });
  const tool = found.tools.find((item) => item && item.name === 'trial_read') ?? null;
  if (!tool) return customerResult(found, publicUrl, { outcome: 'missing', reason: 'trial_read-not-listed' });
  const boundary = readToolBoundary(tool, CUSTOMER_TASK_READY);
  if (boundary.class !== 'free') {
    return customerResult(found, publicUrl, {
      outcome: boundary.class === 'paid' ? 'caller-authority' : 'refused',
      reason: boundary.reason,
    });
  }
  if (boundary.taskSupport === 'required') {
    return customerResult(found, publicUrl, { outcome: 'refused', reason: 'task-augmentation-required' });
  }
  let args;
  try {
    args = trialReadArguments(tool.inputSchema, publicUrl, options.markdownLimitChars);
  } catch (error) {
    return customerResult(found, publicUrl, {
      outcome: 'refused',
      reason: error instanceof Error ? error.message : 'refused',
    });
  }
  const exchange = await postOneTrialRead(mcpUrl, found.session, args, fetchImpl);
  const judged = judgeTrialRead(exchange);
  return customerResult(found, publicUrl, {
    ...judged,
    toolsCallSent: true,
    consumingRequests: 1,
    sentExtra: 'tools/call',
  });
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
  refuseTrialTarget(url);
  const sent = [];
  let session = null;

  async function post(method, params, id) {
    refuseDiscoveryCall(method);
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
  refuseDiscoveryCall(method);
  refuseTrialTarget(url);
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

function readerListTools() {
  return [
    {
      name: 'trial_read',
      description: 'Fixture free trial_read. Ordinary tools/call is allowed once.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['url'],
        properties: {
          url: { type: 'string', minLength: 1, maxLength: 2048 },
          markdownLimitChars: { type: 'integer', minimum: 1, maximum: 40000 },
        },
      },
      execution: { taskSupport: 'forbidden' },
      _meta: { samedaydesk: { charged: false, paymentRequired: false } },
    },
    {
      name: 'read',
      description: 'Fixture paid read. Customer free read must not call it.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['url'],
        properties: { url: { type: 'string' } },
      },
      execution: { taskSupport: 'allowed' },
      _meta: {
        x402: {
          paymentRequired: true,
          accepts: [{ scheme: 'exact', amount: '5000', payTo: '0xfixture' }],
        },
        samedaydesk: { operation: { id: 'read', price: '5000' } },
      },
    },
    {
      name: 'page_change',
      description: 'Fixture free tool that is not the page reader.',
      inputSchema: { type: 'object', additionalProperties: false, properties: {} },
      execution: { taskSupport: 'forbidden' },
      _meta: { samedaydesk: { charged: false, paymentRequired: false } },
    },
    {
      name: 'contradictory',
      description: 'Fixture tool with both paid and free marks.',
      inputSchema: { type: 'object', properties: {} },
      _meta: {
        x402: { paymentRequired: true, accepts: [{ amount: '1', payTo: '0xother' }] },
        samedaydesk: { charged: false, paymentRequired: false },
      },
    },
  ];
}

function listedTools(mode) {
  if (mode === 'missing-schema') return [{ name: 'broken', description: 'no schema' }];
  if (mode === 'reader-list' || (typeof mode === 'string' && mode.startsWith('customer-'))) {
    let tools = readerListTools();
    if (mode === 'customer-missing') tools = tools.filter((tool) => tool.name !== 'trial_read');
    if (mode === 'customer-task-required') {
      tools = tools.map((tool) => (
        tool.name === 'trial_read' ? { ...tool, execution: { taskSupport: 'required' } } : tool
      ));
    }
    return tools;
  }
  return [
    {
      name: 'extract',
      description: 'Paid page extract. The discovery fixture must not be asked to call it.',
      inputSchema: {
        type: 'object',
        properties: { url: { type: 'string' } },
        required: ['url'],
      },
    },
  ];
}

function accessBody(error, status = null) {
  return {
    ok: false,
    sourceOk: false,
    status,
    error,
    markdown: null,
    truncated: false,
    capture: null,
    charged: false,
  };
}

function respondCustomerCall(res, mode, message, customerCalls) {
  if (mode === 'customer-lost') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end('');
    return;
  }
  if (mode === 'customer-payment') {
    res.writeHead(402, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'payment required' }));
    return;
  }
  const params = message.params && typeof message.params === 'object' ? message.params : {};
  const tasky = Object.prototype.hasOwnProperty.call(params, 'task');
  const name = params.name;
  const page = params.arguments && params.arguments.url;
  let structured;
  let isError = false;
  if (customerCalls > 1 || tasky || name !== 'trial_read') {
    structured = accessBody('refused', 403);
    isError = true;
  } else if (mode === 'customer-useful') {
    structured = {
      ok: true,
      sourceOk: true,
      status: 200,
      error: null,
      markdown: `Synthetic read of ${page}`,
      truncated: false,
      capture: { fixture: true },
      charged: false,
    };
  } else if (mode === 'customer-exhausted') {
    structured = accessBody('exhausted', 503);
  } else if (mode === 'customer-expired') {
    structured = accessBody('expired', 403);
  } else if (mode === 'customer-refused') {
    structured = accessBody('refused', 403);
    isError = true;
  } else {
    structured = accessBody('refused', 403);
    isError = true;
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(positiveResult(message.id, {
    content: [{ type: 'text', text: JSON.stringify(structured) }],
    structuredContent: structured,
    isError,
  })));
}

export function startFixture(mode) {
  const requests = [];
  const headerLog = [];
  let customerCalls = 0;
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
      headerLog.push({
        method: message && message.method,
        headers: {
          'mcp-session-id': req.headers['mcp-session-id'] ?? null,
          authorization: req.headers.authorization ?? null,
          'x-samedaydesk-agent-source': req.headers['x-samedaydesk-agent-source'] ?? null,
        },
      });
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
      if (message.method === 'tools/call' && typeof mode === 'string' && mode.startsWith('customer-')) {
        customerCalls += 1;
        respondCustomerCall(res, mode, message, customerCalls);
        return;
      }
      if (message.method === 'tools/call') {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('tools/call reached a discovery fixture');
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
        const payload = positiveResult(message.id, { tools: listedTools(mode) });
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
        headerLog,
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
