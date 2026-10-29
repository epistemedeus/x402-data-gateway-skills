import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { repoRoot } from '../../../lib/cli.mjs';
import { directDeliveredBody } from './direct.mjs';

const PAGE = 'https://example.com/public-page';

async function loadProtocol() {
  const href = pathToFileURL(path.join(repoRoot(), 'tests/fixtures/samedaydesk-antigravity/protocol.mjs')).href;
  return import(href);
}

function calls(requests) {
  return requests.filter((message) => message && message.method === 'tools/call').length;
}

export async function runMcpCases() {
  const protocol = await loadProtocol();
  const { customerFreeRead, discover, startFixture, ProtocolError } = protocol;

  const usefulServer = await startFixture('customer-useful');
  let first;
  let second;
  let afterFirst = 0;
  let afterSecond = 0;
  try {
    first = await customerFreeRead(usefulServer.url, PAGE);
    afterFirst = calls(usefulServer.requests);
    second = await customerFreeRead(usefulServer.url, PAGE);
    afterSecond = calls(usefulServer.requests);
  } finally {
    await usefulServer.close();
  }

  const repeat = directDeliveredBody(first);

  const missingServer = await startFixture('customer-missing');
  let missing;
  try {
    missing = await customerFreeRead(missingServer.url, PAGE);
  } finally {
    await missingServer.close();
  }

  const paidServer = await startFixture('customer-payment');
  let paid;
  try {
    paid = await customerFreeRead(paidServer.url, PAGE);
  } finally {
    await paidServer.close();
  }

  const taskServer = await startFixture('customer-useful');
  let taskRefusal = null;
  let taskRequests = 0;
  try {
    await customerFreeRead(taskServer.url, PAGE, { task: 'do-not-send' });
  } catch (error) {
    taskRefusal = error;
    taskRequests = calls(taskServer.requests);
  } finally {
    await taskServer.close();
  }

  const lostServer = await startFixture('customer-lost');
  let lost;
  try {
    lost = await customerFreeRead(lostServer.url, PAGE);
  } finally {
    await lostServer.close();
  }
  const frozenLost = structuredClone(lost);

  const again = await startFixture('customer-useful');
  let reread;
  try {
    reread = await customerFreeRead(again.url, PAGE);
  } finally {
    await again.close();
  }

  const discovery = await startFixture('reader-list');
  let discovered;
  try {
    discovered = await discover(discovery.url);
  } finally {
    await discovery.close();
  }

  return {
    page: PAGE,
    first,
    second,
    afterFirst,
    afterSecond,
    repeat,
    missing,
    missingCalls: calls(missingServer.requests),
    paid,
    taskRefusal,
    taskIsProtocolError: taskRefusal instanceof ProtocolError,
    taskRequests,
    lost,
    frozenLost,
    reread,
    discoveredSent: discovered.sent,
    discoveryCalls: calls(discovery.requests),
  };
}
