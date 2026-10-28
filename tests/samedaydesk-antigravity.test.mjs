import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  ConfigError,
  ProtocolError,
  TransportRefusal,
  discover,
  loadAdapterConfig,
  probeUnsupported,
  readPluginState,
  stagePlugin,
  startFixture,
  treeDigest,
  uninstallPlugin,
} from './fixtures/samedaydesk-antigravity/protocol.mjs';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pluginRoot = join(repoRoot, 'plugins', 'samedaydesk-antigravity');
const ENDPOINT = 'https://agents.samedaydesk.com/mcp';

function readPlugin(name) {
  return readFileSync(join(pluginRoot, name), 'utf8');
}

test('adapter manifest is one Antigravity plugin and does not enroll root skills', () => {
  const manifest = JSON.parse(readPlugin('plugin.json'));
  assert.equal(manifest.name, 'samedaydesk-antigravity');
  assert.match(manifest.name, /^[a-zA-Z0-9_-]+$/);
  assert.equal(manifest.$schema, 'https://antigravity.google/schemas/v1/plugin.json');
  assert.equal(typeof manifest.description, 'string');
  assert.equal(manifest.skills, undefined);
  assert.equal(manifest.extensions, undefined);
  const allowed = new Set([
    '$schema', 'name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords',
  ]);
  for (const key of Object.keys(manifest)) assert.equal(allowed.has(key), true, key);
  assert.equal(manifest.author.name, 'SameDayDesk');
  assert.equal(manifest.author.email, undefined);
  assert.deepEqual(readdirSync(join(pluginRoot, 'skills')), ['samedaydesk-remote-mcp']);
  assert.equal(readdirSync(join(repoRoot, 'skills')).length, 21);
});

test('qualification record keeps the SDK probe separate from host execution', () => {
  const observed = JSON.parse(readPlugin('OBSERVED.json'));
  assert.equal(observed.directSdkProbe.separateFromAntigravityHost, true);
  assert.equal(observed.directSdkProbe.toolsCallSent, false);
  assert.equal(observed.hostLoadedExchange.received, false);
  assert.equal(observed.attribution, 'unqualified');
  assert.equal(observed.sourceHeader, null);
  assert.equal(observed.githubInstall.pinnedOneCommandUrl, false);
});

test('adapter manifest has no hooks file', () => {
  const names = readdirSync(pluginRoot);
  assert.equal(names.includes('hooks.json'), false);
  assert.equal(names.includes('.mcp.json'), false);
  assert.equal(names.includes('.claude-plugin'), false);
});

test('mcp config uses the existing endpoint and no source header', () => {
  const config = JSON.parse(readPlugin('mcp_config.json'));
  assert.deepEqual(loadAdapterConfig(config), {
    name: 'samedaydesk',
    serverUrl: ENDPOINT,
  });
  assert.equal(JSON.stringify(config).includes('X-SameDayDesk-Agent-Source'), false);
  assert.equal(JSON.stringify(config).includes('claude-code'), false);
  assert.equal(config.mcpServers.samedaydesk.headers, undefined);
  assert.equal(config.mcpServers.samedaydesk.command, undefined);
});

test('license is scoped to the adapter directory', () => {
  const license = readPlugin('LICENSE');
  assert.match(license, /plugins\/samedaydesk-antigravity\//);
  assert.match(license, /does not license/);
  assert.match(license, /no declared/);
  assert.match(license, /Copyright \(c\) 2026 SameDayDesk/);
  const readme = readPlugin('README.md');
  assert.match(readme, /does not license the rest/);
  assert.match(readme, /Do not run `agy plugin import`/);
  assert.doesNotMatch(readme, /whole repository is MIT/i);
});

test('skill states unpaid discovery, unqualified attribution, and no tool call', () => {
  const skill = readPlugin('skills/samedaydesk-remote-mcp/SKILL.md');
  assert.match(skill, /^---\nname: samedaydesk-remote-mcp\n/);
  assert.match(skill, /description: .+/);
  assert.match(skill, new RegExp(ENDPOINT.replaceAll('/', '\\/')));
  assert.match(skill, /Attribution is unqualified/);
  assert.match(skill, /Do not send `tools\/call`/);
  assert.match(skill, /Do not start either trial/);
  assert.match(skill, /_meta\.x402\.paymentRequired/);
  assert.match(skill, /A GET of `https:\/\/agents\.samedaydesk\.com\/mcp` is not `tools\/list`/);
  assert.match(skill, /claude-code-marketplace-v1/);
  assert.doesNotMatch(skill, /X-SameDayDesk-Agent-Source: claude-code-marketplace-v1/);
  assert.doesNotMatch(skill, /\b29 tools\b/);
  assert.doesNotMatch(skill, /Authorization:|Bearer |api[_-]key|PRIVATE_KEY/i);
});

test('bad config and unsupported operation never open a paid tool request', async () => {
  const fixture = await startFixture('positive');
  try {
    const cases = [
      [{ mcpServers: { samedaydesk: { httpUrl: ENDPOINT } } }, /unsupported httpUrl/],
      [{ mcpServers: { samedaydesk: { url: ENDPOINT } } }, /unsupported legacy url key/],
      [{ mcpServers: { samedaydesk: { type: 'sse', serverUrl: ENDPOINT } } }, /unsupported sse/],
      [{ mcpServers: { samedaydesk: { command: 'node', serverUrl: ENDPOINT } } }, /unsupported stdio/],
      [{ mcpServers: { samedaydesk: { serverUrl: ENDPOINT, headers: { Authorization: 'Bearer x' } } } }, /credential or header/],
      [{ mcpServers: { samedaydesk: { serverUrl: 'https://example.invalid/mcp' } } }, /existing SameDayDesk MCP endpoint/],
      [{}, /missing mcpServers/],
    ];
    for (const [config, pattern] of cases) {
      assert.throws(() => loadAdapterConfig(config), ConfigError);
      assert.throws(() => loadAdapterConfig(config), pattern);
    }
    assert.equal(fixture.requests.length, 0);
    await assert.rejects(
      () => probeUnsupported(fixture.url, 'tools/call'),
      (error) => error instanceof ProtocolError && /paid tool request refused before send/.test(error.message),
    );
    assert.equal(fixture.requests.length, 0);
    const unsupported = await probeUnsupported(fixture.url, 'prompts/list');
    assert.equal(unsupported.code, -32601);
    assert.deepEqual(fixture.requests.map((message) => message.method), ['prompts/list']);
  } finally {
    await fixture.close();
  }
});

test('positive fixture completes initialize, initialized, and tools/list', async () => {
  const fixture = await startFixture('positive');
  try {
    const found = await discover(fixture.url);
    assert.deepEqual(found.sent, ['initialize', 'notifications/initialized', 'tools/list']);
    assert.equal(found.protocolVersion, '2025-11-25');
    assert.equal(found.serverInfo.name, 'samedaydesk-fixture');
    assert.equal(found.session, 'fixture-session');
    assert.equal(found.tools.length, 1);
    assert.equal(found.tools[0].name, 'extract');
    assert.equal(found.tools[0].inputSchema.type, 'object');
    assert.deepEqual(fixture.requests.map((message) => message.method), found.sent);
    assert.equal(fixture.requests.some((message) => message.method === 'tools/call'), false);
  } finally {
    await fixture.close();
  }
});

test('transport refusal stops on the first response and does not call a tool', async () => {
  const fixture = await startFixture('transport-refusal');
  try {
    await assert.rejects(
      () => discover(fixture.url),
      (error) => error instanceof TransportRefusal && error.details.sent.length === 1,
    );
    assert.deepEqual(fixture.requests.map((message) => message.method), ['initialize']);
    assert.equal(JSON.stringify(fixture.requests).includes('tools/call'), false);
  } finally {
    await fixture.close();
  }
});

test('cleanup and reinstall preserve an unrelated plugin and config', () => {
  const home = mkdtempSync(join(tmpdir(), 'samedaydesk-antigravity-'));
  const unrelated = join(home, 'unrelated-source');
  const unrelatedPlugin = join(unrelated);
  try {
    writeFileSync(join(home, 'sentinel-config.json'), '{"marker":"preserve"}\n');
    const unrelatedRoot = join(unrelatedPlugin);
    mkdirSync(unrelatedRoot, { recursive: true });
    writeFileSync(join(unrelatedRoot, 'plugin.json'), '{"name":"unrelated-notes","description":"sentinel"}\n');
    const before = treeDigest(unrelatedRoot);
    stagePlugin(home, 'unrelated-notes', unrelatedRoot);
    const stagedUnrelated = treeDigest(join(home, '.gemini', 'antigravity-cli', 'plugins', 'unrelated-notes'));
    assert.equal(stagedUnrelated, before);
    stagePlugin(home, 'samedaydesk-antigravity', pluginRoot);
    const sourceDigest = treeDigest(pluginRoot);
    assert.equal(
      treeDigest(join(home, '.gemini', 'antigravity-cli', 'plugins', 'samedaydesk-antigravity')),
      sourceDigest,
    );
    assert.equal(readPluginState(home).plugins['samedaydesk-antigravity'].enabled, true);
    assert.equal(readPluginState(home).plugins['unrelated-notes'].enabled, true);
    uninstallPlugin(home, 'samedaydesk-antigravity');
    assert.equal(readPluginState(home).plugins['samedaydesk-antigravity'], undefined);
    assert.equal(treeDigest(join(home, '.gemini', 'antigravity-cli', 'plugins', 'unrelated-notes')), before);
    assert.equal(readFileSync(join(home, 'sentinel-config.json'), 'utf8'), '{"marker":"preserve"}\n');
    stagePlugin(home, 'samedaydesk-antigravity', pluginRoot);
    assert.equal(
      treeDigest(join(home, '.gemini', 'antigravity-cli', 'plugins', 'samedaydesk-antigravity')),
      sourceDigest,
    );
    assert.equal(treeDigest(join(home, '.gemini', 'antigravity-cli', 'plugins', 'unrelated-notes')), before);
    assert.equal(readFileSync(join(home, 'sentinel-config.json'), 'utf8'), '{"marker":"preserve"}\n');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
